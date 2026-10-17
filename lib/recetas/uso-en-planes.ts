import type { SupabaseClient } from '@supabase/supabase-js'

// Cuántos planes de nutrición activos usan cada receta (cada plan cuenta una vez). Informativo: nunca se toca el plan.
export async function contarPlanesActivos(db: SupabaseClient, recetaIds: string[]): Promise<Record<string, number>> {
  const resultado: Record<string, number> = Object.fromEntries(recetaIds.map(id => [id, 0]))
  if (recetaIds.length === 0) return resultado
  const { data: comidas } = await db.from('comidas').select('receta_id, plan_id').in('receta_id', recetaIds).not('plan_id', 'is', null)
  const filas = (comidas ?? []) as { receta_id: string; plan_id: string }[]
  const planIds = [...new Set(filas.map(f => f.plan_id))]
  if (planIds.length === 0) return resultado
  const { data: planes } = await db.from('planes_nutricion').select('id').in('id', planIds).eq('activo', true)
  const activos = new Set(((planes ?? []) as { id: string }[]).map(p => p.id))
  const porReceta = new Map<string, Set<string>>()
  for (const f of filas) {
    if (!activos.has(f.plan_id)) continue
    if (!porReceta.has(f.receta_id)) porReceta.set(f.receta_id, new Set())
    porReceta.get(f.receta_id)!.add(f.plan_id)
  }
  for (const [id, set] of porReceta) resultado[id] = set.size
  return resultado
}
