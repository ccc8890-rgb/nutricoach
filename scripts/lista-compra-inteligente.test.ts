import assert from 'node:assert/strict'
import {
  convertirGramosACompra,
  sugerirSustitutosEconomicos,
  type IngredienteCompraInteligente,
} from '../lib/lista-compra/inteligente'

assert.equal(convertirGramosACompra(80, 'Huevos'), '2 unidades aprox.')
assert.equal(convertirGramosACompra(1200, 'Arroz'), '1.2 kg')
assert.equal(convertirGramosACompra(250, 'Yogur griego'), '250 g')

const ingredientes: IngredienteCompraInteligente[] = [
  {
    alimento_id: 'a',
    alimento_nombre: 'Salmón',
    categoria: 'Pescados',
    cantidad_gramos_total: 400,
    recetas_origen: ['Cena'],
    precios: [
      { supermercado_id: 's1', supermercado_nombre: 'Caro', supermercado_slug: 'caro', precio_por_kg: 22, coste_euros: 8.8, es_mas_barato: false },
      { supermercado_id: 's2', supermercado_nombre: 'Barato', supermercado_slug: 'barato', precio_por_kg: 14, coste_euros: 5.6, es_mas_barato: true },
    ],
    seleccion: null,
  },
]

const sustitutos = sugerirSustitutosEconomicos(ingredientes)
assert.equal(sustitutos.length, 1)
assert.equal(sustitutos[0].ahorro_euros, 3.2)
assert.equal(sustitutos[0].supermercado_recomendado, 'Barato')

console.log('lista-compra-inteligente.test.ts OK')
