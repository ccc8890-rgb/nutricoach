import type { CommandCenterRow } from './command-center'

export type QualityStatus = 'top' | 'usable' | 'incompleta' | 'completo' | 'basico'

export interface PlantillaQualityInput {
  sesionesCount: number
  ejerciciosCount: number
  duracionSemanas: number | null | undefined
  sportModality: string | null | undefined
  tier: string | null | undefined
  progresionCount: number
}

export interface EjercicioQualityInput {
  foto_url?: string | null
  video_url?: string | null
  dificultad_nivel?: number | null
  equipamiento?: string[] | null
  musculos_secundarios?: string[] | null
}

export interface QualityResult {
  score: number
  status: QualityStatus
  label: string
  gaps: string[]
}

export interface TrainingRoomSummary {
  riskLevel: 'alto' | 'medio' | 'bajo'
  primaryFocus: string
  evidence: string[]
  coachActions: string[]
  clientMessage: string
}

export interface SesionGuidanceInput {
  nombre: string
  planNombre?: string | null
  ejerciciosCount: number
  totalSets: number
  hasContextoIa: boolean
  hasMedia: boolean
}

export interface SesionGuidance {
  mode: 'guiada' | 'simple'
  objective: string
  coachNote: string
  clientSteps: string[]
}

export interface DecisionSummaryInput {
  prioridad: number
  tipo: string
  senalesCount: number
  ajustesCount: number
  evidenciaCount: number
}

export interface DecisionSummary {
  risk: 'alto' | 'medio' | 'bajo'
  intent: string
  checklist: string[]
}

export interface CoachDeskPlanInput {
  estado: 'descarga' | 'ajustar' | 'progresar' | 'base'
  hasPlan: boolean
  hasPerfil: boolean
  accionesCount: number
  fuentesExternasCount: number
}

export interface CoachDeskPlan {
  phase: string
  nextStep: string
  primaryAction: string
  secondaryAction: string
  blockers: string[]
}

function clampScore(score: number) {
  return Math.max(0, Math.min(100, score))
}

export function calcularPlantillaQuality(input: PlantillaQualityInput): QualityResult {
  const gaps: string[] = []
  let score = 0

  if (input.sesionesCount > 0) score += 25
  else gaps.push('Sin sesiones')

  if (input.ejerciciosCount >= 12) score += 25
  else if (input.ejerciciosCount > 0) {
    score += 12
    gaps.push('Pocos ejercicios')
  } else {
    gaps.push('Sin ejercicios')
  }

  if (input.duracionSemanas && input.duracionSemanas >= 4) score += 15
  else gaps.push('Sin duración')

  if (input.sportModality) score += 15
  else gaps.push('Sin modalidad')

  if (input.progresionCount > 0) score += 15
  else gaps.push('Sin progresión')

  if (input.tier) score += 5
  else gaps.push('Sin tier')

  const finalScore = clampScore(score)
  const status: QualityStatus = finalScore >= 90 ? 'top' : finalScore >= 65 ? 'usable' : 'incompleta'

  return {
    score: finalScore,
    status,
    label: status === 'top' ? 'Top asset' : status === 'usable' ? 'Usable' : 'Incompleta',
    gaps,
  }
}

export function calcularEjercicioQuality(input: EjercicioQualityInput): QualityResult {
  const gaps: string[] = []
  let score = 0

  if (input.foto_url) score += 20
  else gaps.push('Sin foto')

  if (input.video_url) score += 30
  else gaps.push('Sin vídeo')

  if (input.dificultad_nivel) score += 15
  else gaps.push('Sin dificultad')

  if ((input.equipamiento?.length ?? 0) > 0) score += 20
  else gaps.push('Sin equipamiento')

  if ((input.musculos_secundarios?.length ?? 0) > 0) score += 15
  else gaps.push('Sin músculos secundarios')

  const finalScore = clampScore(score)
  const status: QualityStatus = finalScore >= 85 ? 'completo' : finalScore >= 55 ? 'usable' : 'basico'

  return {
    score: finalScore,
    status,
    label: status === 'completo' ? 'Completo' : status === 'usable' ? 'Usable' : 'Básico',
    gaps,
  }
}

