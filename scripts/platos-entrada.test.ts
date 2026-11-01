import assert from 'node:assert/strict'
import { validarEdicion, fotoValida, construirVista } from '../lib/platos/entrada'

// Edición: campos opcionales, con límites
assert.equal(validarEdicion('x').ok, false)
assert.equal(validarEdicion({ nombre: '' }).ok, false)
assert.equal(validarEdicion({ tipo_comida: 'Brunch' }).ok, false)
assert.equal(validarEdicion({ porciones: 0 }).ok, false)
assert.equal(validarEdicion({ lineas: Array.from({ length: 26 }, () => ({ nombre_libre: 'Huevo', cantidad_gramos: 10 })) }).ok, false, 'máx. 25 líneas')
assert.equal(validarEdicion({ lineas: [{ nombre_libre: 'Huevo', cantidad_gramos: -5 }] }).ok, false)
assert.equal(validarEdicion({ lineas: [{ nombre_libre: 'Huevo', cantidad_gramos: 99999 }] }).ok, false)
assert.equal(validarEdicion({ lineas: [{ nombre_libre: 'H', cantidad_gramos: 10 }] }).ok, false)
const ok = validarEdicion({ nombre: ' Tortilla ', tipo_comida: 'Cena', porciones: 2, pasos: 'Cuaja.', lineas: [{ nombre_libre: 'Huevo', cantidad_gramos: 120, alimento_id: '11111111-1111-4111-8111-111111111111' }, { nombre_libre: 'Patata', cantidad_gramos: 200 }] })
assert.ok(ok.ok)
if (ok.ok) {
  assert.equal(ok.valor.nombre, 'Tortilla')
  assert.equal(ok.valor.lineas?.[0].alimento_id, '11111111-1111-4111-8111-111111111111')
  assert.equal(ok.valor.lineas?.[1].alimento_id, null)
}
assert.equal(validarEdicion({ lineas: [{ nombre_libre: 'Huevo', cantidad_gramos: 10, alimento_id: 'no-uuid' }] }).ok, false)
assert.ok(validarEdicion({}).ok, 'una edición vacía es válida (no cambia nada)')

// Foto: tipo y tamaño (Review Focus 4)
assert.equal(fotoValida('text/plain', 100).ok, false)
assert.equal(fotoValida('image/jpeg', 4 * 1024 * 1024 + 1).ok, false)
assert.equal(fotoValida('image/jpeg', 0).ok, false)
assert.ok(fotoValida('image/heic', 5000).ok)
assert.ok(fotoValida('image/webp', 5000).ok)

// Vista congelada para el snapshot
const v = construirVista({ nombre: 'Tortilla', kcal: 500, proteinas: 25, carbohidratos: 30, grasas: 28, estimado: false }, [{ nombre_libre: 'Huevo', cantidad_gramos: 150 }])
assert.deepEqual(v.ingredientes, [{ nombre_libre: 'Huevo', cantidad_gramos: 150 }])
assert.equal(v.kcal, 500)

console.log('platos-entrada OK')
