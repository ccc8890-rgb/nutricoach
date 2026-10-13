import assert from 'node:assert/strict'
import { ingredientesDePlatos, type PlatoCompra } from '../lib/lista-compra/por-platos'

const platos: PlatoCompra[] = [
    {
        id: 'a', nombre: 'Tortilla de patata', franja: 'Comida', dia: 'Lunes',
        ingredientes: [
            { clave: 'canon:huevos', nombre: 'Huevos', categoria: 'Huevos', cantidad_gramos: 180 },
            { clave: 'patata', nombre: 'Patata', categoria: 'Verduras', cantidad_gramos: 400 },
        ],
    },
    {
        id: 'b', nombre: 'Pollo al curry', franja: 'Cena', dia: 'Lunes',
        ingredientes: [
            { clave: 'pollo', nombre: 'Pechuga de pollo', categoria: 'Carnes', cantidad_gramos: 250 },
            { clave: 'patata', nombre: 'Patata', categoria: 'Verduras', cantidad_gramos: 700 },
        ],
    },
    {
        id: 'c', nombre: 'Ensalada', franja: 'Cena', dia: 'Martes',
        ingredientes: [{ clave: 'lechuga', nombre: 'Lechuga', categoria: 'Verduras', cantidad_gramos: 100 }],
    },
]

// Sin selección → nada
assert.deepEqual(ingredientesDePlatos(platos, new Set()), [])

// Un plato: solo sus ingredientes
const uno = ingredientesDePlatos(platos, new Set(['a']))
assert.deepEqual(uno.map(i => i.nombre), ['Huevos', 'Patata'])
assert.equal(uno[0].cantidad_compra, '3 unidades aprox.')

// Dos platos: suma lo repetido (patata 400 + 700 = 1,1 kg) y recuerda de qué platos viene
const dos = ingredientesDePlatos(platos, new Set(['a', 'b']))
const patata = dos.find(i => i.clave === 'patata')!
assert.equal(patata.cantidad_gramos, 1100)
assert.equal(patata.cantidad_compra, '1.1 kg')
assert.deepEqual(patata.platos, ['Tortilla de patata', 'Pollo al curry'])
assert.equal(dos.length, 3)

// No incluye platos no elegidos
assert.ok(!dos.some(i => i.clave === 'lechuga'))

console.log('lista-compra-por-platos: OK')
