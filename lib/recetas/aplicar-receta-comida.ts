import type { SupabaseClient } from '@supabase/supabase-js'
import { calcularGramajeAjustado } from '@/lib/ingredient-roles'
import type { RolIngrediente } from '@/types'

type TipoInteraccion = 'asignada_plan' | 'swap_elegida'

type RecetaIngredienteRow = {
  id: string
  alimento_id: string | null
  nombre_libre: string | null
  cantidad_gramos: number | null
  rol_ingrediente: RolIngrediente | null
  es_cantidad_fija: boolean | null
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

export function redondearGramajePractico(gramos: number) {
  if (!Number.isFinite(gramos) || gramos <= 0) return 1
  if (gramos <= 5) return Math.max(1, Math.round(gramos))
  if (gramos <= 50) return Math.max(5, Math.round(gramos / 5) * 5)
  if (gramos <= 120) return Math.round(gramos / 10) * 10
  return Math.round(gramos / 25) * 25
}

export function calcularCantidadAplicadaReceta(
  cantidadGramos: number,
  rolIngrediente: RolIngrediente | null | undefined,
  esCantidadFija: boolean | null | undefined,
  factorBase: number,
  // Factor ya calculado a partir del macro objetivo de ESTE rol (proteína,
  // carbohidrato o grasa) en vez del factor genérico por kcal. Cuando se
  // pasa, sustituye por completo al damping de SCALING_RULES — ese damping
  // existe para roles SIN objetivo propio (amortiguar el crecimiento de
  // grasa/lácteos al escalar solo por kcal); si el rol ya tiene su propio
  // objetivo de macro, aplicar además el damping generaría un déficit
  // artificial contra ese objetivo.
  factorDirecto?: number | null
) {
  const esFija = esCantidadFija === true
  const ajustada = !esFija && factorDirecto != null
    ? cantidadGramos * factorDirecto
    : calcularGramajeAjustado(cantidadGramos, rolIngrediente, esFija, factorBase)
  const redondeada = redondearGramajePractico(ajustada)
  return {
    cantidad_gramos: redondeada,
    factor_ajuste: cantidadGramos > 0 ? redondeada / cantidadGramos : factorBase,
  }
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
    // Objetivos de macro específicos (opcionales, retrocompatibles). Sin
    // ellos, el comportamiento es idéntico al anterior: un único factor
    // derivado de targetKcal para toda la receta. Con ellos, los
    // ingredientes con rol proteina_principal/carbohidrato_base/
    // grasa_saludable escalan hacia SU propio macro objetivo en vez de
    // heredar el ratio de macros que ya traía la receta — antes, dos
    // recetas con las mismas kcal pero grasa/carbohidrato invertidos
    // producían el mismo plato escalado, y el total del día podía
    // desviarse ~40-80% en un macro aunque las kcal cuadraran.
    targetProteinas?: number | null
    targetCarbohidratos?: number | null
    targetGrasas?: number | null
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
        id, alimento_id, nombre_libre, cantidad_gramos, rol_ingrediente, es_cantidad_fija, orden,
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

  const ingredientesConAlimento = ingredientesRaw
    .filter(ing => ing.alimento_id && ing.alimento && Number(ing.cantidad_gramos ?? 0) > 0)

  // Factores por macro: cuánto aporta HOY (sin escalar) cada rol con
  // objetivo propio, frente a lo que se pide para la comida. Solo se usan
  // si el rol existe en la receta y aporta >0 de ese macro — si no,
  // ese/esos ingredientes siguen el factor general por kcal, igual que
  // antes.
  const MACRO_POR_ROL: Partial<Record<RolIngrediente, 'proteinas' | 'carbohidratos' | 'grasas'>> = {
    proteina_principal: 'proteinas',
    carbohidrato_base: 'carbohidratos',
    grasa_saludable: 'grasas',
  }
  function factorRol(rol: RolIngrediente, target: number | null | undefined): number | null {
    if (!target || target <= 0) return null
    const campoMacro = MACRO_POR_ROL[rol]
    if (!campoMacro) return null
    const aportado = ingredientesConAlimento
      .filter(ing => ing.rol_ingrediente === rol)
      .reduce((sum, ing) => sum + Number(ing.alimento![campoMacro] ?? 0) * (Number(ing.cantidad_gramos) / 100), 0)
    if (aportado <= 0) return null
    return Math.min(2.5, Math.max(0.2, target / aportado))
  }
  const factorProt = factorRol('proteina_principal', params.targetProteinas)
  const factorCarb = factorRol('carbohidrato_base', params.targetCarbohidratos)
  const factorGrasa = factorRol('grasa_saludable', params.targetGrasas)

  const ingredientesValidos = ingredientesConAlimento
    .map(ing => {
      const cantidadBase = Number(ing.cantidad_gramos)
      const factorDirecto =
        ing.rol_ingrediente === 'proteina_principal' ? factorProt :
        ing.rol_ingrediente === 'carbohidrato_base' ? factorCarb :
        ing.rol_ingrediente === 'grasa_saludable' ? factorGrasa :
        null
      const cantidadAplicada = calcularCantidadAplicadaReceta(
        cantidadBase,
        ing.rol_ingrediente,
        ing.es_cantidad_fija,
        factor,
        factorDirecto
      )

      return {
        comida_id: comidaId,
        alimento_id: ing.alimento_id!,
        cantidad_gramos: cantidadAplicada.cantidad_gramos,
        factor_ajuste: cantidadAplicada.factor_ajuste,
        alimento: ing.alimento!,
      }
    })

  if (ingredientesValidos.length === 0) {
    throw new Error('La receta no tiene ingredientes vinculados a alimentos')
  }

  // Corrección final: escalar cada rol hacia SU macro objetivo de forma
  // independiente puede, sumado, superar ampliamente el objetivo de kcal
  // (si proteína, carbohidrato y grasa suben cada uno por su lado, el
  // total no es la suma de un solo factor — se multiplica). Si el
  // resultado se desvía >15% de targetKcal, se reajusta todo el conjunto
  // con un factor uniforme para devolver las kcal a rango, preservando el
  // ratio de macros ya logrado entre sí (no deshace la mejora, solo ajusta
  // el tamaño de la ración completa). Los ingredientes de cantidad fija no
  // se tocan en esta corrección, igual que en el resto del escalado.
  if (targetKcal > 0 && (factorProt !== null || factorCarb !== null || factorGrasa !== null)) {
    const kcalResultante = ingredientesValidos.reduce(
      (sum, ing) => sum + Number(ing.alimento.calorias ?? 0) * (ing.cantidad_gramos / 100), 0
    )
    if (kcalResultante > 0) {
      const desviacion = kcalResultante / targetKcal
      if (desviacion > 1.15 || desviacion < 0.85) {
        const correccion = targetKcal / kcalResultante
        for (let idx = 0; idx < ingredientesValidos.length; idx++) {
          if (ingredientesConAlimento[idx]?.es_cantidad_fija === true) continue
          const original = ingredientesValidos[idx]
          const cantidadCorregida = redondearGramajePractico(original.cantidad_gramos * correccion)
          const cantidadBaseIng = Number(ingredientesConAlimento[idx].cantidad_gramos)
          ingredientesValidos[idx] = {
            ...original,
            cantidad_gramos: cantidadCorregida,
            factor_ajuste: cantidadBaseIng > 0 ? cantidadCorregida / cantidadBaseIng : original.factor_ajuste,
          }
        }
      }
    }
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
    .insert(ingredientesValidos.map(ing => ({
      comida_id: ing.comida_id,
      alimento_id: ing.alimento_id,
      cantidad_gramos: ing.cantidad_gramos,
      factor_ajuste: ing.factor_ajuste,
    })))
    .select(`
      id, alimento_id, cantidad_gramos, factor_ajuste,
      alimento:alimentos(nombre, calorias, proteinas, carbohidratos, grasas, fibra)
    `)

  if (insertError) throw new Error(insertError.message)

  const macrosAplicados = ingredientesValidos.reduce((acc, ing) => {
    const factor100 = ing.cantidad_gramos / 100
    acc.kcal += Number(ing.alimento.calorias ?? 0) * factor100
    acc.proteinas += Number(ing.alimento.proteinas ?? 0) * factor100
    acc.carbohidratos += Number(ing.alimento.carbohidratos ?? 0) * factor100
    acc.grasas += Number(ing.alimento.grasas ?? 0) * factor100
    return acc
  }, { kcal: 0, proteinas: 0, carbohidratos: 0, grasas: 0 })

  const { error: comidaError } = await db
    .from('comidas')
    .update({
      receta_id: receta.id,
      kcal_target: Math.round(macrosAplicados.kcal) || (params.targetKcal ? Math.round(Number(params.targetKcal)) : Math.round(Number(receta.kcal ?? 0)) || null),
      proteinas_target: Math.round(macrosAplicados.proteinas) || null,
      carbos_target: Math.round(macrosAplicados.carbohidratos) || null,
      grasas_target: Math.round(macrosAplicados.grasas) || null,
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
    // Factores por macro realmente aplicados (null = ese rol no estaba
    // presente en la receta o no se pidió objetivo, y usó el factor_ajuste
    // general por kcal en su lugar).
    factor_proteinas: factorProt,
    factor_carbohidratos: factorCarb,
    factor_grasas: factorGrasa,
  }
}
