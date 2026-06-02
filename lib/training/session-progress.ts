export type SessionProgressPhase = 'inicio' | 'bloque_central' | 'cierre' | 'completa'

export interface SessionProgressInput {
  totalExercises: number
  currentExerciseIndex: number
  totalSets: number
  completedSets: number
}

export interface SessionProgressSummary {
  percent: number
  phase: SessionProgressPhase
  message: string
}

export interface SessionExecutionSet {
  kg: number
  reps: number
  rpe: number
  hecho: boolean
}

export interface SessionExecutionInput {
  sets: SessionExecutionSet[]
  descansoSegundos: number
  pesoSugerido?: string | null
  ultimoPesoKg?: number | null
}

export interface SessionExecutionSummary {
  nextSetLabel: string
  volumeKg: number
  averageRpe: number | null
  focusLabel: string
  recoveryLabel: string
}

export function crearSessionProgressSummary(input: SessionProgressInput): SessionProgressSummary {
  const percent = input.totalSets > 0
    ? Math.min(100, Math.round((input.completedSets / input.totalSets) * 100))
    : 0

  const isLastExercise = input.totalExercises > 0 && input.currentExerciseIndex >= input.totalExercises - 1
  const phase: SessionProgressPhase = percent >= 100
    ? 'completa'
    : isLastExercise || percent >= 75
      ? 'cierre'
      : percent >= 25
        ? 'bloque_central'
        : 'inicio'

  const message = phase === 'completa'
    ? 'Sesión lista para cerrar y enviar al coach.'
    : phase === 'cierre'
      ? 'Último tramo: no fuerces técnica por cerrar rápido.'
      : phase === 'bloque_central'
        ? 'Bloque central: mantén el RPE objetivo y registra datos útiles.'
        : 'Empieza con calma y prioriza técnica en los primeros sets.'

  return { percent, phase, message }
}

export function crearSessionExecutionSummary(input: SessionExecutionInput): SessionExecutionSummary {
  const completedSets = input.sets.filter(set => set.hecho)
  const nextSetIndex = input.sets.findIndex(set => !set.hecho)
  const volumeKg = completedSets.reduce((total, set) => total + (set.kg * set.reps), 0)
  const averageRpe = completedSets.length > 0
    ? Number((completedSets.reduce((total, set) => total + set.rpe, 0) / completedSets.length).toFixed(1))
    : null

  let focusLabel = 'Técnica primero'
  if (averageRpe !== null && averageRpe >= 9) {
    focusLabel = 'No fuerces más'
  } else if (input.pesoSugerido || (input.ultimoPesoKg ?? 0) > 0) {
    focusLabel = 'Carga controlada'
  } else if (completedSets.length > 0) {
    focusLabel = 'Mantén consistencia'
  }

  return {
    nextSetLabel: nextSetIndex >= 0 ? `Set ${nextSetIndex + 1} pendiente` : 'Ejercicio completo',
    volumeKg: Number(volumeKg.toFixed(1)),
    averageRpe,
    focusLabel,
    recoveryLabel: input.descansoSegundos > 0 ? `Descanso ${input.descansoSegundos}s` : 'Sin descanso pautado',
  }
}
