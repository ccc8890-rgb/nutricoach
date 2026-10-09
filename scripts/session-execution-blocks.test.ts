import assert from 'node:assert/strict'
import { esInicioDeBloque, ordenarEjerciciosParaEjecucion } from '../lib/training/session-blocks'

const ejercicios = [
  { bloque: null },
  { bloque: 'principal' },
  { bloque: 'accesorios' },
]

assert.equal(esInicioDeBloque(ejercicios, 0), true)
assert.equal(esInicioDeBloque(ejercicios, 1), false)
assert.equal(esInicioDeBloque(ejercicios, 2), true)

const ordenados = ordenarEjerciciosParaEjecucion([
  { id: 'main', orden: 1, bloque: 'principal' },
  { id: 'warm', orden: 2, bloque: 'calentamiento' },
  { id: 'accessory', orden: 3, bloque: 'accesorios' },
  { id: 'main-2', orden: 4, bloque: 'principal' },
])

assert.deepEqual(ordenados.map(item => item.id), ['warm', 'main', 'main-2', 'accessory'])

console.log('✓ límites de bloque durante la ejecución')
