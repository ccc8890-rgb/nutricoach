import assert from 'node:assert/strict'
import { resumirNegocio, type ClienteNegocio } from '../lib/negocio/resumen'

const ahora = new Date('2026-10-08T12:00:00Z')
const c = (x: Partial<ClienteNegocio>): ClienteNegocio => ({ activo: true, tipo_membresia: null, fecha_fin_membresia: null, ...x })

const r = resumirNegocio([
  c({ tipo_membresia: 'trimestral', plan_precio: 300, fecha_fin_membresia: '2026-12-01', pagado_via_stripe: true, fecha_inicio_plan: '2026-10-02' }),
  c({ tipo_membresia: 'anual', plan_precio: 1200, fecha_fin_membresia: '2026-09-01' }), // caducada
  c({ plan_precio: 50 }),                                                                 // sin membresía, cuenta como activo y MRR (custom = 1 mes)
  c({ activo: false, plan_precio: 999, tipo_membresia: 'anual' }),                       // inactivo: no cuenta
], ahora)

assert.equal(r.clientes_activos, 3)
assert.equal(r.mrr_estimado, 250) // 300/3 + 1200/12 + 50/1
assert.equal(r.ingresos_30d, 300)
assert.equal(r.ingresos_mes_actual, 300)
assert.equal(r.clientes_membresia_activa, 1)
assert.equal(r.clientes_sin_membresia, 1)
assert.deepEqual(resumirNegocio([], ahora).clientes_activos, 0)
console.log('negocio-resumen: ok')
