import assert from 'node:assert/strict'
import { IDS_PLANOS, PLANOS, alternarPlano, estadoTrasPlanos, planosPendientes, planosTrasEstado } from '../lib/contenido/escaleta'

assert.equal(PLANOS.length, 6)
assert.equal(new Set(IDS_PLANOS).size, 6)

assert.equal(planosPendientes([]), 6)
assert.equal(planosPendientes(['ingredientes', 'plato']), 4)
assert.equal(planosPendientes([...IDS_PLANOS]), 0)
// ids desconocidos o repetidos no cuentan
assert.equal(planosPendientes(['ingredientes', 'ingredientes', 'otro']), 5)

assert.deepEqual(alternarPlano([], 'plato'), ['plato'])
assert.deepEqual(alternarPlano(['plato'], 'plato'), [])
assert.deepEqual(alternarPlano(['plato'], 'inventado'), ['plato'])

// Marcar el último plano pasa a grabada
assert.equal(estadoTrasPlanos('para_grabar', [...IDS_PLANOS]), 'grabada')
assert.equal(estadoTrasPlanos('para_grabar', ['plato']), 'para_grabar')
// Desmarcar un plano de una pieza grabada la devuelve a para_grabar
assert.equal(estadoTrasPlanos('grabada', IDS_PLANOS.slice(1)), 'para_grabar')
assert.equal(estadoTrasPlanos('grabada', [...IDS_PLANOS]), 'grabada')
// Otros estados no cambian por los planos
assert.equal(estadoTrasPlanos('idea', []), 'idea')
assert.equal(estadoTrasPlanos('publicada', ['plato']), 'publicada')

// Si el estado pasa a grabado o posterior, la escaleta se da por completa (icono "grabada" del planificador)
assert.deepEqual(planosTrasEstado('grabada', []), [...IDS_PLANOS])
assert.deepEqual(planosTrasEstado('publicada', ['plato']), [...IDS_PLANOS])
assert.deepEqual(planosTrasEstado('para_grabar', ['plato']), ['plato'])

console.log('contenido-escaleta: OK')
