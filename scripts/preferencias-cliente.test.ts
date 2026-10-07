// npx tsx scripts/preferencias-cliente.test.ts
import assert from 'node:assert/strict'
import { afinidadHabitual, esHabitualComplemento, lleva } from '../lib/nutricion/preferencias-cliente'
import type { PlatoHabitualCliente } from '../lib/dieta-habitual'

const h = (momento: PlatoHabitualCliente['momento'], plato: string, claves: string[], modificable: PlatoHabitualCliente['modificable'] = 'ajustar_cantidades'): PlatoHabitualCliente => ({
  momento, texto_original: plato, plato_normalizado: plato, frecuencia: 'preferido', importancia_adherencia: 'alta', modificable, estrategia: '', ingredientes_clave: claves, preferencias_detectadas: [], fuente: 'dia_tipico',
})
const habituales = [h('desayuno', 'tostada con aguacate', ['pan', 'aguacate']), h('merienda', 'yogur con fruta', ['yogur']), h('comida', 'arroz con pollo', ['arroz', 'pollo'], 'sustituible')]

assert.equal(afinidadHabitual('Tostada de aguacate y tomate', 'Desayuno', habituales), 1)
assert.equal(afinidadHabitual('Tostada de aguacate y tomate', 'Cena', habituales), 0) // otra franja
assert.equal(afinidadHabitual('Porridge de avena', 'Desayuno', habituales), 0)
assert.equal(afinidadHabitual('Arroz blanco con pollo y huevo', 'Comida', habituales), 0.5) // sustituible pesa la mitad
assert.equal(esHabitualComplemento('Yogur griego natural', 'Merienda', habituales), true)
assert.equal(esHabitualComplemento('Skyr natural', 'Merienda', habituales), false)
assert.equal(lleva('Pimientos rellenos de pollo y arroz', ['pimiento']), true)
assert.equal(lleva('Tortilla de patata', ['pimiento']), false)
console.log('preferencias-cliente: OK')
