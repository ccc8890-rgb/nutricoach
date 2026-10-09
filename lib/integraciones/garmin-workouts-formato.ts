// lib/integraciones/garmin-workouts-formato.ts
import { ritmoDelPaso, type Paso, type PasoSimple } from '@/lib/entrenos/pasos'
import type { Ritmos } from '@/lib/entrenos/ritmos'

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

function convertirPaso(p: PasoSimple, orden: number, ritmos: Ritmos | null): GarminStep {
  const d = p.duracion
  const paso: GarminStep = {
    type: 'ExecutableStepDTO',
    stepOrder: orden,
    stepType: { ...STEP_TYPE[p.tipo] },
    endCondition: d.unidad === 'lap' ? { ...END.lap } : { ...END[d.unidad] },
    endConditionValue: d.unidad === 'lap' ? null : d.valor,
    targetType: { ...TARGET.ninguno },
  }
  if (p.nota) paso.description = p.nota.slice(0, 512)

  const o = p.objetivo
  if (o?.tipo === 'fc') {
    paso.targetType = { ...TARGET.fc }
    paso.targetValueOne = o.min
    paso.targetValueTwo = o.max
  } else if (o?.tipo === 'ritmo') {
    paso.targetType = { ...TARGET.ritmo }
    paso.targetValueOne = 1000 / o.max_seg_km // más lento = menor velocidad
    paso.targetValueTwo = 1000 / o.min_seg_km
  } else if (o?.tipo === 'zona') {
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
): GarminWorkoutPayload {
  let orden = 0
  const workoutSteps: Array<GarminStep | GarminRepeat> = pasos.map(p => {
    if (p.tipo === 'repetir') {
      const grupoOrden = ++orden
      const hijos = p.pasos.map(q => convertirPaso(q, ++orden, ritmos))
      return {
        type: 'RepeatGroupDTO',
        stepOrder: grupoOrden,
        stepType: { stepTypeId: 6, stepTypeKey: 'repeat' },
        numberOfIterations: p.veces,
        endCondition: { ...END.iteraciones },
        endConditionValue: p.veces,
        smartRepeat: false,
        workoutSteps: hijos,
      } satisfies GarminRepeat
    }
    return convertirPaso(p, ++orden, ritmos)
  })

  return {
    workoutName: nombre.slice(0, 80),
    description: descripcion,
    sportType: { ...SPORT_RUNNING },
    workoutSegments: [{ segmentOrder: 1, sportType: { ...SPORT_RUNNING }, workoutSteps }],
  }
}
