import type { SupabaseClient } from '@supabase/supabase-js'
import { calcularGramajeAjustado } from '@/lib/ingredient-roles'
import type { RolIngrediente } from '@/types'
import { optimizarFactoresReceta } from './optimizar-factores'

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
    // El cliente cambió esta receta por otra de las alternativas: se anota la anterior como descartada (aprendizaje de gustos)
    registrarDescarte?: boolean
    reemplazar?: boolean
  }
) {
  const { comidaId, recetaId } = params
  const reemplazar = params.reemplazar ?? true

  // Postre/complemento ya añadido a esta comida: cuenta en sus macros y se descuenta del objetivo del plato
  // principal para que la comida siga en su objetivo (con un suelo del 40% para no vaciar el plato).
  const { data: complementosData } = await db.from('comida_alimentos')
    .select('cantidad_gramos, alimento:alimentos(calorias, proteinas, carbohidratos, grasas)')
    .eq('comida_id', comidaId).eq('es_complemento', true)
  const complementos = ((complementosData ?? []) as unknown as { cantidad_gramos: number; alimento: { calorias: number; proteinas: number; carbohidratos: number; grasas: number } | null }[])
    .reduce((acc, c) => {
      if (!c.alimento) return acc
      const f = Number(c.cantidad_gramos) / 100
      return { kcal: acc.kcal + c.alimento.calorias * f, p: acc.p + c.alimento.proteinas * f, c: acc.c + c.alimento.carbohidratos * f, g: acc.g + c.alimento.grasas * f }
    }, { kcal: 0, p: 0, c: 0, g: 0 })
  const descontar = (objetivo: number | null | undefined, aporte: number) => {
    const t = Number(objetivo ?? 0)
    return t > 0 ? Math.max(t - aporte, t * 0.4) : objetivo
  }
  const objetivoPlato = {
    kcal: descontar(params.targetKcal, complementos.kcal),
    p: descontar(params.targetProteinas, complementos.p),
    c: descontar(params.targetCarbohidratos, complementos.c),
    g: descontar(params.targetGrasas, complementos.g),
  }

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
  // Las cantidades de receta_ingredientes son de la receta ENTERA (porciones raciones). Todo el escalado
  // (factor por kcal, reglas por rol y optimizador) trabaja sobre UNA RACIÓN: cantidad / porciones. Antes se
  // usaba la receta entera y los límites de escala (mín. 0,25) hacían que una receta de 8-12 raciones saliera
  // con 2-3 raciones de comida (Tepache de 12 raciones: 378 kcal por ración → salía 2175).
  const kcalIngredientesReceta = Number(receta.kcal ?? 0)
  const targetKcal = Number(objetivoPlato.kcal ?? 0)
  const factor = kcalIngredientesReceta > 0 && targetKcal > 0
    ? Math.min(2, Math.max(0.2, targetKcal / kcalIngredientesReceta))
    : 1

  const ingredientesConAlimento = ingredientesRaw
    .filter(ing => ing.alimento_id && ing.alimento && Number(ing.cantidad_gramos ?? 0) > 0)

  const hayObjetivosMacro = [objetivoPlato.p, objetivoPlato.c, objetivoPlato.g]
    .some(t => Number(t ?? 0) > 0)

  // Con objetivos de macro, un optimizador calcula a la vez el factor de cada
  // grupo (proteína, hidrato, grasa, resto) teniendo en cuenta lo que aporta
  // cada ingrediente a los 4 macros. Escalar cada rol por separado hacia el
  // 100% de "su" macro ignoraba la grasa del salmón o la proteína del pan y
  // producía planes con proteína baja y grasa alta.
  const optimizacion = targetKcal > 0 && hayObjetivosMacro
    ? optimizarFactoresReceta(
        ingredientesConAlimento.map(ing => ({
          rol: ing.rol_ingrediente,
          gramos: Number(ing.cantidad_gramos) / porciones,
          fija: ing.es_cantidad_fija === true,
          por100: {
            kcal: Number(ing.alimento!.calorias ?? 0),
            p: Number(ing.alimento!.proteinas ?? 0),
            c: Number(ing.alimento!.carbohidratos ?? 0),
            g: Number(ing.alimento!.grasas ?? 0),
          },
        })),
        {
          kcal: targetKcal,
          p: objetivoPlato.p ?? null,
          c: objetivoPlato.c ?? null,
          g: objetivoPlato.g ?? null,
        },
      )
    : null

  const ingredientesValidos = ingredientesConAlimento
    .map((ing, idx) => {
      const cantidadBase = Number(ing.cantidad_gramos) / porciones
      const cantidadAplicada = calcularCantidadAplicadaReceta(
        cantidadBase,
        ing.rol_ingrediente,
        ing.es_cantidad_fija,
        factor,
        optimizacion ? optimizacion.factores[idx] : null
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

  if (reemplazar) {
    const { error: deleteError } = await db
      .from('comida_alimentos')
      .delete()
      .eq('comida_id', comidaId)
      .eq('es_complemento', false)
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

  const { data: previa } = params.registrarDescarte ? await db.from('comidas').select('receta_id').eq('id', comidaId).maybeSingle() : { data: null }
  const { error: comidaError } = await db
    .from('comidas')
    .update({
      receta_id: receta.id,
      kcal_target: Math.round(macrosAplicados.kcal + complementos.kcal) || (params.targetKcal ? Math.round(Number(params.targetKcal)) : Math.round(Number(receta.kcal ?? 0)) || null),
      proteinas_target: Math.round(macrosAplicados.proteinas + complementos.p) || null,
      carbos_target: Math.round(macrosAplicados.carbohidratos + complementos.c) || null,
      grasas_target: Math.round(macrosAplicados.grasas + complementos.g) || null,
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
    if (params.registrarDescarte && previa?.receta_id && previa.receta_id !== receta.id) {
      await db.from('receta_interacciones_cliente').insert({
        cliente_id: params.clienteId, receta_id: previa.receta_id, tipo: 'swap_rechazada', plan_id: params.planId ?? null, comida_slot: params.comidaSlot ?? null,
      })
    }
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
    factor_proteinas: optimizacion?.factorPorGrupo.P ?? null,
    factor_carbohidratos: optimizacion?.factorPorGrupo.C ?? null,
    factor_grasas: optimizacion?.factorPorGrupo.G ?? null,
  }
}
