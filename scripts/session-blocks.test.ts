import assert from 'node:assert/strict'
import {
  agruparEjerciciosPorBloque,
  etiquetaBloqueSesion,
  normalizarBloqueSesion,
} from '../lib/training/session-blocks'

assert.equal(normalizarBloqueSesion(null), 'principal')
assert.equal(normalizarBloqueSesion('desconocido'), 'principal')
assert.equal(normalizarBloqueSesion('pliometria'), 'pliometria')
assert.equal(etiquetaBloqueSesion('vuelta_calma'), 'VUELTA A LA CALMA')

const grupos = agruparEjerciciosPorBloque([
  { id: 'p', orden: 2, bloque: 'principal' },
  { id: 'c', orden: 1, bloque: 'calentamiento' },
  { id: 'legacy', orden: 3, bloque: null },
])

assert.deepEqual(grupos.map(g => [g.bloque, g.items.map(x => x.id)]), [
  ['calentamiento', ['c']],
  ['principal', ['p', 'legacy']],
])

console.log('✓ contrato de bloques de sesión')
