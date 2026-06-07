import type { RecetaCandidata } from './types'

type SupabaseLike = {
  from: (table: string) => any
}

function redondear(value: number) {
  return Math.round(value * 10) / 10
}

function calcularMacros(receta: RecetaCandidata) {
  return receta.ingredientes.reduce(
    (acc, ingrediente) => {
      if (!ingrediente.alimentoId) {
        throw new Error(`No se puede insertar receta con ingrediente sin alimento_id: ${ingrediente.nombre}`)
      }
      if (!ingrediente.macros100g) {
        throw new Error(`No se puede calcular macros sin macros100g: ${ingrediente.nombre}`)
      }

      const factor = ingrediente.cantidadGramos / 100
      return {
        kcal: acc.kcal + ingrediente.macros100g.calorias * factor,
        proteinas: acc.proteinas + ingrediente.macros100g.proteinas * factor,
        carbohidratos: acc.carbohidratos + ingrediente.macros100g.carbohidratos * factor,
        grasas: acc.grasas + ingrediente.macros100g.grasas * factor,
        fibra: acc.fibra + ingrediente.macros100g.fibra * factor,
      }
    },
    { kcal: 0, proteinas: 0, carbohidratos: 0, grasas: 0, fibra: 0 },
  )
}

export function construirPayloadInsercionReceta(receta: RecetaCandidata, options: { imagenPrompt?: string } = {}) {
  const macros = calcularMacros(receta)
  const pesoTotal = receta.ingredientes.reduce((sum, ingrediente) => sum + ingrediente.cantidadGramos, 0)

  return {
    receta: {
      nombre: receta.nombre,
      descripcion: receta.descripcion,
      instrucciones: receta.instrucciones.join('\n'),
      estado: 'en_revision' as const,
      fuente: 'agente_recetario_pro',
      fuente_tipo: 'ia_generada',
      intolerancias: [],
      porciones: 1,
      kcal: redondear(macros.kcal),
      proteinas: redondear(macros.proteinas),
      carbohidratos: redondear(macros.carbohidratos),
      grasas: redondear(macros.grasas),
      fibra: redondear(macros.fibra),
      peso_total_g: redondear(pesoTotal),
      objetivos: receta.objetivos,
      deportes: receta.deportes,
      momentos: receta.momentos,
      tipo_plato: receta.tipoPlato,
      digestibilidad: receta.digestibilidad,
      imagen_estado: 'pendiente_revision',
      imagen_needs_review: true,
      imagen_prompt_base: options.imagenPrompt,
      planning_roles: ['generated_by_agent', 'needs_review', receta.trazabilidad.plantillaId],
      raw_scrape: receta.trazabilidad,
    },
    ingredientes: receta.ingredientes.map((ingrediente) => ({
      alimento_id: ingrediente.alimentoId,
      nombre_libre: ingrediente.nombre,
      cantidad_gramos: ingrediente.cantidadGramos,
      rol_ingrediente: ingrediente.rolIngrediente,
      es_cantidad_fija: ingrediente.esCantidadFija ?? false,
    })),
  }
}

export async function insertarRecetaEnRevision(
  supabase: SupabaseLike,
  receta: RecetaCandidata,
  options: { imagenPrompt?: string } = {},
) {
  const payload = construirPayloadInsercionReceta(receta, options)

  const { data: duplicadas, error: duplicateError } = await supabase
    .from('recetas')
    .select('id,nombre,estado')
    .eq('nombre', payload.receta.nombre)
    .in('estado', ['en_revision', 'aprobada'])
    .limit(1)

  if (duplicateError) throw new Error(duplicateError.message)

  if ((duplicadas ?? []).length > 0) {
    return {
      estado: 'duplicada' as const,
      recetaId: duplicadas[0].id as string,
    }
  }

  const { data: recetaInsertada, error: recetaError } = await supabase
    .from('recetas')
    .insert(payload.receta)
    .select('id')
    .single()

  if (recetaError) throw new Error(recetaError.message)
  if (!recetaInsertada?.id) throw new Error('Supabase no devolvio id de receta insertada')

  const ingredientes = payload.ingredientes.map((ingrediente, index) => ({
    ...ingrediente,
    receta_id: recetaInsertada.id,
    orden: index + 1,
  }))

  const { error: ingredientesError } = await supabase
    .from('receta_ingredientes')
    .insert(ingredientes)

  if (ingredientesError) {
    await supabase.from('recetas').delete().eq('id', recetaInsertada.id)
    throw new Error(ingredientesError.message)
  }

  return {
    estado: 'insertada' as const,
    recetaId: recetaInsertada.id as string,
  }
}
