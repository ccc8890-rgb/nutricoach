import assert from 'node:assert/strict'
import {
  normalizarComidasDia,
  normalizarDuracionEstimadaMin,
  normalizarHoraInicio,
} from '../lib/ajustes-coach-validacion'

assert.equal(normalizarHoraInicio('00:00'), '00:00')
assert.equal(normalizarHoraInicio('23:59'), '23:59')
assert.equal(normalizarHoraInicio(null), null)
assert.equal(normalizarHoraInicio('24:00'), undefined)
assert.equal(normalizarHoraInicio('9:30'), undefined)
assert.equal(normalizarHoraInicio('09:60'), undefined)
assert.equal(normalizarHoraInicio(undefined), undefined)

assert.equal(normalizarDuracionEstimadaMin(10), 10)
assert.equal(normalizarDuracionEstimadaMin(480), 480)
assert.equal(normalizarDuracionEstimadaMin(null), null)
assert.equal(normalizarDuracionEstimadaMin(9), undefined)
assert.equal(normalizarDuracionEstimadaMin(481), undefined)
assert.equal(normalizarDuracionEstimadaMin(45.5), undefined)
assert.equal(normalizarDuracionEstimadaMin('45'), undefined)
assert.equal(normalizarDuracionEstimadaMin(undefined), undefined)

assert.equal(normalizarComidasDia(2), 2)
assert.equal(normalizarComidasDia(5), 5)
assert.equal(normalizarComidasDia(null), null)
assert.equal(normalizarComidasDia(1), undefined)
assert.equal(normalizarComidasDia(6), undefined)
assert.equal(normalizarComidasDia('3'), undefined)
assert.equal(normalizarComidasDia(undefined), undefined)

console.log('ajustes-coach-validacion: OK')
