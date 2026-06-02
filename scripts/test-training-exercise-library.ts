import assert from 'node:assert/strict'
import { crearExerciseLibraryBatchPlan, crearExerciseLibraryQueue } from '../lib/training/exercise-library'

const queue = crearExerciseLibraryQueue([
  { id: 'e1', nombre: 'Sentadilla', grupo_muscular: 'Piernas', tipo: 'fuerza', foto_url: null, video_url: null, dificultad_nivel: null, equipamiento: [], musculos_secundarios: [] },
  { id: 'e2', nombre: 'Press banca', grupo_muscular: 'Pecho', tipo: 'fuerza', foto_url: 'foto.jpg', video_url: null, dificultad_nivel: 3, equipamiento: ['Barra'], musculos_secundarios: [] },
  { id: 'e3', nombre: 'Remo', grupo_muscular: 'Espalda', tipo: 'fuerza', foto_url: 'foto.jpg', video_url: 'video.mp4', dificultad_nivel: 3, equipamiento: ['Mancuernas'], musculos_secundarios: ['Core'] },
])

assert.equal(queue.total, 3)
assert.equal(queue.prioritarios[0].id, 'e1')
assert.equal(queue.prioritarios[0].reason, 'Sin foto, sin vídeo y sin dificultad')
assert.equal(queue.prioritarios[1].id, 'e2')
assert.equal(queue.completos, 1)
assert.equal(queue.assetReadinessPct, 33)

const batchPlan = crearExerciseLibraryBatchPlan([
  { id: 'e1', nombre: 'Sentadilla', grupo_muscular: 'Piernas', tipo: 'fuerza', foto_url: null, video_url: null, dificultad_nivel: null, equipamiento: [], musculos_secundarios: [] },
  { id: 'e2', nombre: 'Press banca', grupo_muscular: 'Pecho', tipo: 'fuerza', foto_url: 'foto.jpg', video_url: null, dificultad_nivel: 3, equipamiento: ['Barra'], musculos_secundarios: [] },
  { id: 'e3', nombre: 'Remo', grupo_muscular: 'Espalda', tipo: 'fuerza', foto_url: 'foto.jpg', video_url: 'video.mp4', dificultad_nivel: 3, equipamiento: ['Mancuernas'], musculos_secundarios: ['Core'] },
])
assert.equal(batchPlan.focus, 'Vídeo y foto')
assert.equal(batchPlan.batchSize, 2)
assert.equal(batchPlan.estimatedMinutes, 22)
assert.deepEqual(batchPlan.exerciseIds, ['e1', 'e2'])
assert.ok(batchPlan.note.includes('2 ejercicios'))

console.log('training exercise library tests passed')
