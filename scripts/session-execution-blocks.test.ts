import assert from 'node:assert/strict'
import { esInicioDeBloque } from '../lib/training/session-blocks'

const ejercicios = [
  { bloque: null },
  { bloque: 'principal' },
  { bloque: 'accesorios' },
]

assert.equal(esInicioDeBloque(ejercicios, 0), true)
assert.equal(esInicioDeBloque(ejercicios, 1), false)
assert.equal(esInicioDeBloque(ejercicios, 2), true)

console.log('✓ límites de bloque durante la ejecución')
