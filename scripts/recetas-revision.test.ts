import assert from 'node:assert/strict'
import {
  esRecetaAprobable,
  inicioFinDiaMadridUtc,
  normalizarTareaRevision,
  type QualityIssues,
} from '../lib/recetas/revision'

assert.equal(normalizarTareaRevision(null), 'pendientes')
assert.equal(normalizarTareaRevision('sin_foto'), 'sin_foto')
assert.equal(normalizarTareaRevision('desconocida'), 'pendientes')

const vacio: QualityIssues = { bloqueantes: [], avisos: [] }
assert.equal(esRecetaAprobable('en_revision', vacio), true)
assert.equal(esRecetaAprobable('borrador', { bloqueantes: ['Faltan ingredientes'], avisos: [] }), false)
assert.equal(esRecetaAprobable('aprobada', vacio), false)
assert.equal(esRecetaAprobable('descartada', vacio), false)

const verano = inicioFinDiaMadridUtc(new Date('2026-10-06T10:00:00.000Z'))
assert.deepEqual(verano, {
  inicio: '2026-10-05T22:00:00.000Z',
  fin: '2026-10-06T22:00:00.000Z',
})

const invierno = inicioFinDiaMadridUtc(new Date('2026-12-06T10:00:00.000Z'))
assert.deepEqual(invierno, {
  inicio: '2026-12-05T23:00:00.000Z',
  fin: '2026-12-06T23:00:00.000Z',
})

console.log('recetas-revision: OK')
