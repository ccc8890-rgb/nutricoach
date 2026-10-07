// Verificación automática del recetario de confianza. El motor de planes solo usa recetas verificadas cuando hay
// suficientes (lib/plan-recetas.ts), así que aprobar una receta sin verificarla la deja fuera de los planes sin avisar.
import type { SupabaseClient } from '@supabase/supabase-js'

export type RecetaParaVerificar = {
  instrucciones: string | null; tipo_plato: string | null; intolerancias: string[] | null; tiempo_prep_min: number | null
  receta_ingredientes: { alimento_id: string | null; rol_ingrediente: string | null }[] | null
}

/** Motivos por los que una receta aprobada todavía no es de confianza (vacío = completa; la foto no se exige). */
export function motivosIncompleta(r: RecetaParaVerificar): string[] {
  const ings = r.receta_ingredientes ?? []
  return [
    (!r.instrucciones || r.instrucciones.length < 80) && 'instrucciones',
    ings.length < 3 && '<3 ingredientes',
    ings.some(i => !i.alimento_id) && 'ingrediente sin vincular',
    ings.some(i => !i.rol_ingrediente) && 'ingrediente sin rol',
    !r.tipo_plato && 'sin franja',
    !(r.intolerancias ?? []).length && 'sin etiquetas',
    !r.tiempo_prep_min && 'sin tiempo',
  ].filter(Boolean) as string[]
}

/** Marca verificacion='auto' en las recetas completas de la lista. Nunca toca las verificadas por el coach ni las ya verificadas. */
export async function verificarRecetasCompletas(db: SupabaseClient, ids: string[]): Promise<{ verificadas: number; incompletas: { id: string; motivos: string[] }[] }> {
  if (ids.length === 0) return { verificadas: 0, incompletas: [] }
  const { data, error } = await db.from('recetas')
    .select('id, instrucciones, tipo_plato, intolerancias, tiempo_prep_min, verificacion, receta_ingredientes!receta_ingredientes_receta_id_fkey(alimento_id, rol_ingrediente)')
    .in('id', ids).eq('estado', 'aprobada')
  if (error) throw error
  const completas: string[] = []
  const incompletas: { id: string; motivos: string[] }[] = []
  for (const r of (data ?? []) as (RecetaParaVerificar & { id: string; verificacion: string | null })[]) {
    if (r.verificacion) continue
    const motivos = motivosIncompleta(r)
    if (motivos.length === 0) completas.push(r.id)
    else incompletas.push({ id: r.id, motivos })
  }
  if (completas.length > 0) {
    const { error: e } = await db.from('recetas').update({ verificacion: 'auto', verificada_at: new Date().toISOString() }).in('id', completas)
    if (e) throw e
  }
  return { verificadas: completas.length, incompletas }
}
