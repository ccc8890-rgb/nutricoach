// Reconstruye recetas desde propuestas SIN revisión manual, pero solo cuando todas las puertas de seguridad pasan
// (lib/recetas/reconstruccion-segura.ts). Simula por defecto; --apply escribe, verifica con el quality gate y
// deshace solo si algo falla. Genera un informe en salidas/.
// Uso: npx tsx scripts/reconstruir-recetas-seguro.ts [--archivo=salidas/propuestas-recetas-2026-10-02.json] [--id=<prefijo>] [--apply]
import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import { createClient } from '@supabase/supabase-js'
import { inferirRolIngrediente } from '../lib/ingredient-roles'
import { auditarRecetaProfesional } from '../lib/recetas/auditoria'
import { calcularScoreCalidadReceta } from '../lib/recetas/profesional'
import { calidadVinculo, evaluarReconstruccion, raicesBusqueda, type CalidadVinculo, type IngredienteResuelto } from '../lib/recetas/reconstruccion-segura'

for (const l of readFileSync(join(__dirname, '..', '.env.local'), 'utf8').split('\n')) {
  const m = l.match(/^([A-Z0-9_]+)=(.*)$/)
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^['"]|['"]$/g, '')
}
const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } })
const arg = (n: string) => process.argv.find(a => a.startsWith(`--${n}=`))?.split('=').slice(1).join('=')
const APPLY = process.argv.includes('--apply')
const ARCHIVO = arg('archivo') ?? 'salidas/propuestas-recetas-2026-10-02.json'
const SOLO = arg('id')

type Al = { id: string; nombre: string; calorias: number; proteinas: number; carbohidratos: number; grasas: number; fibra: number | null; categoria: string | null; es_generico: boolean | null }
const CAMPOS = 'id, nombre, calorias, proteinas, carbohidratos, grasas, fibra, categoria, es_generico'
const rango: Record<CalidadVinculo, number> = { exacta: 3, buena: 2, dudosa: 1, sin: 0 }

async function buscarMejor(nombre: string): Promise<{ al: Al; calidad: CalidadVinculo } | null> {
  const principal = nombre.split(/\s+o\s+/)[0]
  const raices = raicesBusqueda(nombre)
  if (raices.length === 0) return null
  const vistos = new Map<string, Al>()
  // 1) nombre exacto (para que "Sal" no se pierda entre cientos de coincidencias parciales)
  const { data: exactos } = await db.from('alimentos').select(CAMPOS).ilike('nombre', principal.trim()).eq('es_comestible', true).limit(10)
  for (const a of (exactos ?? []) as Al[]) vistos.set(a.id, a)
  // 2) por palabra, también en singular ("zanahorias" → "zanahoria")
  for (const t of raices) {
    const { data: genericos } = await db.from('alimentos').select(CAMPOS).ilike('nombre', t).eq('es_comestible', true).limit(10) // "Tomate" entre cientos de productos con tomate
    for (const a of (genericos ?? []) as Al[]) vistos.set(a.id, a)
    const { data } = await db.from('alimentos').select(CAMPOS).ilike('nombre', `%${t}%`).eq('es_comestible', true).limit(80)
    for (const a of (data ?? []) as Al[]) vistos.set(a.id, a)
  }
  const puntuados = [...vistos.values()].map(a => ({ al: a, calidad: calidadVinculo(nombre, a.nombre) }))
    .filter(x => x.calidad === 'exacta' || x.calidad === 'buena')
    .sort((a, b) => rango[b.calidad] - rango[a.calidad] || Number(!!b.al.es_generico) - Number(!!a.al.es_generico) || a.al.nombre.length - b.al.nombre.length)
  return puntuados[0] ?? null
}

async function resolver(ing: { nombre: string; gramos: number; alimento_id: string | null }): Promise<IngredienteResuelto & { al: Al | null }> {
  let al: Al | null = null
  let calidad: CalidadVinculo = 'sin'
  if (ing.alimento_id) {
    const { data } = await db.from('alimentos').select(CAMPOS).eq('id', ing.alimento_id).maybeSingle()
    if (data) { al = data as Al; calidad = calidadVinculo(ing.nombre, al.nombre) }
  }
  // Sin vínculo, o vínculo dudoso: se busca uno mejor; si no lo hay, se queda como estaba (dudoso/sin) y las puertas decidirán
  if (calidad === 'sin' || calidad === 'dudosa') {
    const mejor = await buscarMejor(ing.nombre)
    if (mejor) { al = mejor.al; calidad = mejor.calidad }
  }
  return { nombre: ing.nombre, gramos: ing.gramos, alimento: al, calidad, al }
}

