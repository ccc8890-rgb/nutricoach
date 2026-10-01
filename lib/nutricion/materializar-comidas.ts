import type { SupabaseClient } from '@supabase/supabase-js'
import { DIAS_SEMANA } from './comidas-dia'

/**
 * Convierte las comidas recurrentes (dia_semana null) de un plan en 7 comidas
 * concretas, una por día, copiando sus ingredientes, y borra la original.
 * Necesario antes de cambiar una comida de un solo día.
 */
export async function materializarComidasRecurrentes(db: SupabaseClient, planId: string): Promise<number> {
  const { data: recurrentes, error } = await db.from('comidas').select('*').eq('plan_id', planId).is('dia_semana', null)
  if (error) throw new Error('Error al leer comidas')
  for (const comida of recurrentes ?? []) {
    const { data: alimentos } = await db.from('comida_alimentos')
      .select('alimento_id, cantidad_gramos, factor_ajuste, es_complemento, complemento_receta_id').eq('comida_id', comida.id)
    const { data: creadas, error: insertError } = await db.from('comidas')
      .insert(DIAS_SEMANA.map(dia => ({
        plan_id: comida.plan_id,
        nombre: comida.nombre,
        orden: comida.orden,
        hora_sugerida: comida.hora_sugerida,
        kcal_target: comida.kcal_target,
        proteinas_target: comida.proteinas_target,
        carbos_target: comida.carbos_target,
        grasas_target: comida.grasas_target,
        notas_peri_entreno: comida.notas_peri_entreno,
        receta_id: comida.receta_id,
        alternativas_receta_ids: comida.alternativas_receta_ids,
        dieta_habitual_id: comida.dieta_habitual_id,
        origen_adherencia: comida.origen_adherencia,
        adaptacion_habitual: comida.adaptacion_habitual,
        dia_semana: dia,
      }))).select('id')
    if (insertError || !creadas) throw new Error(`No se pudo materializar "${comida.nombre}"`)
    if (alimentos?.length) {
      const { error: e } = await db.from('comida_alimentos').insert(
        creadas.flatMap(n => alimentos.map(a => ({ comida_id: n.id, alimento_id: a.alimento_id, cantidad_gramos: a.cantidad_gramos, factor_ajuste: a.factor_ajuste, es_complemento: a.es_complemento, complemento_receta_id: a.complemento_receta_id })))
      )
      if (e) throw new Error(`No se pudieron copiar los ingredientes de "${comida.nombre}"`)
    }
    await db.from('comida_alimentos').delete().eq('comida_id', comida.id)
    await db.from('comidas').delete().eq('id', comida.id)
  }
  return recurrentes?.length ?? 0
}
