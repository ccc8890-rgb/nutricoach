import assert from 'node:assert/strict'
import { distribucionIntensidad, valorarIntensidad, type EntrenoIntensidad } from '../lib/rendimiento/intensidad'

const dia = (n: number) => new Date(Date.UTC(2026, 9, 10) - n * 86_400_000).toISOString().slice(0, 10)
const lap = (fc: number | null, dur: number) => ({ tipo: 'ACTIVE', paso: null, distancia_m: 1000, duracion_s: dur, fc_media: fc, velocidad_ms: 3 })
const e = (atras: number, vueltas: ReturnType<typeof lap>[], tipo = 'running'): EntrenoIntensidad => ({ fecha: dia(atras), tipo, vueltas })
const UMBRAL = 176 // límites: suave < 158, media < 176, dura ≥ 176

// 90 min suaves (140), 15 min medios (165), 15 min duros (180) → 75 / 12,5 / 12,5.
const d = distribucionIntensidad([e(3, [lap(140, 5400), lap(165, 900), lap(180, 900)]), e(10, [lap(null, 3000)])], dia(0), UMBRAL)
assert.deepEqual(d.limites, { suaveHasta: 158, mediaHasta: 176 })
assert.equal(d.reciente.minutos, 120)
assert.equal(d.reciente.pctSuave, 75)
assert.equal(d.reciente.pctMedia, 13)
assert.equal(d.reciente.pctSuave + d.reciente.pctMedia + d.reciente.pctDura, 100)
assert.equal(d.reciente.valoracion, 'bien')
assert.equal(d.previo.valoracion, 'sin_datos')
assert.equal(d.semanas.length, 12)

// Un rodaje a 160-165 ppm con umbral 176 es esfuerzo MEDIO, no duro (con zonas por % del máximo salía «duro»).
const medio = distribucionIntensidad([e(2, [lap(162, 3600), lap(165, 3600)]), e(9, [lap(160, 3600)])], dia(0), UMBRAL)
assert.equal(medio.reciente.pctMedia, 100)
assert.equal(medio.reciente.valoracion, 'zona_gris')

// Sin umbral conocido no se inventa nada.
const sin = distribucionIntensidad([e(2, [lap(150, 7200)])], dia(0), null)
assert.equal(sin.limites, null)
assert.equal(sin.reciente.valoracion, 'sin_datos')

// Ventana previa (28-83 días) separada; menos de 60 min con pulso → sin datos.
const prev = distribucionIntensidad([e(40, [lap(140, 7200)]), e(1, [lap(140, 600)])], dia(0), UMBRAL)
assert.equal(prev.previo.minutos, 120)
assert.equal(prev.reciente.valoracion, 'sin_datos')

// Solo carrera; fuerza y entrenos sin vueltas se ignoran.
const otros = distribucionIntensidad([e(2, [lap(140, 7200)], 'strength_training'), { fecha: dia(2), tipo: 'running', vueltas: null }], dia(0), UMBRAL)
assert.equal(otros.reciente.minutos, 0)

assert.equal(valorarIntensidad(80, 10, 10), 'bien')
assert.equal(valorarIntensidad(50, 35, 15), 'zona_gris')
assert.equal(valorarIntensidad(40, 20, 40), 'muy_duro')
assert.equal(valorarIntensidad(60, 20, 20), 'mejorable')
console.log('intensidad.test OK')
