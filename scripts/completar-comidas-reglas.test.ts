// Reglas de sentido de los complementos (tieneSentido / contextoDe): ejecutar con `npx tsx scripts/completar-comidas-reglas.test.ts`
import assert from 'node:assert/strict'
import { contextoDe, tieneSentido, type Cand } from '../lib/nutricion/completar-comidas'

const al = (nombre: string, categoria: string, calorias = 100, grasas = 5, g = 100) => ({ cantidad_gramos: g, es_complemento: false, alimento: { nombre, categoria, calorias, grasas } })
const alimento = (nombre: string, cat: Cand['cat']): Cand => ({ tipo: 'alimento', clave: nombre, nombre, cat, alim: { id: 'x', nombre, calorias: 100, proteinas: 5, carbohidratos: 10, grasas: 2 }, raciones: [100] })
const receta = (nombre: string, cat: Cand['cat'] = 'base'): Cand => ({ tipo: 'receta', clave: nombre, nombre, cat, id: 'r', m: { kcal: 200, p: 5, c: 30, g: 5 } })

// Cena de pescado sin hidrato: arroz y fruta sí, lácteo no
const caballa = contextoDe({ receta: { nombre: 'Caballa al horno con tomate y orégano' }, comida_alimentos: [al('Caballa', 'Pescados', 205, 14, 200), al('Tomate', 'Verduras y hortalizas', 18, 0.2, 200), al('Aceite de oliva', 'Grasas y aceites', 884, 100, 15)] })
assert.equal(tieneSentido(alimento('Arroz blanco (cocido)', 'base'), caballa, 'Cena'), true)
assert.equal(tieneSentido(alimento('Manzana', 'fruta'), caballa, 'Cena'), true)
assert.equal(tieneSentido(alimento('Skyr natural', 'lacteo'), caballa, 'Cena'), false)

// Plato que ya lleva pasta: no se añade otra base
const pasta = contextoDe({ receta: { nombre: 'Macarrones con pollo' }, comida_alimentos: [al('Macarrones', 'Pastas y arroces'), al('Pollo', 'Carnes')] })
assert.equal(tieneSentido(alimento('Arroz blanco (cocido)', 'base'), pasta, 'Comida'), false)

// Desayuno salado: tostada de jamón sí, porridge no; dulce al revés; neutro (café) en ambos
const salado = contextoDe({ receta: { nombre: 'Revuelto de huevo y jamón' }, comida_alimentos: [al('Huevo', 'Huevos'), al('Jamón', 'Carnes')] })
assert.equal(salado.salado, true)
assert.equal(tieneSentido(receta('Tostada de jamón serrano y tomate'), salado, 'Desayuno'), true)
assert.equal(tieneSentido(receta('Porridge de avena con frutos rojos'), salado, 'Desayuno'), false)
assert.equal(tieneSentido(receta('Café con leche', 'lacteo'), salado, 'Desayuno'), true)
assert.equal(tieneSentido(alimento('Manzana', 'fruta'), salado, 'Desayuno'), true) // la fruta no depende del sabor
const dulce = contextoDe({ receta: { nombre: 'Tortitas de avena y plátano' }, comida_alimentos: [al('Harina de avena', 'Cereales'), al('Plátano', 'Frutas')] })
assert.equal(tieneSentido(receta('Tostada de aguacate y tomate'), dulce, 'Desayuno'), false)
assert.equal(tieneSentido(receta('Yogur griego con granola y frutos rojos', 'lacteo'), dulce, 'Desayuno'), true)
assert.equal(tieneSentido(receta('Tostada de plátano y miel'), dulce, 'Desayuno'), false) // ya lleva base (tortitas)

// Plato muy graso: sin frutos secos ni aguacate encima
const graso = contextoDe({ receta: { nombre: 'Salmón con salsa' }, comida_alimentos: [al('Aceite de oliva', 'Grasas y aceites', 884, 100, 30)] })
assert.equal(tieneSentido(alimento('Nueces', 'grasa'), graso, 'Cena'), false)
console.log('completar-comidas reglas: OK')
