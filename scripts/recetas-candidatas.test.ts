import assert from 'node:assert/strict'
import { seleccionarCandidatas } from '../lib/recetas/candidatas'

const r = (id: string, estado: string | null, score: number | null, bloqueantes?: unknown[]) =>
  ({ id, nombre: `R-${id}`, estado, score_calidad: score, quality_issues: bloqueantes === undefined ? null : { bloqueantes, avisos: [] } })

// Solo aprobadas, y con bloqueante entra
assert.deepEqual(seleccionarCandidatas([r('a', 'aprobada', 90, ['sin_macros'])]).map(c => c.id), ['a'])
assert.deepEqual(seleccionarCandidatas([r('b', 'en_revision', 10, ['sin_macros'])]), [])
// quality_issues nulo con score alto: no entra y no rompe; con score bajo sí
assert.deepEqual(seleccionarCandidatas([r('c', 'aprobada', 90)]), [])
assert.deepEqual(seleccionarCandidatas([r('d', 'aprobada', 50)]).map(c => c.id), ['d'])
// score nulo y sin bloqueantes: no entra
assert.deepEqual(seleccionarCandidatas([r('e', 'aprobada', null, [])]), [])
// motivos = códigos de bloqueantes
assert.deepEqual(seleccionarCandidatas([r('f', 'aprobada', 80, ['sin_macros', 'cantidad_absurda'])])[0].motivos, ['sin_macros', 'cantidad_absurda'])
// límite y orden: más bloqueantes primero, luego score menor
const lote = Array.from({ length: 100 }, (_, i) => r(`x${i}`, 'aprobada', 60, i === 7 ? ['a', 'b', 'c'] : i === 3 ? ['a'] : []))
const sel = seleccionarCandidatas(lote, 60)
assert.equal(sel.length, 60)
assert.equal(sel[0].id, 'x7')
assert.equal(sel[1].id, 'x3')
console.log('recetas-candidatas OK')
