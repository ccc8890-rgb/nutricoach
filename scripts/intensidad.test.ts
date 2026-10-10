import assert from 'node:assert/strict'
import { distribucionIntensidad, valorarIntensidad, type EntrenoIntensidad } from '../lib/rendimiento/intensidad'

const dia = (n: number) => new Date(Date.UTC(2026, 9, 10) - n * 86_400_000).toISOString().slice(0, 10)
const e = (atras: number, z: number[], tipo = 'running'): EntrenoIntensidad => ({ fecha: dia(atras), tipo, tiempo_zona_fc: z })

// 2 h recientes: 1h30 fácil (Z1-2), 15 min Z3, 15 min Z4-5 → 75 / 12,5 / 12,5.
const d = distribucionIntensidad([e(3, [1200, 4200, 900, 600, 300]), e(10, [0, 0, 0, 0, 0])], dia(0))
assert.equal(d.reciente.minutos, 120)
assert.equal(d.reciente.pctSuave, 75)
assert.equal(d.reciente.pctMedia, 13)
assert.equal(d.reciente.pctSuave + d.reciente.pctMedia + d.reciente.pctDura, 100)
assert.equal(d.reciente.valoracion, 'bien')
assert.equal(d.previo.valoracion, 'sin_datos')
assert.equal(d.semanas.length, 12)

// Perfil típico de «todo a ritmo moderado-fuerte»: casi todo en Z4.
const duro = distribucionIntensidad([e(2, [60, 200, 1500, 5000, 1000]), e(9, [60, 200, 1500, 5000, 1000])], dia(0))
assert.equal(duro.reciente.valoracion, 'muy_duro')
assert.ok(duro.reciente.pctSuave < 10)

// Ventana previa (28-83 días) separada de la reciente.
const prev = distribucionIntensidad([e(40, [3000, 3000, 600, 300, 300]), e(1, [100, 100, 100, 100, 100])], dia(0))
assert.equal(prev.previo.minutos, 120)
assert.equal(prev.reciente.valoracion, 'sin_datos') // 500 s < 60 min

// Solo carrera; fuerza y zonas inválidas se ignoran.
const otros = distribucionIntensidad([e(2, [3000, 3000, 0, 0, 0], 'strength_training'), { fecha: dia(2), tipo: 'running', tiempo_zona_fc: null }, e(3, [1, 2] as number[])], dia(0))
assert.equal(otros.reciente.minutos, 0)

assert.equal(valorarIntensidad(80, 10, 10), 'bien')
assert.equal(valorarIntensidad(50, 35, 15), 'zona_gris')
assert.equal(valorarIntensidad(40, 20, 40), 'muy_duro')
assert.equal(valorarIntensidad(60, 20, 20), 'mejorable')
console.log('intensidad.test OK')
