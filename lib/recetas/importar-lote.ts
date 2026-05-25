type RecetaGeneradaInput = {
  nombre?: unknown
  descripcion?: unknown
  categoria?: unknown
  tipo_plato?: unknown
  porciones?: unknown
  descripcion_porcion?: unknown
  tiempo_prep_min?: unknown
  tiempo_coccion_min?: unknown
  kcal?: unknown
  proteinas?: unknown
  carbohidratos?: unknown
  grasas?: unknown
  fibra?: unknown
  ingredientes?: unknown
  instrucciones?: unknown
  consejos?: unknown
  tags?: unknown
  objetivos?: unknown
  deportes?: unknown
  momentos?: unknown
  estilos?: unknown
  premium_chef?: unknown
  uso_personal?: unknown
  batch_cooking?: unknown
  tupper?: unknown
  digestibilidad?: unknown
  densidad_energetica?: unknown
  nivel_elaboracion?: unknown
  adherencia_score?: unknown
  coste_estimado_nivel?: unknown
}

export type RecetaImportable = {
  nombre: string
  descripcion: string | null
  categoria: string | null
  tipo_plato: string | null
  porciones: number
  descripcion_porcion: string | null
  tiempo_prep_min: number | null
  tiempo_coccion_min: number | null
  kcal: number | null
  proteinas: number | null
  carbohidratos: number | null
  grasas: number | null
  fibra: number | null
  instrucciones: string | null
  consejos: string | null
  tags: string[]
  objetivos: string[]
  deportes: string[]
  momentos: string[]
  estilos: string[]
  premium_chef: boolean
  uso_personal: boolean
  batch_cooking: boolean
  tupper: boolean
  digestibilidad: string | null
  densidad_energetica: string | null
  nivel_elaboracion: number
  adherencia_score: number
  coste_estimado_nivel: string | null
  ingredientes: Array<{ nombre_libre: string; cantidad_gramos: number; orden: number }>
}

export const MAX_IMPORT_RECETAS_LOTE = 20

function asString(value: unknown, max = 500) {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  return trimmed ? trimmed.slice(0, max) : null
}

function asNumber(value: unknown, min: number, max: number, fallback: number | null = null) {
  const n = Number(value)
  if (!Number.isFinite(n)) return fallback
  return Math.min(max, Math.max(min, n))
}

function asStringArray(value: unknown, maxItems = 8) {
  if (!Array.isArray(value)) return []
  return value
    .filter((item): item is string => typeof item === 'string')
    .map(item => item.trim().slice(0, 80))
    .filter(Boolean)
    .slice(0, maxItems)
}

function asBool(value: unknown) {
  return Boolean(value)
}

function normalizarIngredientes(value: unknown) {
  if (!Array.isArray(value)) return []
  return value
    .map((item, idx) => {
      if (!item || typeof item !== 'object') return null
      const record = item as Record<string, unknown>
      const nombre = asString(record.nombre ?? record.nombre_libre, 120)
      if (!nombre) return null
      return {
        nombre_libre: nombre,
        cantidad_gramos: asNumber(record.cantidad_gramos, 0, 3000, 100) ?? 100,
        orden: idx,
      }
    })
    .filter((item): item is { nombre_libre: string; cantidad_gramos: number; orden: number } => Boolean(item))
    .slice(0, 40)
}

export function normalizarRecetasGeneradas(input: unknown) {
  const recetasRaw = Array.isArray(input)
    ? input
    : input && typeof input === 'object' && Array.isArray((input as { recetas?: unknown }).recetas)
      ? (input as { recetas: unknown[] }).recetas
      : []

  return recetasRaw
    .slice(0, MAX_IMPORT_RECETAS_LOTE)
    .map((raw): RecetaImportable | null => {
      if (!raw || typeof raw !== 'object') return null
      const receta = raw as RecetaGeneradaInput
      const nombre = asString(receta.nombre, 160)
      if (!nombre) return null

      return {
        nombre,
        descripcion: asString(receta.descripcion, 700),
        categoria: asString(receta.categoria, 80),
        tipo_plato: asString(receta.tipo_plato, 80),
        porciones: Math.round(asNumber(receta.porciones, 1, 20, 1) ?? 1),
        descripcion_porcion: asString(receta.descripcion_porcion, 160),
        tiempo_prep_min: asNumber(receta.tiempo_prep_min, 0, 480, null),
        tiempo_coccion_min: asNumber(receta.tiempo_coccion_min, 0, 480, null),
        kcal: asNumber(receta.kcal, 0, 3000, null),
        proteinas: asNumber(receta.proteinas, 0, 250, null),
        carbohidratos: asNumber(receta.carbohidratos, 0, 500, null),
        grasas: asNumber(receta.grasas, 0, 250, null),
        fibra: asNumber(receta.fibra, 0, 100, null),
        instrucciones: asString(receta.instrucciones, 3000),
        consejos: asString(receta.consejos, 1000),
        tags: asStringArray(receta.tags, 12),
        objetivos: asStringArray(receta.objetivos, 8),
        deportes: asStringArray(receta.deportes, 8),
        momentos: asStringArray(receta.momentos, 8),
        estilos: asStringArray(receta.estilos, 8),
        premium_chef: asBool(receta.premium_chef),
        uso_personal: asBool(receta.uso_personal),
        batch_cooking: asBool(receta.batch_cooking),
        tupper: asBool(receta.tupper),
        digestibilidad: asString(receta.digestibilidad, 40),
        densidad_energetica: asString(receta.densidad_energetica, 40),
        nivel_elaboracion: Math.round(asNumber(receta.nivel_elaboracion, 1, 5, 2) ?? 2),
        adherencia_score: Math.round(asNumber(receta.adherencia_score, 0, 100, 70) ?? 70),
        coste_estimado_nivel: asString(receta.coste_estimado_nivel, 40),
        ingredientes: normalizarIngredientes(receta.ingredientes),
      }
    })
    .filter((receta): receta is RecetaImportable => Boolean(receta))
}
