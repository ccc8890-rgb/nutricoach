import assert from 'node:assert/strict'
import { formatoFecha, lunesDe, repartirEnDieta, semanaYDia, sumarDias } from '../lib/contenido/fechas'

// 2026-10-07 es miércoles
assert.equal(lunesDe('2026-10-07'), '2026-10-05')
assert.equal(lunesDe('2026-10-05'), '2026-10-05')
assert.equal(lunesDe('2026-10-11'), '2026-10-05') // domingo
assert.equal(sumarDias('2026-10-31', 1), '2026-11-01')
assert.equal(sumarDias('2026-12-31', 1), '2027-01-01')
assert.equal(formatoFecha('2026-10-07'), '07-10-2026')

const hoy = '2026-10-07'
assert.deepEqual(semanaYDia('2026-10-12', hoy), { semana: 1, dia: 'Lunes' })
assert.deepEqual(semanaYDia('2026-10-18', hoy), { semana: 1, dia: 'Domingo' })
assert.deepEqual(semanaYDia('2026-11-30', hoy), { semana: 8, dia: 'Lunes' })
// Semana en curso, pasada o demasiado lejana: no se puede colocar
assert.equal(semanaYDia('2026-10-09', hoy), null)
assert.equal(semanaYDia('2026-10-05', hoy), null)
assert.equal(semanaYDia('2026-09-28', hoy), null)
assert.equal(semanaYDia('2026-12-07', hoy), null)
assert.equal(semanaYDia('no-es-fecha', hoy), null)

// Reparto: 2 recetas por día (Comida y Cena), desde la fecha de grabación
assert.deepEqual(repartirEnDieta(0, '2026-10-17'), [])
assert.deepEqual(repartirEnDieta(3, '2026-10-17'), [
  { fecha: '2026-10-17', franja: 'Comida' },
  { fecha: '2026-10-17', franja: 'Cena' },
  { fecha: '2026-10-18', franja: 'Comida' },
])

console.log('contenido-fechas: OK')
