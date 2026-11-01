import assert from 'node:assert/strict'
import { transicionPermitida, vistaPublica, puedeAprobar, MAX_ANALISIS_POR_DIA, MAX_FOTO_BYTES, TIPOS_FOTO, type VistaPlato } from '../lib/platos/estado'

// Cliente
assert.equal(transicionPermitida('borrador', 'pendiente', 'cliente'), true)
assert.equal(transicionPermitida('aprobado', 'pendiente', 'cliente'), true, 'editar un aprobado lo devuelve a pendiente')
assert.equal(transicionPermitida('devuelto', 'pendiente', 'cliente'), true)
assert.equal(transicionPermitida('pendiente', 'aprobado', 'cliente'), false, 'el cliente no se aprueba solo')
assert.equal(transicionPermitida('borrador', 'aprobado', 'cliente'), false)

// Coach
assert.equal(transicionPermitida('pendiente', 'aprobado', 'coach'), true)
assert.equal(transicionPermitida('pendiente', 'devuelto', 'coach'), true)
assert.equal(transicionPermitida('borrador', 'aprobado', 'coach'), false, 'el coach no ve borradores')
assert.equal(transicionPermitida('borrador', 'devuelto', 'coach'), false)

// Vista pública: lo aprobado manda mientras se re-revisa
const base: VistaPlato = { nombre: 'Tortilla', kcal: 500, proteinas: 25, carbohidratos: 30, grasas: 28, ingredientes: [{ nombre_libre: 'Huevo', cantidad_gramos: 150 }], estimado: false }
const nuevo: VistaPlato = { ...base, kcal: 900, estimado: true }
assert.deepEqual(vistaPublica({ ...nuevo, estado: 'pendiente', aprobado_snapshot: base }), base, 'pendiente con snapshot enseña la versión aprobada')
assert.deepEqual(vistaPublica({ ...base, estado: 'aprobado', aprobado_snapshot: null }), base)
assert.equal(vistaPublica({ ...nuevo, estado: 'borrador', aprobado_snapshot: null }), null)
assert.equal(vistaPublica({ ...nuevo, estado: 'pendiente', aprobado_snapshot: null }), null, 'pendiente sin snapshot no se enseña como plato')

// Aprobar exige líneas enlazadas
assert.equal(puedeAprobar({ lineas: [] }).ok, false)
assert.equal(puedeAprobar({ lineas: [{ alimento_id: null, cantidad_gramos: 100 }] }).ok, false)
assert.equal(puedeAprobar({ lineas: [{ alimento_id: 'a', cantidad_gramos: 100 }, { alimento_id: null, cantidad_gramos: 5 }] }).ok, false)
assert.equal(puedeAprobar({ lineas: [{ alimento_id: 'a', cantidad_gramos: 100 }] }).ok, true)

assert.equal(MAX_ANALISIS_POR_DIA, 10)
assert.equal(MAX_FOTO_BYTES, 8 * 1024 * 1024)
assert.ok(TIPOS_FOTO.includes('image/jpeg'))

console.log('platos-estado OK')
