// lib/integraciones/garmin-workouts-formato.ts
import { ritmoDelPaso, type Paso, type PasoSimple } from '@/lib/entrenos/pasos'
import { formatearRitmo, type Ritmos } from '@/lib/entrenos/ritmos'
import type { ZonasFc } from '@/lib/entrenos/zonas-fc'

const SPORT_RUNNING = { sportTypeId: 1, sportTypeKey: 'running' }

const STEP_TYPE = {
  calentamiento: { stepTypeId: 1, stepTypeKey: 'warmup' },
  enfriamiento: { stepTypeId: 2, stepTypeKey: 'cooldown' },
  trabajo: { stepTypeId: 3, stepTypeKey: 'interval' },
  recuperacion: { stepTypeId: 4, stepTypeKey: 'recovery' },
} as const

const END = {
  lap: { conditionTypeId: 1, conditionTypeKey: 'lap.button' },
  segundos: { conditionTypeId: 2, conditionTypeKey: 'time' },
  metros: { conditionTypeId: 3, conditionTypeKey: 'distance' },
  iteraciones: { conditionTypeId: 7, conditionTypeKey: 'iterations' },
} as const

const TARGET = {
  ninguno: { workoutTargetTypeId: 1, workoutTargetTypeKey: 'no.target' },
  fc: { workoutTargetTypeId: 4, workoutTargetTypeKey: 'heart.rate.zone' },
  ritmo: { workoutTargetTypeId: 6, workoutTargetTypeKey: 'pace.zone' },
} as const

/** Margen alrededor del ritmo de una zona (±3 %). */
const MARGEN_ZONA = 0.03

/**
 * Las series cortas se envían sin alerta de ritmo: el reloj usa un ritmo suavizado que tarda
 * 5-15 s en asentarse, así que en 400 m avisa tarde y mal. El objetivo va en la descripción del paso.
 * Poner a false para volver al comportamiento anterior (objetivo de ritmo en cada serie).
 */
const SERIES_CORTAS_SIN_ALERTA = true
const SERIE_CORTA_METROS = 600
const SERIE_CORTA_SEGUNDOS = 150

function esSerieCorta(p: PasoSimple): boolean {
  if (!SERIES_CORTAS_SIN_ALERTA || p.tipo !== 'trabajo') return false
  const d = p.duracion
  return (d.unidad === 'metros' && d.valor <= SERIE_CORTA_METROS) || (d.unidad === 'segundos' && d.valor <= SERIE_CORTA_SEGUNDOS)
}

export interface GarminStep {
  type: 'ExecutableStepDTO'
  stepOrder: number
  stepType: { stepTypeId: number; stepTypeKey: string }
  endCondition: { conditionTypeId: number; conditionTypeKey: string }
  endConditionValue: number | null
  targetType: { workoutTargetTypeId: number; workoutTargetTypeKey: string }
  targetValueOne?: number
  targetValueTwo?: number
  description?: string
}
export interface GarminRepeat {
  type: 'RepeatGroupDTO'
  stepOrder: number
  stepType: { stepTypeId: number; stepTypeKey: string }
  numberOfIterations: number
  endCondition: { conditionTypeId: number; conditionTypeKey: string }
  endConditionValue: number
  smartRepeat: boolean
  workoutSteps: GarminStep[]
}
export interface GarminWorkoutPayload {
  workoutName: string
  description?: string
  sportType: { sportTypeId: number; sportTypeKey: string }
  workoutSegments: Array<{
    segmentOrder: number
    sportType: { sportTypeId: number; sportTypeKey: string }
    workoutSteps: Array<GarminStep | GarminRepeat>
  }>
}

export type Superficie = 'pista' | 'cinta'

