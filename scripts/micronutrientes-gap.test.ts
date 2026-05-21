import assert from 'node:assert/strict'
import {
  calcularGapMicronutrientes,
  crearTotalesMicronutrientes,
  seleccionarMicronutrientesPrioritarios,
} from '../lib/micronutrientes/gap-report'

const totales = crearTotalesMicronutrientes()
totales.fibra_g = 12
totales.sodio_mg = 2400
totales.calcio_mg = 950

const gaps = calcularGapMicronutrientes(totales)
const fibra = gaps.find(g => g.key === 'fibra_g')
const sodio = gaps.find(g => g.key === 'sodio_mg')
const calcio = gaps.find(g => g.key === 'calcio_mg')

assert.equal(fibra?.estado, 'bajo')
assert.equal(sodio?.estado, 'alto')
assert.equal(calcio?.estado, 'ok')

const prioridades = seleccionarMicronutrientesPrioritarios(gaps, 2)
assert.equal(prioridades.length, 2)
assert.equal(prioridades[0].estado !== 'ok', true)

console.log('micronutrientes-gap.test.ts OK')
