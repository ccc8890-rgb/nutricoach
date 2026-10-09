// scripts/ritmos.test.ts
import assert from 'node:assert/strict'
import { ritmosDesdeVdot, formatearRitmo } from '../lib/entrenos/ritmos'

const r = ritmosDesdeVdot(45)!
assert.ok(r)
// Rangos de control Daniels para VDOT 45 (seg/km)
assert.ok(r.E >= 340 && r.E <= 370, `E ${r.E}`)
assert.ok(r.M >= 280 && r.M <= 300, `M ${r.M}`)
assert.ok(r.T >= 270 && r.T <= 285, `T ${r.T}`)
assert.ok(r.I >= 245 && r.I <= 265, `I ${r.I}`)
assert.ok(r.R >= 222 && r.R <= 242, `R ${r.R}`)
// Orden: E más lento que R
assert.ok(r.E > r.M && r.M > r.T && r.T > r.I && r.I > r.R)
// Mejor VDOT = ritmos más rápidos
assert.ok(ritmosDesdeVdot(55)!.T < r.T)
// Entradas inválidas
assert.equal(ritmosDesdeVdot(0), null)
assert.equal(ritmosDesdeVdot(NaN), null)
assert.equal(ritmosDesdeVdot(120), null)
assert.equal(formatearRitmo(255), '4:15')
assert.equal(formatearRitmo(304.6), '5:05')
assert.equal(formatearRitmo(299.6), '5:00')

console.log('ritmos.test.ts OK')
