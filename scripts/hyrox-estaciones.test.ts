import assert from 'node:assert/strict'
import { estacionesEnNombres, esPliometria, validarHibridoHyrox } from '../lib/entrenos/hyrox-estaciones'

assert.deepEqual([...estacionesEnNombres(['Sled push', 'Remo ergómetro', "Farmer's carry", 'Wall balls hyrox', 'SkiErg intervalos', 'Burpee broad jumps ritmo', 'Sandbag lunges', 'Sled pull pesado'])].sort(), ['burpee_broad_jump', 'farmers_carry', 'remo', 'sandbag_lunges', 'skierg', 'sled_pull', 'sled_push', 'wall_balls'])
assert.equal(esPliometria({ nombre: 'Box jumps' }), true)
assert.equal(esPliometria({ nombre: 'Burpee broad jumps' }), false)
assert.equal(esPliometria({ nombre: 'Sentadilla con barra' }), false)
assert.equal(esPliometria({ nombre: 'Lo que sea', bloque: 'pliometria' }), true)

// Semana de Base sin pliometría y con estaciones que faltan.
let h = validarHibridoHyrox([{ nombre: 'A', ejercicios: [{ nombre: 'SkiErg' }, { nombre: 'Sled push' }] }], 'Base')
assert.deepEqual(h.map(x => x.codigo).sort(), ['estaciones_incompletas', 'sin_pliometria'])

// Semana completa de Base con pliometría: sin avisos.
h = validarHibridoHyrox([
  { nombre: 'Pierna', ejercicios: [{ nombre: 'Box jumps', bloque: 'pliometria' }, { nombre: 'Sled push', encadenado: true, series: 4 }, { nombre: 'Series run 400m', series: 4 }, { nombre: 'Wall balls' }] },
  { nombre: 'A', ejercicios: [{ nombre: 'SkiErg' }, { nombre: 'Sled pull' }] },
  { nombre: 'B', ejercicios: [{ nombre: 'Remo ergómetro' }, { nombre: "Farmer's carry" }] },
], 'Base')
assert.equal(h.length, 0)

// Encadenado mal formado.
h = validarHibridoHyrox([{ nombre: 'X', ejercicios: [{ nombre: 'Box jumps', bloque: 'pliometria' }, { nombre: 'Sled push', encadenado: true, series: 4 }, { nombre: 'Series run 400m', series: 3 }, { nombre: 'SkiErg' }, { nombre: 'Remo ergómetro' }] }], 'Deload')
assert.deepEqual(h.map(x => x.codigo), ['encadenado_series_distintas'])
console.log('hyrox-estaciones OK')
