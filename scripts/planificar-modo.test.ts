import assert from 'node:assert/strict'
import { decidirModoPlanificacion, DIAS_AVISO_SIGUIENTE_BLOQUE } from '../lib/entrenos/planificar-modo'

const hoy = new Date(2026, 9, 10) // 10-10-2026 (local)
const inicio = (diasAtras: number) => new Date(2026, 9, 10 - diasAtras, 12).toISOString()

// Sin plan activo → crear
assert.deepEqual(decidirModoPlanificacion(null, hoy), { modo: 'crear', etiqueta: 'Crear el primer bloque', diasRestantes: null })

// Bloque de 4 semanas (28 días): a mitad → ajustar
const mitad = decidirModoPlanificacion({ created_at: inicio(10), duracion_semanas: 4 }, hoy)
assert.equal(mitad.modo, 'ajustar')
assert.equal(mitad.diasRestantes, 18)
assert.match(mitad.etiqueta, /semana 2 de 4/)

// Quedan exactamente 7 días → siguiente bloque; 8 días → todavía ajustar
assert.equal(decidirModoPlanificacion({ created_at: inicio(21), duracion_semanas: 4 }, hoy).modo, 'siguiente_bloque')
assert.equal(decidirModoPlanificacion({ created_at: inicio(20), duracion_semanas: 4 }, hoy).modo, 'ajustar')
assert.equal(DIAS_AVISO_SIGUIENTE_BLOQUE, 7)

// Quedan 3 días → texto en plural; queda 1 → singular
assert.match(decidirModoPlanificacion({ created_at: inicio(25), duracion_semanas: 4 }, hoy).etiqueta, /acaba en 3 días/)
assert.match(decidirModoPlanificacion({ created_at: inicio(27), duracion_semanas: 4 }, hoy).etiqueta, /acaba en 1 día\)/)

// Bloque terminado → siguiente bloque
const acabado = decidirModoPlanificacion({ created_at: inicio(40), duracion_semanas: 4 }, hoy)
assert.equal(acabado.modo, 'siguiente_bloque')
assert.equal(acabado.diasRestantes, 0)
assert.match(acabado.etiqueta, /ya terminó/)

// Plan sin duración definida (p. ej. plantilla): no se sustituye, se ajusta
const sinDuracion = decidirModoPlanificacion({ created_at: inicio(5), duracion_semanas: null }, hoy)
assert.equal(sinDuracion.modo, 'ajustar')
assert.equal(sinDuracion.diasRestantes, null)

console.log('planificar-modo.test OK')
