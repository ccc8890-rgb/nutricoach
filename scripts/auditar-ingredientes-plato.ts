// Solo lectura: ingredientes de recetas aprobadas cuyo "alimento" es en realidad un plato/receta
// (mismo nombre que una receta, o producto preparado con nombre de plato) y cuya cantidad desvirtúa la receta.
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { join } from 'node:path'
import { createClient } from '@supabase/supabase-js'

for (const l of readFileSync(join(__dirname, '..', '.env.local'), 'utf8').split('\n')) {
  const m = l.match(/^([A-Z0-9_]+)=(.*)$/)
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^['"]|['"]$/g, '')
}
const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } })
const norm = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim()

async function todo<T>(tabla: string, select: string, filtro?: (q: any) => any): Promise<T[]> {
  const out: T[] = []
  for (let f = 0; ; f += 1000) {
    let q = db.from(tabla).select(select).range(f, f + 999)
    if (filtro) q = filtro(q)
    const { data, error } = await q
    if (error) throw error
    out.push(...(data as T[]))
    if ((data ?? []).length < 1000) break
  }
  return out
}

async function main() {
  const recetas = await todo<{ id: string; nombre: string; estado: string }>('recetas', 'id, nombre, estado')
  const porNombre = new Map(recetas.map(r => [norm(r.nombre), r]))
  const aprobadas = recetas.filter(r => r.estado === 'aprobada')
  const ings = await todo<{ id: string; receta_id: string; nombre_libre: string | null; cantidad_gramos: number; alimento: { id: string; nombre: string; fuente: string | null; categoria: string | null; calorias: number } | null }>(
    'receta_ingredientes', 'id, receta_id, nombre_libre, cantidad_gramos, alimento:alimentos(id, nombre, fuente, categoria, calorias)')
  const aprobadasIds = new Set(aprobadas.map(r => r.id))
  const nombreReceta = new Map(recetas.map(r => [r.id, r.nombre]))

  const hallazgos: any[] = []
  for (const i of ings) {
    if (!aprobadasIds.has(i.receta_id) || !i.alimento) continue
    const esReceta = porNombre.get(norm(i.alimento.nombre))
    if (esReceta && esReceta.id !== i.receta_id) {
      hallazgos.push({ tipo: 'alimento_es_receta', receta: nombreReceta.get(i.receta_id), receta_id: i.receta_id, ingrediente_id: i.id, nombre_libre: i.nombre_libre, alimento: i.alimento.nombre, alimento_id: i.alimento.id, fuente: i.alimento.fuente, categoria: i.alimento.categoria, gramos: i.cantidad_gramos, kcal100: i.alimento.calorias })
    }
  }
  const recetasAfectadas = new Set(hallazgos.map(h => h.receta_id))
  console.log(`Ingredientes de recetas aprobadas: ${ings.filter(i => aprobadasIds.has(i.receta_id)).length}`)
  console.log(`Hallazgos "el alimento es una receta": ${hallazgos.length} en ${recetasAfectadas.size} recetas\n`)
  const porFuente: Record<string, number> = {}
  for (const h of hallazgos) porFuente[`${h.fuente ?? '—'} / ${h.categoria ?? '—'}`] = (porFuente[`${h.fuente ?? '—'} / ${h.categoria ?? '—'}`] ?? 0) + 1
  console.log('Por fuente/categoría del alimento:', porFuente, '\n')
  for (const h of hallazgos.slice(0, 40)) console.log(`- ${h.receta} ← "${h.nombre_libre}" = [${h.alimento}] ${h.gramos} g (${h.kcal100} kcal/100g)`)
  mkdirSync(join(__dirname, '..', 'salidas'), { recursive: true })
  writeFileSync(join(__dirname, '..', 'salidas', 'auditoria-ingredientes-plato-2026-10-01.json'), JSON.stringify(hallazgos, null, 1))
}
main().catch(e => { console.error(e); process.exit(1) })
