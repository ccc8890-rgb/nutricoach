import assert from 'node:assert/strict'
import { calcularGramajeAjustado, inferirRolIngrediente } from '../lib/ingredient-roles'
import { calcularCantidadAplicadaReceta } from '../lib/recetas/aplicar-receta-comida'

assert.equal(
  inferirRolIngrediente({ calorias: 149, carbohidratos: 33, proteinas: 6, grasas: 0 }, 'ajo'),
  'especias_aromaticos'
)

assert.equal(calcularGramajeAjustado(5, 'especias_aromaticos', false, 1.8), 5)
assert.equal(calcularGramajeAjustado(10, 'grasa_saludable', false, 2), 15)
assert.equal(calcularGramajeAjustado(40, 'salsa_condimento', false, 2), 50)
assert.equal(calcularGramajeAjustado(80, 'estructural', false, 2), 92)
assert.equal(calcularGramajeAjustado(30, 'carbohidrato_base', true, 2), 30)

const salAplicada = calcularCantidadAplicadaReceta(5, 'especias_aromaticos', false, 2)
assert.equal(salAplicada.cantidad_gramos, 5)
assert.equal(salAplicada.factor_ajuste, 1)

const aceiteAplicado = calcularCantidadAplicadaReceta(10, 'grasa_saludable', false, 2)
assert.equal(aceiteAplicado.cantidad_gramos, 15)
assert.equal(aceiteAplicado.factor_ajuste, 1.5)

const arrozAplicado = calcularCantidadAplicadaReceta(120, 'carbohidrato_base', false, 1.6)
assert.equal(arrozAplicado.cantidad_gramos, 200)
assert.equal(Math.round(arrozAplicado.factor_ajuste * 100) / 100, 1.67)

console.log('ingredient-roles-scaling.test.ts OK')
