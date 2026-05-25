export type RecipeIntelligenceTier = 'elite' | 'pro' | 'usable' | 'revisar' | 'bloqueada'

export type RecipeIntelligenceInput = {
  nombre?: string | null
  descripcion?: string | null
  instrucciones?: string | null
  tipo_plato?: string | null
  categoria?: string | null
  kcal?: number | null
  proteinas?: number | null
  carbohidratos?: number | null
  grasas?: number | null
  fibra?: number | null
  porciones?: number | null
  tiempo_prep_min?: number | null
  tiempo_coccion_min?: number | null
  score_calidad?: number | null
  adherencia_score?: number | null
  imagen_url?: string | null
  imagen_estado?: string | null
  imagen_quality_score?: number | null
  imagen_realismo_score?: number | null
  imagen_match_receta_score?: number | null
  premium_chef?: boolean | null
  batch_cooking?: boolean | null
  tupper?: boolean | null
  digestibilidad?: string | null
  densidad_energetica?: string | null
  coste_estimado_nivel?: string | null
  nivel_elaboracion?: number | null
  intolerancias?: string[] | null
  objetivos?: string[] | null
  deportes?: string[] | null
  momentos?: string[] | null
  estilos?: string[] | null
  ingredientes?: Array<{
    nombre_libre?: string | null
    alimento_id?: string | null
    cantidad_gramos?: number | null
  }> | null
}

export type RecipeIntelligenceResult = {
  score: number
  tier: RecipeIntelligenceTier
  macro_flex_score: number
  flags: string[]
  planning_roles: string[]
  detail: {
    quality: number
    macro_fit: number
    adherence: number
    execution: number
    agent_readiness: number
    visual: number
    ingredient_match_pct: number
    human_rounding_pct: number
  }
}

function n(value: unknown) {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : 0
}

function clamp(value: number, min = 0, max = 100) {
  return Math.max(min, Math.min(max, value))
}

function textOf(receta: RecipeIntelligenceInput) {
  return [
    receta.nombre,
    receta.descripcion,
    receta.tipo_plato,
    receta.categoria,
    receta.objetivos?.join(' '),
    receta.deportes?.join(' '),
    receta.momentos?.join(' '),
    receta.estilos?.join(' '),
    receta.ingredientes?.map(i => i.nombre_libre).join(' '),
  ].filter(Boolean).join(' ').toLowerCase()
}

function roundFriendly(cantidad: number) {
  if (cantidad <= 0) return false
  if (cantidad <= 10) return cantidad % 1 === 0
  if (cantidad <= 50) return cantidad % 5 === 0
  if (cantidad <= 250) return cantidad % 10 === 0 || cantidad % 25 === 0
  return cantidad % 25 === 0 || cantidad % 50 === 0
}

function tierFrom(score: number, flags: Set<string>): RecipeIntelligenceTier {
  if (flags.has('needs_macro_review') || flags.has('needs_ingredient_match')) return 'bloqueada'
  if (score >= 88) return 'elite'
  if (score >= 76) return 'pro'
  if (score >= 62) return 'usable'
  return 'revisar'
}

