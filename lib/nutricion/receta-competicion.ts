import type { ObjetivoDia } from './objetivo-dia'

export type ContextoRecetaCompeticion = 'vispera' | 'carrera' | 'recuperacion'

export type RecetaParaCompeticion = {
  nombre: string
  kcal?: number | null
  proteinas?: number | null
  carbohidratos?: number | null
  grasas?: number | null
  fibra?: number | null
  pre?: boolean
  post?: boolean
  planningRoles?: string[] | null
}

export function contextoRecetaCompeticion(objetivo: ObjetivoDia | undefined): ContextoRecetaCompeticion | undefined {
  const competicion = objetivo?.competicion
  if (!competicion) return undefined
  if (competicion.fase === 'race_day') return 'carrera'
  if (competicion.fase === 'carrera_inminente' && competicion.dias_restantes === 1) return 'vispera'
  if (competicion.fase === 'recuperacion' && competicion.dias_restantes >= -2) return 'recuperacion'
  return undefined
}

const FACIL_DIGESTION = /\b(arroz|pasta|patata|papa|pan|tostada|cuscus|couscous|noodle|fideo)\b/i

// Preferencias peri-competición basadas en disponibilidad alta de hidratos y
// menor carga de grasa/fibra alrededor de la prueba. Fuentes: Burke et al.
// 2011, J Sports Sci 29(S1); Thomas et al. 2016, ACSM/AND/DC.
export function puntuarRecetaCompeticion(
  receta: RecetaParaCompeticion,
  contexto: ContextoRecetaCompeticion,
  franja: string,
): number {
  const kcal = Number(receta.kcal) || 0
  const proteinas = Number(receta.proteinas) || 0
  const carbohidratos = Number(receta.carbohidratos) || 0
  const grasas = Number(receta.grasas) || 0

  if (contexto === 'recuperacion') {
    const densidadProteica = kcal > 0 ? (proteinas * 4) / kcal : 0
    return Math.min(densidadProteica / 0.3, 1) * 5 + (receta.post ? 4 : 0)
  }

  const proporcionHidratos = kcal > 0 ? (carbohidratos * 4) / kcal : 0
  let score = Math.min(proporcionHidratos / 0.6, 1) * 5
  score += grasas <= 20 ? 1.5 : grasas >= 30 ? -2 : 0

  // Una fibra ausente no se interpreta como cero: queda deliberadamente neutra.
  if (receta.fibra != null) {
    score += receta.fibra < 4 ? 2 : receta.fibra < 6 ? 1 : receta.fibra >= 9 ? -2 : -0.5
  }

  if (contexto === 'carrera' && franja === 'Desayuno' && receta.pre) score += 4
  if (contexto === 'vispera' && (franja === 'Comida' || franja === 'Cena')) {
    const clasificacion = receta.planningRoles?.join(' ') ?? ''
    if (FACIL_DIGESTION.test(`${receta.nombre} ${clasificacion}`)) score += 2.5
  }
  return score
}

