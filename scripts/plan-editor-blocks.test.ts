import assert from 'node:assert/strict'
import { combinarOrdenBloque, crearGruposEditorSesion, crearGuardiaActualizacionBloque } from '../lib/training/plan-editor-blocks'

const grupos = crearGruposEditorSesion([
  { id: 'principal-2', orden: 4, bloque: 'principal' },
  { id: 'calentamiento', orden: 1, bloque: 'calentamiento' },
  { id: 'principal-1', orden: 2, bloque: 'principal' },
])

assert.deepEqual(grupos.map(g => g.label), ['CALENTAMIENTO', 'BLOQUE PRINCIPAL'])
assert.deepEqual(grupos[1].items.map(item => item.id), ['principal-1', 'principal-2'])

const reordenados = combinarOrdenBloque(
  [
    { id: 'warm', orden: 1, bloque: 'calentamiento' },
    { id: 'main-a', orden: 2, bloque: 'principal' },
    { id: 'main-b', orden: 3, bloque: 'principal' },
  ],
  'principal',
  ['main-b', 'main-a'],
)

assert.deepEqual(reordenados.map(item => item.id), ['warm', 'main-b', 'main-a'])

const guardia = crearGuardiaActualizacionBloque()
assert.equal(guardia.iniciar('exercise-a'), true)
assert.equal(guardia.iniciar('exercise-a'), false)
assert.equal(guardia.estaGuardando('exercise-a'), true)
guardia.finalizar('exercise-a')
assert.equal(guardia.iniciar('exercise-a'), true)

console.log('✓ agrupación del editor de entrenamiento')
