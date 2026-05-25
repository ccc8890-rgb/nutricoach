type IngredientePrompt = {
  nombre_libre?: string | null
  cantidad_gramos?: number | null
  alimento?: { nombre?: string | null } | Array<{ nombre?: string | null }> | null
}

type RecetaPrompt = {
  nombre: string
  descripcion?: string | null
  categoria?: string | null
  tipo_plato?: string | null
  kcal?: number | null
  proteinas?: number | null
  carbohidratos?: number | null
  grasas?: number | null
  premium_chef?: boolean | null
  objetivos?: string[] | null
  deportes?: string[] | null
  momentos?: string[] | null
  estilos?: string[] | null
  digestibilidad?: string | null
  imagen_review_notes?: string | null
  receta_ingredientes?: IngredientePrompt[] | null
}

export type PresetImagenReceta =
  | 'real_food_editorial'
  | 'mobile_home_kitchen'
  | 'chef_healthy_dark'
  | 'batch_tupper_real'
  | 'performance_bowl'
  | 'pre_race_simple'

const PRESET_COPY: Record<PresetImagenReceta, { label: string; direccion: string[] }> = {
  real_food_editorial: {
    label: 'Real food editorial',
    direccion: [
      'fotografía editorial realista de comida casera saludable',
      'luz natural lateral de ventana, sombras suaves, plato imperfecto y apetecible',
      'encuadre 45 grados, profundidad de campo realista, textura visible',
    ],
  },
  mobile_home_kitchen: {
    label: 'Móvil cocina real',
    direccion: [
      'fotografía real tomada con móvil de gama alta en cocina doméstica',
      'encuadre espontáneo pero cuidado, pequeñas imperfecciones naturales',
      'vajilla sencilla, fondo real sin parecer estudio publicitario',
    ],
  },
  chef_healthy_dark: {
    label: 'Chef healthy sobrio',
    direccion: [
      'fotografía culinaria sobria, estilo restaurante casual premium',
      'plato saludable con emplatado cuidado, sin artificios ni brillos falsos',
      'fondo neutro oscuro, luz lateral natural, contraste suave',
    ],
  },
  batch_tupper_real: {
    label: 'Batch/tupper real',
    direccion: [
      'comida saludable preparada para varios días, aspecto real y práctico',
      'tupper o bol de cristal, ingredientes separados con orden natural',
      'sin aspecto de meal prep genérico de stock, textura fresca',
    ],
  },
  performance_bowl: {
    label: 'Performance bowl',
    direccion: [
      'bowl deportivo realista para recuperación o rendimiento',
      'carbohidrato, proteína y vegetales claramente reconocibles',
      'composición limpia, apetecible y funcional, sin estética de anuncio fitness',
    ],
  },
  pre_race_simple: {
    label: 'Pre-competición simple',
    direccion: [
      'comida simple, digestiva y realista previa a entrenamiento o carrera',
      'plato sencillo con pocos ingredientes, sin exceso de grasa ni salsas pesadas',
      'luz natural, presentación limpia y honesta',
    ],
  },
}

export const PRESETS_IMAGEN_RECETA = Object.entries(PRESET_COPY).map(([value, cfg]) => ({
  value: value as PresetImagenReceta,
  label: cfg.label,
}))

export function inferirPresetImagenReceta(receta: RecetaPrompt): PresetImagenReceta {
  const momentos = new Set(receta.momentos ?? [])
  const estilos = new Set(receta.estilos ?? [])
  const deportes = new Set(receta.deportes ?? [])
  const texto = `${receta.nombre} ${receta.categoria ?? ''} ${receta.tipo_plato ?? ''}`.toLowerCase()

  if (momentos.has('pre_entreno') || momentos.has('tapering') || momentos.has('carga_cho')) return 'pre_race_simple'
  if (momentos.has('post_entreno') || deportes.has('running') || deportes.has('hyrox') || deportes.has('endurance')) return 'performance_bowl'
  if (estilos.has('batch_cooking') || estilos.has('tupper')) return 'batch_tupper_real'
  if (receta.premium_chef || estilos.has('chef_healthy') || estilos.has('comfort_healthy') || estilos.has('gourmet_simple')) return 'chef_healthy_dark'
  if (texto.includes('tupper') || texto.includes('batch')) return 'batch_tupper_real'
  if (texto.includes('bowl')) return 'performance_bowl'
  return 'real_food_editorial'
}

function ingredienteNombre(ingrediente: IngredientePrompt) {
  const alimento = Array.isArray(ingrediente.alimento) ? ingrediente.alimento[0] : ingrediente.alimento
  return ingrediente.nombre_libre || alimento?.nombre || null
}

function ingredientesClave(receta: RecetaPrompt) {
  return (receta.receta_ingredientes ?? [])
    .map(ingredienteNombre)
    .filter((nombre): nombre is string => Boolean(nombre))
    .slice(0, 9)
}

export function construirPromptImagenReceta(receta: RecetaPrompt, preset?: PresetImagenReceta) {
  const selected = preset ?? inferirPresetImagenReceta(receta)
  const cfg = PRESET_COPY[selected]
  const ingredientes = ingredientesClave(receta)
  const macros = [
    receta.kcal ? `${Math.round(receta.kcal)} kcal` : null,
    receta.proteinas ? `${Math.round(receta.proteinas)}g proteína` : null,
    receta.carbohidratos ? `${Math.round(receta.carbohidratos)}g carbohidratos` : null,
    receta.grasas ? `${Math.round(receta.grasas)}g grasas` : null,
  ].filter(Boolean).join(' · ')

  return [
    `Fotografía realista de la receta: ${receta.nombre}.`,
    receta.descripcion ? `Descripción del plato: ${receta.descripcion}.` : null,
    ingredientes.length ? `Ingredientes visibles principales: ${ingredientes.join(', ')}.` : null,
    macros ? `Contexto nutricional aproximado: ${macros}.` : null,
    '',
    'Dirección fotográfica:',
    ...cfg.direccion.map(line => `- ${line}`),
    '- comida real, apetecible, con imperfecciones naturales y textura reconocible',
    '- proporciones creíbles, plato no demasiado perfecto, sin aspecto CGI',
    '- estilo mediterráneo/europeo actual, vajilla sobria, fondo limpio pero real',
    '',
    'Evitar estrictamente:',
    '- aspecto de imagen IA, comida de plástico, brillos irreales o simetría perfecta',
    '- manos deformes, cubiertos raros, texto, logos, marcas, packaging protagonista',
    '- ingredientes que no aparezcan en la receta o composición que no coincida con el plato',
    '- fondo de stock genérico, vapor exagerado, colores sobresaturados',
    receta.imagen_review_notes ? `\nNota de revisión previa: ${receta.imagen_review_notes}` : null,
  ].filter(Boolean).join('\n')
}
