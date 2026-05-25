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

export const RECETA_LABELS: Record<string, string> = {
  desayuno: 'Desayuno',
  media_manana: 'Media mañana',
  comida: 'Comida',
  merienda: 'Merienda',
  cena: 'Cena',
  pre_entreno: 'Pre-entreno',
  post_entreno: 'Post-entreno',
  intra_entreno: 'Intra-entreno',
  descanso: 'Descanso',
  refeed: 'Refeed',
  tapering: 'Tapering',
  carga_cho: 'Carga CHO',
  perdida_grasa: 'Pérdida grasa',
  recomposicion: 'Recomposición',
  ganancia_muscular: 'Ganancia muscular',
  mantenimiento: 'Mantenimiento',
  rendimiento: 'Rendimiento',
  salud_general: 'Salud general',
  fuerza: 'Fuerza',
  running: 'Running',
  hyrox: 'Hyrox',
  ciclismo: 'Ciclismo',
  triatlon: 'Triatlón',
  crossfit: 'CrossFit',
  endurance: 'Endurance',
  general: 'General',
  funcional: 'Funcional',
  chef_healthy: 'Chef healthy',
  batch_cooking: 'Batch cooking',
  tupper: 'Tupper',
  mediterranea: 'Mediterránea',
  alto_volumen: 'Alto volumen',
  comfort_healthy: 'Comfort healthy',
  rapida: 'Rápida',
  gourmet_simple: 'Gourmet simple',
}

export type RecetaChefColeccion = {
  id: string
  titulo: string
  subtitulo: string
  descripcion: string
  bloque: string
  objetivo?: string
  deporte?: string
  momento?: string
  estilo: string
  cantidad: number
  tags: string[]
  direccion: string[]
}

export const RECETA_CHEF_COLECCIONES: RecetaChefColeccion[] = [
  {
    id: 'comfort-healthy',
    titulo: 'Comfort healthy',
    subtitulo: 'Comida normal reinterpretada',
    descripcion: 'Recetas que no parecen dieta: pasta, burgers, tacos, cremas, wraps y platos de cuchara con macros útiles.',
    bloque: 'comfort healthy de alta adherencia',
    objetivo: 'recomposicion',
    estilo: 'comfort_healthy',
    cantidad: 8,
    tags: ['adherencia', 'vida real', 'antojos controlados'],
    direccion: [
      'Reinterpretar platos cotidianos sin que parezcan restrictivos.',
      'Priorizar salsas ligeras, texturas crujientes y nombres apetecibles.',
      'Mantener cantidades redondeadas y fáciles de pesar.',
    ],
  },
  {
    id: 'street-fit',
    titulo: 'Street fit',
    subtitulo: 'Tacos, kebab, pizza, burger',
    descripcion: 'Platos sociales en versión funcional para fines de semana, cenas atractivas y clientes con baja adherencia.',
    bloque: 'street food saludable',
    objetivo: 'perdida_grasa',
    estilo: 'chef_healthy',
    cantidad: 8,
    tags: ['social', 'cena', 'saciedad'],
    direccion: [
      'Inspirarse en street food, manteniendo digestibilidad y control calórico.',
      'Evitar ultraprocesados como base, pero permitir atajos realistas.',
      'Crear versiones que el cliente enseñaría con ganas.',
    ],
  },
  {
    id: 'performance-bowls',
    titulo: 'Performance bowls',
    subtitulo: 'Running, Hyrox y endurance',
    descripcion: 'Bowls, arroces, noodles y platos post-entreno con carbohidratos útiles, proteína clara y digestibilidad media/alta.',
    bloque: 'bowls de rendimiento',
    objetivo: 'rendimiento',
    deporte: 'endurance',
    momento: 'post_entreno',
    estilo: 'funcional',
    cantidad: 8,
    tags: ['post-entreno', 'carbohidratos', 'recuperación'],
    direccion: [
      'Priorizar carbohidrato útil y proteína suficiente.',
      'Incluir opciones con arroz, patata, pasta, pan, fruta o legumbre bien tolerada.',
      'Justificar brevemente por qué encaja tras sesiones exigentes.',
    ],
  },
  {
    id: 'batch-gourmet',
    titulo: 'Batch gourmet',
    subtitulo: 'Tupper sin tristeza',
    descripcion: 'Recetas que aguantan nevera, recalientan bien y permiten preparar varias raciones sin perder atractivo.',
    bloque: 'batch cooking gourmet',
    objetivo: 'mantenimiento',
    estilo: 'batch_cooking',
    cantidad: 8,
    tags: ['tupper', 'meal prep', 'semana laboral'],
    direccion: [
      'Diseñar recetas con buena conservación y salsas separables.',
      'Indicar cómo guardar, recalentar y ajustar guarnición.',
      'Evitar ensaladas acuosas o platos que se degraden rápido.',
    ],
  },
  {
    id: 'pre-race',
    titulo: 'Pre-competición',
    subtitulo: 'Digestivo y útil',
    descripcion: 'Opciones simples para tapering, carga de carbohidratos y comidas previas a entrenos o carreras.',
    bloque: 'pre competición y tapering',
    objetivo: 'rendimiento',
    deporte: 'running',
    momento: 'pre_entreno',
    estilo: 'rapida',
    cantidad: 6,
    tags: ['digestibilidad', 'tapering', 'carga CHO'],
    direccion: [
      'Priorizar digestibilidad y baja complejidad.',
      'Evitar exceso de grasa y fibra en pre-entreno inmediato.',
      'Incluir timing recomendado y variantes según tolerancia.',
    ],
  },
]

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
  recipe_intelligence_score?: number | null
  macro_flex_score?: number | null
  planning_roles?: string[] | null
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
  const intelligence = Math.min(Math.max((receta.recipe_intelligence_score ?? receta.score_calidad ?? 60) / 100, 0), 1)
  const macroFlex = Math.min(Math.max((receta.macro_flex_score ?? 55) / 100, 0), 1)
  const adherencia = Math.min(Math.max((receta.adherencia_score ?? 65) / 100, 0), 1)
  const objetivos = new Set(receta.objetivos ?? [])
  const deportes = new Set(receta.deportes ?? [])
  const momentos = new Set(receta.momentos ?? [])
  const estilos = new Set(receta.estilos ?? [])
  const roles = new Set(receta.planning_roles ?? [])

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

  const roleScore =
    (roles.has('portion_scalable') ? 0.35 : 0) +
    (roles.has('chef_signature') ? 0.25 : 0) +
    (roles.has('performance_fuel') && contexto.deporte ? 0.25 : 0) +
    (roles.has('quick_weekday') ? 0.15 : 0)

  return (
    intelligence * 0.24 +
    calidad * 0.10 +
    adherencia * 0.13 +
    objetivoScore * 0.15 +
    deporteScore * 0.10 +
    momentoScore * 0.12 +
    macroScore * 0.10 +
    macroFlex * 0.03 +
    chefScore * 0.02 +
    Math.min(roleScore, 1) * 0.01
  )
}

export function estadoCobertura(actual: number, minimo: number) {
  const ratio = minimo > 0 ? actual / minimo : 1
  if (ratio >= 1) return 'cubierto'
  if (ratio >= 0.6) return 'medio'
  if (ratio >= 0.25) return 'bajo'
  return 'critico'
}
