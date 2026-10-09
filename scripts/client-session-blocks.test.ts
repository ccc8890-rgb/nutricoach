import assert from 'node:assert/strict'
import { crearPresentacionEjercicios } from '../lib/training/session-blocks'

const vista = crearPresentacionEjercicios([
  { id: 'warm', orden: 1, bloque: 'calentamiento' },
  { id: 'main-a', orden: 2, bloque: 'principal' },
  { id: 'main-b', orden: 3, bloque: null },
  { id: 'cool', orden: 4, bloque: 'vuelta_calma' },
])

assert.deepEqual(vista.map(grupo => grupo.label), [
  'CALENTAMIENTO',
  'BLOQUE PRINCIPAL',
  'VUELTA A LA CALMA',
])
assert.deepEqual(vista.flatMap(grupo => grupo.items.map(item => item.indiceGlobal)), [1, 2, 3, 4])
assert.equal(vista.some(grupo => grupo.label === 'MOVILIDAD / ACTIVACIÓN'), false)

console.log('✓ presentación de bloques para cliente')
