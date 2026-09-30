import assert from 'node:assert/strict'
import { formatearDuracionEjecucion, normalizarLimiteEjecuciones } from '../lib/agentes/ejecuciones'

assert.equal(normalizarLimiteEjecuciones(null), 10)
assert.equal(normalizarLimiteEjecuciones('5'), 5)
assert.equal(normalizarLimiteEjecuciones('0'), 1)
assert.equal(normalizarLimiteEjecuciones('500'), 50)
assert.equal(normalizarLimiteEjecuciones('texto'), 10)

assert.equal(formatearDuracionEjecucion(null), '—')
assert.equal(formatearDuracionEjecucion(850), '0,9 s')
assert.equal(formatearDuracionEjecucion(27_115), '27,1 s')
assert.equal(formatearDuracionEjecucion(75_000), '1 min 15 s')

console.log('agente-ejecuciones.test.ts OK')
