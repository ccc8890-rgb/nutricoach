import assert from 'node:assert/strict'
import { validarCuerpoPlanificar } from '../lib/entrenos/planificar-con-ia'

assert.deepEqual(validarCuerpoPlanificar({ cliente_id: '04cc53b3-1111-2222-3333-444455556666' }), { ok: true, clienteId: '04cc53b3-1111-2222-3333-444455556666' })
for (const malo of [null, 'x', {}, { cliente_id: 5 }, { cliente_id: '' }, { cliente_id: 'no-es-uuid' }, { cliente_id: "'; drop table clientes;--" }]) {
  assert.equal(validarCuerpoPlanificar(malo).ok, false, JSON.stringify(malo))
}
console.log('planificar-ia-ruta.test OK')
