import assert from 'node:assert/strict'
import { esEstadoPieza, estadoIconoReceta, planificarIcono } from '../lib/contenido/estados'

assert.equal(esEstadoPieza('para_grabar'), true)
assert.equal(esEstadoPieza('inventado'), false)
assert.equal(esEstadoPieza(null), false)

// Caché del icono: lo pendiente manda sobre lo grabado
assert.equal(estadoIconoReceta([]), null)
assert.equal(estadoIconoReceta(['idea', 'documentada']), null)
assert.equal(estadoIconoReceta(['para_grabar']), 'para_grabar')
assert.equal(estadoIconoReceta(['grabada']), 'grabada')
assert.equal(estadoIconoReceta(['publicada']), 'grabada')
assert.equal(estadoIconoReceta(['grabada', 'para_grabar']), 'para_grabar')

// Icono → para_grabar
assert.deepEqual(planificarIcono([], 'para_grabar'), { crear: 'para_grabar', actualizar: [], borrar: [] })
assert.deepEqual(planificarIcono([{ id: 'a', estado: 'para_grabar' }], 'para_grabar'), { crear: null, actualizar: [], borrar: [] })
assert.deepEqual(
  planificarIcono([{ id: 'a', estado: 'documentada' }], 'para_grabar'),
  { crear: null, actualizar: [{ id: 'a', estado: 'para_grabar' }], borrar: [] },
)
// Una pieza ya grabada no impide crear otra para volver a grabar
assert.deepEqual(planificarIcono([{ id: 'a', estado: 'publicada' }], 'para_grabar'), { crear: 'para_grabar', actualizar: [], borrar: [] })

// Icono → grabada
assert.deepEqual(
  planificarIcono([{ id: 'a', estado: 'para_grabar' }, { id: 'b', estado: 'idea' }], 'grabada'),
  { crear: null, actualizar: [{ id: 'a', estado: 'grabada' }], borrar: [] },
)
assert.deepEqual(planificarIcono([], 'grabada'), { crear: 'grabada', actualizar: [], borrar: [] })
assert.deepEqual(planificarIcono([{ id: 'a', estado: 'editada' }], 'grabada'), { crear: null, actualizar: [], borrar: [] })

// Icono → nada: solo se borran piezas pendientes o recién grabadas, nunca las ya editadas o publicadas
assert.deepEqual(
  planificarIcono([{ id: 'a', estado: 'para_grabar' }, { id: 'b', estado: 'grabada' }, { id: 'c', estado: 'publicada' }, { id: 'd', estado: 'idea' }], null),
  { crear: null, actualizar: [], borrar: ['a', 'b'] },
)

console.log('contenido-estados: OK')
