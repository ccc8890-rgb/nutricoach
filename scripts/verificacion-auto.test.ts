import assert from 'node:assert/strict'
import { motivosIncompleta, type RecetaParaVerificar } from '../lib/recetas/verificacion-auto'

const ing = (alimento: string | null = 'a', rol: string | null = 'carbohidrato_base') => ({ alimento_id: alimento, rol_ingrediente: rol })
const buena: RecetaParaVerificar = {
  instrucciones: 'x'.repeat(80), tipo_plato: 'Comida', intolerancias: ['Sin Lactosa'], tiempo_prep_min: 20,
  receta_ingredientes: [ing(), ing(), ing()],
}
assert.deepEqual(motivosIncompleta(buena), [])
assert.deepEqual(motivosIncompleta({ ...buena, instrucciones: 'x'.repeat(79) }), ['instrucciones'])
assert.deepEqual(motivosIncompleta({ ...buena, receta_ingredientes: [ing(), ing()] }), ['<3 ingredientes'])
assert.deepEqual(motivosIncompleta({ ...buena, receta_ingredientes: [ing(), ing(null), ing()] }), ['ingrediente sin vincular'])
assert.deepEqual(motivosIncompleta({ ...buena, receta_ingredientes: [ing(), ing('a', null), ing()] }), ['ingrediente sin rol'])
assert.deepEqual(motivosIncompleta({ ...buena, tipo_plato: null, intolerancias: [], tiempo_prep_min: null }), ['sin franja', 'sin etiquetas', 'sin tiempo'])
assert.deepEqual(motivosIncompleta({ ...buena, receta_ingredientes: null, instrucciones: null }).includes('<3 ingredientes'), true)
console.log('verificacion-auto: OK')
