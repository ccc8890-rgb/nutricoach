import assert from 'node:assert/strict'
import { bloqueEjercicioGenerado } from '../lib/training/generated-session-blocks'

assert.equal(bloqueEjercicioGenerado('calentamiento'), 'calentamiento')
assert.equal(bloqueEjercicioGenerado(undefined), 'principal')
assert.equal(bloqueEjercicioGenerado('potencia'), 'principal')

console.log('✓ bloques generados por IA')