type Resultado = { id: string; nombre: string; faltan?: string[]; estado: 'aplicada' | 'simulada_ok' | 'bloqueada' | 'revertida' | 'error'; detalle: string[]; antes?: number; despues?: number }

async function procesar(prop: any): Promise<Resultado> {
  const id: string = prop.receta_id
  const { data: r } = await db.from('recetas').select('id, nombre, porciones, kcal, proteinas, carbohidratos, grasas, fibra, instrucciones, tipo_plato, tipo_receta, descripcion, categoria, dificultad, imagen_url, url_origen, intolerancias, tags').eq('id', id).single()
  if (!r) return { id, nombre: prop.receta ?? id, estado: 'error', detalle: ['Receta no encontrada'] }

  const resueltos = await Promise.all((prop.ingredientes as any[]).map(resolver))
  const ev = evaluarReconstruccion({
    ingredientes: resueltos, porciones_propuesta: Number(prop.porciones_propuesta ?? r.porciones ?? 1),
    actual: { porciones: Number(r.porciones ?? 1), kcal: Number(r.kcal ?? 0), tipo_plato: r.tipo_plato, tipo_receta: r.tipo_receta },
  })
  // Mismo quality gate que se aplicará después, ejecutado ANTES de escribir (función pura): si habría bloqueantes, no se toca la receta
  if (ev.ok) {
    const gate = calcularScoreCalidadReceta({
      nombre: r.nombre, descripcion: r.descripcion, instrucciones: prop.instrucciones ?? r.instrucciones, categoria: r.categoria, tipo_plato: r.tipo_plato,
      dificultad: r.dificultad, imagen_url: r.imagen_url, url_origen: r.url_origen, kcal: ev.nuevo.kcal, proteinas: ev.nuevo.proteinas, carbohidratos: ev.nuevo.carbohidratos,
      grasas: ev.nuevo.grasas, fibra: ev.nuevo.fibra, porciones: Number(prop.porciones_propuesta ?? r.porciones), intolerancias: r.intolerancias, tags: r.tags,
      ingredientes: ev.ingredientesFinales.map(i => ({ alimento_id: (i as any).al.id, nombre_libre: i.nombre, cantidad_gramos: i.gramos, tiene_precio: true, nombre_alimento: i.alimento!.nombre, kcal_alimento: i.alimento!.calorias })),
    } as any)
    for (const b of gate.bloqueantes) ev.motivos.push(`El quality gate bloquearía: ${b}`)
    ev.ok = ev.motivos.length === 0
  }
  const detalle = [
    ...ev.motivos.map(m => `⛔ ${m}`),
    ...ev.descartados.map(d => `ℹ️ omitido por ser despreciable y sin vínculo fiable: ${d}`),
    ...resueltos.filter(x => x.alimento && x.calidad === 'buena').map(x => `ℹ️ vínculo aproximado: «${x.nombre}» → «${x.alimento!.nombre}»`),
  ]
  const faltan = resueltos.filter(x => (x.calidad === 'dudosa' || x.calidad === 'sin') && !ev.descartados.includes(x.nombre)).map(x => `${x.nombre} (${x.gramos} g)`)
  const base = { id, nombre: r.nombre, antes: Math.round(r.kcal), despues: ev.nuevo.kcal, faltan }
  if (!ev.ok) return { ...base, estado: 'bloqueada', detalle }
  if (!APPLY) return { ...base, estado: 'simulada_ok', detalle }

  // Aplicar con copia y verificación
  const { data: previos } = await db.from('receta_ingredientes').select('*').eq('receta_id', id)
  const copia = { receta: r, ingredientes: previos }
  writeFileSync(join(__dirname, '..', 'salidas', `copia-receta-${id}.json`), JSON.stringify(copia, null, 1))
  const finales = ev.ingredientesFinales as (IngredienteResuelto & { al: Al })[]
  const revertir = async () => {
    await db.from('receta_ingredientes').delete().eq('receta_id', id)
    await db.from('receta_ingredientes').insert((previos ?? []).map(({ id: _i, ...x }: any) => x))
    const { id: _r, ...campos } = r as any
    await db.from('recetas').update(campos).eq('id', id)
  }
  try {
    await db.from('receta_ingredientes').delete().eq('receta_id', id)
    const { error: e2 } = await db.from('receta_ingredientes').insert(finales.map((f, orden) => ({
      receta_id: id, alimento_id: f.al.id, nombre_libre: f.nombre, cantidad_gramos: f.gramos, es_cantidad_fija: false, orden,
      rol_ingrediente: inferirRolIngrediente(f.al as any, f.nombre),
    })))
    if (e2) throw new Error(e2.message)
    const { error: e3 } = await db.from('recetas').update({
      kcal: ev.nuevo.kcal, proteinas: ev.nuevo.proteinas, carbohidratos: ev.nuevo.carbohidratos, grasas: ev.nuevo.grasas, fibra: ev.nuevo.fibra,
      porciones: Number(prop.porciones_propuesta ?? r.porciones), ...(prop.instrucciones ? { instrucciones: prop.instrucciones } : {}),
    }).eq('id', id)
    if (e3) throw new Error(e3.message)
    const audit = await auditarRecetaProfesional(db as any, id, 'reconstruccion_segura', 'sistema')
    if (audit.score.bloqueantes.length > 0) throw new Error(`el quality gate detecta bloqueantes: ${audit.score.bloqueantes.join(', ')}`)
    return { ...base, estado: 'aplicada', detalle }
  } catch (e: any) {
    await revertir()
    return { ...base, estado: 'revertida', detalle: [...detalle, `↩️ revertida automáticamente: ${e.message}`] }
  }
}

