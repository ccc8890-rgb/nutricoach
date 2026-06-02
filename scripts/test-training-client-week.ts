import assert from 'node:assert/strict'
import { aplicarSesionesCompletadas, crearClienteWeekSummary } from '../lib/training/client-week'

const summary = crearClienteWeekSummary({
  sesiones: [
    { id: 's1', nombre: 'Fuerza full body', dia_semana: 'Lunes', duracion_estimada_min: 55, ejercicios_count: 6, completada: true, esHoy: false },
    { id: 's2', nombre: 'Hyrox engine', dia_semana: 'Miércoles', duracion_estimada_min: 45, ejercicios_count: 5, completada: false, esHoy: true },
    { id: 's3', nombre: 'Zona 2', dia_semana: 'Viernes', duracion_estimada_min: null, ejercicios_count: 1, completada: false, esHoy: false },
  ],
})

assert.equal(summary.totalSesiones, 3)
assert.equal(summary.completadas, 1)
assert.equal(summary.pendientes, 2)
assert.equal(summary.progresoPct, 33)
assert.equal(summary.minutosPlanificados, 100)
assert.equal(summary.estadoSemana, 'en_curso')
assert.equal(summary.sesionPrincipal?.id, 's2')
assert.equal(summary.mensajeCliente, 'Hoy toca Hyrox engine. Ejecuta con control y registra sensaciones al terminar.')

const empty = crearClienteWeekSummary({ sesiones: [] })
assert.equal(empty.estadoSemana, 'sin_plan')
assert.equal(empty.mensajeCliente, 'Tu coach todavía no ha cargado sesiones para esta semana.')

const sesionesPersistidas = aplicarSesionesCompletadas([
  { id: 's1', nombre: 'Fuerza full body', dia_semana: 'Lunes', duracion_estimada_min: 55, ejercicios_count: 6, completada: false, esHoy: false },
  { id: 's2', nombre: 'Hyrox engine', dia_semana: 'Miércoles', duracion_estimada_min: 45, ejercicios_count: 5, completada: false, esHoy: true },
], ['s2'])
assert.equal(sesionesPersistidas[0].completada, false)
assert.equal(sesionesPersistidas[1].completada, true)

console.log('training client week tests passed')
