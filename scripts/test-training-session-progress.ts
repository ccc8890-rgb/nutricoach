import assert from 'node:assert/strict'
import { crearSessionProgressSummary } from '../lib/training/session-progress'

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

console.log('training session progress tests passed')
