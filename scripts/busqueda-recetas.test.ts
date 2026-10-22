import assert from 'node:assert/strict'
import { palabrasDeBusqueda, coincidePalabras, aplicarBusquedaNombre } from '../lib/recetas/busqueda'

const nombre = 'Tarta de chocolate con solo 3 ingredientes'
assert.ok(coincidePalabras(nombre, palabrasDeBusqueda('tarta chocolate')), 'palabras sueltas')
assert.ok(coincidePalabras(nombre, palabrasDeBusqueda('chocolate tarta')), 'cualquier orden')
assert.ok(coincidePalabras('Pollo al limón', palabrasDeBusqueda('limon')), 'sin tildes')
assert.ok(coincidePalabras(nombre, palabrasDeBusqueda('de')), 'solo relleno: se respeta lo escrito')
assert.ok(!coincidePalabras('Tarta de queso', palabrasDeBusqueda('tarta chocolate')), 'todas las palabras deben aparecer')
assert.deepEqual(palabrasDeBusqueda('  tarta   de chocolate '), ['tarta', 'chocolate'])
assert.deepEqual(palabrasDeBusqueda(''), [])

// Consulta Supabase: un ilike por palabra
const llamadas: string[] = []
const falsa = { ilike(c: string, v: string) { llamadas.push(`${c}:${v}`); return falsa }, or(f: string) { llamadas.push(`or:${f}`); return falsa } }
aplicarBusquedaNombre(falsa, 'tarta de chocolate')
assert.deepEqual(llamadas, ['or:nombre_busqueda.ilike.%tarta%,nombre_busqueda.ilike.%pastel%,nombre_busqueda.ilike.%cheesecake%', 'nombre_busqueda:%chocolate%'])
assert.ok(coincidePalabras('Cheesecake vegano de chocolate', palabrasDeBusqueda('tarta chocolate')), 'sinónimo: tarta → cheesecake')
assert.ok(coincidePalabras('Tosta de aguacate', palabrasDeBusqueda('tostadas')), 'sinónimo y plural: tostadas → tosta')
assert.ok(coincidePalabras('Pancakes de avena', palabrasDeBusqueda('tortitas')), 'sinónimo: tortitas → pancakes')
assert.ok(!coincidePalabras('Pollo al horno', palabrasDeBusqueda('tarta')), 'sin falsos positivos')
console.log('busqueda-recetas: OK')
assert.ok(!coincidePalabras('Pancakes de avena', palabrasDeBusqueda('bizcocho')), 'bizcocho no trae pancakes')
assert.ok(!coincidePalabras('Pasta a la boloñesa', palabrasDeBusqueda('bowl')), 'bowl no trae boloñesa')
console.log('busqueda-recetas (sinónimos): OK')
const l2: string[] = []
const f2 = { ilike(c: string, v: string) { l2.push(`${c}:${v}`); return f2 }, or() { return f2 } }
aplicarBusquedaNombre(f2, 'LIMÓN')
assert.deepEqual(l2, ['nombre_busqueda:%limon%'], 'la palabra se normaliza sin tildes para la columna sin tildes')
console.log('busqueda-recetas (tildes en servidor): OK')
