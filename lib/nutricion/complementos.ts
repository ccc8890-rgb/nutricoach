// Postre / complemento de una comida: alimentos sueltos (fruta, yogur…) o una receta (postre) añadidos
// fuera de la receta principal. Se guardan como ingredientes de la comida (es_complemento) para que
// cuenten en los macros de la comida, el día y la semana en todo lo que lee comida_alimentos.
import type { SupabaseClient } from '@supabase/supabase-js'
import { DIAS_SEMANA } from './comidas-dia'
import { materializarComidasRecurrentes } from './materializar-comidas'
import { FRANJAS, repartoFranja } from './semana-dieta'
import type { PlanObjetivo } from './planificar-semana'
import { aplicarRecetaAComida } from '@/lib/recetas/aplicar-receta-comida'
import type { SlotComida } from '@/lib/tipos-comida'

const MAX_GRAMOS = 2000

// Reescala el plato principal para que la comida siga en su objetivo contando los complementos
async function reajustarPlato(db: SupabaseClient, plan: PlanObjetivo, clienteId: string, comida: { id: string; nombre: string; receta_id: string | null }) {
  if (!comida.receta_id) return
  const share = await repartoFranja(db, plan.id, comida.nombre as SlotComida)
  const objetivo = (v: number | null) => (v ? v * share : undefined)
  await aplicarRecetaAComida(db, {
    comidaId: comida.id, recetaId: comida.receta_id, clienteId, planId: plan.id, comidaSlot: comida.nombre,
    targetKcal: objetivo(plan.kcal_objetivo), targetProteinas: objetivo(plan.proteinas_objetivo),
    targetCarbohidratos: objetivo(plan.carbohidratos_objetivo), targetGrasas: objetivo(plan.grasas_objetivo),
    reemplazar: true,
  })
}

export async function anadirComplemento(
  db: SupabaseClient, plan: PlanObjetivo, clienteId: string,
  p: { dia: string; franja: string; alimento_id?: string; gramos?: number; receta_id?: string; ajustar?: boolean },
) {
  if (!DIAS_SEMANA.includes(p.dia as typeof DIAS_SEMANA[number]) || !FRANJAS.includes(p.franja as SlotComida)) throw new Error('Día o franja no válidos')
  if (!p.alimento_id && !p.receta_id) throw new Error('Elige un alimento o una receta')

  await materializarComidasRecurrentes(db, plan.id)
  const { data: existente } = await db.from('comidas').select('id, nombre, receta_id').eq('plan_id', plan.id).eq('dia_semana', p.dia).eq('nombre', p.franja).limit(1).maybeSingle()
  let comida = existente
  if (!comida) {
    // Un complemento puede ir solo (p. ej. una fruta en la media mañana)
    const { data: nueva, error } = await db.from('comidas')
      .insert({ plan_id: plan.id, nombre: p.franja, dia_semana: p.dia, orden: FRANJAS.indexOf(p.franja as SlotComida) + 1 })
      .select('id, nombre, receta_id').single()
    if (error || !nueva) throw new Error('No se pudo crear la comida')
    comida = nueva
  }

  if (p.alimento_id) {
    const gramos = Number(p.gramos)
    if (!Number.isFinite(gramos) || gramos <= 0 || gramos > MAX_GRAMOS) throw new Error('Cantidad no válida')
    const { data: alimento } = await db.from('alimentos').select('id').eq('id', p.alimento_id).eq('es_comestible', true).maybeSingle()
    if (!alimento) throw new Error('Alimento no encontrado')
    const { error } = await db.from('comida_alimentos').insert({ comida_id: comida.id, alimento_id: p.alimento_id, cantidad_gramos: Math.round(gramos), es_complemento: true })
    if (error) throw new Error('No se pudo añadir el complemento')
  } else {
    const { data: receta } = await db.from('recetas')
      .select('id, porciones, receta_ingredientes!receta_ingredientes_receta_id_fkey(alimento_id, cantidad_gramos)')
      .eq('id', p.receta_id!).eq('estado', 'aprobada').maybeSingle()
    if (!receta) throw new Error('Receta no encontrada o no aprobada')
    const porciones = Math.max(1, Number(receta.porciones ?? 1))
    const filas = ((receta.receta_ingredientes ?? []) as { alimento_id: string | null; cantidad_gramos: number | null }[])
      .filter(i => i.alimento_id && Number(i.cantidad_gramos) > 0)
      // Una ración del postre: las cantidades de la receta están en total
      .map(i => ({ comida_id: comida!.id, alimento_id: i.alimento_id, cantidad_gramos: Math.max(1, Math.round(Number(i.cantidad_gramos) / porciones)), es_complemento: true, complemento_receta_id: receta.id }))
    if (filas.length === 0) throw new Error('La receta no tiene ingredientes vinculados')
    const { error } = await db.from('comida_alimentos').insert(filas)
    if (error) throw new Error('No se pudo añadir el postre')
  }
  if (p.ajustar !== false) await reajustarPlato(db, plan, clienteId, comida)
}

export async function quitarComplemento(
  db: SupabaseClient, plan: PlanObjetivo, clienteId: string,
  p: { comida_id: string; fila?: string; receta?: string; ajustar?: boolean },
) {
  const { data: comida } = await db.from('comidas').select('id, nombre, receta_id').eq('id', p.comida_id).eq('plan_id', plan.id).maybeSingle()
  if (!comida) throw new Error('Comida no encontrada en el plan')
  let q = db.from('comida_alimentos').delete().eq('comida_id', comida.id).eq('es_complemento', true)
  if (p.fila) q = q.eq('id', p.fila)
  else if (p.receta) q = q.eq('complemento_receta_id', p.receta)
  else throw new Error('Falta qué complemento quitar')
  const { error } = await q
  if (error) throw new Error('No se pudo quitar el complemento')
  if (p.ajustar !== false) await reajustarPlato(db, plan, clienteId, comida)
}
