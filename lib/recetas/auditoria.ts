import { createServiceSupabase } from '@/lib/supabase-server'
import {
  calcularScoreCalidadReceta,
  clasificarRecetaProfesional,
  resumenCalidadReceta,
  type RecetaProfesionalInput,
} from './profesional'

type SupabaseService = ReturnType<typeof createServiceSupabase>

interface RecetaDb {
  id: string
  nombre: string | null
  descripcion: string | null
  instrucciones: string | null
  categoria: string | null
  tipo_plato: string | null
  dificultad: string | null
  imagen_url: string | null
  url_origen: string | null
  kcal: number | null
  proteinas: number | null
  carbohidratos: number | null
  grasas: number | null
  fibra: number | null
  porciones: number | null
  intolerancias: string[] | null
  tags: string[] | null
  score_calidad?: number | null
  nivel_fit?: string | null
  tipo_uso?: string | null
  contexto_uso?: string | null
  apta_cliente?: string | null
  alcohol_culinario?: boolean | null
  quality_estado_sugerido?: string | null
}

interface IngredienteDb {
  id: string
  alimento_id: string | null
  nombre_libre: string | null
  cantidad_gramos: number | null
  alimentos?: { nombre: string | null; calorias: number | null } | null
}

function toInput(receta: RecetaDb, ingredientes: IngredienteDb[], conPrecio: Set<string>): RecetaProfesionalInput {
  return {
    nombre: receta.nombre,
    descripcion: receta.descripcion,
    instrucciones: receta.instrucciones,
    categoria: receta.categoria,
    tipo_plato: receta.tipo_plato,
    dificultad: receta.dificultad,
    imagen_url: receta.imagen_url,
    url_origen: receta.url_origen,
    kcal: receta.kcal,
    proteinas: receta.proteinas,
    carbohidratos: receta.carbohidratos,
    grasas: receta.grasas,
    fibra: receta.fibra,
    porciones: receta.porciones,
    intolerancias: receta.intolerancias,
    tags: receta.tags,
    ingredientes: ingredientes.map(i => ({
      alimento_id: i.alimento_id,
      nombre_libre: i.nombre_libre,
      cantidad_gramos: i.cantidad_gramos,
      tiene_precio: i.alimento_id ? conPrecio.has(i.alimento_id) : false,
      nombre_alimento: i.alimentos?.nombre ?? null,
      kcal_alimento: i.alimentos?.calorias ?? null,
    })),
  }
}

export async function auditarRecetaProfesional(
  srv: SupabaseService,
  recetaId: string,
  evento = 'quality_check',
  origen = 'sistema'
) {
  const [{ data: receta, error: recetaError }, { data: ingredientes, error: ingredientesError }] = await Promise.all([
    srv
      .from('recetas')
      .select(`
        id, nombre, descripcion, instrucciones, categoria, tipo_plato, dificultad,
        imagen_url, url_origen, kcal, proteinas, carbohidratos, grasas, fibra,
        porciones, intolerancias, tags, score_calidad, nivel_fit, tipo_uso,
        contexto_uso, apta_cliente, alcohol_culinario, quality_estado_sugerido
      `)
      .eq('id', recetaId)
      .single(),
    srv
      .from('receta_ingredientes')
      .select('id, alimento_id, nombre_libre, cantidad_gramos, alimentos!left(nombre, calorias)')
      .eq('receta_id', recetaId),
  ])

  if (recetaError || !receta) throw new Error(recetaError?.message || 'Receta no encontrada')
  if (ingredientesError) throw new Error(ingredientesError.message)

  const typedReceta = receta as RecetaDb
  const typedIngredientes = (ingredientes || []) as IngredienteDb[]
  const alimentoIds = typedIngredientes.map(i => i.alimento_id).filter((id): id is string => Boolean(id))
  const { data: precios, error: preciosError } = alimentoIds.length
    ? await srv.from('mejores_precios_por_alimento').select('alimento_id').in('alimento_id', alimentoIds)
    : { data: [], error: null }

  if (preciosError) throw new Error(preciosError.message)

  const conPrecio = new Set((precios || []).map(p => p.alimento_id as string))
  const input = toInput(typedReceta, typedIngredientes, conPrecio)
  const clasificacion = clasificarRecetaProfesional(input)
  const score = calcularScoreCalidadReceta(input)
  const resumen = resumenCalidadReceta(score)

  const issues = {
    bloqueantes: score.bloqueantes,
    avisos: score.avisos,
    banda: score.banda,
    estado_sugerido: resumen.estado_sugerido,
  }

  const update = {
    score_calidad: score.score,
    score_calidad_detalle: score.desglose,
    nivel_fit: clasificacion.nivel_fit,
    tipo_uso: clasificacion.tipo_uso,
    contexto_uso: clasificacion.contexto_uso,
    apta_cliente: clasificacion.apta_cliente,
    alcohol_culinario: clasificacion.alcohol_culinario,
    quality_estado_sugerido: resumen.estado_sugerido,
    quality_issues: issues,
    quality_actualizado_at: new Date().toISOString(),
  }

  const cambios = {
    score_calidad: [typedReceta.score_calidad ?? null, score.score],
    nivel_fit: [typedReceta.nivel_fit ?? null, clasificacion.nivel_fit],
    tipo_uso: [typedReceta.tipo_uso ?? null, clasificacion.tipo_uso],
    contexto_uso: [typedReceta.contexto_uso ?? null, clasificacion.contexto_uso],
    apta_cliente: [typedReceta.apta_cliente ?? null, clasificacion.apta_cliente],
    alcohol_culinario: [typedReceta.alcohol_culinario ?? null, clasificacion.alcohol_culinario],
    quality_estado_sugerido: [typedReceta.quality_estado_sugerido ?? null, resumen.estado_sugerido],
  }

  const cambioReal = Object.values(cambios).some(([antes, despues]) => antes !== despues)

  const { error: updateError } = await srv.from('recetas').update(update).eq('id', recetaId)
  if (updateError) throw new Error(updateError.message)

  if (cambioReal || evento !== 'quality_check') {
    await srv.from('recetas_auditoria').insert({
      receta_id: recetaId,
      evento,
      score_antes: typedReceta.score_calidad ?? null,
      score_despues: score.score,
      issues,
      cambios,
      origen,
    })
  }

  return {
    receta: typedReceta,
    ingredientes: typedIngredientes,
    conPrecio,
    clasificacion,
    score,
    resumen,
  }
}
