// scripts/running-plantillas.test.ts
import assert from 'node:assert/strict'
import { PASOS_RUNNING } from '../lib/entrenos/running-plantillas'
import { validarPasos, resumenSesion } from '../lib/entrenos/pasos'
import { ritmosDesdeVdot } from '../lib/entrenos/ritmos'

const nombres = [
  'Long Run — E-pace',
  'Umbral — Tempo + Strides',
  'VO2max — Intervalos I-pace',
  'Easy + Strides — Recuperación activa',
]
assert.deepEqual(Object.keys(PASOS_RUNNING).sort(), [...nombres].sort())
for (const n of nombres) assert.equal(validarPasos(PASOS_RUNNING[n]).ok, true, n)

const ritmos = ritmosDesdeVdot(45)
const vo2 = resumenSesion(PASOS_RUNNING['VO2max — Intervalos I-pace'], ritmos)
// 15' E + 5×(1000+400) + 4×(100+60") + 10' E → bastante más de 7 km
assert.ok(vo2.distancia_m > 9000 && vo2.distancia_m < 14000, String(vo2.distancia_m))
const largo = resumenSesion(PASOS_RUNNING['Long Run — E-pace'], ritmos)
assert.equal(largo.duracion_s, 4500)

console.log('running-plantillas.test.ts OK')
