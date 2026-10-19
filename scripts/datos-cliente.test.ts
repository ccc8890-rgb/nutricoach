// scripts/datos-cliente.test.ts
import assert from 'node:assert/strict'
import { construirDatosCliente, type FilaReloj } from '../lib/rendimiento/datos-cliente'
import { construirPanel } from '../lib/rendimiento/panel'

const hoy = '2026-10-11'
const dia = (n: number) => new Date(Date.parse(`${hoy}T12:00:00Z`) - n * 86_400_000).toISOString().slice(0, 10)
const fila = (n: number, extra: Partial<FilaReloj> = {}): FilaReloj => ({
  fecha: dia(n), rhr: 50 + (n % 3), hrv: 51, training_readiness: 60, body_battery_max: 80, stress_avg: 30, sueno_h: null, sueno_calidad: null,
  raw_data: { training_readiness_level: 'MODERATE', training_readiness_feedback: 'WELL_RECOVERED' }, ...extra,
})
const panel = construirPanel([], [], hoy, 90)

// Sin reloj: nada inventado
const vacio = construirDatosCliente(panel, [], hoy)
assert.equal(vacio.tieneReloj, false)
assert.equal(vacio.recuperacion, null)
assert.equal(vacio.sueno, null)
assert.equal(vacio.tendencias.preparacion, null)

// 20 días de reloj: recuperación, motivo traducido y rango habitual
const filas = Array.from({ length: 20 }, (_, i) => fila(19 - i))
const d = construirDatosCliente(panel, filas, hoy)
assert.equal(d.tieneReloj, true)
assert.equal(d.recuperacion?.puntuacion, 60)
assert.equal(d.recuperacion?.nivel, 'moderada')
assert.equal(d.recuperacion?.motivo, 'Estás bien recuperado.')
assert.ok(d.tendencias.pulsoReposo!.normal)
assert.equal(d.tendencias.pulsoReposo!.posicion, 'dentro')

// Código de Garmin desconocido: sin frase inventada
const raro = construirDatosCliente(panel, [fila(0, { raw_data: { training_readiness_level: 'HIGH', training_readiness_feedback: 'CODIGO_NUEVO' } })], hoy)
assert.equal(raro.recuperacion?.motivo, null)
assert.equal(raro.recuperacion?.nivel, 'alta')

// Con menos de 14 días no hay rango habitual
assert.equal(construirDatosCliente(panel, filas.slice(-5), hoy).tendencias.pulsoReposo!.normal, null)

// Sueño: solo con 3+ noches en los últimos 14 días (2 noches no bastan)
const dos = filas.map((f, i) => (i >= 18 ? { ...f, sueno_h: 7 } : f))
assert.equal(construirDatosCliente(panel, dos, hoy).sueno, null)
const cuatro = filas.map((f, i) => (i >= 16 ? { ...f, sueno_h: 7.5 } : f))
assert.equal(construirDatosCliente(panel, cuatro, hoy).sueno?.mediaHoras, 7.5)

// Semana: siempre 7 días de lunes a domingo; sin entrenos, todo a cero
assert.equal(d.semanaDias.length, 7)
assert.equal(d.semanaDias[0].fecha, '2026-10-05') // lunes de la semana del 11-10 (domingo)
assert.equal(d.semanaDias[6].fecha, hoy)
assert.ok(d.semanaDias.every(x => x.minutos === 0 && x.sesiones === 0))

// Batería y estrés: series de días con dato; sin forma ni intensidad sin entrenos
assert.equal(d.bienestar.bateria.length, 20)
assert.equal(d.forma, null)
assert.equal(d.intensidad, null)
assert.equal(d.vo2max, null)
assert.deepEqual(d.ultimosEntrenos, [])

console.log('datos-cliente.test.ts OK')
