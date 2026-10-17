import assert from 'node:assert/strict'
import { limpiarCamposEditables } from '../lib/recetas/campos-editables'

assert.equal(limpiarCamposEditables({ nombre: '   ' }).ok, false)
const r = limpiarCamposEditables({ nombre: ' Tortitas ', kcal: 9999, estado: 'aprobada', ingredientes: [] })
assert.ok(r.ok)
assert.deepEqual(r.cambios, { nombre: 'Tortitas' })
assert.equal(limpiarCamposEditables({ tiempo_prep_min: -5 }).ok, false)
assert.equal(limpiarCamposEditables({ tiempo_prep_min: 12.5 }).ok, false)
assert.equal(limpiarCamposEditables({}).ok, false)
assert.equal(limpiarCamposEditables({ tags: Array.from({ length: 25 }, (_, i) => `t${i}`) }).ok, false)
const t = limpiarCamposEditables({ tags: ['Pollo', ' Arroz ', ''], descripcion: 'Rica', categoria: 'Comida', tiempo_prep_min: 20 })
assert.ok(t.ok)
assert.deepEqual(t.cambios, { tags: ['Pollo', 'Arroz'], descripcion: 'Rica', categoria: 'Comida', tiempo_prep_min: 20 })
console.log('recetas-campos-editables OK')