async function main() {
  const ruta = join(__dirname, '..', ARCHIVO)
  if (!existsSync(ruta)) throw new Error(`No existe ${ARCHIVO}`)
  const props = (JSON.parse(readFileSync(ruta, 'utf8')) as any[]).filter(p => !SOLO || p.receta_id.startsWith(SOLO))
  const resultados: Resultado[] = []
  for (const p of props) {
    const res = await procesar(p)
    resultados.push(res)
    const icono = { aplicada: '✅', simulada_ok: '🟢', bloqueada: '⛔', revertida: '↩️', error: '❌' }[res.estado]
    console.log(`${icono} ${res.nombre} (${res.antes ?? '?'} → ${res.despues ?? '?'} kcal/ración) [${res.estado}]`)
    for (const d of res.detalle) console.log(`     ${d}`)
  }
  const hoy = new Date().toISOString().slice(0, 10).split('-').reverse().join('-')
  const md = [`# Reconstrucción segura de recetas · ${hoy}`, '', `Modo: ${APPLY ? 'APLICAR' : 'simulación'} · archivo: ${ARCHIVO}`, '',
    ...(['aplicada', 'simulada_ok', 'revertida', 'bloqueada', 'error'] as const).flatMap(est => {
      const l = resultados.filter(r => r.estado === est)
      return l.length ? [`## ${est} (${l.length})`, ...l.flatMap(r => [`- **${r.nombre}** (${r.antes} → ${r.despues} kcal/ración)`, ...r.detalle.map(d => `  - ${d}`)]), ''] : []
    }),
    ...(resultados.some(r => r.faltan?.length) ? ['## Alimentos que faltan en el catálogo (desbloquearían estas recetas)', ...resultados.filter(r => r.faltan?.length).map(r => `- **${r.nombre}**: ${r.faltan!.join(', ')}`), ''] : []),
  ].join('\n')
  writeFileSync(join(__dirname, '..', 'salidas', `${hoy}_reconstruccion-recetas${APPLY ? '' : '-simulacion'}.md`), md)
  console.log(`\nInforme en salidas/${hoy}_reconstruccion-recetas${APPLY ? '' : '-simulacion'}.md`)
}
main().catch(e => { console.error('❌', e.message ?? e); process.exit(1) })
