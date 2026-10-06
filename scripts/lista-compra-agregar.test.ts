import assert from 'node:assert/strict'
import { agregarIngredientes, type FuenteIngrediente } from '../lib/lista-compra/agregar'

const f = (alimento_id: string, alimento_nombre: string, categoria: string, cantidad_gramos: number, receta_nombre: string): FuenteIngrediente =>
  ({ alimento_id, alimento_nombre, categoria, es_generico: true, cantidad_gramos, receta_nombre })

assert.equal(agregarIngredientes([]).size, 0)

const mapa = agregarIngredientes([
  f('a1', 'Pechuga de pollo', 'Carnes', 200, 'Bowl'),
  f('a1', 'Pechuga de pollo', 'Carnes', 300, 'Wrap'),
  f('agua', 'Agua', 'Otros', 500, 'Bowl'),
  f('sal', 'Sal', 'Otros', 5, 'Bowl'),
  f('h1', 'Huevo L', 'Huevos', 120, 'Bowl'),
  f('h2', 'Huevos camperos', 'Huevos', 60, 'Wrap'),
])
const items = [...mapa.values()]
// agua y sal no se compran; los dos tipos de huevo se unifican
assert.equal(items.length, 2)
const pollo = items.find(i => i.alimento_ids.includes('a1'))!
assert.equal(pollo.cantidad_gramos_total, 500)
assert.deepEqual([...pollo.recetas_origen].sort(), ['Bowl', 'Wrap'])
const huevos = items.find(i => i.alimento_nombre === 'Huevos')!
assert.equal(huevos.cantidad_gramos_total, 180)
assert.deepEqual([...huevos.alimento_ids].sort(), ['h1', 'h2'])

console.log('lista-compra-agregar: OK')
