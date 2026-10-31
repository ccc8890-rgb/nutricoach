// Revierte lo que el estimador del motor (--auto, 31-10-2026) cambió en fichas de WEBS: ahí las cantidades vienen de la receta original
// (no eran estimaciones; solo les faltaba cantidad_original) y no deben tocarse. Restaura gramos y raciones desde recetas_auditoria.
//   npx tsx scripts/revertir-estimaciones-web.ts            → simula
//   npx tsx scripts/revertir-estimaciones-web.ts --aplica
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { createClient } from '@supabase/supabase-js'
import { recalcularMacrosReceta } from '../lib/recetas/elaboraciones-db'
for (const l of readFileSync(join(__dirname, '..', '.env.local'), 'utf8').split('\n')) { const m = l.match(/^([A-Z0-9_]+)=(.*)$/); if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^['"]|['"]$/g, '') }
const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } })
const APLICA = process.argv.includes('--aplica')
const esReel = (u: string | null) => /tiktok|instagram|youtube|youtu\.be/.test(u ?? '')

async function main() {
  const { data: ev } = await db.from('recetas_auditoria').select('id, receta_id, issues, created_at').eq('evento', 'correccion_motor').gte('created_at', '2026-10-31T00:00:00Z').order('created_at', { ascending: true })
  const relevantes = (ev ?? []).filter((e: any) => ['cantidades_estimadas', 'raciones_kcal'].includes(e.issues?.aspecto) && Array.isArray(e.issues?.gramos_anteriores) || e.issues?.porciones_anteriores != null)
  const ids = [...new Set(relevantes.map((e: any) => e.receta_id))]
  const { data: rs } = await db.from('recetas').select('id, nombre, url_origen, porciones').in('id', ids)
  const web = new Map((rs ?? []).filter(r => !esReel(r.url_origen)).map(r => [r.id, r]))
  console.log(`Eventos del motor hoy: ${relevantes.length} en ${ids.length} fichas · de webs: ${web.size}`)
  let hechas = 0
  for (const id of web.keys()) {
    const eventos = relevantes.filter((e: any) => e.receta_id === id)
    // el valor ORIGINAL es el del evento más antiguo de cada ingrediente
    const gramos = new Map<string, number>(); let porciones: number | null = null
    for (const e of eventos as any[]) {
      for (const g of e.issues.gramos_anteriores ?? []) if (!gramos.has(g.fila)) gramos.set(g.fila, g.gramos)
      if (porciones == null && e.issues.porciones_anteriores != null && e.issues.aspecto === 'raciones_kcal') porciones = e.issues.porciones_anteriores
    }
    const r = web.get(id)!
    console.log(`  ${r.nombre}: ${gramos.size} cantidades${porciones != null && porciones !== r.porciones ? `, raciones ${r.porciones}→${porciones}` : ''}`)
    if (!APLICA) continue
    for (const [fila, g] of gramos) await db.from('receta_ingredientes').update({ cantidad_gramos: g }).eq('id', fila)
    if (porciones != null && porciones !== r.porciones) await db.from('recetas').update({ porciones }).eq('id', id)
    await recalcularMacrosReceta(db as any, id)
    await db.from('recetas_auditoria').insert({ receta_id: id, evento: 'correccion_motor', origen: 'motor_correcciones', issues: { aspecto: 'revertido_web', nota: 'estimaciones del 31-10 revertidas: la ficha viene de una web con cantidades originales' } })
    hechas++
  }
  console.log(APLICA ? `\nRevertidas ${hechas} fichas de webs.` : '\nSimulación. Añade --aplica.')
}
main().catch(e => { console.error(e.message); process.exit(1) })
