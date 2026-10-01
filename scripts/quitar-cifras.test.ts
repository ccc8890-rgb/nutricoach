import assert from 'node:assert/strict'
import { quitarCifras } from '../lib/nutricion/quitar-cifras'

assert.equal(quitarCifras('Mezcla 113 g de yogur con 2 cucharadas de aceite.'), 'Mezcla yogur con aceite.')
assert.equal(quitarCifras('Cortar 2 cebollas y 2 morrones en juliana'), 'Cortar cebollas y morrones en juliana')
assert.equal(quitarCifras('Añade 1/2 taza de leche y 3 huevos'), 'Añade leche y huevos')
assert.equal(quitarCifras('Añade 1,5 kg de carne picada'), 'Añade carne picada')
// no toca tiempos, temperaturas ni número de porciones
assert.equal(quitarCifras('Hornea 30 minutos a 180 °C'), 'Hornea 30 minutos a 180 °C')
assert.equal(quitarCifras('Deja reposar 10 min y divide en 4 porciones'), 'Deja reposar 10 min y divide en 4 porciones')
assert.equal(quitarCifras('Cocina 2 horas a fuego lento'), 'Cocina 2 horas a fuego lento')
assert.equal(quitarCifras('Un pellizco de sal (1 g)'), 'Un pellizco de sal')
// rangos y restos
assert.equal(quitarCifras('agrega agua poco a poco (1-2 cucharadas) hasta lograr una textura'), 'agrega agua poco a poco hasta lograr una textura')
assert.equal(quitarCifras('salsa de chile (Tabasco o siracha, aprox. 1 cucharada)'), 'salsa de chile (Tabasco o siracha)')
assert.equal(quitarCifras('Vierte una porción (aproximadamente 1/4 de la mezcla) en la gofrera'), 'Vierte una porción (de la mezcla) en la gofrera')
console.log('quitar-cifras: OK')
