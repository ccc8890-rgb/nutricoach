import assert from 'node:assert/strict'
import { lineasParaDieta, factorDeActualizacion } from '../lib/platos/dieta'

// Líneas a 0 g no impiden añadir el plato a la dieta (Final #3); solo falta de enlace sí
const ok = lineasParaDieta([{ alimento_id: 'a', cantidad_gramos: 150 }, { alimento_id: 'b', cantidad_gramos: 0 }], 1, 1)
assert.ok(ok.ok)
if (ok.ok) assert.deepEqual(ok.filas, [{ alimento_id: 'a', cantidad_gramos: 150 }])
assert.equal(lineasParaDieta([{ alimento_id: null, cantidad_gramos: 20 }], 1, 1).ok, false)
assert.equal(lineasParaDieta([], 1, 1).ok, false)
assert.equal(lineasParaDieta([{ alimento_id: 'b', cantidad_gramos: 0 }], 1, 1).ok, false, 'si no queda ningún ingrediente con cantidad, no hay comida')

// Raciones: gramos × raciones / porciones del plato
const dos = lineasParaDieta([{ alimento_id: 'a', cantidad_gramos: 200 }], 1, 2)
assert.ok(dos.ok && dos.filas[0].cantidad_gramos === 100)

// Al re-aprobar, la comida ya creada conserva su proporción de raciones (Final #5)
assert.equal(factorDeActualizacion(150, 300, 1), 0.5, 'la comida tenía la mitad de los gramos aprobados antes')
assert.equal(factorDeActualizacion(0, 300, 2), 0.5, 'sin dato → 1/porciones')
assert.equal(factorDeActualizacion(100, 0, 1), 1, 'sin gramos anteriores → 1/porciones')

console.log('platos-dieta-lineas OK')
