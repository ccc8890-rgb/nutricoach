import { createHash } from 'node:crypto'
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

// --- Programación multi-fecha (horizonte de 3 semanas) ---
import { finHorizonteEnvio, planearEnvioGarmin } from '../lib/entrenos/garmin-auto'
import assert2 from 'node:assert/strict'
assert2.equal(finHorizonteEnvio('2026-10-11'), '2026-10-25') // domingo 11 → domingo de dentro de dos semanas
assert2.equal(finHorizonteEnvio('2026-10-12'), '2026-11-01')
const vacio = { garmin_workout_id: null, garmin_programado_fecha: null, garmin_fechas: [], garmin_pasos_hash: null }
const ok = { garmin_workout_id: 'w1', garmin_programado_fecha: '2026-10-13', garmin_fechas: ['2026-10-13', '2026-10-20'], garmin_pasos_hash: 'h' }
assert2.deepEqual(planearEnvioGarmin(vacio, 'h', ['2026-10-20', '2026-10-13'], '2026-10-11'), { accion: 'recrear', fechas: ['2026-10-13', '2026-10-20'] })
assert2.deepEqual(planearEnvioGarmin(ok, 'h', ['2026-10-13', '2026-10-20'], '2026-10-11'), { accion: 'nada' })
assert2.deepEqual(planearEnvioGarmin(ok, 'h', ['2026-10-13', '2026-10-20', '2026-10-27'], '2026-10-11'), { accion: 'anadir', fechas: ['2026-10-27'] })
assert2.deepEqual(planearEnvioGarmin(ok, 'otra', ['2026-10-13', '2026-10-20'], '2026-10-11'), { accion: 'recrear', fechas: ['2026-10-13', '2026-10-20'] })
// una fecha programada que ya no toca (la movieron) obliga a recrear
assert2.deepEqual(planearEnvioGarmin(ok, 'h', ['2026-10-14', '2026-10-20'], '2026-10-11'), { accion: 'recrear', fechas: ['2026-10-14', '2026-10-20'] })
// las fechas pasadas no cuentan; si ya no toca ninguna se borra
assert2.deepEqual(planearEnvioGarmin(ok, 'h', ['2026-10-20'], '2026-10-14'), { accion: 'nada' })
assert2.deepEqual(planearEnvioGarmin(ok, 'h', [], '2026-10-11'), { accion: 'borrar' })
assert2.deepEqual(planearEnvioGarmin(vacio, 'h', [], '2026-10-11'), { accion: 'nada' })
console.log('garmin-auto multi OK')

assert.notEqual(h, huellaPasos(pasos, 45, null, null, 'cinta'))
assert.equal(h, huellaPasos(pasos, 45, null, null, 'pista'))
assert.equal(h, huellaPasos(pasos, 45, null, null, null))

// La huella cambia solo en sesiones con recuperaciones (reenvío tras quitar el techo de pulso)
const conRec = [{ tipo: 'recuperacion', duracion: { unidad: 'segundos', valor: 60 } }] as Paso[]
assert.notEqual(huellaPasos(conRec, 45), createHash('sha256').update(JSON.stringify({ pasos: conRec, vdot: 45 })).digest('hex').slice(0, 16))
