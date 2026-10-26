// Motor de correcciones de recetas marcadas «Corregir» (Reportar problema), todos los aspectos salvo la foto
// (la foto la hace corregir-marcadas.mjs). NUNCA aprueba: lo corregido vuelve a «Por revisar» para la revisión final de Carlos.
//   ingredientes → reenlaza solo los enlaces dudosos (mismas reglas que la reconstrucción segura) y recalcula macros
//   pasos / textos / titulo → DeepSeek redacta con la nota de Carlos y un validador (ingredientes, cantidades, vocabulario)
//   gramos / raciones_kcal / otro → DeepSeek convierte la nota en cambios concretos; sin cifras explícitas en la nota no toca nada
// Cada cambio guarda lo anterior en recetas_auditoria (evento correccion_motor) y se revierte si el quality gate sale peor.
// Lo que el motor no puede hacer con seguridad queda marcado «Corregir» con el motivo en las notas (lo atiende Claude: «pasa las correcciones»).
//   npx tsx scripts/corregir-marcadas-motor.ts                 → simula
//   npx tsx scripts/corregir-marcadas-motor.ts --aplica [--limite=10] [--id=<prefijo>]
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { createClient } from '@supabase/supabase-js'
import { auditarRecetaProfesional } from '../lib/recetas/auditoria'
import { recalcularMacrosReceta } from '../lib/recetas/elaboraciones-db'
import { calidadVinculo, raicesBusqueda, type CalidadVinculo } from '../lib/recetas/reconstruccion-segura'

for (const l of readFileSync(join(__dirname, '..', '.env.local'), 'utf8').split('\n')) {
  const m = l.match(/^([A-Z0-9_]+)=(.*)$/)
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^['"]|['"]$/g, '')
}
const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } })
const arg = (n: string) => process.argv.find(a => a.startsWith(`--${n}=`))?.split('=').slice(1).join('=')
const APLICA = process.argv.includes('--aplica')
const LIMITE = Number(arg('limite') ?? 10)
const SOLO = arg('id')
const hoy = () => new Date().toLocaleDateString('es-ES')

type Ing = { id: string; nombre_libre: string | null; cantidad_gramos: number | null; alimento_id: string | null; elaboracion_id: string | null; es_opcional: boolean | null; alimentos: { id: string; nombre: string } | { id: string; nombre: string }[] | null }
type Receta = { id: string; nombre: string; tags: string[] | null; notas_coach: string | null; porciones: number | null; instrucciones: string | null; descripcion: string | null; consejos: string | null; receta_ingredientes: Ing[] }
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
  const hecho = (a: string) => new RegExp(`Motor [✓✗] ${a}\\b`).test(despues) || (a === 'foto' && despues.includes('foto regenerada'))
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

// Para lo dudoso sin alternativa mejor: la IA solo dice si el alimento actual ES el mismo producto (otra forma, marca o preparación vale)
async function veredictoSinAlternativa(dudosos: { nombre: string; actual: string | null }[]): Promise<Set<string>> {
  const conAlimento = dudosos.filter(d => d.actual)
  if (conAlimento.length === 0) return new Set()
  const out = await deepseek(`Para cada par decide si el ALIMENTO enlazado es el mismo producto que el INGREDIENTE de la receta, a efectos nutricionales (otra forma, marca, corte o preparación del mismo alimento VALE; otro alimento distinto NO).
${conAlimento.map((d, i) => `${i + 1}. INGREDIENTE: ${d.nombre} | ALIMENTO: ${d.actual}`).join('\n')}
Devuelve JSON: {"veredictos":[{"n":1,"igual":true}]}`)
  const buenos = new Set<string>()
  for (const v of Array.isArray(out?.veredictos) ? out.veredictos : []) if (v?.igual === true && conAlimento[v.n - 1]) buenos.add(conAlimento[v.n - 1].nombre)
  return buenos
}

