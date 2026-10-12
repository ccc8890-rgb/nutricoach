import assert from 'node:assert/strict'
import { fechaLegible, textoSesionDevuelta, textoSesionMovida } from '../lib/entrenos/cambios-cliente'
assert.equal(fechaLegible('2026-10-24'), 'sábado 24 oct')
assert.equal(fechaLegible('2026-11-01'), 'domingo 1 nov')
assert.equal(textoSesionMovida('Tirada larga Z2', '2026-10-24', '2026-10-25'), 'Movió «Tirada larga Z2» del sábado 24 oct al domingo 25 oct')
assert.equal(textoSesionDevuelta('Tirada larga Z2', '2026-10-24'), 'Devolvió «Tirada larga Z2» a su día de siempre (sábado 24 oct)')
console.log('cambios-cliente OK')

import { decidirMovimientoSesion } from '../lib/entrenos/cambios-cliente'
// Sesión de la semana tipo (sábado) → se mueve solo esa fecha
let d = decidirMovimientoSesion({ fechaOrigen: '2026-10-24', destino: '2026-10-25', diaPlantilla: 'Sábado', existente: null })
assert.deepEqual(d, { accion: 'insertar', fila: { tipo: 'mover', fecha_origen: '2026-10-24', fecha: '2026-10-25' } })
// Un día que no le toca → error
assert.equal(decidirMovimientoSesion({ fechaOrigen: '2026-10-23', destino: '2026-10-25', diaPlantilla: 'Sábado', existente: null }).accion, 'error')
// Ya movida (24 → 25) y la mueve otra vez al 26: se actualiza el mismo ajuste
const mov = { id: 'a1', sesion_id: 's', tipo: 'mover' as const, fecha_origen: '2026-10-24', fecha: '2026-10-25' }
assert.deepEqual(decidirMovimientoSesion({ fechaOrigen: '2026-10-25', destino: '2026-10-26', diaPlantilla: 'Sábado', existente: mov }), { accion: 'actualizar', ajusteId: 'a1', fecha: '2026-10-26' })
// La devuelve a su día de siempre (24): se borra el ajuste
assert.deepEqual(decidirMovimientoSesion({ fechaOrigen: '2026-10-25', destino: '2026-10-24', diaPlantilla: 'Sábado', existente: mov }), { accion: 'borrar', ajusteId: 'a1' })
console.log('cambios-cliente (movimiento) OK')
