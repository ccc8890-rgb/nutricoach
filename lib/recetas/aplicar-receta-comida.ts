import type { SupabaseClient } from '@supabase/supabase-js'

type TipoInteraccion = 'asignada_plan' | 'swap_elegida'

type RecetaIngredienteRow = {
  id: string
  alimento_id: string | null
  nombre_libre: string | null
  cantidad_gramos: number | null
  orden: number | null
  alimento: {
    id: string
    nombre: string
    calorias: number
    proteinas: number
    carbohidratos: number
    grasas: number
    fibra: number | null
  } | null
}

function redondearGramajePractico(gramos: number) {
  if (!Number.isFinite(gramos) || gramos <= 0) return 1
  if (gramos <= 5) return Math.max(1, Math.round(gramos))
  if (gramos <= 50) return Math.max(5, Math.round(gramos / 5) * 5)
  if (gramos <= 120) return Math.round(gramos / 10) * 10
  return Math.round(gramos / 25) * 25
}

export type IngredienteComidaAplicado = {
  id: string
  alimento_id: string
  cantidad_gramos: number
  factor_ajuste?: number | null
  alimento: {
    nombre: string
    calorias: number
    proteinas: number
    carbohidratos: number
    grasas: number
    fibra: number
  }
}

export async function aplicarRecetaAComida(
  db: SupabaseClient,
  params: {
    comidaId: string
    recetaId: string
    clienteId?: string | null
    planId?: string | null
    comidaSlot?: string | null
    targetKcal?: number | null
    tipoInteraccion?: TipoInteraccion
    reemplazar?: boolean
  }
) {
  const { comidaId, recetaId } = params
  const reemplazar = params.reemplazar ?? true

  const { data: receta, error: recetaError } = await db
    .from('recetas')
    .select(`
      id, nombre, imagen_url, kcal, proteinas, carbohidratos, grasas, tiempo_prep_min, porciones,
      receta_ingredientes!receta_ingredientes_receta_id_fkey(
        id, alimento_id, nombre_libre, cantidad_gramos, orden,
        alimento:alimentos(id, nombre, calorias, proteinas, carbohidratos, grasas, fibra)
      )
    `)
    .eq('id', recetaId)
    .eq('estado', 'aprobada')
    .single()

  if (recetaError || !receta) {
    throw new Error('Receta no encontrada o no aprobada')
  }

  const ingredientesRaw = ((receta.receta_ingredientes ?? []) as unknown as RecetaIngredienteRow[])
    .sort((a, b) => (a.orden ?? 0) - (b.orden ?? 0))

  const porciones = Math.max(1, Number(receta.porciones ?? 1))
  const kcalIngredientesReceta = Number(receta.kcal ?? 0) * porciones
  const targetKcal = Number(params.targetKcal ?? 0)
  const factor = kcalIngredientesReceta > 0 && targetKcal > 0
    ? Math.min(2, Math.max(0.2, targetKcal / kcalIngredientesReceta))
    : 1
  const macroFactor = porciones * factor

  const ingredientesValidos = ingredientesRaw
    .filter(ing => ing.alimento_id && ing.alimento && Number(ing.cantidad_gramos ?? 0) > 0)
    .map(ing => ({
      comida_id: comidaId,
      alimento_id: ing.alimento_id!,
      cantidad_gramos: redondearGramajePractico(Number(ing.cantidad_gramos) * factor),
      factor_ajuste: factor,
    }))

  if (ingredientesValidos.length === 0) {
    throw new Error('La receta no tiene ingredientes vinculados a alimentos')
  }

  if (reemplazar) {
    const { error: deleteError } = await db
      .from('comida_alimentos')
      .delete()
      .eq('comida_id', comidaId)
    if (deleteError) throw new Error(deleteError.message)
  }

  const { data: insertados, error: insertError } = await db
    .from('comida_alimentos')
    .insert(ingredientesValidos)
    .select(`
      id, alimento_id, cantidad_gramos, factor_ajuste,
      alimento:alimentos(nombre, calorias, proteinas, carbohidratos, grasas, fibra)
    `)

  if (insertError) throw new Error(insertError.message)

  const { error: comidaError } = await db
    .from('comidas')
    .update({
      receta_id: receta.id,
      kcal_target: params.targetKcal ? Math.round(Number(params.targetKcal)) : Math.round(Number(receta.kcal ?? 0)) || null,
      proteinas_target: receta.proteinas ? Math.round(Number(receta.proteinas) * macroFactor) : null,
      carbos_target: receta.carbohidratos ? Math.round(Number(receta.carbohidratos) * macroFactor) : null,
      grasas_target: receta.grasas ? Math.round(Number(receta.grasas) * macroFactor) : null,
    })
    .eq('id', comidaId)
  if (comidaError) throw new Error(comidaError.message)

  if (params.clienteId && params.tipoInteraccion) {
    await db.from('receta_interacciones_cliente').insert({
      cliente_id: params.clienteId,
      receta_id: receta.id,
      tipo: params.tipoInteraccion,
      plan_id: params.planId ?? null,
      comida_slot: params.comidaSlot ?? null,
    })
  }

  const ingredientes = ((insertados ?? []) as unknown as IngredienteComidaAplicado[]).map(ing => ({
    ...ing,
    alimento: {
      nombre: ing.alimento.nombre,
      calorias: ing.alimento.calorias,
      proteinas: ing.alimento.proteinas,
      carbohidratos: ing.alimento.carbohidratos,
      grasas: ing.alimento.grasas,
      fibra: ing.alimento.fibra ?? 0,
    },
  }))

  return {
    receta: {
      id: receta.id,
      nombre: receta.nombre,
      imagen_url: receta.imagen_url,
      kcal: receta.kcal,
      proteinas: receta.proteinas,
      carbohidratos: receta.carbohidratos,
      grasas: receta.grasas,
      tiempo_prep_min: receta.tiempo_prep_min,
    },
    ingredientes,
    sin_vincular: ingredientesRaw.filter(ing => !ing.alimento_id || !ing.alimento).length,
    factor_ajuste: factor,
  }
}
