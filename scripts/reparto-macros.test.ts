import assert from 'node:assert/strict'
import { repartoKcal } from '../lib/nutricion/reparto-macros'

// 42 P · 48 C · 16 G → 168 / 192 / 144 kcal de 504: carbos predominante
let r = repartoKcal(42, 48, 16)
assert.deepEqual(r.pct, [33, 38, 29])
assert.equal(r.dom, 1)
assert.ok(Math.abs(r.f[0] + r.f[1] + r.f[2] - 1) < 1e-9)

// Proteína pura y grasa pura caen en su vértice
assert.equal(repartoKcal(30, 0, 0).dom, 0)
assert.deepEqual(repartoKcal(0, 0, 10).f, [0, 0, 1])

// La grasa pesa 9 kcal/g: 10 g de grasa (90 kcal) superan a 20 g de proteína (80 kcal)
assert.equal(repartoKcal(20, 0, 10).dom, 2)

// Sin macros o con valores negativos: nada se rompe
assert.deepEqual(repartoKcal(0, 0, 0).f, [0, 0, 0])
assert.deepEqual(repartoKcal(-5, 10, 0).f, [0, 1, 0])

// Barrido: siempre suma 1 y el predominante tiene la mayor fracción
for (let i = 0; i < 500; i++) {
  const p = Math.random() * 80, c = Math.random() * 150, g = Math.random() * 60
  const x = repartoKcal(p, c, g)
  assert.ok(Math.abs(x.f[0] + x.f[1] + x.f[2] - 1) < 1e-9)
  assert.equal(x.f[x.dom], Math.max(...x.f))
}
console.log('reparto-macros: OK')
