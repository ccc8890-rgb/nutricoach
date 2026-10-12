import assert from 'node:assert/strict'
import { agruparEncadenados } from '../lib/training/encadenados'

const ej = (series: number, descanso: number | null, encadenado = false) => ({ series, descanso_segundos: descanso, encadenado })

// Sled push + 400 m: una cadena de 4 rondas con la pausa del último ejercicio.
let u = agruparEncadenados([ej(2, 45), ej(4, 0, true), ej(4, 120), ej(3, 120)])
assert.equal(u.length, 3)
assert.equal(u[0].tipo, 'solo')
assert.deepEqual(u[1].tipo === 'cadena' && [u[1].items.length, u[1].rondas, u[1].pausaRonda], [2, 4, 120])
assert.equal(u[2].tipo, 'solo')

// Series distintas: sigue encadenado pero sin número de rondas.
u = agruparEncadenados([ej(4, 0, true), ej(3, 90)])
assert.deepEqual(u[0].tipo === 'cadena' && [u[0].rondas, u[0].pausaRonda], [null, 90])

// Tres seguidos (A→B→C).
u = agruparEncadenados([ej(3, 0, true), ej(3, 0, true), ej(3, 60)])
assert.equal(u.length, 1)
assert.equal(u[0].tipo === 'cadena' && u[0].items.length, 3)

// Marcado en el último ejercicio: no hay siguiente, queda suelto.
u = agruparEncadenados([ej(3, 60), ej(3, 0, true)])
assert.deepEqual(u.map(x => x.tipo), ['solo', 'solo'])

// Sin marca no se encadena aunque la pausa sea 0 (trote de calentamiento, carrera continua).
u = agruparEncadenados([ej(1, 0), ej(1, 0)])
assert.deepEqual(u.map(x => x.tipo), ['solo', 'solo'])

console.log('encadenados OK')
