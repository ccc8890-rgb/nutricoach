import type { ActividadCoachData } from '@/lib/actividad/coach-insights'

type Tone = 'critico' | 'atencion' | 'ok' | 'neutro'

export interface RendimientoSemana {
  sesiones_7d: number
  sesiones_objetivo_semana: number | null
  adherencia_7d_pct: number | null
  rpe_media_7d: number | null
}

export interface TrainingOSDecision {
  estado: 'descarga' | 'ajustar' | 'progresar' | 'base'
  tono: Tone
  score: number
  microciclo: {
    foco: string
    sesiones_recomendadas: number | null
    intensidad: 'baja' | 'moderada' | 'alta'
    ajuste_volumen_pct: number
  }
  fuentes: {
    externas_sesiones: number
    internas_sesiones: number
    fuentes_activas: string[]
    usar_externo_para_adherencia: boolean
  }
  acciones: string[]
  senales: string[]
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value))
}

function round(value: number): number {
  return Math.round(value)
}

export function crearDecisionTrainingOS(params: {
  actividad: ActividadCoachData | null
  rendimiento: RendimientoSemana
}): TrainingOSDecision {
  const resumen = params.actividad?.resumen
  const flags = params.actividad?.flags ?? []
  const rendimiento = params.rendimiento
  const objetivo = rendimiento.sesiones_objetivo_semana
  const externas = resumen?.sesiones ?? 0
  const internas = rendimiento.sesiones_7d
  const readiness = resumen?.readiness_media ?? null
  const hrv = resumen?.hrv_media ?? null
  const tss = resumen?.tss_total ?? 0
  const altaIntensidad = resumen?.minutos_alta_intensidad_total ?? 0
  const adherencia = rendimiento.adherencia_7d_pct
  const fuentes = resumen?.proveedores ?? []

  let score = 72
  const acciones: string[] = []
  const senales = ['RPE de calentamiento', 'Sueño', 'HRV/readiness', 'Dolor muscular', 'Sesiones completadas']

  if (readiness !== null && readiness < 45) score -= 22
  if (hrv !== null && hrv < 45) score -= 16
  if (tss >= 400) score -= 18
  if (altaIntensidad >= 180) score -= 12
  if (adherencia !== null && adherencia < 70) score -= 14
  if (flags.some(f => f.tipo === 'sync_inactiva')) score -= 8
  if (externas > 0 && internas === 0) score += 6
  if (readiness !== null && readiness >= 70 && tss < 350 && (adherencia ?? 100) >= 85) score += 14

  score = clamp(round(score), 0, 100)

  const recuperacionBaja = (readiness !== null && readiness < 45) || (hrv !== null && hrv < 45)
  const cargaAlta = tss >= 400 || altaIntensidad >= 180
  const adherenciaBaja = adherencia !== null && adherencia < 70
  const usarExterno = externas > internas

  let estado: TrainingOSDecision['estado'] = 'base'
  let tono: Tone = 'neutro'
  let foco = 'Consolidar semana base y mantener progresión controlada.'
  let intensidad: TrainingOSDecision['microciclo']['intensidad'] = 'moderada'
  let ajusteVolumen = 0
  let sesionesRecomendadas = objetivo

  if (recuperacionBaja && cargaAlta) {
    estado = 'descarga'
    tono = 'critico'
    foco = 'Descarga activa: reducir intensidad y proteger recuperación antes de progresar.'
    intensidad = 'baja'
    ajusteVolumen = -30
    sesionesRecomendadas = objetivo ? Math.max(2, objetivo - 1) : null
    acciones.push('Bajar volumen 20-30% durante 3-5 días.')
    acciones.push('Evitar sesiones máximas o intervalos largos hasta recuperar HRV/readiness.')
  } else if (recuperacionBaja || cargaAlta || adherenciaBaja) {
    estado = 'ajustar'
    tono = 'atencion'
    foco = adherenciaBaja
      ? 'Semana de adherencia: simplificar estructura y asegurar cumplimiento.'
      : 'Ajustar carga: mantener estímulo, pero sin añadir estrés innecesario.'
    intensidad = recuperacionBaja ? 'baja' : 'moderada'
    ajusteVolumen = adherenciaBaja ? -20 : -10
    sesionesRecomendadas = objetivo ? Math.max(2, objetivo - 1) : null
    if (adherenciaBaja) acciones.push('Reducir fricción: menos sesiones, mejor cumplidas.')
    if (cargaAlta) acciones.push('Separar estímulos intensos y reforzar carbohidratos peri-entreno.')
    if (recuperacionBaja) acciones.push('Priorizar sueño, baja intensidad y movilidad.')
  } else if (score >= 80 && objetivo && internas >= Math.max(1, objetivo - 1)) {
    estado = 'progresar'
    tono = 'ok'
    foco = 'Progresar con un estímulo principal y mantener el resto controlado.'
    intensidad = 'alta'
    ajusteVolumen = 5
    acciones.push('Añadir un estímulo clave o subir ligeramente volumen accesorio.')
  } else {
    estado = 'base'
    tono = 'ok'
    acciones.push('Mantener estructura y revisar tendencia semanal antes de progresar.')
  }

  if (usarExterno) {
    acciones.push('Usar Garmin/Strava como fuente de adherencia esta semana.')
  }

  return {
    estado,
    tono,
    score,
    microciclo: {
      foco,
      sesiones_recomendadas: sesionesRecomendadas,
      intensidad,
      ajuste_volumen_pct: ajusteVolumen,
    },
    fuentes: {
      externas_sesiones: externas,
      internas_sesiones: internas,
      fuentes_activas: fuentes,
      usar_externo_para_adherencia: usarExterno,
    },
    acciones,
    senales,
  }
}

