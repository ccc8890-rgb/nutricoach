import assert from 'node:assert/strict'
import { motivoIncompatible, expandirEvitar } from '../lib/nutricion/compatibilidad-receta'

const pesce = ['pescetariano']
assert.ok(motivoIncompatible({ nombre: 'Lentejas estofadas con chorizo y verduras', intolerancias: [], ingredientes: ['Lentejas', 'Chorizo'] }, pesce, []))
assert.ok(motivoIncompatible({ nombre: 'Huevos duros con salmorejo y jamón serrano', intolerancias: [], ingredientes: ['Jamón serrano'] }, pesce, []))
assert.ok(motivoIncompatible({ nombre: 'Mini wraps de pavo y hummus', intolerancias: [], ingredientes: ['Pavo'] }, pesce, []))
// Pescado y marisco sí valen; «lomo de salmón» no es carne
assert.equal(motivoIncompatible({ nombre: 'Salmón al horno con espárragos', intolerancias: [], ingredientes: ['Lomo de salmón'] }, pesce, []), null)
assert.equal(motivoIncompatible({ nombre: 'Fideos con gambas y ajo', intolerancias: [], ingredientes: ['Gambas'] }, pesce, []), null)
// Quien solo evita «pollo» no pierde el pavo
assert.deepEqual(expandirEvitar('pollo'), ['pollo'])
assert.ok(expandirEvitar('aves').includes('pavo'))
console.log('compatibilidad pescetariano OK')
