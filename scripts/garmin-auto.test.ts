import assert from 'node:assert/strict'
import { huellaPasos, decidirEnvio } from '../lib/entrenos/garmin-auto'
import type { Paso } from '../lib/entrenos/pasos'

const pasos: Paso[] = [
  { tipo: 'trabajo', duracion: { unidad: 'segundos', valor: 1200 }, objetivo: { tipo: 'zona', zona: 'T' } },
]

// Huella estable y sensible a cambios de pasos y de VDOT
const h = huellaPasos(pasos, 45)
assert.equal(h, huellaPasos(JSON.parse(JSON.stringify(pasos)), 45))
assert.notEqual(h, huellaPasos(pasos, 50))
assert.notEqual(h, huellaPasos(pasos, null))
assert.notEqual(h, huellaPasos([{ ...pasos[0], duracion: { unidad: 'segundos', valor: 1300 } } as Paso], 45))

// 09-10-2026 es viernes
const viernes = new Date(2026, 9, 9, 6, 0, 0)
const base = { dia_semana: 'Viernes', garmin_workout_id: null, garmin_programado_fecha: null, garmin_pasos_hash: null }

// Nunca enviada → enviar para hoy
assert.deepEqual(decidirEnvio(base, h, viernes), { enviar: true, fecha: '2026-10-09' })

// Ya enviada para esa fecha con la misma huella → saltar
const enviada = { ...base, garmin_workout_id: '123', garmin_programado_fecha: '2026-10-09', garmin_pasos_hash: h }
assert.deepEqual(decidirEnvio(enviada, h, viernes), { enviar: false, fecha: '2026-10-09' })

// Mismo viernes, pero los pasos cambiaron → reenviar
assert.deepEqual(decidirEnvio({ ...enviada, garmin_pasos_hash: 'otra' }, h, viernes), { enviar: true, fecha: '2026-10-09' })

// Al día siguiente (sábado) ya toca el viernes de la semana que viene
const sabado = new Date(2026, 9, 10, 6, 0, 0)
assert.deepEqual(decidirEnvio(enviada, h, sabado), { enviar: true, fecha: '2026-10-16' })

// Programada y sin huella (enviada a mano antes de existir la huella) → reenviar una vez
assert.equal(decidirEnvio({ ...enviada, garmin_pasos_hash: null }, h, viernes).enviar, true)

// Día de la semana no reconocido → no enviar
assert.deepEqual(decidirEnvio({ ...base, dia_semana: 'Funsday' }, h, viernes), { enviar: false, fecha: null })
assert.deepEqual(decidirEnvio({ ...base, dia_semana: null }, h, viernes), { enviar: false, fecha: null })

// Creada en Garmin pero sin fecha (falló la programación) → reintentar
assert.equal(decidirEnvio({ ...base, garmin_workout_id: '9' }, h, viernes).enviar, true)

console.log('garmin-auto.test.ts OK')
