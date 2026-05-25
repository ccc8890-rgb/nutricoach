import assert from 'node:assert/strict'
import { evaluarCheckin, normalizarAdherenciaPct } from '../lib/periodizacion/arbol-decision'

assert.equal(normalizarAdherenciaPct(8), 80)
assert.equal(normalizarAdherenciaPct(10), 100)
assert.equal(normalizarAdherenciaPct(80), 80)
assert.equal(normalizarAdherenciaPct(null), 80)

const resultado = evaluarCheckin({
  energia: 4,
  horas_sueno: 7,
  adherencia: normalizarAdherenciaPct(8),
  tls_semanal: 40,
  semanas_en_deficit: 1,
  umbral_carga_alta: 80,
})

assert.notEqual(resultado.accion, 'alerta_coach_solo')

console.log('periodizacion-adherencia.test.ts OK')