/** Sobre cinta el reloj estima los metros con el acelerómetro y falla: los tramos por distancia pasan a tiempo (ritmo × distancia) y se indica la velocidad de la cinta. */
function convertirPaso(p: PasoSimple, orden: number, ritmos: Ritmos | null, fc: ZonasFc | null, cinta = false, conSeries = false): GarminStep {
  let d = p.duracion
  // Recuperaciones sin ritmo propio: trote a ritmo suave.
  const ritmoCinta = cinta ? (ritmoDelPaso(p, ritmos) ?? (p.tipo === 'recuperacion' ? ritmos?.E ?? null : null)) : null
  if (ritmoCinta !== null && d.unidad === 'metros') {
    d = { unidad: 'segundos', valor: Math.max(5, Math.round(((ritmoCinta * d.valor) / 1000) / 5) * 5) }
  }
  const paso: GarminStep = {
    type: 'ExecutableStepDTO',
    stepOrder: orden,
    stepType: { ...STEP_TYPE[p.tipo] },
    endCondition: d.unidad === 'lap' ? { ...END.lap } : { ...END[d.unidad] },
    endConditionValue: d.unidad === 'lap' ? null : d.valor,
    targetType: { ...TARGET.ninguno },
  }
  const notaCinta = ritmoCinta !== null ? `Cinta a ${(3600 / ritmoCinta).toFixed(1).replace('.', ',')} km/h` : null
  const descripcion = [p.nota, notaCinta].filter(Boolean).join(' · ')
  if (descripcion) paso.description = descripcion.slice(0, 512)

  const o = p.objetivo
  // La zona suave (E) se rige por pulso, no por ritmo: no entra aquí.
  if (!cinta && esSerieCorta(p) && (o?.tipo === 'ritmo' || (o?.tipo === 'zona' && o.zona !== 'E'))) {
    const ritmo = ritmoDelPaso(p, ritmos)
    if (ritmo !== null) {
      const parcial = p.duracion.unidad === 'metros' ? ` (${formatearRitmo((ritmo * p.duracion.valor) / 1000)} los ${p.duracion.valor} m)` : ''
      paso.description = [p.nota, `Objetivo ${formatearRitmo(ritmo)}/km${parcial}`].filter(Boolean).join(' · ').slice(0, 512)
      return paso
    }
  }
  if (o?.tipo === 'fc') {
    paso.targetType = { ...TARGET.fc }
    paso.targetValueOne = o.min
    paso.targetValueTwo = o.max
  } else if (o?.tipo === 'ritmo' && !cinta) {
    paso.targetType = { ...TARGET.ritmo }
    paso.targetValueOne = 1000 / o.max_seg_km // más lento = menor velocidad
    paso.targetValueTwo = 1000 / o.min_seg_km
  } else if (o?.tipo === 'zona' && o.zona === 'E' && (p.tipo === 'recuperacion' || (conSeries && fc?.E && (p.tipo === 'calentamiento' || p.tipo === 'enfriamiento')))) {
    // En sesiones de series el pulso sigue alto 1-2 min tras el esfuerzo (y aún no ha subido en el calentamiento): un techo de pulso solo daría avisos falsos.
  } else if (o?.tipo === 'zona' && o.zona === 'E' && fc?.E) {
    // Suave: manda el pulso (techo), no el ritmo; con calor, fatiga o cuestas el ritmo engaña.
    paso.targetType = { ...TARGET.fc }
    paso.targetValueOne = fc.E.min
    paso.targetValueTwo = fc.E.max
  } else if (o?.tipo === 'zona' && !cinta) {
    const ritmo = ritmoDelPaso(p, ritmos)
    if (ritmo !== null) {
      paso.targetType = { ...TARGET.ritmo }
      paso.targetValueOne = 1000 / (ritmo * (1 + MARGEN_ZONA))
      paso.targetValueTwo = 1000 / (ritmo * (1 - MARGEN_ZONA))
    }
  }
  return paso
}

export function pasosAGarmin(
  nombre: string,
  pasos: Paso[],
  ritmos: Ritmos | null,
  descripcion?: string,
  fc: ZonasFc | null = null,
  superficie: Superficie = 'pista',
): GarminWorkoutPayload {
  const cinta = superficie === 'cinta'
  // Sesión de intensidad (bloques repetidos o trabajo por encima de la zona suave): su calentamiento y vuelta a la calma no llevan techo de pulso.
  const intenso = (x: Paso) => x.tipo === 'trabajo' && (x.objetivo?.tipo === 'ritmo' || (x.objetivo?.tipo === 'zona' && x.objetivo.zona !== 'E'))
  const conSeries = pasos.some(x => x.tipo === 'repetir' || intenso(x))
  let orden = 0
  const workoutSteps: Array<GarminStep | GarminRepeat> = pasos.map(p => {
    if (p.tipo === 'repetir') {
      // La última repetición va aparte y marcada («Última serie») para saber cuándo se acaba; sin recuperación detrás, pasa a la vuelta a la calma.
      const ultimaAparte = p.veces >= 2 && p.pasos.length >= 2 && p.pasos[0].tipo === 'trabajo' && p.pasos[p.pasos.length - 1].tipo === 'recuperacion'
      const veces = ultimaAparte ? p.veces - 1 : p.veces
      const grupoOrden = ++orden
      const hijos = p.pasos.map(q => convertirPaso(q, ++orden, ritmos, fc, cinta, conSeries))
      const grupo = {
        type: 'RepeatGroupDTO',
        stepOrder: grupoOrden,
        stepType: { stepTypeId: 6, stepTypeKey: 'repeat' },
        numberOfIterations: veces,
        endCondition: { ...END.iteraciones },
        endConditionValue: veces,
        smartRepeat: false,
        workoutSteps: hijos,
      } satisfies GarminRepeat
      if (!ultimaAparte) return grupo
      const trabajo = p.pasos[0]
      return [grupo, convertirPaso({ ...trabajo, nota: ['Última serie', trabajo.nota].filter(Boolean).join(' · ') }, ++orden, ritmos, fc, cinta, conSeries)]
    }
    return convertirPaso(p, ++orden, ritmos, fc, cinta, conSeries)
  }).flat()

  return {
    workoutName: nombre.slice(0, 80),
    description: descripcion,
    sportType: { ...SPORT_RUNNING },
    workoutSegments: [{ segmentOrder: 1, sportType: { ...SPORT_RUNNING }, workoutSteps }],
  }
}
