export const RECETA_OBJETIVOS = [
  'perdida_grasa',
  'recomposicion',
  'ganancia_muscular',
  'mantenimiento',
  'rendimiento',
  'salud_general',
] as const

export const RECETA_DEPORTES = [
  'fuerza',
  'running',
  'hyrox',
  'ciclismo',
  'triatlon',
  'crossfit',
  'endurance',
  'general',
] as const

export const RECETA_MOMENTOS = [
  'desayuno',
  'media_manana',
  'comida',
  'merienda',
  'cena',
  'pre_entreno',
  'post_entreno',
  'intra_entreno',
  'descanso',
  'refeed',
  'tapering',
  'carga_cho',
] as const

export const RECETA_ESTILOS = [
  'funcional',
  'chef_healthy',
  'batch_cooking',
  'tupper',
  'mediterranea',
  'alto_volumen',
  'comfort_healthy',
  'rapida',
  'gourmet_simple',
] as const

export const RECETA_SLOT_MINIMOS: Record<string, number> = {
  desayuno: 50,
  media_manana: 30,
  comida: 80,
  merienda: 40,
  cena: 80,
  pre_entreno: 25,
  post_entreno: 25,
}

export const RECETA_OBJETIVO_MINIMOS: Record<string, number> = {
  perdida_grasa: 90,
  recomposicion: 90,
  ganancia_muscular: 70,
  mantenimiento: 70,
  rendimiento: 90,
  salud_general: 70,
}

export const RECETA_DEPORTE_MINIMOS: Record<string, number> = {
  running: 50,
  hyrox: 50,
  ciclismo: 40,
  triatlon: 40,
  fuerza: 60,
  crossfit: 40,
  endurance: 60,
}

type RecetaScoringInput = {
  kcal?: number | null
  proteinas?: number | null
  carbohidratos?: number | null
  grasas?: number | null
  score_calidad?: number | null
  objetivos?: string[] | null
  deportes?: string[] | null
  momentos?: string[] | null
  estilos?: string[] | null
  premium_chef?: boolean | null
  adherencia_score?: number | null
}

export function inferirMomentoDesdeTipo(tipo?: string | null) {
  const t = (tipo ?? '').toLowerCase()
  if (t.includes('desayuno')) return 'desayuno'
  if (t.includes('almuerzo')) return 'media_manana'
  if (t.includes('snack')) return 'merienda'
  if (t.includes('merienda')) return 'merienda'
  if (t.includes('cena')) return 'cena'
  if (t.includes('comida')) return 'comida'
  return null
}

export function scoreRecetaParaAgente(
  receta: RecetaScoringInput,
  contexto: {
    objetivo?: string | null
    deporte?: string | null
    momento?: string | null
    targetKcal?: number | null
    targetProteinas?: number | null
    preferirChefHealthy?: boolean
  }
) {
  const calidad = Math.min(Math.max((receta.score_calidad ?? 60) / 100, 0), 1)
  const adherencia = Math.min(Math.max((receta.adherencia_score ?? 65) / 100, 0), 1)
  const objetivos = new Set(receta.objetivos ?? [])
  const deportes = new Set(receta.deportes ?? [])
  const momentos = new Set(receta.momentos ?? [])
  const estilos = new Set(receta.estilos ?? [])

  const objetivoScore = contexto.objetivo
    ? objetivos.has(contexto.objetivo) ? 1 : objetivos.has('salud_general') ? 0.55 : 0.25
    : 0.5

  const deporteScore = contexto.deporte
    ? deportes.has(contexto.deporte) ? 1 : deportes.has('general') ? 0.55 : 0.25
    : 0.5

  const momentoScore = contexto.momento
    ? momentos.has(contexto.momento) ? 1 : 0.35
    : 0.5

  const kcal = Number(receta.kcal ?? 0)
  const prot = Number(receta.proteinas ?? 0)
  const targetKcal = Number(contexto.targetKcal ?? 0)
  const targetProt = Number(contexto.targetProteinas ?? 0)
  const macroScore = targetKcal > 0
    ? Math.max(0, 1 - Math.min(
      Math.abs(kcal - targetKcal) / targetKcal + Math.abs(prot - targetProt) / Math.max(targetProt, 1),
      1
    ))
    : 0.5

  const chefScore = contexto.preferirChefHealthy
    ? receta.premium_chef || estilos.has('chef_healthy') || estilos.has('comfort_healthy') ? 1 : 0.45
    : receta.premium_chef ? 0.75 : 0.6

  return (
    calidad * 0.20 +
    adherencia * 0.15 +
    objetivoScore * 0.18 +
    deporteScore * 0.12 +
    momentoScore * 0.15 +
    macroScore * 0.15 +
    chefScore * 0.05
  )
}

export function estadoCobertura(actual: number, minimo: number) {
  const ratio = minimo > 0 ? actual / minimo : 1
  if (ratio >= 1) return 'cubierto'
  if (ratio >= 0.6) return 'medio'
  if (ratio >= 0.25) return 'bajo'
  return 'critico'
}
