import assert from 'node:assert/strict'
import { emitPortalFeedback } from '../lib/cliente/portal-feedback'

const recibidos: Array<{ type: string; title: string }> = []
const send = (feedback: { type: string; title: string }) => recibidos.push(feedback)

assert.equal(
  emitPortalFeedback(send, { type: 'success', title: 'Entrenamiento movido' }),
  false,
  'los éxitos rutinarios no deben mostrar notificaciones',
)
assert.deepEqual(recibidos, [])

assert.equal(
  emitPortalFeedback(send, { type: 'warning', title: 'Objetivo desviado' }),
  true,
  'las advertencias deben seguir visibles',
)
assert.equal(
  emitPortalFeedback(send, { type: 'success', title: 'Check-in completado', importance: 'important' }),
  true,
  'los hitos importantes deben seguir visibles',
)
assert.equal(
  emitPortalFeedback(send, { type: 'error', title: 'No se pudo guardar' }),
  true,
  'los errores deben seguir visibles',
)
assert.deepEqual(recibidos.map(item => item.type), ['warning', 'success', 'error'])

console.log('portal-feedback: OK')
