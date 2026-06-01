import assert from 'node:assert/strict'
import {
  calcularCommandCenterRow,
  ordenarCommandCenterRows,
  type CommandCenterInput,
} from '../lib/training/command-center'

const base: CommandCenterInput = {
  cliente_id: 'c1',
  plan_id: 'p1',
  nombre: 'Carlos',
  apellidos: 'Casanova',
  plan_nombre: 'Hyrox Base',
  sesiones_objetivo: 4,
  sesiones_7d: 4,
  sesiones_28d: 14,
  rpe_media_7d: 6.4,
  pr_count_7d: 0,
  ultima_fecha: '2026-06-01',
  dots: [true, false, true, false, true, false, true],
  tareas_pendientes: [],
  flags_altas: 0,
}

const fatiga = calcularCommandCenterRow({
  ...base,
  cliente_id: 'fatiga',
  rpe_media_7d: 9.1,
  sesiones_7d: 6,
})
assert.equal(fatiga.estado, 'fatiga')
assert.equal(fatiga.accion_principal, 'Revisar carga')
assert.equal(fatiga.requiere_accion, true)

const ia = calcularCommandCenterRow({
  ...base,
  cliente_id: 'ia',
  tareas_pendientes: [{ id: 't1', tipo: 'training_brain', prioridad: 2, propuesta: 'Bajar volumen' }],
})
assert.equal(ia.estado, 'revision_ia')
assert.equal(ia.accion_principal, 'Aprobar IA')

const progreso = calcularCommandCenterRow({
  ...base,
  cliente_id: 'progreso',
  pr_count_7d: 2,
  rpe_media_7d: 6.1,
})
assert.equal(progreso.estado, 'progreso')
assert.equal(progreso.accion_principal, 'Progresar')

const ordenadas = ordenarCommandCenterRows([progreso, ia, fatiga])
assert.deepEqual(ordenadas.map(r => r.cliente_id), ['fatiga', 'ia', 'progreso'])

console.log('training command center tests passed')
