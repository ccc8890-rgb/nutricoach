import assert from 'node:assert/strict'
import {
  claveBienvenidaPlan,
  debeMostrarBienvenidaPlan,
} from '../lib/cliente/bienvenida-plan'

assert.equal(
  claveBienvenidaPlan('cliente-123'),
  'nutricoach:bienvenida-plan:cliente-123',
  'la marca debe estar aislada por cliente',
)

assert.equal(
  debeMostrarBienvenidaPlan({ clienteId: 'cliente-123', tienePlan: true, yaVista: false }),
  true,
  'el primer plan activo debe mostrar la bienvenida',
)
assert.equal(
  debeMostrarBienvenidaPlan({ clienteId: 'cliente-123', tienePlan: false, yaVista: false }),
  false,
  'no debe anunciar un plan que todavía no existe',
)
assert.equal(
  debeMostrarBienvenidaPlan({ clienteId: 'cliente-123', tienePlan: true, yaVista: true }),
  false,
  'la bienvenida cerrada no debe reaparecer',
)
assert.equal(
  debeMostrarBienvenidaPlan({ clienteId: '', tienePlan: true, yaVista: false }),
  false,
  'sin cliente identificado no debe compartir una marca global',
)

console.log('bienvenida-plan.test.ts OK')
