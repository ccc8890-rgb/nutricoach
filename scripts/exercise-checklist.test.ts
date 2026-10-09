import assert from 'node:assert/strict'
import {
  buildExerciseChecklistKey,
  parseExerciseChecklist,
  toggleExerciseChecklist,
} from '../lib/training/exercise-checklist'

assert.equal(
  buildExerciseChecklistKey('sesion-1', new Date(2026, 9, 9, 18, 30)),
  'nutricoach:exercise-checklist:sesion-1:2026-10-09',
  'la checklist debe quedar aislada por sesión y fecha local',
)

assert.deepEqual(
  [...parseExerciseChecklist('["ej-1","eliminado",4]', ['ej-1', 'ej-2'])],
  ['ej-1'],
  'la carga debe conservar únicamente ejercicios válidos de la sesión',
)

const marcado = toggleExerciseChecklist(new Set<string>(), 'ej-1')
assert.deepEqual([...marcado], ['ej-1'], 'el primer toque debe marcar el ejercicio')
assert.deepEqual(
  [...toggleExerciseChecklist(marcado, 'ej-1')],
  [],
  'el segundo toque debe desmarcar el ejercicio',
)

console.log('exercise-checklist: OK')
