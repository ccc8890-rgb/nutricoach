// ── Evaluador de calidad y relevancia de papers ──────────────────
// Score 1-10 basado en: revista, diseño, tamaño muestral y relevancia.
// Threshold de inclusión: >= 7 puntos.

import type { PaperExtraido, PaperEvaluado } from './tipos'

/**
 * Puntuación por tipo de revista/publicación.
 */
function scoreRevista(revista?: string): number {
  if (!revista) return 0

  const r = revista.toLowerCase()

  // Top tier (3 pts)
  const topTier = [
    'new england journal of medicine',
    'lancet',
    'jama',
    'nature',
    'science',
    'british medical journal',
    'bmj',
  ]
  if (topTier.some(t => r.includes(t))) return 3

  // Alto impacto específico (2 pts)
  const highImpact = [
    'american journal of clinical nutrition',
    'journal of nutrition',
    'medicine and science in sports and exercise',
    'journal of applied physiology',
    'sports medicine',
    'journal of the international society of sports nutrition',
    'journal of strength and conditioning research',
    'european journal of applied physiology',
    'european journal of clinical nutrition',
    'international journal of sport nutrition and exercise metabolism',
    'nutrients',
    'obesity',
    'diabetes care',
    'clinical nutrition',
    'frontiers in nutrition',
    'frontiers in physiology',
    'scandinavian journal of medicine and science in sports',
    'journal of sports sciences',
    // Añadidas en mejora #5
    'british journal of sports medicine',
    'international journal of obesity',
    'appetite',
    'journal of the academy of nutrition and dietetics',
    'annual review of nutrition',
    'nutrition reviews',
    'critical reviews in food science and nutrition',
    'international journal of behavioral nutrition and physical activity',
    'journal of obesity',
    'european journal of sport science',
    'international journal of environmental research and public health',
  ]
  if (highImpact.some(t => r.includes(t))) return 2

  // Indexada en PubMed (1 pt) — asumimos que si llegó por PubMed RSS, está indexada
  return 1
}

/**
 * Puntuación por diseño del estudio.
 */
function scoreDiseno(diseno: string): number {
  switch (diseno) {
    case 'meta_analisis':
      return 5
    case 'revision_sistematica':
      return 5
    case 'rct':
      return 5
    case 'cohorte':
      return 3
    case 'caso_control':
      return 2
    case 'transversal':
      return 1
    case 'opinion_experto':
      return 0
    default:
      return 1
  }
}

/**
 * Puntuación por tamaño muestral.
 */
function scoreMuestra(tamano: number): number {
  if (tamano >= 1000) return 3
  if (tamano >= 100) return 2
  if (tamano >= 20) return 1
  return 0
}

/**
 * Puntuación por relevancia para NutriCoach.
 * Basado en la disciplina y categoría del paper.
 */
function scoreRelevancia(extraido: PaperExtraido): number {
  const { disciplina_sugerida, categoria_sugerida, condiciones_relacionadas } = extraido

  let score = 0

  // Disciplinas core (2 pts)
  const coreDisciplinas = ['nutricion', 'fuerza', 'hibrido', 'running']
  if (coreDisciplinas.includes(disciplina_sugerida)) score += 2

  // Categorías directamente aplicables (2 pts)
  const coreCategorias = [
    'proteina', 'periodizacion', 'composicion_corporal',
    'suplementacion', 'patologia', 'volumen', 'fuerza',
  ]
  if (coreCategorias.includes(categoria_sugerida)) score += 2

  // Categorías secundarias (1 pt)
  const secondaryCategorias = [
    'resistencia', 'hiit', 'metabolismo', 'recuperacion', 'hidratacion',
  ]
  if (secondaryCategorias.includes(categoria_sugerida)) score += 1

  // Condiciones de salud relevantes (+1 pt si tiene alguna)
  if (condiciones_relacionadas.length > 0) score += 1

  return Math.min(score, 5) // Máximo 5 puntos
}

function motivoExclusionDominio(extraido: PaperExtraido): string | null {
  const texto = [
    extraido.titulo,
    extraido.abstract,
    extraido.poblacion,
    extraido.intervencion,
    extraido.resultado_principal,
    ...(extraido.keywords ?? []),
  ].join(' ').toLowerCase()

  const animales = [
    'horse', 'horses', 'racehorse', 'racehorses', 'equine',
    'rat', 'rats', 'mouse', 'mice', 'murine',
  ]
  if (animales.some(term => new RegExp(`\\b${term}\\b`, 'i').test(texto))) {
    return 'Modelo animal o veterinario no aplicable al coaching humano.'
  }

  const poblacionesClinicasFueraScope = [
    'cerebral palsy',
    'autism spectrum',
    'breast cancer',
    'cancer survivors',
    'stroke survivors',
    'parkinson',
    'multiple sclerosis',
  ]
  const condicionesPermitidas = extraido.condiciones_relacionadas.some(c =>
    ['diabetes', 'hta', 'hipertension', 'dislipemia', 'higado_graso', 'obesidad', 'sarcopenia'].includes(c.toLowerCase())
  )
  if (!condicionesPermitidas && poblacionesClinicasFueraScope.some(term => texto.includes(term))) {
    return 'Población clínica fuera del alcance principal de NutriCoach.'
  }

  return null
}

/**
 * Evalúa un paper extraído y devuelve el resultado con score.
 */
export function evaluarPaper(extraido: PaperExtraido): PaperEvaluado {
  const exclusionDominio = motivoExclusionDominio(extraido)
  const score_revista = scoreRevista(extraido.revista)
  const score_diseno = scoreDiseno(extraido.diseno_estudio)
  const score_muestra = scoreMuestra(extraido.tamano_muestral)
  const score_relevancia = scoreRelevancia(extraido)

  const score_total = score_revista + score_diseno + score_muestra + score_relevancia

  let recomendacion: PaperEvaluado['recomendacion'] = 'descartar'
  let motivo_rechazo: string | undefined

  if (exclusionDominio) {
    recomendacion = 'descartar'
    motivo_rechazo = exclusionDominio
  } else if (score_total >= 7) {
    recomendacion = 'incluir'
  } else if (score_total >= 5) {
    recomendacion = 'revisar'
  } else {
    recomendacion = 'descartar'
    motivo_rechazo = `Score insuficiente (${score_total}/10). Revista: ${score_revista}/3, Diseño: ${score_diseno}/5, Muestra: ${score_muestra}/3, Relevancia: ${score_relevancia}/5`
  }

  return {
    ...extraido,
    score_revista,
    score_diseno,
    score_muestra,
    score_relevancia,
    score_total,
    recomendacion,
    motivo_rechazo,
  }
}

/**
 * Evalúa una lista de papers extraídos y filtra por recomendación.
 */
export function evaluarPapers(
  extraidos: PaperExtraido[]
): { evaluados: PaperEvaluado[]; incluidos: PaperEvaluado[]; revisar: PaperEvaluado[]; descartados: PaperEvaluado[] } {
  const evaluados = extraidos.map(evaluarPaper)

  return {
    evaluados,
    incluidos: evaluados.filter(e => e.recomendacion === 'incluir'),
    revisar: evaluados.filter(e => e.recomendacion === 'revisar'),
    descartados: evaluados.filter(e => e.recomendacion === 'descartar'),
  }
}
