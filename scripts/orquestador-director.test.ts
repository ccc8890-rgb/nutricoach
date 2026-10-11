import assert from 'node:assert/strict'
import { crearPlanDirectorCliente, resolverEstadoEjecucion, resolverPasosDirector } from '../lib/agentes/orquestador'

const base = {
  clienteId: 'cliente-1',
  tienePlanNutricion: true,
  tienePlanEntreno: true,
  diasSinCheckin: 2,
  diasSinSesion: 1,
  sesiones7d: 3,
  pendientes: [],
}

const diarioActivo = crearPlanDirectorCliente(base, 'diario')
assert.equal(diarioActivo.ejecutar.perfil_aprendizaje, true)
assert.equal(diarioActivo.ejecutar.perfil_gusto, true)
// Agentes de entreno antiguos apagados (11-10-2026): ver orquestador.ts
assert.equal(diarioActivo.ejecutar.readiness, false)
assert.equal(diarioActivo.ejecutar.supercoach, false)
assert.equal(diarioActivo.ejecutar.riesgo_nutricion, false)
assert.equal(diarioActivo.ejecutar.riesgo_entreno, false)
assert.equal(diarioActivo.ejecutar.revisor_semanal, false)

const riesgo = crearPlanDirectorCliente({
  ...base,
  diasSinCheckin: 10,
  diasSinSesion: 12,
  sesiones7d: 0,
}, 'diario')
assert.equal(riesgo.ejecutar.riesgo_nutricion, true)
assert.equal(riesgo.ejecutar.riesgo_entreno, false)
assert.ok(riesgo.motivos.some(m => m.startsWith('riesgo_nutricion')))
assert.ok(!riesgo.motivos.some(m => m.startsWith('riesgo_entreno')))

const semanal = crearPlanDirectorCliente(base, 'semanal')
assert.equal(semanal.ejecutar.revisor_semanal, true)
assert.equal(semanal.ejecutar.revisor_semanal_entreno, false)
assert.equal(semanal.ejecutar.motivacion, true)

const inboxSaturado = crearPlanDirectorCliente({
  ...base,
  diasSinCheckin: 12,
  diasSinSesion: 12,
  pendientes: Array.from({ length: 12 }, (_, i) => ({ tipo: `tipo_${i}`, agente: 'supercoach' })),
}, 'diario')
assert.equal(inboxSaturado.presionInbox, 'alta')
assert.equal(inboxSaturado.ejecutar.riesgo_nutricion, false)
assert.equal(inboxSaturado.ejecutar.riesgo_entreno, false)

const duplicados = crearPlanDirectorCliente({
  ...base,
  diasSinCheckin: 12,
  diasSinSesion: 12,
  pendientes: [
    { tipo: 'alerta_riesgo', agente: 'riesgo' },
    { tipo: 'alerta_riesgo_entreno', agente: 'riesgo' },
    { tipo: 'actualizacion_plan', agente: 'supercoach' },
  ],
}, 'diario')
assert.equal(duplicados.ejecutar.riesgo_nutricion, false)
assert.equal(duplicados.ejecutar.riesgo_entreno, false)
assert.equal(duplicados.ejecutar.supercoach, false)

const pasosSemanales = resolverPasosDirector(semanal, false)
assert.deepEqual(pasosSemanales, [
  'perfil_aprendizaje',
  'perfil_gusto',
  'retencion',
  'revisor_semanal',
  'motivacion',
])

const pasosDryRun = resolverPasosDirector(semanal, true)
assert.deepEqual(pasosDryRun, [])

assert.equal(resolverEstadoEjecucion([]), 'completado')
assert.equal(resolverEstadoEjecucion(['cliente C1: timeout']), 'completado_con_errores')

console.log('orquestador-director.test.ts OK')
