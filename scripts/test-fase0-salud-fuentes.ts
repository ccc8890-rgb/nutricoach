import assert from 'node:assert/strict'
import { calcularFlagsActividad, type ActividadResumen } from '../lib/actividad/coach-insights'
import { evaluarSaludFuente, sanitizarErrorIntegracion } from '../lib/integraciones/salud-fuente'

const AHORA = new Date('2026-09-30T12:00:00Z')

function evaluar(
  input: Partial<Parameters<typeof evaluarSaludFuente>[0]> & Pick<Parameters<typeof evaluarSaludFuente>[0], 'activa'>
) {
  return evaluarSaludFuente({
    ultima_sync: null,
    error_ultimo: null,
    ultima_fecha_datos: null,
    ahora: AHORA,
    ...input,
  })
}

const desconectada = evaluar({ activa: false })
assert.equal(desconectada.estado, 'desconectada')
assert.equal(desconectada.ultimaRecepcion, null)
assert.equal(desconectada.antiguedadHoras, null)
assert.equal(desconectada.puedeInterpretarAusencia, false)
assert.ok(desconectada.accion)

assert.equal(evaluar({ activa: true }).estado, 'sin_datos')
assert.equal(evaluar({ activa: true }).puedeInterpretarAusencia, false)

const saludable48h = evaluar({ activa: true, ultima_sync: '2026-09-28T12:00:00Z' })
assert.equal(saludable48h.estado, 'saludable')
assert.equal(saludable48h.antiguedadHoras, 48)
assert.equal(saludable48h.puedeInterpretarAusencia, true)

const retrasadaTras48h = evaluar({ activa: true, ultima_sync: '2026-09-28T11:59:59Z' })
assert.equal(retrasadaTras48h.estado, 'retrasada')

const retrasada = evaluar({
  activa: true,
  ultima_sync: '2026-09-27T12:00:00Z',
  ultima_fecha_datos: '2026-09-29T11:00:00Z',
})
assert.equal(retrasada.estado, 'saludable', 'debe usar la recepción más reciente entre sync y datos')
assert.equal(retrasada.ultimaRecepcion, '2026-09-29T11:00:00.000Z')

const retrasada168h = evaluar({ activa: true, ultima_fecha_datos: '2026-09-23T12:00:00Z' })
assert.equal(retrasada168h.estado, 'retrasada')
assert.equal(retrasada168h.antiguedadHoras, 168)
assert.equal(retrasada168h.puedeInterpretarAusencia, true)

const desactualizada = evaluar({ activa: true, ultima_fecha_datos: '2026-09-23T11:59:59Z' })
assert.equal(desactualizada.estado, 'desactualizada')
assert.equal(desactualizada.puedeInterpretarAusencia, false)

const conError = evaluar({
  activa: true,
  ultima_sync: '2026-09-30T11:30:00Z',
  error_ultimo: 'invalid_grant token=secreto',
})
assert.equal(conError.estado, 'error', 'el error debe prevalecer aunque la recepción sea reciente')
assert.equal(conError.puedeInterpretarAusencia, false)
assert.equal(conError.mensaje.includes('secreto'), false, 'el estado no debe filtrar el error técnico')

const errorJsonSanitizado = sanitizarErrorIntegracion('{"access_token":"abc123","refresh_token":"xyz789"}')
assert.equal(errorJsonSanitizado?.includes('abc123'), false)
assert.equal(errorJsonSanitizado?.includes('xyz789'), false)

const resumenBajo: ActividadResumen = {
  dias: 14,
  tiene_datos: true,
  sesiones: 0,
  pasos_media: 1200,
  calorias_activas_total: 0,
  tdee_media: null,
  tss_total: 0,
  minutos_alta_intensidad_total: 0,
  hrv_media: null,
  rhr_media: null,
  fc_media_entreno: null,
  body_battery_media: null,
  stress_media: null,
  readiness_media: null,
  distancia_entreno_km_total: 0,
  proveedores: ['garmin_connect'],
}

const estadosNoInterpretables = ['error', 'sin_datos', 'desactualizada'] as const
for (const estado of estadosNoInterpretables) {
  const salud = evaluar({
    activa: true,
    ultima_fecha_datos: estado === 'desactualizada' ? '2026-09-20T12:00:00Z' : null,
    error_ultimo: estado === 'error' ? 'timeout' : null,
  })
  assert.equal(salud.estado, estado)
  const flags = calcularFlagsActividad({
    resumen: resumenBajo,
    integraciones: [{ proveedor: 'garmin_connect', activa: true, salud }],
  })
  assert.equal(
    flags.some(flag => flag.tipo === 'actividad_baja'),
    false,
    `actividad_baja no es válida cuando la única fuente está ${estado}`
  )
}

console.log('fase0 source health tests passed')
