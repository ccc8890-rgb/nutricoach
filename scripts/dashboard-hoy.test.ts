import assert from 'node:assert/strict'
import { resumirHoy } from '../lib/dashboard/hoy'
import type { CommandData } from '../lib/dashboard/tipos'

const base: CommandData = {
  hoy: [],
  clientes_riesgo: [],
  inbox_ia: [],
  operacion: {
    clientes_activos: 4, planes_nutricion_activos: 4, planes_entreno_activos: 4,
    checkins_pendientes: 0, revisiones_7d: 0, revisiones_30d: 0, membresias_30d: 0, respuestas_pendientes: 0,
  },
  competiciones: [],
  timestamp: '2026-10-08T00:00:00Z',
}

// Todo vacío → todo al día, tonos ok
const vacio = resumirHoy(base)
assert.equal(vacio.todoAlDia, true)
assert.deepEqual(vacio.tarjetas.map(t => [t.id, t.total, t.tono]), [['checkins', 0, 'ok'], ['riesgo', 0, 'ok'], ['ia', 0, 'ok'], ['altas', 0, 'ok']])

// Check-ins: total = checkins + respuestas; casos solo de tipo checkin/respuesta, máximo 3; crítico si algún caso lo es
const accion = (id: string, tipo: string, severity: 'critica' | 'alta' | 'media' | 'baja') => ({
  id, tipo, title: `t-${id}`, cliente_id: 'c', cliente_nombre: `N-${id}`, detail: 'd', meta: 'm', severity, href: `/h/${id}`, cta: 'Abrir',
})
const conCheckins = resumirHoy({
  ...base,
  operacion: { ...base.operacion, checkins_pendientes: 5, respuestas_pendientes: 2 },
  hoy: [accion('1', 'checkin', 'media'), accion('2', 'plan', 'critica'), accion('3', 'respuesta', 'critica'), accion('4', 'checkin', 'baja'), accion('5', 'checkin', 'baja')],
})
const tc = conCheckins.tarjetas.find(t => t.id === 'checkins')!
assert.equal(tc.total, 7)
assert.equal(tc.casos.length, 3)
assert.deepEqual(tc.casos.map(c => c.id), ['1', '3', '4'])
assert.equal(tc.tono, 'critico')
assert.equal(conCheckins.todoAlDia, false)

// Check-ins sin casos críticos → pendiente
const soloPend = resumirHoy({ ...base, operacion: { ...base.operacion, checkins_pendientes: 1 }, hoy: [accion('9', 'checkin', 'media')] })
assert.equal(soloPend.tarjetas[0].tono, 'pendiente')

// Riesgo: crítico si hay alguno 'alto', pendiente si solo medio; máximo 3 casos con la acción como detalle
const riesgo = (n: string, r: 'alto' | 'medio' | 'bajo') => ({ cliente_id: n, cliente_nombre: n, riesgo: r, score: 1, signals: [], accion: `acc-${n}`, href: `/clientes/${n}` })
const rAlto = resumirHoy({ ...base, clientes_riesgo: [riesgo('a', 'medio'), riesgo('b', 'alto'), riesgo('c', 'bajo'), riesgo('d', 'bajo')] })
const tr = rAlto.tarjetas.find(t => t.id === 'riesgo')!
assert.equal(tr.total, 4)
assert.equal(tr.tono, 'critico')
assert.equal(tr.casos.length, 3)
assert.equal(tr.casos[0].detalle, 'acc-a')
assert.equal(tr.casos[0].href, '/clientes/a')
assert.equal(resumirHoy({ ...base, clientes_riesgo: [riesgo('a', 'medio')] }).tarjetas[1].tono, 'pendiente')

// IA: detalle = tipo con espacios; href de la tarea
const ia = resumirHoy({
  ...base,
  inbox_ia: [{ id: 'x', tipo: 'actualizacion_plan', agente: 'a', prioridad: 1, propuesta: null, cliente_id: 'c', cliente_nombre: 'Ana', href: '/clientes', created_at: '' }],
})
const ti = ia.tarjetas.find(t => t.id === 'ia')!
assert.equal(ti.total, 1)
assert.equal(ti.tono, 'pendiente')
assert.deepEqual(ti.casos[0], { id: 'x', titulo: 'Ana', detalle: 'actualizacion plan', href: '/clientes' })
assert.equal(ti.href, '/entrenos/brain-ia')

// Planes y altas: acciones plan/onboarding/competicion; total = nº de acciones, máx 3 casos, crítico si alguna lo es
const altas = resumirHoy({
  ...base,
  hoy: [accion('p', 'plan', 'media'), accion('o', 'onboarding', 'alta'), accion('c', 'competicion', 'critica'), accion('k', 'checkin', 'critica'), accion('p2', 'plan', 'baja')],
})
const ta = altas.tarjetas.find(t => t.id === 'altas')!
assert.equal(ta.total, 4)
assert.deepEqual(ta.casos.map(c => c.id), ['p', 'o', 'c'])
assert.equal(ta.tono, 'critico')
assert.equal(altas.todoAlDia, false)
// Con solo una acción de plan ya no es 'todo al día'
assert.equal(resumirHoy({ ...base, hoy: [accion('p', 'plan', 'media')] }).todoAlDia, false)

console.log('dashboard-hoy: OK')