export function crearTrainingRoomSummary(cliente: CommandCenterRow): TrainingRoomSummary {
  const evidence = [
    cliente.rpe_media_7d !== null ? `RPE medio 7d: ${cliente.rpe_media_7d.toFixed(1)}` : 'RPE medio sin registrar',
    cliente.adherencia_7d_pct !== null ? `Adherencia 7d: ${cliente.adherencia_7d_pct}%` : 'Adherencia sin objetivo semanal',
    `Sesiones 7d: ${cliente.sesiones_7d}`,
    `Carga score: ${cliente.carga_score}`,
  ]

  if (cliente.estado === 'fatiga') {
    return {
      riskLevel: 'alto',
      primaryFocus: 'Controlar fatiga',
      evidence,
      coachActions: [
        'Revisar volumen e intensidad de la próxima sesión',
        'Valorar descarga o sesión técnica',
        'Comprobar sueño, dolor y recuperación antes de progresar',
      ],
      clientMessage: 'Hoy priorizamos ejecutar bien y ajustar carga si la recuperación no acompaña.',
    }
  }

  if (cliente.estado === 'revision_ia') {
    return {
      riskLevel: 'medio',
      primaryFocus: 'Aprobar decisión IA',
      evidence,
      coachActions: [
        'Abrir bandeja IA',
        'Validar datos usados por la recomendación',
        'Aprobar, editar o ignorar antes de cambiar el plan',
      ],
      clientMessage: 'Tu coach está revisando el siguiente ajuste para mantener el plan alineado contigo.',
    }
  }

  if (cliente.estado === 'sin_actividad') {
    return {
      riskLevel: 'medio',
      primaryFocus: 'Recuperar adherencia',
      evidence,
      coachActions: [
        'Detectar fricción de agenda o dificultad',
        'Enviar mensaje breve de seguimiento',
        'Simplificar próxima sesión si hace falta',
      ],
      clientMessage: 'Volvemos a una sesión clara y asumible para recuperar continuidad.',
    }
  }

  if (cliente.estado === 'progreso') {
    return {
      riskLevel: 'bajo',
      primaryFocus: 'Progresar o consolidar',
      evidence,
      coachActions: [
        'Revisar si toca subir carga, reps o densidad',
        'Mantener técnica y control de RPE',
        'Celebrar progreso sin acelerar de más',
      ],
      clientMessage: 'Hay buena respuesta al plan. La siguiente sesión buscará progresar sin perder control.',
    }
  }

  return {
    riskLevel: 'bajo',
    primaryFocus: 'Mantener plan',
    evidence,
    coachActions: [
      'Revisar próxima sesión programada',
      'Mantener seguimiento semanal',
      'Ajustar solo si aparecen señales nuevas',
    ],
    clientMessage: 'Seguimos con el plan previsto y revisamos sensaciones al terminar.',
  }
}

export function crearSesionGuidance(input: SesionGuidanceInput): SesionGuidance {
  const mode = input.hasContextoIa || input.hasMedia ? 'guiada' : 'simple'
  const objective = input.totalSets >= 16
    ? 'Ejecutar con control y registrar datos útiles'
    : 'Completar la sesión con buena técnica'

  const clientSteps = [
    'Revisa el objetivo antes de empezar',
    'Abre la demo si tienes dudas de técnica',
    'Registra peso, reps y RPE en cada set',
    'Cierra con sensaciones para que el coach ajuste mejor',
  ]

  const signals = [
    `${input.ejerciciosCount} ejercicios`,
    `${input.totalSets} sets`,
    input.hasMedia ? 'media disponible' : 'media incompleta',
    input.hasContextoIa ? 'contexto IA disponible' : 'sin contexto IA',
  ]

  return {
    mode,
    objective,
    coachNote: `Sesión ${input.planNombre ? `del plan ${input.planNombre}` : input.nombre}: ${signals.join(' · ')}.`,
    clientSteps,
  }
}

export function crearDecisionSummary(input: DecisionSummaryInput): DecisionSummary {
  const risk = input.prioridad <= 3 || input.tipo.includes('riesgo')
    ? 'alto'
    : input.prioridad <= 6 || input.ajustesCount > 0
      ? 'medio'
      : 'bajo'

  const intent = risk === 'alto'
    ? 'Intervenir antes de la próxima sesión'
    : input.ajustesCount > 0
      ? 'Validar ajuste propuesto'
      : 'Revisar y archivar criterio'

  const checklist = [
    'Revisar señales y evidencia',
    input.ajustesCount > 0 ? 'Comprobar impacto sobre volumen, intensidad o nutrición' : 'Confirmar que no requiere cambio de plan',
    input.evidenciaCount > 0 ? 'Mantener trazabilidad de la fuente aplicada' : 'Pedir más contexto si la recomendación es sensible',
  ]

  return { risk, intent, checklist }
}

export function crearCoachDeskPlan(input: CoachDeskPlanInput): CoachDeskPlan {
  const blockers = [
    !input.hasPlan ? 'Asignar o crear plan activo' : null,
    !input.hasPerfil ? 'Completar perfil atleta' : null,
    input.fuentesExternasCount === 0 ? 'Conectar o revisar datos externos si el cliente los usa' : null,
  ].filter((item): item is string => Boolean(item))

  if (!input.hasPlan) {
    return {
      phase: 'Setup',
      nextStep: 'Crear estructura base antes de analizar carga',
      primaryAction: 'Asignar plantilla',
      secondaryAction: 'Abrir builder',
      blockers,
    }
  }

  if (input.estado === 'descarga') {
    return {
      phase: 'Control',
      nextStep: 'Reducir fricción y proteger recuperación esta semana',
      primaryAction: 'Ajustar volumen',
      secondaryAction: 'Enviar pauta al cliente',
      blockers,
    }
  }

  if (input.estado === 'ajustar' || input.accionesCount > 0) {
    return {
      phase: 'Decisión',
      nextStep: 'Validar señales y aplicar solo el ajuste con más impacto',
      primaryAction: 'Revisar IA',
      secondaryAction: 'Editar plan',
      blockers,
    }
  }

  if (input.estado === 'progresar') {
    return {
      phase: 'Progresión',
      nextStep: 'Subir estímulo manteniendo técnica y RPE objetivo',
      primaryAction: 'Programar progresión',
      secondaryAction: 'Revisar historial',
      blockers,
    }
  }

  return {
    phase: 'Base',
    nextStep: 'Mantener estructura y esperar nuevos datos de ejecución',
    primaryAction: 'Actualizar análisis',
    secondaryAction: 'Revisar semana',
    blockers,
  }
}