export function calcularRecipeIntelligence(receta: RecipeIntelligenceInput): RecipeIntelligenceResult {
  const flags = new Set<string>()
  const roles = new Set<string>()
  const ingredientes = receta.ingredientes ?? []
  const kcal = n(receta.kcal)
  const proteinas = n(receta.proteinas)
  const carbohidratos = n(receta.carbohidratos)
  const grasas = n(receta.grasas)
  const fibra = n(receta.fibra)
  const porciones = Math.max(1, n(receta.porciones) || 1)
  const texto = textOf(receta)

  const ingredientMatchPct = ingredientes.length
    ? ingredientes.filter(i => Boolean(i.alimento_id)).length / ingredientes.length
    : 0
  const humanRoundingPct = ingredientes.length
    ? ingredientes.filter(i => roundFriendly(n(i.cantidad_gramos))).length / ingredientes.length
    : 0

  if (!ingredientes.length) flags.add('needs_ingredients')
  if (ingredientMatchPct < 0.85) flags.add('needs_ingredient_match')
  if (kcal <= 0 || proteinas <= 0) flags.add('needs_macro_review')
  if (!receta.imagen_url || receta.imagen_estado !== 'aprobada') flags.add('needs_image')
  if (kcal >= 850) flags.add('high_kcal')
  if (proteinas >= 35) flags.add('high_protein')
  if (humanRoundingPct < 0.7) flags.add('needs_human_rounding')

  const proteinDensity = kcal > 0 ? clamp((proteinas * 4 / kcal) * 220) : 0
  const fatLoad = kcal > 0 ? grasas * 9 / kcal : 0
  const carbUtility = kcal > 0 ? carbohidratos * 4 / kcal : 0
  const macroFit = clamp(
    proteinDensity * 0.42 +
    clamp(100 - Math.max(0, fatLoad - 0.42) * 180) * 0.22 +
    clamp(fibra * 8) * 0.16 +
    clamp(100 - Math.abs(kcal - 550) / 6) * 0.2
  )

  const tiempoTotal = n(receta.tiempo_prep_min) + n(receta.tiempo_coccion_min)
  const dificultad = n(receta.nivel_elaboracion)
  const execution = clamp(
    (tiempoTotal <= 0 ? 55 : tiempoTotal <= 20 ? 95 : tiempoTotal <= 35 ? 82 : tiempoTotal <= 55 ? 64 : 45) * 0.35 +
    (dificultad <= 0 ? 65 : dificultad <= 2 ? 95 : dificultad === 3 ? 80 : dificultad === 4 ? 62 : 45) * 0.25 +
    humanRoundingPct * 100 * 0.25 +
    (receta.batch_cooking || receta.tupper || receta.estilos?.includes('batch_cooking') || receta.estilos?.includes('tupper') ? 100 : 60) * 0.15
  )

  const visual = clamp(
    (receta.imagen_url ? 45 : 0) +
    n(receta.imagen_quality_score) * 0.22 +
    n(receta.imagen_realismo_score) * 0.18 +
    n(receta.imagen_match_receta_score) * 0.15
  )

  const adherence = clamp(
    n(receta.adherencia_score || 68) * 0.55 +
    (receta.premium_chef || receta.estilos?.includes('chef_healthy') || receta.estilos?.includes('comfort_healthy') ? 92 : 65) * 0.2 +
    (receta.digestibilidad === 'alta' ? 88 : receta.digestibilidad === 'media' ? 72 : receta.digestibilidad === 'baja' ? 42 : 65) * 0.15 +
    (receta.coste_estimado_nivel === 'bajo' ? 88 : receta.coste_estimado_nivel === 'medio' ? 74 : receta.coste_estimado_nivel === 'alto' ? 50 : 65) * 0.1
  )

  const agentReadiness = clamp(
    ingredientMatchPct * 100 * 0.35 +
    (receta.objetivos?.length ? 100 : 35) * 0.15 +
    (receta.momentos?.length ? 100 : 35) * 0.15 +
    (receta.deportes?.length ? 100 : 45) * 0.1 +
    (receta.intolerancias?.length ? 100 : 40) * 0.15 +
    (receta.score_calidad ?? 60) * 0.1
  )

  const macroFlexScore = clamp(
    humanRoundingPct * 35 +
    (ingredientes.length >= 5 && ingredientes.length <= 14 ? 25 : 12) +
    (/\b(arroz|pasta|patata|boniato|pan|quinoa|avena|tortilla|wrap)\b/.test(texto) ? 18 : 8) +
    (/\b(pollo|pavo|ternera|huevo|claras|salmon|salmón|atun|atún|tofu|yogur|queso fresco)\b/.test(texto) ? 18 : 8) +
    (/\b(aceite|aguacate|tahini|frutos secos|nueces|semillas)\b/.test(texto) ? 4 : 0)
  )

  if (receta.batch_cooking || receta.tupper || receta.estilos?.includes('batch_cooking') || receta.estilos?.includes('tupper')) {
    roles.add('batch_tupper')
  }
  if (receta.premium_chef || receta.estilos?.includes('chef_healthy') || receta.estilos?.includes('comfort_healthy')) {
    roles.add('chef_signature')
  }
  if (proteinas >= 35 && kcal <= 650) roles.add('high_protein_cut')
  if (carbUtility >= 0.42 && proteinas >= 25) roles.add('performance_fuel')
  if (receta.momentos?.includes('pre_entreno') || receta.momentos?.includes('carga_cho')) roles.add('pre_training')
  if (receta.momentos?.includes('post_entreno') || receta.deportes?.some(d => ['running', 'hyrox', 'endurance', 'ciclismo', 'triatlon'].includes(d))) roles.add('post_training')
  if (tiempoTotal > 0 && tiempoTotal <= 20) roles.add('quick_weekday')
  if (macroFlexScore >= 75) roles.add('portion_scalable')

  if (roles.has('batch_tupper')) flags.add('batch_ready')
  if (roles.has('chef_signature')) flags.add('high_adherence')
  if (roles.has('performance_fuel')) flags.add('performance_ready')
  if (macroFlexScore >= 80) flags.add('macro_flexible')

  const score = Math.round(clamp(
    (receta.score_calidad ?? 62) * 0.18 +
    macroFit * 0.17 +
    adherence * 0.2 +
    execution * 0.16 +
    agentReadiness * 0.17 +
    visual * 0.06 +
    macroFlexScore * 0.06
  ))

  const tier = tierFrom(score, flags)

  return {
    score,
    tier,
    macro_flex_score: Math.round(macroFlexScore),
    flags: [...flags],
    planning_roles: [...roles],
    detail: {
      quality: Math.round(receta.score_calidad ?? 62),
      macro_fit: Math.round(macroFit),
      adherence: Math.round(adherence),
      execution: Math.round(execution),
      agent_readiness: Math.round(agentReadiness),
      visual: Math.round(visual),
      ingredient_match_pct: Math.round(ingredientMatchPct * 100),
      human_rounding_pct: Math.round(humanRoundingPct * 100),
    },
  }
}
