import assert from 'node:assert/strict'
import { canonicoCarrera, nombreCatalogoPorDistancia, midePorDistanciaOTiempo, tipoPreferidoDeSesion } from '../lib/entrenos/guardar-plan'

// «Carrera continua» con series de distancia son intervalos
assert.equal(nombreCatalogoPorDistancia('Carrera continua', 4, '400m'), 'Intervalos 400m')
assert.equal(nombreCatalogoPorDistancia('Carrera continua', 5, '400 m'), 'Intervalos 400m')
// Una sola serie (rodaje de 34 min) o sin distancia: no se toca
assert.equal(nombreCatalogoPorDistancia('Carrera continua', 1, '34min'), null)
assert.equal(nombreCatalogoPorDistancia('Carrera continua', 1, '400m'), null)
assert.equal(nombreCatalogoPorDistancia('Dominadas', 4, '400m'), null)

// Metros o minutos → se busca entre cardio y funcional; repeticiones normales → no
assert.equal(midePorDistanciaOTiempo('500m'), true)
assert.equal(midePorDistanciaOTiempo('5min'), true)
assert.equal(midePorDistanciaOTiempo('50 m'), true)
assert.equal(midePorDistanciaOTiempo('6-8'), false)
assert.equal(midePorDistanciaOTiempo(10), false)

// Sesión de carrera pura = cardio; híbrida = sin preferencia
assert.equal(tipoPreferidoDeSesion({ nombre: 'Rodaje regenerativo Z2' }), 'cardio')
assert.equal(tipoPreferidoDeSesion({ nombre: 'Híbrido Tren Superior B · Row + Farmers Carry' }), undefined)
// Trote de activación/final en carrera → catálogo (no «Pilates suave»)
assert.equal(canonicoCarrera('Trote suave de activación'), 'trote de calentamiento')
assert.equal(canonicoCarrera('Trote suave de calentamiento'), 'trote de calentamiento')
assert.equal(canonicoCarrera('Trote muy suave final'), 'vuelta a la calma')
assert.equal(canonicoCarrera('Vuelta a la calma'), 'vuelta a la calma')
assert.equal(canonicoCarrera('Carrera continua'), null)
assert.equal(canonicoCarrera('Rodaje continuo Z2'), null)
console.log('guardar-plan-vinculos OK')
