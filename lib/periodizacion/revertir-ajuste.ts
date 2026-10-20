import type { AjusteMacros, MacrosBase } from './motor-macros'

/** Ajuste guardado en `periodizacion_acciones.ajuste_macros`; `revertido_at` se añade al devolver el plan a su base. */
export type AjusteGuardado = AjusteMacros & { revertido_at?: string }

/**
 * El ajuste calórico de la periodización es «de esta semana»: antes de evaluar el siguiente check-in hay que devolver el plan a
 * sus macros base, o cada ajuste se suma sobre el anterior (+10 % → +21 % → +33 %…). Devuelve los macros a restaurar o `null`
 * si no hay nada que revertir. Si el plan ya no tiene los valores ajustados (el coach lo cambió a mano), no se toca.
 */
export function macrosARestaurar(ajuste: AjusteGuardado | null | undefined, plan: MacrosBase): MacrosBase | null {
  if (!ajuste || ajuste.revertido_at) return null
  if (Math.round(plan.kcal) !== Math.round(ajuste.kcal_ajustado)) return null
  return { kcal: ajuste.kcal, proteinas: ajuste.proteinas, carbohidratos: ajuste.carbohidratos, grasas: ajuste.grasas }
}

/** Revierte en la base de datos el último ajuste aplicado de un cliente, si sigue vigente. Devuelve true si restauró el plan. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function revertirAjusteVigente(db: any, clienteId: string): Promise<boolean> {
  const { data: accion } = await db.from('periodizacion_acciones')
    .select('id, ajuste_macros')
    .eq('cliente_id', clienteId).eq('accion', 'ajuste_calorico_10pct').eq('aplicado', true).not('ajuste_macros', 'is', null)
    .order('created_at', { ascending: false }).limit(1).maybeSingle()
  if (!accion) return false
  const { data: plan } = await db.from('planes_nutricion')
    .select('id, kcal_objetivo, proteinas_objetivo, carbohidratos_objetivo, grasas_objetivo')
    .eq('cliente_id', clienteId).eq('activo', true).order('created_at', { ascending: false }).limit(1).maybeSingle()
  if (!plan) return false
  const base = macrosARestaurar(accion.ajuste_macros, { kcal: plan.kcal_objetivo, proteinas: plan.proteinas_objetivo, carbohidratos: plan.carbohidratos_objetivo, grasas: plan.grasas_objetivo })
  if (!base) return false
  await db.from('planes_nutricion').update({ kcal_objetivo: base.kcal, proteinas_objetivo: base.proteinas, carbohidratos_objetivo: base.carbohidratos, grasas_objetivo: base.grasas, updated_at: new Date().toISOString() }).eq('id', plan.id)
  await db.from('periodizacion_acciones').update({ ajuste_macros: { ...accion.ajuste_macros, revertido_at: new Date().toISOString() } }).eq('id', accion.id)
  return true
}
