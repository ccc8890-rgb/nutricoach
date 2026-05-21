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

const perfilado = calcularGapMicronutrientes(totales, {
  sexo: 'mujer',
  edad: 55,
  objetivo: 'diabetes tipo 2',
  condiciones: ['HTA'],
})

assert.equal(perfilado.find(g => g.key === 'sodio_mg')?.objetivo, 1500)
assert.equal(perfilado.find(g => g.key === 'fibra_g')?.objetivo, 30)
assert.equal(perfilado.find(g => g.key === 'azucares_anyadidos_g')?.objetivo, 15)
assert.equal(perfilado.find(g => g.key === 'hierro_mg')?.objetivo, 18)
assert.equal(perfilado.find(g => g.key === 'calcio_mg')?.objetivo, 1200)

console.log('micronutrientes-gap.test.ts OK')
