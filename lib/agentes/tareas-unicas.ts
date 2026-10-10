// lib/agentes/tareas-unicas.ts
// Para ciertos tipos de tarea solo tiene sentido UNA pendiente por cliente: cuando llega una nueva, la anterior queda reemplazada.
// Así no se acumulan análisis, alertas o propuestas repetidos mientras el coach no los revisa.
import type { SupabaseClient } from '@supabase/supabase-js'

/**
 * Tipos con una sola pendiente por cliente. Quedan fuera:
 *  - `actualizacion_plan`: puede ser de nutrición o de entreno (dos pendientes legítimas a la vez);
 *  - `propuesta_receta`: varias recetas distintas pueden esperar a la vez.
 */
const UNICA_PENDIENTE = new Set([
  'analisis_rendimiento', 'alerta_rendimiento', 'alerta_riesgo', 'alerta_riesgo_entreno', 'alerta_retencion', 'alerta_readiness',
  'revision_semanal', 'revision_semanal_entreno', 'mensaje_motivacion', 'ajuste_macros', 'ajuste_nutricion_carga', 'training_brain', 'plan_entreno_ia',
])

export const tipoEsUnicoPendiente = (tipo: string): boolean => UNICA_PENDIENTE.has(tipo)

/**
 * Marca como `reemplazada` las tareas pendientes anteriores del mismo cliente y tipo. No es una decisión del coach (no entra en el
 * aprendizaje) y no afecta a lo ya decidido. Nunca lanza: la tarea nueva ya está guardada y esto es solo limpieza.
 */
export async function reemplazarPendientesAnteriores(
  db: SupabaseClient,
  input: { clienteId: string | null; tipo: string; nuevaId: string },
): Promise<number> {
  if (!input.clienteId || !tipoEsUnicoPendiente(input.tipo)) return 0
  try {
    const { data, error } = await db.from('agente_tareas').update({ estado: 'reemplazada' })
      .eq('cliente_id', input.clienteId).eq('tipo', input.tipo).in('estado', ['pendiente', 'en_revision']).neq('id', input.nuevaId).select('id')
    if (error) { console.error('[tareas-unicas] no se pudieron reemplazar las anteriores:', error.message); return 0 }
    return (data ?? []).length
  } catch (e) {
    console.error('[tareas-unicas]', e instanceof Error ? e.message : e)
    return 0
  }
}
