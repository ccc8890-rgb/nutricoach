// scripts/pasos.test.ts
import assert from 'node:assert/strict'
import { validarPasos, resumenSesion, lineaPaso, type Paso } from '../lib/entrenos/pasos'
import { ritmosDesdeVdot } from '../lib/entrenos/ritmos'

const series: Paso[] = [
  { tipo: 'calentamiento', duracion: { unidad: 'segundos', valor: 900 }, objetivo: { tipo: 'zona', zona: 'E' } },
  { tipo: 'repetir', veces: 5, pasos: [
    { tipo: 'trabajo', duracion: { unidad: 'metros', valor: 1000 }, objetivo: { tipo: 'zona', zona: 'I' } },
    { tipo: 'recuperacion', duracion: { unidad: 'metros', valor: 400 }, objetivo: { tipo: 'zona', zona: 'E' } },
  ] },
  { tipo: 'enfriamiento', duracion: { unidad: 'segundos', valor: 600 }, objetivo: { tipo: 'zona', zona: 'E' } },
]

// Validación OK
const v = validarPasos(series)
assert.equal(v.ok, true)

// Validaciones que deben rechazar
for (const malo of [
  null, 'x', [], {},
  [{ tipo: 'trabajo' }],
  [{ tipo: 'trabajo', duracion: { unidad: 'metros', valor: 0 } }],
  [{ tipo: 'trabajo', duracion: { unidad: 'metros', valor: -5 } }],
  [{ tipo: 'volar', duracion: { unidad: 'metros', valor: 100 } }],
  [{ tipo: 'repetir', veces: 0, pasos: [{ tipo: 'trabajo', duracion: { unidad: 'lap' } }] }],
  [{ tipo: 'repetir', veces: 51, pasos: [{ tipo: 'trabajo', duracion: { unidad: 'lap' } }] }],
  [{ tipo: 'repetir', veces: 3, pasos: [] }],
  [{ tipo: 'repetir', veces: 3, pasos: [{ tipo: 'repetir', veces: 2, pasos: [] }] }],
  [{ tipo: 'trabajo', duracion: { unidad: 'lap' }, objetivo: { tipo: 'zona', zona: 'Z' } }],
  [{ tipo: 'trabajo', duracion: { unidad: 'lap' }, objetivo: { tipo: 'ritmo', min_seg_km: 300, max_seg_km: 250 } }],
  Array.from({ length: 31 }, () => ({ tipo: 'trabajo', duracion: { unidad: 'lap' } })),
]) {
  assert.equal(validarPasos(malo).ok, false, JSON.stringify(malo)?.slice(0, 80))
}

// Resumen con VDOT
const ritmos = ritmosDesdeVdot(45)
const r = resumenSesion(series, ritmos)
assert.equal(r.lineas.length, 3)
assert.ok(r.lineas[1].startsWith('5 ×'), r.lineas[1])
assert.ok(r.lineas[1].includes('1000 m'), r.lineas[1])
assert.ok(r.lineas[1].includes('4:'), r.lineas[1]) // ritmo I con VDOT 45
assert.equal(r.distancia_m > 5000 + 2000, true) // 5 km trabajo + 2 km recup + calentamiento/enfriamiento
assert.ok(r.duracion_s !== null && r.duracion_s > 2400)

// Sin VDOT: sin números de ritmo, sin duración total
const sin = resumenSesion(series, null)
assert.equal(sin.duracion_s, null)
assert.ok(sin.lineas[1].includes('zona I'), sin.lineas[1])
assert.ok(!/\d:\d\d\/km/.test(sin.lineas[1]))

assert.equal(
  lineaPaso({ tipo: 'recuperacion', duracion: { unidad: 'segundos', valor: 60 } }, null),
  'Recuperación 1:00'
)

console.log('pasos.test.ts OK')
