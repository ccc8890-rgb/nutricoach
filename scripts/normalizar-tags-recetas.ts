/**
 * Fase 1 de la migración de taxonomía: normaliza recetas.tags.
 * Simula por defecto. Con --apply escribe (copia previa en salidas/).
 * Reglas y motivo: salidas/17-10-2026_auditoria-taxonomia-recetario.md
 *
 *   npx tsx scripts/normalizar-tags-recetas.ts          # simula
 *   npx tsx scripts/normalizar-tags-recetas.ts --apply  # aplica
 *
 * Seguridad: nunca toca `intolerancias` ni los momentos estrictos
 * (pre/post/carga/tapering); los tags de flujo se dejan tal cual.
 */
import { createClient } from '@supabase/supabase-js'
import { readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'

const APPLY = process.argv.includes('--apply')
const env = Object.fromEntries(readFileSync(resolve('.env.local'), 'utf8').split('\n').filter(l => l.includes('=') && !l.startsWith('#')).map(l => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^["']|["']$/g, '')] }))
const db = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } })

const clave = (t: string) => t.toLowerCase().normalize('NFD').replace(/\p{Mn}/gu, '').replace(/[\s_-]+/g, '')

// Se conservan tal cual (flujo del coach)
const FLUJO = new Set(['Borrador', 'Revisar macros', 'Corregir', 'Reporte cliente'])
// Sinónimos → tag canónico
const CANON: Record<string, string> = {
  altoproteina: 'alta_proteina', altaproteina: 'alta_proteina', proteico: 'alta_proteina', proteina: 'alta_proteina',
  singluten: 'sin_gluten', sinazucar: 'sin_azucar', bajoazucar: 'bajo_azucar',
  bajocho: 'bajo_carbohidratos', bajocarbohidratos: 'bajo_carbohidratos',
  mealprep: 'mealprep', tupperamigable: 'tupper',
  nococcion: 'sin_coccion', nocook: 'sin_coccion', sincoccion: 'sin_coccion',
  facil: 'facil',
}
// Se mueven a una columna NO estricta (se añade si falta) y se quitan de tags
const A_COLUMNA: Record<string, { col: 'deportes' | 'objetivos' | 'estilos'; val: string }> = {
  running: { col: 'deportes', val: 'running' }, ciclismo: { col: 'deportes', val: 'ciclismo' },
  hyrox: { col: 'deportes', val: 'hyrox' }, triatlon: { col: 'deportes', val: 'triatlon' },
  triathlon: { col: 'deportes', val: 'triatlon' }, crossfit: { col: 'deportes', val: 'crossfit' },
  fuerza: { col: 'deportes', val: 'fuerza' }, endurance: { col: 'deportes', val: 'endurance' },
  perdidagrasa: { col: 'objetivos', val: 'perdida_grasa' }, rendimiento: { col: 'objetivos', val: 'rendimiento' },
  chefhealthy: { col: 'estilos', val: 'chef_healthy' }, chefhealthybatch: { col: 'estilos', val: 'chef_healthy' },
  comforthealthy: { col: 'estilos', val: 'comfort_healthy' }, mediterranea: { col: 'estilos', val: 'mediterranea' },
  altovolumen: { col: 'estilos', val: 'alto_volumen' }, rapida: { col: 'estilos', val: 'rapida' }, rapido: { col: 'estilos', val: 'rapida' },
  batchcooking: { col: 'estilos', val: 'batch_cooking' },
}
// Momentos estrictos: no se mueven; se listan para revisión
const ESTRICTOS = new Set(['postentreno', 'preentreno', 'cargacho', 'tapering'])
// Fugas de ids de colección y redundantes con categoria/momentos
const BORRAR = new Set(['performancebowls', 'prerace', 'batchgourmet', 'desayuno', 'merienda', 'cena', 'postre', 'snack', 'comida'])

type Fila = { id: string; nombre: string; estado: string; tags: string[] | null; deportes: string[] | null; objetivos: string[] | null; estilos: string[] | null }

async function main() {
  const filas: Fila[] = []
  for (let desde = 0; ; desde += 1000) {
    const { data, error } = await db.from('recetas').select('id, nombre, estado, tags, deportes, objetivos, estilos').neq('estado', 'descartada').range(desde, desde + 999)
    if (error) throw new Error(error.message)
    filas.push(...(data as Fila[]))
    if (!data || data.length < 1000) break
  }

  // Forma dominante por clave (para unificar mayúsculas: Yogur/yogur → Yogur)
  const formas = new Map<string, Map<string, number>>()
  for (const f of filas) for (const t of f.tags ?? []) { const k = clave(t); const m = formas.get(k) ?? new Map(); m.set(t, (m.get(t) ?? 0) + 1); formas.set(k, m) }
  const dominante = (k: string) => [...formas.get(k)!.entries()].sort((a, b) => b[1] - a[1])[0][0]

  const cambios: Array<{ id: string; nombre: string; antes: Record<string, string[]>; despues: Record<string, string[]> }> = []
  const revisar: Array<{ nombre: string; tag: string }> = []
  const resumen = new Map<string, number>()
  const cuenta = (m: string) => resumen.set(m, (resumen.get(m) ?? 0) + 1)

  for (const f of filas) {
    const tags = f.tags ?? []
    const nuevos: string[] = []
    const add = { deportes: new Set(f.deportes ?? []), objetivos: new Set(f.objetivos ?? []), estilos: new Set(f.estilos ?? []) }
    for (const t of tags) {
      const k = clave(t)
      if (FLUJO.has(t)) { nuevos.push(t); continue }
      if (ESTRICTOS.has(k)) { revisar.push({ nombre: f.nombre, tag: t }); nuevos.push(CANON[k] ?? dominante(k)); continue }
      if (BORRAR.has(k)) { cuenta(`quitar "${t}"`); continue }
      const col = A_COLUMNA[k]
      if (col) { add[col.col].add(col.val); cuenta(`"${t}" → ${col.col}`); continue }
      const canon = CANON[k]
      if (canon) { if (canon !== t) cuenta(`"${t}" → "${canon}"`); nuevos.push(canon); continue }
      const dom = dominante(k)
      if (dom !== t) cuenta(`"${t}" → "${dom}"`)
      nuevos.push(dom)
    }
    const finTags = [...new Set(nuevos)]
    const despues = { tags: finTags, deportes: [...add.deportes], objetivos: [...add.objetivos], estilos: [...add.estilos] }
    const antes = { tags, deportes: f.deportes ?? [], objetivos: f.objetivos ?? [], estilos: f.estilos ?? [] }
    if (JSON.stringify(antes) !== JSON.stringify(despues)) cambios.push({ id: f.id, nombre: f.nombre, antes, despues })
  }

  console.log(`Recetas leídas: ${filas.length} · con cambios: ${cambios.length}`)
  console.log('\nTransformaciones (nº de ocurrencias):')
  for (const [k, v] of [...resumen.entries()].sort((a, b) => b[1] - a[1])) console.log(String(v).padStart(5), k)
  console.log(`\nTags de momento estricto NO movidos (solo canonizados), para revisar a mano: ${revisar.length}`)
  const stamp = new Date().toISOString().slice(0, 16).replace('T', '_').replace(':', 'h')
  const archivo = resolve(`salidas/${stamp}_copia-tags-recetas.json`)
  if (cambios.length) { writeFileSync(archivo, JSON.stringify(cambios, null, 1)); console.log(`Copia previa / plan: ${archivo}`) }
  if (!APPLY) { console.log('\nSimulación: no se ha escrito nada. Usa --apply para aplicar.'); return }

  let ok = 0
  for (const c of cambios) {
    const { error } = await db.from('recetas').update({ tags: c.despues.tags, deportes: c.despues.deportes, objetivos: c.despues.objetivos, estilos: c.despues.estilos }).eq('id', c.id)
    if (error) throw new Error(`${c.nombre}: ${error.message} (ya aplicadas ${ok}; la copia permite revertir)`)
    ok++
  }
  console.log(`\nAplicadas ${ok} recetas. Para revertir: restaurar los campos 'antes' de ${archivo}`)
}
main().catch(e => { console.error(e); process.exit(1) })
