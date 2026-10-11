import assert from 'node:assert/strict'
import {
  aplicarCambios, diaSemanaDe, lunesDe, ocurrenciasDelDia, planificarOperacion, proximaFechaSesion, sumarDias,
  type Ajuste, type Operacion,
} from '../lib/entrenos/calendario-ajustes'

const sesiones = [
  { id: 'a', dia_semana: 'Martes' },
  { id: 'b', dia_semana: 'Jueves' },
]
const activa = () => true
let n = 0
const id = () => `n${++n}`
const aplicar = (aj: Ajuste[], o: Operacion) => aplicarCambios(aj, planificarOperacion(o, sesiones, aj, activa), id)
const ids = (f: string, aj: Ajuste[]) => ocurrenciasDelDia(f, sesiones, aj, true).map(x => x.sesion.id)

// Fechas: 2026-10-13 es martes
assert.equal(diaSemanaDe('2026-10-13'), 'Martes')
assert.equal(lunesDe('2026-10-18'), '2026-10-12') // domingo → lunes anterior
assert.equal(sumarDias('2026-10-31', 1), '2026-11-01')

// Plantilla sin ajustes
assert.deepEqual(ids('2026-10-13', []), ['a'])
assert.deepEqual(ids('2026-10-14', []), [])
assert.deepEqual(ids('2026-10-13', []), ids('2026-10-20', []))

// Mover solo UNA fecha: el martes 13 pasa al miércoles 14; el martes 20 sigue igual
let aj = aplicar([], { op: 'mover', sesion_id: 'a', desde: '2026-10-13', hasta: '2026-10-14' })
assert.deepEqual(ids('2026-10-13', aj), [])
assert.deepEqual(ids('2026-10-14', aj), ['a'])
assert.deepEqual(ids('2026-10-20', aj), ['a'])

// Mover otra vez lo ya movido: actualiza el ajuste, no crea otro
aj = aplicar(aj, { op: 'mover', sesion_id: 'a', desde: '2026-10-14', hasta: '2026-10-16' })
assert.equal(aj.length, 1)
assert.deepEqual(ids('2026-10-14', aj), [])
assert.deepEqual(ids('2026-10-16', aj), ['a'])
assert.deepEqual(ids('2026-10-13', aj), [])

// Devolverla a su día original deshace el movimiento
aj = aplicar(aj, { op: 'mover', sesion_id: 'a', desde: '2026-10-16', hasta: '2026-10-13' })
assert.equal(aj.length, 0)
assert.deepEqual(ids('2026-10-13', aj), ['a'])

// Copiar a otro día/semana; no duplica si ya está
aj = aplicar([], { op: 'copiar', sesion_id: 'b', hasta: '2026-10-24' })
assert.deepEqual(ids('2026-10-24', aj), ['b'])
assert.equal(aplicar(aj, { op: 'copiar', sesion_id: 'b', hasta: '2026-10-24' }).length, 1)
assert.equal(aplicar(aj, { op: 'copiar', sesion_id: 'b', hasta: '2026-10-15' }).length, 1) // jueves ya la tiene

// Mover a un día donde ya está no hace nada
assert.deepEqual(planificarOperacion({ op: 'mover', sesion_id: 'a', desde: '2026-10-13', hasta: '2026-10-20' }, sesiones, [], activa), [])

// Quitar de un día: solo ese día; una copia se borra; una movida se convierte en omitida
aj = aplicar([], { op: 'omitir', sesion_id: 'a', desde: '2026-10-13' })
assert.deepEqual(ids('2026-10-13', aj), [])
assert.deepEqual(ids('2026-10-20', aj), ['a'])
aj = aplicar([], { op: 'copiar', sesion_id: 'b', hasta: '2026-10-24' })
aj = aplicar(aj, { op: 'omitir', sesion_id: 'b', desde: '2026-10-24' })
assert.equal(aj.length, 0)
aj = aplicar([], { op: 'mover', sesion_id: 'a', desde: '2026-10-13', hasta: '2026-10-14' })
aj = aplicar(aj, { op: 'omitir', sesion_id: 'a', desde: '2026-10-14' })
assert.equal(aj.length, 1)
assert.equal(aj[0].tipo, 'omitir')
assert.deepEqual(ids('2026-10-13', aj), [])
assert.deepEqual(ids('2026-10-14', aj), [])

// Copiar sobre un día de la plantilla que se había quitado la vuelve a poner
aj = aplicar([], { op: 'omitir', sesion_id: 'a', desde: '2026-10-13' })
aj = aplicar(aj, { op: 'copiar', sesion_id: 'a', hasta: '2026-10-13' })
assert.deepEqual(ids('2026-10-13', aj), ['a'])

// Fuera del bloque la plantilla no cuenta, pero lo copiado sí
const fuera = ocurrenciasDelDia('2026-12-01', sesiones, [{ id: 'z', sesion_id: 'a', tipo: 'copiar', fecha_origen: null, fecha: '2026-12-01' }], false)
assert.deepEqual(fuera.map(x => x.sesion.id), ['a'])

// Próxima fecha para Garmin: sigue la sesión movida
aj = aplicar([], { op: 'mover', sesion_id: 'a', desde: '2026-10-13', hasta: '2026-10-15' })
assert.equal(proximaFechaSesion(sesiones[0], sesiones, aj, '2026-10-12', activa), '2026-10-15')
assert.equal(proximaFechaSesion(sesiones[0], sesiones, [], '2026-10-12', activa), '2026-10-13')

console.log('calendario-ajustes.test.ts OK')
