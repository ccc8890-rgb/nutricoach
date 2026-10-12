import assert from 'node:assert/strict'
import { evaluarSistema, type EjecucionAgente } from '../lib/sistema/estado'

const AHORA = Date.parse('2026-10-12T12:00:00Z')
const h = (n: number) => new Date(AHORA - n * 3_600_000).toISOString()
const ej = (modo: 'diario' | 'semanal', horas: number, estado: EjecucionAgente['estado'] = 'completado', extra: Partial<EjecucionAgente> = {}): EjecucionAgente =>
  ({ modo, origen: 'cron', dry_run: false, estado, errores: [], iniciado_at: h(horas), ...extra })

const cr = (cron: string, horas: number, estado: 'ok' | 'error' = 'ok') => ({ cron, estado, detalle: null, ejecutado_at: h(horas) })
const todos = [cr('enviar-garmin', 5), cr('avisos-rendimiento', 5), cr('proponer-bloques', 5), cr('recordatorio-checkin', 100), cr('analisis-rendimiento', 100)]

// Todo bien
let r = evaluarSistema({ ejecuciones: [ej('diario', 5), ej('semanal', 50)], integraciones: [{ proveedor: 'garmin_connect', ultima_sync: h(6), error_ultimo: null }], crons: todos }, AHORA)
assert.equal(r.nivel, 'ok'); assert.equal(r.resumen, 'Todo en marcha.')

// Diario sin correr 40 h → error
r = evaluarSistema({ ejecuciones: [ej('diario', 40), ej('semanal', 50)], integraciones: [] }, AHORA)
assert.equal(r.nivel, 'error'); assert.equal(r.comprobaciones[0].nivel, 'error')

// Una simulación (dry_run) no cuenta como ejecución real
r = evaluarSistema({ ejecuciones: [ej('diario', 1, 'completado', { dry_run: true }), ej('semanal', 50)], integraciones: [] }, AHORA)
assert.equal(r.comprobaciones[0].nivel, 'aviso')

// Con errores parciales → aviso; fallida → error
r = evaluarSistema({ ejecuciones: [ej('diario', 3, 'completado_con_errores', { errores: ['x'] }), ej('semanal', 50)], integraciones: [] }, AHORA)
assert.equal(r.nivel, 'aviso')
r = evaluarSistema({ ejecuciones: [ej('diario', 3, 'fallido'), ej('semanal', 50)], integraciones: [] }, AHORA)
assert.equal(r.nivel, 'error')

// Relojes: sin sincronizar 40 h → error; con error de conexión → aviso
r = evaluarSistema({ ejecuciones: [ej('diario', 3), ej('semanal', 50)], integraciones: [{ proveedor: 'strava', ultima_sync: h(40), error_ultimo: null }] }, AHORA)
assert.equal(r.comprobaciones[2].nivel, 'error')
r = evaluarSistema({ ejecuciones: [ej('diario', 3), ej('semanal', 50)], integraciones: [{ proveedor: 'strava', ultima_sync: h(2), error_ultimo: 'token' }] }, AHORA)
assert.equal(r.comprobaciones[2].nivel, 'aviso')

// Semanal: a los 8 días aún vale, a los 10 no
r = evaluarSistema({ ejecuciones: [ej('diario', 3), ej('semanal', 8 * 24)], integraciones: [] }, AHORA)
assert.equal(r.comprobaciones[1].nivel, 'ok')
r = evaluarSistema({ ejecuciones: [ej('diario', 3), ej('semanal', 10 * 24)], integraciones: [] }, AHORA)
assert.equal(r.comprobaciones[1].nivel, 'error')

console.log('sistema-estado: OK')

// ── Crons registrados ──
const base = { ejecuciones: [ej('diario', 3), ej('semanal', 50)], integraciones: [] }
let c = evaluarSistema({ ...base, crons: todos }, AHORA)
assert.equal(c.nivel, 'ok')
// sin registros → aviso (no error)
c = evaluarSistema({ ...base, crons: [] }, AHORA)
assert.equal(c.nivel, 'aviso')
// un cron diario parado 40 h → error
c = evaluarSistema({ ...base, crons: [cr('enviar-garmin', 40), ...todos.slice(1)] }, AHORA)
assert.equal(c.nivel, 'error'); assert.match(c.resumen, /reloj/)
// último con errores → aviso
c = evaluarSistema({ ...base, crons: [cr('proponer-bloques', 2, 'error'), cr('enviar-garmin', 5), cr('avisos-rendimiento', 5), cr('recordatorio-checkin', 100), cr('analisis-rendimiento', 100)] }, AHORA)
assert.equal(c.nivel, 'aviso')
console.log('sistema-estado crons: OK')
