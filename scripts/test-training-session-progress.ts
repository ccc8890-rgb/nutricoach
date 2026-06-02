import assert from 'node:assert/strict'
import { crearSessionExecutionSummary, crearSessionProgressSummary } from '../lib/training/session-progress'

const inicio = crearSessionProgressSummary({ totalExercises: 4, currentExerciseIndex: 0, totalSets: 16, completedSets: 0 })
assert.equal(inicio.percent, 0)
assert.equal(inicio.phase, 'inicio')
assert.equal(inicio.message, 'Empieza con calma y prioriza técnica en los primeros sets.')

const mitad = crearSessionProgressSummary({ totalExercises: 4, currentExerciseIndex: 1, totalSets: 16, completedSets: 8 })
assert.equal(mitad.percent, 50)
assert.equal(mitad.phase, 'bloque_central')
assert.equal(mitad.message, 'Bloque central: mantén el RPE objetivo y registra datos útiles.')

const cierre = crearSessionProgressSummary({ totalExercises: 4, currentExerciseIndex: 3, totalSets: 16, completedSets: 15 })
assert.equal(cierre.percent, 94)
assert.equal(cierre.phase, 'cierre')
assert.equal(cierre.message, 'Último tramo: no fuerces técnica por cerrar rápido.')

const execution = crearSessionExecutionSummary({
  sets: [
    { kg: 80, reps: 5, rpe: 8, hecho: true },
    { kg: 82.5, reps: 5, rpe: 8, hecho: true },
    { kg: 0, reps: 0, rpe: 7, hecho: false },
  ],
  descansoSegundos: 120,
  pesoSugerido: 'RPE 8',
  ultimoPesoKg: 77.5,
})
assert.equal(execution.nextSetLabel, 'Set 3 pendiente')
assert.equal(execution.volumeKg, 812.5)
assert.equal(execution.averageRpe, 8)
assert.equal(execution.focusLabel, 'Carga controlada')
assert.equal(execution.recoveryLabel, 'Descanso 120s')

console.log('training session progress tests passed')
