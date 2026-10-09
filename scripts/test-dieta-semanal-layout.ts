import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const source = readFileSync('components/PortalCliente/DietaKanban.tsx', 'utf8')

assert.match(source, /diet-week-agenda/, 'La semana debe usar una agenda vertical')
assert.match(source, /diet-week-day/, 'Cada día debe tener una sección propia')
assert.match(source, /diet-week-meal__move/, 'Cada plato debe ofrecer un control Mover independiente')
assert.doesNotMatch(source, /overflow-x-auto/, 'La vista semanal no debe depender de un carrusel horizontal')

console.log('✓ La dieta semanal usa agenda vertical y movimiento independiente')