async function corregirIngredientes(r: Receta): Promise<Resultado> {
  const filas = r.receta_ingredientes.filter(i => !i.elaboracion_id && !i.es_opcional && i.nombre_libre)
  const cambios: { fila: Ing; antes: string | null; despues: Al }[] = []
  const dudososSinMejor: { nombre: string; actual: string | null }[] = []
  for (const i of filas) {
    const actual = nombreAlimento(i)
    const calidad = actual ? calidadVinculo(i.nombre_libre!, actual) : 'sin'
    if (calidad === 'exacta' || calidad === 'buena') continue
    const mejor = await buscarMejor(i.nombre_libre!)
    if (mejor) cambios.push({ fila: i, antes: actual, despues: mejor.al })
    else dudososSinMejor.push({ nombre: i.nombre_libre!, actual })
  }
  const aceptables = await veredictoSinAlternativa(dudososSinMejor)
  const malos = dudososSinMejor.filter(d => !aceptables.has(d.nombre)).map(d => `${d.nombre}${d.actual ? ` (hoy «${d.actual}»)` : ' (sin enlace)'}`)
  if (cambios.length === 0 && malos.length === 0) return { ok: false, motivo: 'no veo enlaces malos: dime qué ingrediente falla' }
  const resumenCambios = cambios.map(c => `${c.fila.nombre_libre}: ${c.antes ?? 'sin enlace'} → ${c.despues.nombre}`).join('; ')
  const faltan = malos.length ? `sin alimento fiable en el catálogo para: ${malos.join(', ')}` : ''
  if (!APLICA) return { ok: malos.length === 0, ...(malos.length === 0 ? { detalle: `[simulación] ${resumenCambios}` } : { motivo: `[simulación] ${cambios.length ? `reenlazaría ${resumenCambios}; ` : ''}${faltan}` }) } as Resultado

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
    await db.from('recetas_auditoria').insert({ receta_id: r.id, evento: 'correccion_motor', origen: 'motor_correcciones', issues: { aspecto: 'ingredientes', enlaces_anteriores: cambios.map(c => ({ fila: c.fila.id, alimento_id: c.fila.alimento_id })) } })
  }
  const hecho = cambios.length ? `${cambios.length} enlaces corregidos (${resumenCambios})${recalc ? ` · ${recalc.kcal} kcal/ración` : ''}` : ''
  if (malos.length) return { ok: false, motivo: `${hecho ? `${hecho}; ` : ''}${faltan}` }
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
    if (!permitidas.some(p => Math.abs(p - v) <= Math.max(2, p * 0.1))) return `cantidad que no está en la lista: ${m[0]}`
  }
  if (PROHIBIDAS.test(n)) return 'vocabulario no permitido (víspera/carrera o inglés)'
  return null
}

