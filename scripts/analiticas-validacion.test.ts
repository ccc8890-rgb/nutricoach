import assert from 'node:assert/strict'
import { fusionarValoresAnalitica, validarEdicionAnalitica } from '../lib/analiticas-validacion'

assert.deepEqual(validarEdicionAnalitica({ valores: { vitamina_d: 29.5, ferritina: null }, notas: 'Control en tres meses' }), {
  ok: true,
  valores: { vitamina_d: 29.5, ferritina: null },
  notas: 'Control en tres meses',
})
assert.equal(validarEdicionAnalitica({ valores: { inventado: 10 } }).ok, false)
assert.equal(validarEdicionAnalitica({ valores: { vitamina_d: 0 } }).ok, false)
assert.equal(validarEdicionAnalitica({ valores: { vitamina_d: Number.POSITIVE_INFINITY } }).ok, false)
assert.equal(validarEdicionAnalitica({ valores: { vitamina_d: 100000 } }).ok, false)
assert.equal(validarEdicionAnalitica({ valores: {}, notas: 'x'.repeat(1001) }).ok, false)
assert.deepEqual(
  fusionarValoresAnalitica({ vitamina_d: '25,5', ferritina: 42, legado: 7 }, { vitamina_d: 31, ferritina: null }),
  { vitamina_d: 31, legado: 7 },
)

console.log('analiticas-validacion: OK')
