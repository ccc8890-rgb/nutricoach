import {
  RECETA_DEPORTES,
  RECETA_ESTILOS,
  RECETA_MOMENTOS,
  RECETA_OBJETIVOS,
} from '@/lib/recetario-taxonomia'

// Punto único para completar la taxonomía (objetivos, deportes, momentos, estilos)
// de una receta NUEVA. Solo rellena lo que viene vacío y solo con valores del
// vocabulario cerrado. Criterio de entrenador, no estudio: ver
// salidas/17-10-2026_auditoria-taxonomia-recetario.md.

export type RecetaParaTaxonomia = {
  tipo_plato?: string | null
  categoria?: string | null
  kcal?: number | null
  proteinas?: number | null
  carbohidratos?: number | null
  tiempo_prep_min?: number | null
  tiempo_coccion_min?: number | null
  tags?: string[] | null
  perfil?: 'pre' | 'post' | null
  apto_rendimiento?: boolean | null
  objetivos?: string[] | null
  deportes?: string[] | null
  momentos?: string[] | null
  estilos?: string[] | null
}

export type TaxonomiaCompleta = { objetivos: string[]; deportes: string[]; momentos: string[]; estilos: string[] }

const MOMENTO_POR_TIPO: Record<string, string[]> = {
  desayuno: ['desayuno'],
  comida: ['comida'],
  almuerzo: ['media_manana'],
  cena: ['cena'],
  merienda: ['merienda'],
  snack: ['merienda'],
  postre: ['postre', 'merienda'],
}

function sanear<T extends readonly string[]>(valores: string[] | null | undefined, vocabulario: T): string[] {
  const ok = new Set<string>(vocabulario)
  return [...new Set((valores ?? []).filter(v => ok.has(v)))]
}

export function completarTaxonomia(r: RecetaParaTaxonomia): TaxonomiaCompleta {
  const kcal = Number(r.kcal) || 0
  const prot = Number(r.proteinas) || 0
  const carb = Number(r.carbohidratos) || 0
  const pctProt = kcal > 0 ? (prot * 4) / kcal : 0
  const pctCarb = kcal > 0 ? (carb * 4) / kcal : 0
  const tiempo = (Number(r.tiempo_prep_min) || 0) + (Number(r.tiempo_coccion_min) || 0)
  const tags = (r.tags ?? []).map(t => t.toLowerCase())

  // Momentos: la categoría manda; pre/post solo si el alta lo declara
  let momentos = sanear(r.momentos, RECETA_MOMENTOS)
  if (!momentos.length) {
    const tipo = (r.tipo_plato || r.categoria || '').toLowerCase()
    momentos = MOMENTO_POR_TIPO[tipo] ?? []
    if (r.perfil === 'pre') momentos = [...momentos, 'pre_entreno']
    if (r.perfil === 'post') momentos = [...momentos, 'post_entreno']
  }

  // Objetivos: por macros por ración; sin «salud_general» (no discrimina)
  let objetivos = sanear(r.objetivos, RECETA_OBJETIVOS)
  if (!objetivos.length) {
    const o = new Set<string>()
    if (pctProt >= 0.25 && kcal > 0 && kcal <= 550) { o.add('perdida_grasa'); o.add('recomposicion') }
    if (kcal >= 650 && prot >= 25) o.add('ganancia_muscular')
    if (r.perfil || r.apto_rendimiento || (pctCarb >= 0.5 && prot >= 20)) o.add('rendimiento')
    if (!o.size) o.add('mantenimiento')
    objetivos = [...o]
  }

  // Deportes: vacío = sin sesgo. Solo si la receta se pensó para entrenar
  let deportes = sanear(r.deportes, RECETA_DEPORTES)
  if (!deportes.length) {
    deportes = r.perfil || r.apto_rendimiento ? ['endurance'] : sanear(tags.filter(t => t === 'running' || t === 'ciclismo' || t === 'hyrox'), RECETA_DEPORTES)
  }

  // Estilos: solo lo que se deduce con seguridad
  let estilos = sanear(r.estilos, RECETA_ESTILOS)
  if (!estilos.length) {
    const e = new Set<string>()
    if (tiempo > 0 && tiempo <= 20) e.add('rapida')
    if (tags.some(t => /batch|meal ?prep|mealprep/.test(t))) e.add('batch_cooking')
    if (tags.some(t => t.startsWith('tupper'))) e.add('tupper')
    estilos = [...e]
  }

  return { objetivos, deportes, momentos, estilos }
}
