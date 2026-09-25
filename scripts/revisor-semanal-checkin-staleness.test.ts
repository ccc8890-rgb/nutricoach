import assert from 'node:assert/strict'
import { diasDesde, DIAS_CHECKIN_DESACTUALIZADO } from '../lib/agentes/revisor-semanal'

const hoy = Date.now()
const hace = (dias: number) => new Date(hoy - dias * 24 * 60 * 60 * 1000).toISOString()

assert.equal(diasDesde(hace(0)), 0)
assert.equal(diasDesde(hace(5)), 5)
assert.equal(diasDesde(hace(122)), 122)
assert.equal(diasDesde(undefined), Infinity)

// Umbral: un check-in de hace 12 días exactos NO debe considerarse desactualizado
// (semana perdida con margen); 13 días sí.
assert.ok(diasDesde(hace(DIAS_CHECKIN_DESACTUALIZADO)) <= DIAS_CHECKIN_DESACTUALIZADO)
assert.ok(diasDesde(hace(DIAS_CHECKIN_DESACTUALIZADO + 1)) > DIAS_CHECKIN_DESACTUALIZADO)

console.log('OK — revisor-semanal-checkin-staleness')
