// Motor de correcciones de recetas marcadas «Corregir» (Reportar problema), todos los aspectos salvo la foto
// (la foto la hace corregir-marcadas.mjs). NUNCA aprueba: lo corregido vuelve a «Por revisar» para la revisión final de Carlos.
//   ingredientes → reenlaza solo los enlaces dudosos (mismas reglas que la reconstrucción segura) y recalcula macros
//   pasos / textos / titulo → DeepSeek redacta con la nota de Carlos y un validador (ingredientes, cantidades, vocabulario)
//   gramos / raciones_kcal / otro → DeepSeek convierte la nota en cambios concretos; sin cifras explícitas en la nota no toca nada
// Cada cambio guarda lo anterior en recetas_auditoria (evento correccion_motor) y se revierte si el quality gate sale peor.
// Lo que el motor no puede hacer con seguridad queda marcado «Corregir» con el motivo en las notas (lo atiende Claude: «pasa las correcciones»).
//   npx tsx scripts/corregir-marcadas-motor.ts                 → simula
//   npx tsx scripts/corregir-marcadas-motor.ts --aplica [--limite=10] [--id=<prefijo>]
//   npx tsx scripts/corregir-marcadas-motor.ts --auto [--aplica] [--limite=8]   → fichas en revisión SIN marcar: enlaces a la BD + cantidades estimadas + alérgenos (una vez por ficha, anota «Motor auto»)
import { readFileSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { join } from 'node:path'
import { createClient } from '@supabase/supabase-js'
import { auditarRecetaProfesional } from '../lib/recetas/auditoria'
import { recalcularMacrosReceta } from '../lib/recetas/elaboraciones-db'
import { camposAlCambiarTipo, clasificarFicha, familiaElaboracion } from '../lib/recetas/clasificacion'
import { validarCantidadesSospechosas } from '../lib/recetas/profesional'
import { extraerJsonPlan } from '../lib/entrenos/evidencia-plan'
import { aliasAlimento, calidadVinculo, raicesBusqueda, type CalidadVinculo } from '../lib/recetas/reconstruccion-segura'

for (const l of readFileSync(join(__dirname, '..', '.env.local'), 'utf8').split('\n')) {
  const m = l.match(/^([A-Z0-9_]+)=(.*)$/)
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^['"]|['"]$/g, '')
}
const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } })
const arg = (n: string) => process.argv.find(a => a.startsWith(`--${n}=`))?.split('=').slice(1).join('=')
const APLICA = process.argv.includes('--aplica')
const LIMITE = Number(arg('limite') ?? 10)
const SOLO = arg('id')
const PARTE = arg('parte')?.split('/').map(Number) // --parte=k/n: reparte la cola entre procesos en paralelo (k de 0 a n-1)
const AUTO = process.argv.includes('--auto') // fichas en revisión sin marcar «Corregir»: saneado automático
const REINTENTAR = process.argv.includes('--reintentar') // vuelve a probar también los aspectos que el motor dejó con ✗
const hoy = () => new Date().toLocaleDateString('es-ES')

type Ing = { id: string; nombre_libre: string | null; cantidad_gramos: number | null; cantidad_original?: number | null; alimento_id: string | null; elaboracion_id: string | null; es_opcional: boolean | null; alimentos: { id: string; nombre: string } | { id: string; nombre: string }[] | null }
type Receta = { id: string; nombre: string; tipo_contenido: string | null; familia: string | null; categoria: string | null; tipo_receta: string | null; tipo_plato: string | null; kcal: number | null; proteinas: number | null; tags: string[] | null; notas_coach: string | null; porciones: number | null; instrucciones: string | null; descripcion: string | null; consejos: string | null; url_origen?: string | null; raw_scrape?: { texto?: string } | null; receta_ingredientes: Ing[] }
type Resultado = { ok: true; detalle: string } | { ok: false; motivo: string }
const nombreAlimento = (i: Ing) => (Array.isArray(i.alimentos) ? i.alimentos[0]?.nombre : i.alimentos?.nombre) ?? null

// ── Notas: qué se marcó y qué ha hecho ya el motor ─────────────────────────────────────────────
function leerNotas(notas: string | null) {
  const lineas = (notas ?? '').split('\n')
  const i = lineas.map(l => l.includes('A corregir:')).lastIndexOf(true)
  if (i < 0) return null
  const [lista, ...resto] = (lineas[i].split('A corregir:')[1] ?? '').split('—')
  const aspectos = lista.split(',').map(s => s.trim()).filter(Boolean)
  const despues = lineas.slice(i + 1).join('\n')
  const hecho = (a: string) => new RegExp(`Motor [${REINTENTAR ? '✓' : '✓✗'}] ${a}\\b`).test(despues) || (a === 'foto' && despues.includes('foto regenerada'))
  return { aspectos, nota: resto.join('—').trim(), pendientes: aspectos.filter(a => !hecho(a)) }
}

