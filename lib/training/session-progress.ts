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
