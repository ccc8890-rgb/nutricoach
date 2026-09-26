import assert from 'node:assert/strict'
import {
  siguienteFaseBloque,
  calcularEstadoBloque,
  clasificarTipoSesion,
} from '../lib/entrenos/bloques'

// --- siguienteFaseBloque: rotación fija Base -> Fuerza -> Resistencia -> Deload -> Base ---
assert.equal(siguienteFaseBloque(null), 'Base')
assert.equal(siguienteFaseBloque(undefined), 'Base')
assert.equal(siguienteFaseBloque('Base'), 'Fuerza')
assert.equal(siguienteFaseBloque('Fuerza'), 'Resistencia')
assert.equal(siguienteFaseBloque('Resistencia'), 'Deload')
assert.equal(siguienteFaseBloque('Deload'), 'Base')

// --- calcularEstadoBloque: semana 1 el día de inicio ---
const inicio = '2026-09-01'
const bloqueDia0 = calcularEstadoBloque(inicio, 4, new Date('2026-09-01T12:00:00Z'))
assert.equal(bloqueDia0.semanaActual, 1)
assert.equal(bloqueDia0.semanasTotales, 4)
assert.equal(bloqueDia0.terminado, false)

// --- semana 2 tras 7 días ---
const bloqueSemana2 = calcularEstadoBloque(inicio, 4, new Date('2026-09-08T12:00:00Z'))
assert.equal(bloqueSemana2.semanaActual, 2)

// --- terminado tras las 4 semanas completas ---
const bloqueTerminado = calcularEstadoBloque(inicio, 4, new Date('2026-09-29T12:00:00Z'))
assert.equal(bloqueTerminado.terminado, true)
assert.equal(bloqueTerminado.diasRestantes, 0)
// nunca debe pasarse de semanasTotales aunque hayan pasado muchas más semanas
assert.equal(bloqueTerminado.semanaActual, 4)

// --- reloj/fecha de inicio en el futuro respecto a fechaRef: no debe dar negativos ni NaN ---
const bloqueFuturo = calcularEstadoBloque('2099-01-01', 4, new Date('2026-09-01T12:00:00Z'))
assert.equal(bloqueFuturo.semanaActual, 1)
assert.equal(Number.isNaN(bloqueFuturo.diasRestantes), false)
assert.ok(bloqueFuturo.diasRestantes >= 0)

// --- clasificarTipoSesion ---
assert.equal(clasificarTipoSesion(['fuerza', 'fuerza', 'funcional']), 'hibrido')
assert.equal(clasificarTipoSesion(['cardio', 'cardio', 'cardio']), 'carrera')
assert.equal(clasificarTipoSesion(['fuerza', 'cardio']), 'mixto')
// sesión sin ejercicios vinculados: no debe dividir por cero ni lanzar
assert.equal(clasificarTipoSesion([]), 'mixto')

console.log('OK — bloques-entreno')