// ── DeepSeek ───────────────────────────────────────────────────────────────────────────────────
async function deepseek(prompt: string): Promise<any | null> {
  for (let intento = 0; intento < 2; intento++) {
    try {
      const r = await fetch('https://api.deepseek.com/v1/chat/completions', {
        method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${process.env.DEEPSEEK_API_KEY}` },
        body: JSON.stringify({ model: process.env.DEEPSEEK_MODEL || 'deepseek-chat', temperature: 0.2, max_tokens: 1500, response_format: { type: 'json_object' }, messages: [{ role: 'system', content: 'Eres un dietista-cocinero español. Respondes SOLO con JSON válido.' }, { role: 'user', content: prompt }] }),
        signal: AbortSignal.timeout(90000),
      })
      if (!r.ok) continue
      return JSON.parse((await r.json()).choices?.[0]?.message?.content ?? '')
    } catch { /* reintenta una vez */ }
  }
  return null
}

const norm = (s: string) => (s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9 %.,]/g, ' ').replace(/\s+/g, ' ').trim()
const STOP = new Set('de del la el en con sin para y o al los las un una natural light fresco fresca picado picada troceado rallado molido entero cocido crudo opcional polvo'.split(' '))
const claves = (s: string) => norm(s).split(' ').filter(w => w.length > 3 && !STOP.has(w)).map(w => w.replace(/(es|s)$/, ''))
const PROHIBIDAS = /v[ií]spera|carrera|recuperaci[oó]n|marat[oó]n|competici|\b(the|and|with|until|minutes)\b/

// ── Quality gate: contar bloqueantes antes/después para poder revertir ─────────────────────────
async function bloqueantes(id: string): Promise<string[]> {
  const a = await auditarRecetaProfesional(db as any, id, 'correccion_motor', 'motor_correcciones')
  return a.score.bloqueantes
}
const nuevosBloqueantes = (antes: string[], despues: string[]) => despues.filter(b => !antes.includes(b))

// ── Ingredientes: reenlazar solo lo dudoso ─────────────────────────────────────────────────────
type Al = { id: string; nombre: string; es_generico: boolean | null }
const rango: Record<CalidadVinculo, number> = { exacta: 3, buena: 2, dudosa: 1, sin: 0 }
async function buscarMejor(nombre: string): Promise<{ al: Al; calidad: CalidadVinculo } | null> {
  const alias = aliasAlimento(nombre.split(/\s+o\s+/)[0]) // equivalencias revisadas a mano: mandan sobre la búsqueda por palabras
  if (alias) {
    const { data: a } = await db.from('alimentos').select('id, nombre, es_generico').eq('nombre', alias).eq('es_comestible', true).limit(1)
    if (a?.[0]) return { al: a[0] as Al, calidad: 'buena' }
  }
  const raices = raicesBusqueda(nombre)
  if (raices.length === 0) return null
  const vistos = new Map<string, Al>()
  const principal = nombre.split(/\s+o\s+/)[0].trim()
  const { data: exactos } = await db.from('alimentos').select('id, nombre, es_generico').ilike('nombre', principal).eq('es_comestible', true).limit(10)
  for (const a of (exactos ?? []) as Al[]) vistos.set(a.id, a)
  for (const t of raices) {
    const { data: gen } = await db.from('alimentos').select('id, nombre, es_generico').ilike('nombre', t).eq('es_comestible', true).limit(10)
    for (const a of (gen ?? []) as Al[]) vistos.set(a.id, a)
    const { data } = await db.from('alimentos').select('id, nombre, es_generico').ilike('nombre', `%${t}%`).eq('es_comestible', true).limit(80)
    for (const a of (data ?? []) as Al[]) vistos.set(a.id, a)
  }
  return [...vistos.values()].map(al => ({ al, calidad: calidadVinculo(nombre, al.nombre) }))
    .filter(x => x.calidad === 'exacta' || x.calidad === 'buena')
    .sort((a, b) => rango[b.calidad] - rango[a.calidad] || Number(!!b.al.es_generico) - Number(!!a.al.es_generico) || a.al.nombre.length - b.al.nombre.length)[0] ?? null
}

// IA como segunda opinión sobre TODOS los enlaces (no solo los que las reglas ven dudosos): «nata 35 %» → «Castañas heladas de nata» pasa las reglas por compartir «nata»
async function revisarEnlacesConIA(filas: Ing[]): Promise<{ fila: Ing; generico: string }[]> {
  const con = filas.filter(i => nombreAlimento(i))
  if (con.length === 0) return []
  const out = await deepseek(`Revisa si cada ALIMENTO enlazado es el mismo producto que el INGREDIENTE de una receta, a efectos nutricionales. Otra forma, corte o preparación del mismo alimento VALE. NO vale: otro alimento distinto, un postre o producto elaborado en vez del ingrediente base, ni un PRODUCTO DE MARCA o variedad concreta (galletas, sabores, rellenos, «Chips Ahoy», «con arándanos») cuando el ingrediente es genérico: ante la duda, el genérico es lo correcto («vino de cocina» = vino blanco, no vinagre).
${con.map((i, n) => `${n + 1}. INGREDIENTE: ${i.nombre_libre} | ALIMENTO: ${nombreAlimento(i)}`).join('\n')}
Para los que NO valen, da el nombre del alimento genérico correcto (español, singular, sin marca, p. ej. «Nata para montar», «Harina de sorgo»).
Devuelve JSON: {"incorrectos":[{"n":1,"generico":"..."}]}`)
  const res: { fila: Ing; generico: string }[] = []
  for (const x of Array.isArray(out?.incorrectos) ? out.incorrectos : []) {
    const fila = con[Number(x?.n) - 1]
    if (fila && typeof x.generico === 'string' && x.generico.trim().length >= 3) res.push({ fila, generico: x.generico.trim() })
  }
  return res
}

/** Crea el alimento genérico que falta con macros estimados por IA, solo si pasan las comprobaciones de coherencia (Atwater, rangos). */
async function crearAlimentoFaltante(nombre: string): Promise<{ al: Al; creado: boolean } | null> {
  const out = await deepseek(`Da los valores nutricionales por 100 g de «${nombre}» (alimento genérico, tal como se compra/usa en cocina) con datos tipo BEDCA/USDA.
Devuelve JSON: {"nombre_estandar":"nombre genérico en español, singular, sin marca","categoria":"Carnes rojas|Carnes blancas|Pescado azul|Pescado blanco|Mariscos|Huevos|Legumbres|Frutos secos y semillas|Lácteos|Cereales|Verduras y hortalizas|Frutas|Aceites y grasas|Condimentos|Salsas|Bebidas|Suplementos|Otros","calorias":0,"proteinas":0,"carbohidratos":0,"grasas":0,"fibra":0}`)
  if (!out) return null
  const [k, pr, ch, gr, fi] = [out.calorias, out.proteinas, out.carbohidratos, out.grasas, out.fibra].map(Number)
  const nombreFinal = typeof out.nombre_estandar === 'string' ? out.nombre_estandar.trim() : ''
  if (![k, pr, ch, gr, fi].every(Number.isFinite) || nombreFinal.length < 3) return null
  if (k < 0 || k > 900 || pr + ch + gr > 105 || fi < 0 || fi > ch + 1) return null
  const atwater = 4 * pr + 4 * ch + 9 * gr
  if (k > 20 && Math.abs(atwater - k) / k > 0.12) return null
  const { data: existente } = await db.from('alimentos').select('id, nombre, es_generico').ilike('nombre', nombreFinal).eq('es_comestible', true).limit(1)
  if (existente?.[0]) return { al: existente[0] as Al, creado: false }
  if (!APLICA) return { al: { id: 'simulado', nombre: nombreFinal, es_generico: true }, creado: true }
  const { data, error } = await db.from('alimentos').insert({
    nombre: nombreFinal[0].toUpperCase() + nombreFinal.slice(1), categoria: out.categoria || 'Otros', calorias: k, proteinas: pr, carbohidratos: ch, grasas: gr, fibra: fi,
    custom: false, es_generico: true, es_comestible: true, fuente: 'ia', fuente_nutricional: 'deepseek', // 'ia' = estimación: se distingue de lo curado por el coach
  }).select('id, nombre, es_generico').single()
  if (error || !data) return null
  return { al: data as Al, creado: true }
}

async function corregirIngredientes(r: Receta): Promise<Resultado> {
  const todoBien: Resultado = AUTO ? { ok: true, detalle: 'todos los enlaces son correctos' } : { ok: false, motivo: 'revisados todos los enlaces (reglas + IA) y todos parecen correctos: dime qué ingrediente falla' }
  const filas = r.receta_ingredientes.filter(i => !i.elaboracion_id && !i.es_opcional && i.nombre_libre)
  type Cambio = { fila: Ing; antes: string | null; despues: Al; creado?: boolean }
  const cambios: Cambio[] = []
  // 1) reglas: enlaces dudosos con una alternativa clara en el catálogo
  for (const i of filas) {
    const actual = nombreAlimento(i)
    const calidad = actual ? calidadVinculo(i.nombre_libre!, actual) : 'sin'
    if (calidad === 'exacta' || calidad === 'buena') continue
    const mejor = await buscarMejor(i.nombre_libre!)
    if (mejor) cambios.push({ fila: i, antes: actual, despues: mejor.al })
  }
  // 2) IA: segunda opinión sobre el resto → busca el genérico correcto en el catálogo o lo crea
  const yaCambiadas = new Set(cambios.map(c => c.fila.id))
  const sinSolucion: string[] = []
  // Si las reglas dan el enlace por exacto (mismas palabras, solo cambian cifras o envases) la IA no lo cuestiona: evita cambiar «chocolate negro 75-80 %» por «70 %»
  const paraIA = filas.filter(i => !yaCambiadas.has(i.id) && !(nombreAlimento(i) && calidadVinculo(i.nombre_libre!, nombreAlimento(i)!) === 'exacta'))
  for (const { fila, generico } of await revisarEnlacesConIA(paraIA)) {
    const actual = nombreAlimento(fila)
    const mejor = await buscarMejor(generico)
    if (mejor && mejor.al.nombre !== actual) { cambios.push({ fila, antes: actual, despues: mejor.al }); continue }
    // un ingrediente que es en realidad una sub-receta («caramelo de kabocha, miso, sésamo y frutos secos») no se convierte en alimento inventado
    const subReceta = (fila.nombre_libre ?? '').split(/\s+/).length >= 6 || /,/.test(fila.nombre_libre ?? '')
    const nuevo = subReceta ? null : await crearAlimentoFaltante(generico)
    if (nuevo) cambios.push({ fila, antes: actual, despues: nuevo.al, creado: nuevo.creado })
    else sinSolucion.push(`${fila.nombre_libre} (hoy «${actual}», debería ser «${generico}»)`)
  }
  if (cambios.length === 0 && sinSolucion.length === 0) return todoBien
  const resumen = cambios.map(c => `${c.fila.nombre_libre}: ${c.antes ?? 'sin enlace'} → ${c.despues.nombre}${c.creado ? ' (alimento nuevo, macros estimados: revisar)' : ''}`).join('; ')
  const faltan = sinSolucion.length ? `sin alimento válido ni forma segura de crearlo para: ${sinSolucion.join(', ')}` : ''
  if (!APLICA) return { ok: sinSolucion.length === 0, ...(sinSolucion.length === 0 ? { detalle: `[simulación] ${resumen}` } : { motivo: `[simulación] ${cambios.length ? `${resumen}; ` : ''}${faltan}` }) } as Resultado

  let recalc: { kcal: number } | null = null
  if (cambios.length) {
    const antes = await bloqueantes(r.id)
    for (const c of cambios) await db.from('receta_ingredientes').update({ alimento_id: c.despues.id }).eq('id', c.fila.id)
    recalc = await recalcularMacrosReceta(db as any, r.id)
    const peor = nuevosBloqueantes(antes, await bloqueantes(r.id))
    if (peor.length) {
      for (const c of cambios) await db.from('receta_ingredientes').update({ alimento_id: c.fila.alimento_id }).eq('id', c.fila.id)
      await recalcularMacrosReceta(db as any, r.id)
      return { ok: false, motivo: `reenlazar dejaba bloqueantes en el quality gate (${peor.join(', ')}); deshecho` }
    }
    await db.from('recetas_auditoria').insert({ receta_id: r.id, evento: 'correccion_motor', origen: 'motor_correcciones', issues: { aspecto: 'ingredientes', enlaces_anteriores: cambios.map(c => ({ fila: c.fila.id, alimento_id: c.fila.alimento_id })), alimentos_creados: cambios.filter(c => c.creado).map(c => c.despues.id) } })
  }
  const hecho = cambios.length ? `${cambios.length} enlaces corregidos (${resumen})${recalc ? ` · ${recalc.kcal} kcal/ración` : ''}` : ''
  if (sinSolucion.length) return { ok: false, motivo: `${hecho ? `${hecho}; ` : ''}${faltan}` }
  return { ok: true, detalle: hecho }
}

// ── Pasos / textos / título ────────────────────────────────────────────────────────────────────
const listaIngredientes = (r: Receta) => r.receta_ingredientes.filter(i => !i.es_opcional).map(i => `- ${i.nombre_libre ?? nombreAlimento(i)}: ${i.cantidad_gramos ?? 0} g`).join('\n')

function validarPasos(r: Receta, texto: string): string | null {
  const pasos = texto.split('\n').filter(l => /^\s*\d+[.)]\s+\S/.test(l))
  const antiguos = (r.instrucciones ?? '').split('\n').filter(l => /^\s*\d+[.)]\s+\S/.test(l)).length
  if (pasos.length < 2 || pasos.length > Math.max(10, antiguos + 2)) return `nº de pasos ${pasos.length}`
  if (texto.length < 120 || texto.length > 2000) return `longitud ${texto.length}`
  const n = norm(texto)
  for (const i of r.receta_ingredientes) {
    if ((i.cantidad_gramos ?? 0) <= 10 || i.es_opcional) continue
    const k = claves(i.nombre_libre ?? nombreAlimento(i) ?? '')
    if (k.length && !k.some(w => n.includes(w))) return `no nombra el ingrediente ${i.nombre_libre}`
  }
  const permitidas = r.receta_ingredientes.map(i => Number(i.cantidad_gramos)).filter(Boolean)
  for (const m of texto.matchAll(/(\d+(?:[.,]\d+)?)\s?(g|gr|gramos|ml)\b/gi)) {
    const v = parseFloat(m[1].replace(',', '.'))
    if (/agua[^.]{0,25}$/i.test(texto.slice(Math.max(0, m.index! - 30), m.index! + m[0].length))) continue
    if (permitidas.some(p => Math.abs(p - v) <= Math.max(2, p * 0.1))) continue
    // reparto de un ingrediente entre pasos («190 g de harina» de 400 g): vale si no pasa del total del ingrediente nombrado justo antes
    const antes = norm(texto.slice(Math.max(0, m.index! - 70), m.index! + m[0].length + 25))
    const parcial = r.receta_ingredientes.some(i => claves(i.nombre_libre ?? '').some(w => antes.includes(w)) && v <= Number(i.cantidad_gramos) * 1.05)
    if (!parcial) return `cantidad que no está en la lista: ${m[0]}`
  }
  if (PROHIBIDAS.test(n)) return 'vocabulario no permitido (víspera/carrera o inglés)'
  return null
}

async function corregirPasos(r: Receta, nota: string): Promise<Resultado> {
  let error: string | null = null
  let texto = ''
  for (let intento = 0; intento < 2; intento++) { // si falla la validación, se reintenta una vez diciéndole a la IA qué falló
    const out = await deepseek(`Corrige los PASOS de esta receta para un cliente de nutrición.
RECETA: ${r.nombre} (${r.porciones ?? 1} raciones)
INGREDIENTES (únicos permitidos, gramos totales):\n${listaIngredientes(r)}
PASOS ACTUALES:\n${r.instrucciones ?? '(ninguno)'}
LO QUE HA MARCADO EL COACH COMO MAL: ${nota || '(sin nota: revisa que los pasos sean coherentes con los ingredientes y completos)'}
REGLAS: pasos numerados "1. ...", solo los necesarios; TODOS los ingredientes de más de 10 g deben aparecer nombrados en algún paso; solo ingredientes de la lista y, si citas gramos, los de la lista; conserva lo que estaba bien; sin víspera/carrera/recuperación; español de España.${error ? `\nTU INTENTO ANTERIOR FALLÓ: ${error}. Corrígelo.` : ''}
Devuelve JSON: {"instrucciones":"1. ...\\n2. ..."}`)
    texto = typeof out?.instrucciones === 'string' ? out.instrucciones.trim() : ''
    error = texto ? validarPasos(r, texto) : 'la IA no devolvió pasos'
    if (!error) break
  }
  if (error) return { ok: false, motivo: `los pasos propuestos no pasan la validación tras reintentar (${error})` }
  if (!APLICA) return { ok: true, detalle: '[simulación] pasos reescritos' }
  await db.from('recetas').update({ instrucciones: texto }).eq('id', r.id)
  await db.from('recetas_auditoria').insert({ receta_id: r.id, evento: 'correccion_motor', origen: 'motor_correcciones', issues: { aspecto: 'pasos', instrucciones_anteriores: r.instrucciones } })
  return { ok: true, detalle: 'pasos reescritos con la nota y validados contra la lista de ingredientes' }
}

async function corregirTextos(r: Receta, nota: string): Promise<Resultado> {
  const out = await deepseek(`Corrige la DESCRIPCIÓN y los CONSEJOS de esta receta.
RECETA: ${r.nombre}\nINGREDIENTES:\n${listaIngredientes(r)}
DESCRIPCIÓN ACTUAL: ${r.descripcion ?? '(ninguna)'}\nCONSEJOS ACTUALES: ${r.consejos ?? '(ninguno)'}
LO QUE HA MARCADO EL COACH COMO MAL: ${nota || '(sin nota)'}
REGLAS: descripción de 1 a 3 frases; consejos de 1 o 2 frases (conservación o truco); sin inventar ingredientes ni cantidades; sin víspera/carrera/recuperación, sin afirmaciones de salud; español de España.
Devuelve JSON: {"descripcion":"...","consejos":"..."}`)
  const d = typeof out?.descripcion === 'string' ? out.descripcion.trim() : ''
  const c = typeof out?.consejos === 'string' ? out.consejos.trim() : ''
  if (!d || d.length > 500 || c.length > 400 || PROHIBIDAS.test(norm(`${d} ${c}`))) return { ok: false, motivo: 'los textos propuestos no pasan la validación' }
  if (/\d+\s?(g|gr|gramos|ml)\b/i.test(`${d} ${c}`)) return { ok: false, motivo: 'los textos propuestos citan cantidades (no se permiten en descripción/consejos)' }
  if (!APLICA) return { ok: true, detalle: '[simulación] descripción y consejos reescritos' }
  await db.from('recetas').update({ descripcion: d, consejos: c || r.consejos }).eq('id', r.id)
  await db.from('recetas_auditoria').insert({ receta_id: r.id, evento: 'correccion_motor', origen: 'motor_correcciones', issues: { aspecto: 'textos', descripcion_anterior: r.descripcion, consejos_anteriores: r.consejos } })
  return { ok: true, detalle: 'descripción y consejos reescritos y validados' }
}

// ── Título, tipo, gramos, raciones: de la nota si trae datos, y SIN nota con comprobaciones objetivas ──
type EditGramos = { fila: Ing; gramos: number; origen: 'nota' | 'cantidad irreal' }

/** Cantidades que el propio quality gate considera irreales (360 g de ralladura, 15 g de sal…): la IA propone una realista y se acepta solo si el gate la da por buena. */
async function cantidadesIrreales(r: Receta, ya: Set<string>): Promise<EditGramos[]> {
  const sospechosas = r.receta_ingredientes.filter(i => !ya.has(i.id) && !i.es_opcional && (i.cantidad_gramos ?? 0) > 0 && validarCantidadesSospechosas({ nombre_libre: i.nombre_libre, cantidad_gramos: i.cantidad_gramos }, r.porciones) === 'cantidades_sospechosas')
  if (sospechosas.length === 0) return []
  const out = await deepseek(`En la receta «${r.nombre}» (${r.porciones ?? 1} raciones) estas cantidades totales son irreales. Da una cantidad realista en gramos para cada una, con criterio de cocina (p. ej. la ralladura de un limón son ~6 g, una pizca de sal 1 g).
${sospechosas.map((i, n) => `${n + 1}. ${i.nombre_libre}: ${i.cantidad_gramos} g`).join('\n')}
Devuelve JSON: {"cantidades":[{"n":1,"gramos":0}]}`)
  const res: EditGramos[] = []
  for (const x of Array.isArray(out?.cantidades) ? out.cantidades : []) {
    const fila = sospechosas[Number(x?.n) - 1]; const v = Number(x?.gramos)
    if (!fila || !(v > 0) || v >= (fila.cantidad_gramos ?? 0)) continue
    if (validarCantidadesSospechosas({ nombre_libre: fila.nombre_libre, cantidad_gramos: v }, r.porciones) === null) res.push({ fila, gramos: v, origen: 'cantidad irreal' })
  }
  return res
}

/** Raciones realistas según el peso y las kcal de la receta (nada de la nota): solo se cambia si las actuales dan una ración fuera de lo plausible. */
async function estimarRaciones(r: Receta): Promise<number | null> {
  const total = r.receta_ingredientes.reduce((t, i) => t + Number(i.cantidad_gramos || 0), 0)
  const kcalRacion = Number(r.kcal ?? 0), por = Math.max(1, Number(r.porciones ?? 1))
  const principal = /comida|cena|almuerzo/i.test(r.tipo_plato ?? '') && (r.tipo_receta ?? 'completa') === 'completa'
  const [min, max, gMin, gMax] = principal ? [150, 1000, 100, 900] : [60, 1100, 15, 900]
  const gRacion = total / por
  const tope = r.familia === 'Panes y masas' ? 130 : /postre|snack|merienda|desayuno/i.test(r.tipo_plato ?? '') ? 260 : 450 // g por ración razonables según el tipo
  const plausible = kcalRacion >= min && kcalRacion <= max && gRacion >= gMin && gRacion <= gMax && gRacion <= tope
  if (plausible) return null
  const out = await deepseek(`¿Cuántas raciones individuales (porciones de una persona) rinde realmente esta receta? Piensa en el tamaño habitual de una ración de este tipo de plato (un plato principal ~250-450 g; un postre ~80-150 g; un pan: una rebanada ~50-90 g, así que una hogaza o un pan de molde rinde ~10-14 rebanadas).
RECETA: ${r.nombre} (${r.tipo_plato ?? 'plato'}) · peso total ${Math.round(total)} g · ${Math.round(kcalRacion * por)} kcal en total · hoy ${por} raciones
INGREDIENTES:\n${listaIngredientes(r)}
Devuelve JSON: {"raciones": número entero}`)
  const n = Number(out?.raciones)
  if (!Number.isInteger(n) || n < 1 || n > 24 || n === por) return null
  const nueva = (kcalRacion * por) / n
  return nueva >= min && nueva <= max ? n : null
}

async function corregirDesdeNota(r: Receta, nota: string, aspectos: string[]): Promise<Resultado> {
  let titulo: string | null = null, raciones: number | null = null, tipo: 'plato' | 'elaboracion' | null = null
  const edits: EditGramos[] = []
  const estimados: string[] = []
  if (nota) {
    const out = await deepseek(`Convierte la nota de un coach de nutrición en cambios CONCRETOS sobre una receta. Extrae SOLO lo que la nota dice de forma explícita; si no da el dato (nueva cifra, nuevo nombre), devuelve null. No deduzcas ni inventes cifras.
RECETA: ${r.nombre} · ${r.porciones ?? 1} raciones · tipo ${r.tipo_contenido ?? 'plato'}\nINGREDIENTES ACTUALES:\n${listaIngredientes(r)}
ASPECTOS MARCADOS: ${aspectos.join(', ')}\nNOTA DEL COACH: ${nota}
Devuelve JSON: {"titulo": null | "nuevo título", "raciones": null | número entero, "tipo": null | "plato" | "elaboracion" (solo si la nota dice que es una elaboración base/salsa/masa o que es un plato), "gramos": [{"ingrediente":"nombre EXACTO de la lista","gramos":número}]}`)
    for (const g of Array.isArray(out?.gramos) ? out.gramos : []) {
      const fila = r.receta_ingredientes.find(i => norm(i.nombre_libre ?? '') === norm(String(g.ingrediente ?? '')))
      const v = Number(g.gramos)
      if (!fila || !(v > 0) || v > 1500) return { ok: false, motivo: `la nota pide un cambio de gramos que no puedo validar («${g.ingrediente}» → ${g.gramos})` }
      edits.push({ fila, gramos: v, origen: 'nota' })
    }
    titulo = typeof out?.titulo === 'string' && out.titulo.trim() ? out.titulo.trim() : null
    raciones = Number.isInteger(out?.raciones) && out.raciones >= 1 && out.raciones <= 24 ? out.raciones : null
    tipo = out?.tipo === 'plato' || out?.tipo === 'elaboracion' ? out.tipo : null
    if (tipo && tipo === (r.tipo_contenido ?? 'plato')) tipo = null
    if (titulo && (titulo.length > 80 || PROHIBIDAS.test(norm(titulo)))) return { ok: false, motivo: 'el título propuesto no es válido' }
  }
  // Sin datos en la nota: comprobaciones objetivas
  if (aspectos.some(a => ['gramos', 'otro', 'ingredientes'].includes(a))) {
    for (const e of await cantidadesIrreales(r, new Set(edits.map(x => x.fila.id)))) { edits.push(e); estimados.push(`${e.fila.nombre_libre} ${e.fila.cantidad_gramos}→${e.gramos} g (cantidad irreal, estimada)`) }
  }
  if (raciones == null && aspectos.includes('raciones_kcal')) {
    raciones = await estimarRaciones(r)
    if (raciones != null) estimados.push(`raciones ${r.porciones}→${raciones} (ración actual fuera de lo plausible, estimada)`)
  }
  if (!edits.length && !titulo && raciones == null && !tipo) {
    return { ok: false, motivo: nota ? 'la nota no trae cifras ni nombres concretos y las comprobaciones objetivas (cantidades irreales, raciones plausibles) no ven nada que cambiar' : 'sin nota y las comprobaciones objetivas (cantidades irreales, raciones plausibles) no ven nada que cambiar' }
  }
  const resumen = [titulo && `título → «${titulo}»`, tipo && `tipo → ${tipo}`, raciones != null && `raciones ${r.porciones} → ${raciones}`, ...edits.map(e => `${e.fila.nombre_libre}: ${e.fila.cantidad_gramos} → ${e.gramos} g${e.origen === 'cantidad irreal' ? ' (estimado)' : ''}`)].filter(Boolean).join('; ')
  if (!APLICA) return { ok: true, detalle: `[simulación] ${resumen}` }

  const antes = await bloqueantes(r.id)
  const previoTipo = { tipo_contenido: r.tipo_contenido, familia: r.familia, categoria: r.categoria, tipo_receta: r.tipo_receta }
  for (const e of edits) await db.from('receta_ingredientes').update({ cantidad_gramos: e.gramos, cantidad_original: null, unidad_display: null }).eq('id', e.fila.id)
  const camposReceta: Record<string, unknown> = { ...(titulo ? { nombre: titulo } : {}), ...(raciones != null ? { porciones: raciones } : {}) }
  if (tipo) {
    const familia = tipo === 'elaboracion' ? familiaElaboracion(titulo ?? r.nombre) : clasificarFicha({ nombre: titulo ?? r.nombre, categoria: r.categoria, tipo_receta: r.tipo_receta }).familia
    Object.assign(camposReceta, camposAlCambiarTipo({ nombre: titulo ?? r.nombre, tipo, familia, categoria: r.categoria, kcal: r.kcal, proteinas: r.proteinas, tipoRecetaActual: r.tipo_receta }))
  }
  if (Object.keys(camposReceta).length) await db.from('recetas').update(camposReceta).eq('id', r.id)
  const recalc = await recalcularMacrosReceta(db as any, r.id)
  const peor = nuevosBloqueantes(antes, await bloqueantes(r.id))
  if (peor.length) {
    for (const e of edits) await db.from('receta_ingredientes').update({ cantidad_gramos: e.fila.cantidad_gramos }).eq('id', e.fila.id)
    await db.from('recetas').update({ nombre: r.nombre, porciones: r.porciones, ...previoTipo }).eq('id', r.id)
    await recalcularMacrosReceta(db as any, r.id)
    return { ok: false, motivo: `aplicar los cambios dejaba bloqueantes en el quality gate (${peor.join(', ')}); deshecho` }
  }
  await db.from('recetas_auditoria').insert({ receta_id: r.id, evento: 'correccion_motor', origen: 'motor_correcciones', issues: { aspecto: aspectos.join(','), nombre_anterior: r.nombre, porciones_anteriores: r.porciones, tipo_anterior: previoTipo, gramos_anteriores: edits.map(e => ({ fila: e.fila.id, gramos: e.fila.cantidad_gramos })) } })
  return { ok: true, detalle: `${resumen}${recalc ? ` · ${recalc.kcal} kcal/ración` : ''}${estimados.length ? ' · valores estimados por el motor: conviene revisarlos' : ''}` }
}


// ── Cantidades estimadas: el vídeo solo da el 16 %; el resto se estima con criterio (receta, pasos, raciones, texto original) ──
let tokensIA = 0
/** Estima con IA (Claude → GPT → DeepSeek) las cantidades que NO dijo el vídeo («≈»). Nunca toca las dichas; las estimadas siguen marcadas «≈». */
async function estimarCantidades(r: Receta): Promise<Resultado> {
  const est = r.receta_ingredientes.filter(i => !i.elaboracion_id && !i.es_opcional && (i.cantidad_gramos ?? 0) > 0 && !i.cantidad_original)
  if (est.length === 0) return { ok: true, detalle: 'sin cantidades estimadas' }
  const dichas = r.receta_ingredientes.filter(i => !i.elaboracion_id && !i.es_opcional && (i.cantidad_gramos ?? 0) > 0 && i.cantidad_original)
  const { llamarIA } = await import('../lib/ia/enrutador')
  const texto = (r.raw_scrape?.texto ?? '').slice(0, 3500)
  let respuesta
  try {
    respuesta = await llamarIA('revision_receta', {
      sistema: 'Eres un dietista-cocinero español con criterio de cantidades. Respondes SOLO con JSON válido.',
      usuario: `Estima las cantidades que el vídeo NO dijo, para que la receta sea coherente y realista.
RECETA: ${r.nombre} · ${r.porciones ?? 1} raciones · ${r.tipo_plato ?? 'plato'} · hoy ${Math.round(Number(r.kcal ?? 0))} kcal/ración
PASOS: ${(r.instrucciones ?? '(sin pasos)').slice(0, 1500)}
${texto ? `TEXTO ORIGINAL DEL VÍDEO (pista, no verdad absoluta):\n${texto}\n` : ''}CANTIDADES DICHAS POR EL VÍDEO (no se tocan):\n${dichas.map(i => `- ${i.nombre_libre}: ${i.cantidad_gramos} g`).join('\n') || '(ninguna)'}
INGREDIENTES A ESTIMAR (valor actual por defecto, gramos TOTALES de toda la receta):\n${est.map((i, n) => `${n + 1}. ${i.nombre_libre}: ${i.cantidad_gramos} g`).join('\n')}
CRITERIO: cantidades habituales de cocina para este plato y este número de raciones (un plato principal pesa ~250-450 g por ración; un postre ~80-150 g); coherentes con los pasos, con las cantidades dichas y con lo que cuente el texto original (si da kcal o proteína por ración, que cuadre). Especias y sal, pocos gramos; aceite para freír o saltar, lo que absorbe, no el bote; líquidos en ml ≈ g. Si el valor actual ya es razonable, déjalo igual.
Devuelve JSON: {"cantidades":[{"n":1,"gramos":0}]}`,
      json: true, maxTokens: 1500, esfuerzo: 'low', presupuestoMs: 90000,
    })
  } catch (e: any) { return { ok: false, motivo: `error: la IA no respondió (${String(e.message).slice(0, 80)})` } }
  tokensIA += (respuesta.usoTotal.entrada ?? 0) + (respuesta.usoTotal.salida ?? 0)
  let out: any
  try { out = extraerJsonPlan(respuesta.texto) } catch { return { ok: false, motivo: 'error: la IA no devolvió JSON válido' } }
  const edits: EditGramos[] = []
  for (const x of Array.isArray(out?.cantidades) ? out.cantidades : []) {
    const fila = est[Number(x?.n) - 1]; const v = Math.round(Number(x?.gramos) * 10) / 10
    if (!fila || !(v > 0) || v > 1500) continue
    const actual = Number(fila.cantidad_gramos)
    if (Math.abs(v - actual) < Math.max(2, actual * 0.1)) continue // cambios de ruido
    if (validarCantidadesSospechosas({ nombre_libre: fila.nombre_libre, cantidad_gramos: v }, r.porciones) !== null) continue
    edits.push({ fila, gramos: v, origen: 'cantidad irreal' })
  }
  if (edits.length === 0) return { ok: true, detalle: 'las cantidades estimadas ya eran razonables' }
  const resumen = edits.map(e => `${e.fila.nombre_libre} ${e.fila.cantidad_gramos}→${e.gramos} g`).join('; ')
  if (!APLICA) return { ok: true, detalle: `[simulación] ${resumen}` }

  const antes = await bloqueantes(r.id)
  for (const e of edits) await db.from('receta_ingredientes').update({ cantidad_gramos: e.gramos }).eq('id', e.fila.id) // cantidad_original sigue nula: la «≈» se mantiene
  const recalc = await recalcularMacrosReceta(db as any, r.id)
  const principal = /comida|cena|almuerzo/i.test(r.tipo_plato ?? '') && (r.tipo_receta ?? 'completa') === 'completa'
  const [min, max] = principal ? [150, 1000] : [60, 1100]
  const kcalAntes = Number(r.kcal ?? 0), plausibleAntes = kcalAntes >= min && kcalAntes <= max
  const peor = nuevosBloqueantes(antes, await bloqueantes(r.id))
  const absurdo = recalc && plausibleAntes && (recalc.kcal < min || recalc.kcal > max)
  if (peor.length || absurdo) {
    for (const e of edits) await db.from('receta_ingredientes').update({ cantidad_gramos: e.fila.cantidad_gramos }).eq('id', e.fila.id)
    await recalcularMacrosReceta(db as any, r.id)
    return { ok: false, motivo: `las cantidades propuestas ${absurdo ? `dejaban ${recalc!.kcal} kcal/ración` : `dejaban bloqueantes (${peor.join(', ')})`}; deshecho` }
  }
  await db.from('recetas_auditoria').insert({ receta_id: r.id, evento: 'correccion_motor', origen: 'motor_correcciones', issues: { aspecto: 'cantidades_estimadas', gramos_anteriores: edits.map(e => ({ fila: e.fila.id, gramos: e.fila.cantidad_gramos })) } })
  return { ok: true, detalle: `${edits.length} cantidades estimadas con criterio (${resumen})${recalc ? ` · ${recalc.kcal} kcal/ración` : ''}` }
}

// ── Alérgenos y etiquetas: se apoyan en las auditorías que ya corren en la pasada de 6 h ─────────
function ejecutar(args: string[]): string {
  const r = spawnSync('node', args, { cwd: join(__dirname, '..'), encoding: 'utf8', timeout: 5 * 60 * 1000, env: { ...process.env, PATH: '/usr/local/bin:/usr/bin:/bin:/opt/homebrew/bin' } })
  return `${r.stdout ?? ''}${r.stderr ?? ''}`
}
function corregirAlergenos(r: Receta): Resultado {
  const salida = ejecutar(['scripts/auditar-intolerancias-completo.mjs', ...(APLICA ? ['--aplica'] : []), `--id=${r.id.slice(0, 8)}`])
  const cambios = salida.split('\n').filter(l => l.startsWith('- ')).map(l => l.slice(2).trim().replace(/^.{0,46}\s{2,}/, ''))
  if (/ERROR|Error/.test(salida) && !cambios.length) return { ok: false, motivo: 'error al auditar los alérgenos' }
  return { ok: true, detalle: cambios.length ? `${APLICA ? '' : '[simulación] '}alérgenos ajustados: ${cambios.join(' ')}` : 'las etiquetas de alérgenos ya coinciden con los ingredientes' }
}
function corregirEtiquetas(): Resultado {
  const salida = ejecutar(['--import', 'tsx', 'scripts/completar-campos-recetas.mts', ...(APLICA ? ['--aplica'] : [])])
  const m = salida.match(/(\d+)\s+(?:recetas?|cambios)/i)
  return { ok: true, detalle: `${APLICA ? '' : '[simulación] '}clasificación y etiquetas completadas con las reglas automáticas${m ? ` (${m[0]})` : ''}` }
}

// ── Orquestación ───────────────────────────────────────────────────────────────────────────────
const SELECT_RECETA = 'id, nombre, tipo_contenido, familia, categoria, tipo_receta, tipo_plato, kcal, proteinas, tags, notas_coach, porciones, instrucciones, descripcion, consejos, url_origen, raw_scrape, receta_ingredientes!receta_ingredientes_receta_id_fkey(id, nombre_libre, cantidad_gramos, cantidad_original, alimento_id, elaboracion_id, es_opcional, alimentos!left(id, nombre))'

/** Saneado automático de las fichas en revisión que nadie ha marcado: enlaces a la BD, cantidades estimadas y alérgenos. Una vez por ficha (nota «Motor auto»). */
async function mainAuto() {
  const { data, error } = await db.from('recetas').select(SELECT_RECETA)
    .eq('estado', 'en_revision').not('url_origen', 'is', null)
    .or('notas_coach.is.null,notas_coach.not.ilike.%Motor auto%')
    .order('created_at', { ascending: false }).limit(SOLO ? 50 : Math.max(LIMITE, 1))
  if (error) { console.error(error.message); process.exit(1) }
  const reparte = (id: string) => !PARTE || [...id].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7) % PARTE[1] === PARTE[0]
  const cola = ((data ?? []) as unknown as Receta[]).filter(r => (!SOLO || r.id.startsWith(SOLO)) && reparte(r.id))
  console.log(`Fichas en revisión sin saneado automático: a procesar ${cola.length}`)
  let ok = 0, dudas = 0
  for (const r of cola) {
    console.log(`\n${r.nombre}`)
    const lineas: string[] = []
    let reintentar = false
    const pasos: [string, () => Promise<Resultado>][] = [
      ['enlaces', () => corregirIngredientes(r)],
      ['cantidades', () => estimarCantidades(r)],
      ['raciones', async () => { const x = await corregirDesdeNota(r, '', ['raciones_kcal']); return !x.ok && x.motivo.includes('no ven nada que cambiar') ? { ok: true, detalle: 'raciones plausibles' } as Resultado : x }],
    ]
    for (const [aspecto, hacer] of pasos) {
      let res: Resultado
      try { res = await hacer() } catch (e: any) { res = { ok: false, motivo: `error: ${e.message}` } }
      if (!res.ok && res.motivo.startsWith('error')) reintentar = true // fallo de red/IA: se vuelve a intentar en la siguiente pasada
      lineas.push(res.ok ? `${aspecto} ✓ ${res.detalle}` : `${aspecto} ✗ ${res.motivo}`)
      console.log(`  ${res.ok ? '✅' : '⚠️'} ${aspecto}: ${res.ok ? res.detalle : res.motivo}`)
    }
    if (APLICA && !reintentar) {
      await db.from('recetas').update({ notas_coach: [r.notas_coach, `[${hoy()}] Motor auto — ${lineas.join(' · ')}`].filter(Boolean).join('\n') }).eq('id', r.id)
    }
    lineas.every(l => l.includes(' ✓ ')) ? ok++ : dudas++
  }
  // Los alérgenos dependen de los enlaces ya corregidos: una sola pasada al final para todo el recetario (la misma auditoría de la pasada de 6 h)
  if (cola.length) {
    const a = corregirAlergenos({ id: '' } as Receta)
    console.log(`\nAlérgenos: ${a.ok ? a.detalle : a.motivo}`)
  }
  console.log(`\nSaneado automático: ${ok} sin dudas · ${dudas} con algo que mirar · ~${tokensIA.toLocaleString('es-ES')} tokens de IA`)
  if (!APLICA) console.log('Simulación. Añade --aplica.')
}

async function main() {
  if (AUTO) return mainAuto()
  const { data, error } = await db.from('recetas')
    .select('id, nombre, tipo_contenido, familia, categoria, tipo_receta, tipo_plato, kcal, proteinas, tags, notas_coach, porciones, instrucciones, descripcion, consejos, url_origen, raw_scrape, receta_ingredientes!receta_ingredientes_receta_id_fkey(id, nombre_libre, cantidad_gramos, cantidad_original, alimento_id, elaboracion_id, es_opcional, alimentos!left(id, nombre))')
    .contains('tags', ['Corregir']).in('estado', ['en_revision', 'borrador'])
  if (error) { console.error(error.message); process.exit(1) }
  const cola = ((data ?? []) as unknown as Receta[])
    .filter(r => !SOLO || r.id.startsWith(SOLO))
    .map(r => ({ r, n: leerNotas(r.notas_coach) }))
    .filter((x): x is { r: Receta; n: NonNullable<ReturnType<typeof leerNotas>> } => !!x.n && x.n.pendientes.some(a => a !== 'foto'))
  console.log(`Marcadas «Corregir» con aspectos que atiende el motor: ${cola.length} · a procesar: ${Math.min(cola.length, LIMITE)}`)

  let hechas = 0, parciales = 0
  for (const { r, n } of cola.slice(0, LIMITE)) {
    console.log(`\n${r.nombre} — pendiente: ${n.pendientes.join(', ')}${n.nota ? ` · nota: ${n.nota}` : ''}`)
    const lineas: string[] = []
    const hechosAhora: string[] = []
    const gramosSinNota = n.pendientes.includes('gramos') && !n.nota // sin cifras en la nota: se estiman con criterio las cantidades que el vídeo no dijo
    const desdeNota = n.pendientes.filter(a => ['titulo', 'gramos', 'raciones_kcal', 'otro'].includes(a) && !(a === 'gramos' && gramosSinNota))
    const tareas: [string[], () => Promise<Resultado>][] = []
    const deEnlaces = n.pendientes.filter(a => ['ingredientes', 'enlaces', 'alimento_falta'].includes(a))
    if (deEnlaces.length) tareas.push([deEnlaces, () => corregirIngredientes(r)])
    if (n.pendientes.includes('pasos')) tareas.push([['pasos'], () => corregirPasos(r, n.nota)])
    if (n.pendientes.includes('textos')) tareas.push([['textos'], () => corregirTextos(r, n.nota)])
    if (desdeNota.length) tareas.push([desdeNota, () => corregirDesdeNota(r, n.nota, desdeNota)])
    if (gramosSinNota) tareas.push([['gramos'], () => estimarCantidades(r)])
    if (n.pendientes.includes('alergenos')) tareas.push([['alergenos'], async () => corregirAlergenos(r)])
    if (n.pendientes.includes('etiquetas')) tareas.push([['etiquetas'], async () => corregirEtiquetas()])
    for (const [aspectos, hacer] of tareas) {
      let res: Resultado
      try { res = await hacer() } catch (e: any) { res = { ok: false, motivo: `error: ${e.message}` } }
      for (const a of aspectos) lineas.push(res.ok ? `[${hoy()}] Motor ✓ ${a}: ${res.detalle}` : `[${hoy()}] Motor ✗ ${a}: ${res.motivo}`)
      if (res.ok) hechosAhora.push(...aspectos)
      console.log(`  ${res.ok ? '✅' : '⚠️'} ${aspectos.join('+')}: ${res.ok ? res.detalle : res.motivo}`)
    }
    if (!APLICA || lineas.length === 0) continue
    // «Corregir» solo se quita cuando todo lo marcado está atendido (foto incluida); si no, queda para la pasada de Claude con el motivo anotado
    const pendientesTrasMotor = n.pendientes.filter(a => !hechosAhora.includes(a) && !(a === 'foto' && (r.notas_coach ?? '').includes('foto regenerada')))
    const completa = pendientesTrasMotor.length === 0
    await db.from('recetas').update({
      notas_coach: [r.notas_coach, ...lineas].filter(Boolean).join('\n'),
      ...(completa ? { tags: (r.tags ?? []).filter(t => t !== 'Corregir' && t !== 'Reporte cliente') } : {}),
    }).eq('id', r.id)
    completa ? hechas++ : parciales++
    console.log(`  → ${completa ? 'lista para revisar (sin «Corregir»)' : `sigue marcada: pendiente ${pendientesTrasMotor.join(', ')}`}`)
  }
  if (APLICA) console.log(`\nCorrecciones del motor: ${hechas} listas para revisar · ${parciales} con aspectos que necesitan a Claude`)
  else console.log('\nSimulación. Añade --aplica.')
}
main().catch(e => { console.error('❌', e.message ?? e); process.exit(1) })