async function corregirPasos(r: Receta, nota: string): Promise<Resultado> {
  const out = await deepseek(`Corrige los PASOS de esta receta para un cliente de nutrición.
RECETA: ${r.nombre} (${r.porciones ?? 1} raciones)
INGREDIENTES (únicos permitidos, gramos totales):\n${listaIngredientes(r)}
PASOS ACTUALES:\n${r.instrucciones ?? '(ninguno)'}
LO QUE HA MARCADO EL COACH COMO MAL: ${nota || '(sin nota: revisa que los pasos sean coherentes con los ingredientes)'}
REGLAS: pasos numerados "1. ...", solo los necesarios; solo ingredientes de la lista y, si citas gramos, los de la lista; conserva lo que estaba bien; sin víspera/carrera/recuperación; español de España.
Devuelve JSON: {"instrucciones":"1. ...\\n2. ..."}`)
  const texto = typeof out?.instrucciones === 'string' ? out.instrucciones.trim() : ''
  if (!texto) return { ok: false, motivo: 'la IA no devolvió pasos válidos' }
  const error = validarPasos(r, texto)
  if (error) return { ok: false, motivo: `los pasos propuestos no pasan la validación (${error})` }
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

// ── Título, gramos, raciones: solo si la nota lo dice con cifras explícitas ───────────────────
async function corregirDesdeNota(r: Receta, nota: string, aspectos: string[]): Promise<Resultado> {
  if (!nota) return { ok: false, motivo: 'sin nota: no sé qué hay que cambiar' }
  const out = await deepseek(`Convierte la nota de un coach de nutrición en cambios CONCRETOS sobre una receta. Extrae SOLO lo que la nota dice de forma explícita; si no da el dato (nueva cifra, nuevo nombre), devuelve null. No deduzcas ni inventes cifras.
RECETA: ${r.nombre} · ${r.porciones ?? 1} raciones\nINGREDIENTES ACTUALES:\n${listaIngredientes(r)}
ASPECTOS MARCADOS: ${aspectos.join(', ')}\nNOTA DEL COACH: ${nota}
Devuelve JSON: {"titulo": null | "nuevo título", "raciones": null | número entero, "gramos": [{"ingrediente":"nombre EXACTO de la lista","gramos":número}]}`)
  if (!out) return { ok: false, motivo: 'la IA no respondió' }
  const edits: { fila: Ing; gramos: number }[] = []
  for (const g of Array.isArray(out.gramos) ? out.gramos : []) {
    const fila = r.receta_ingredientes.find(i => norm(i.nombre_libre ?? '') === norm(String(g.ingrediente ?? '')))
    const v = Number(g.gramos)
    if (!fila || !(v > 0) || v > 1500) return { ok: false, motivo: `la nota pide un cambio de gramos que no puedo validar («${g.ingrediente}» → ${g.gramos})` }
    edits.push({ fila, gramos: v })
  }
  const titulo = typeof out.titulo === 'string' && out.titulo.trim() ? out.titulo.trim() : null
  const raciones = Number.isInteger(out.raciones) && out.raciones >= 1 && out.raciones <= 24 ? out.raciones : null
  if (titulo && (titulo.length > 80 || PROHIBIDAS.test(norm(titulo)))) return { ok: false, motivo: 'el título propuesto no es válido' }
  if (!edits.length && !titulo && raciones == null) return { ok: false, motivo: 'la nota no trae cifras o nombres concretos que aplicar' }
  const resumen = [titulo && `título → «${titulo}»`, raciones != null && `raciones ${r.porciones} → ${raciones}`, ...edits.map(e => `${e.fila.nombre_libre}: ${e.fila.cantidad_gramos} → ${e.gramos} g`)].filter(Boolean).join('; ')
  if (!APLICA) return { ok: true, detalle: `[simulación] ${resumen}` }

  const antes = await bloqueantes(r.id)
  for (const e of edits) await db.from('receta_ingredientes').update({ cantidad_gramos: e.gramos, cantidad_original: null, unidad_display: null }).eq('id', e.fila.id)
  if (titulo || raciones != null) await db.from('recetas').update({ ...(titulo ? { nombre: titulo } : {}), ...(raciones != null ? { porciones: raciones } : {}) }).eq('id', r.id)
  const recalc = await recalcularMacrosReceta(db as any, r.id)
  const peor = nuevosBloqueantes(antes, await bloqueantes(r.id))
  if (peor.length) {
    for (const e of edits) await db.from('receta_ingredientes').update({ cantidad_gramos: e.fila.cantidad_gramos }).eq('id', e.fila.id)
    await db.from('recetas').update({ nombre: r.nombre, porciones: r.porciones }).eq('id', r.id)
    await recalcularMacrosReceta(db as any, r.id)
    return { ok: false, motivo: `aplicar la nota dejaba bloqueantes en el quality gate (${peor.join(', ')}); deshecho` }
  }
  await db.from('recetas_auditoria').insert({ receta_id: r.id, evento: 'correccion_motor', origen: 'motor_correcciones', issues: { aspecto: aspectos.join(','), nombre_anterior: r.nombre, porciones_anteriores: r.porciones, gramos_anteriores: edits.map(e => ({ fila: e.fila.id, gramos: e.fila.cantidad_gramos })) } })
  return { ok: true, detalle: `${resumen}${recalc ? ` · ${recalc.kcal} kcal/ración` : ''}` }
}

// ── Orquestación ───────────────────────────────────────────────────────────────────────────────
async function main() {
  const { data, error } = await db.from('recetas')
    .select('id, nombre, tags, notas_coach, porciones, instrucciones, descripcion, consejos, receta_ingredientes!receta_ingredientes_receta_id_fkey(id, nombre_libre, cantidad_gramos, alimento_id, elaboracion_id, es_opcional, alimentos!left(id, nombre))')
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
    const desdeNota = n.pendientes.filter(a => ['titulo', 'gramos', 'raciones_kcal', 'otro'].includes(a))
    const tareas: [string[], () => Promise<Resultado>][] = []
    if (n.pendientes.includes('ingredientes')) tareas.push([['ingredientes'], () => corregirIngredientes(r)])
    if (n.pendientes.includes('pasos')) tareas.push([['pasos'], () => corregirPasos(r, n.nota)])
    if (n.pendientes.includes('textos')) tareas.push([['textos'], () => corregirTextos(r, n.nota)])
    if (desdeNota.length) tareas.push([desdeNota, () => corregirDesdeNota(r, n.nota, desdeNota)])
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
