import assert from 'node:assert/strict'
import { endulzanteDeNombre, endulzanteDeReceta, interpretarBusquedaEndulzante } from '../lib/recetas/endulzante'

const casos: [string, string][] = [
  ['Azúcar moreno', 'refinado'], ['Azucar blanco sobres', 'refinado'], ['AZUCARERA Panela', 'refinado'], ['Sirope de arce', 'refinado'],
  ['Mermelada de fresa', 'refinado'], ['Chocolate con leche', 'refinado'], ['Miel', 'natural'], ['Dátiles medjool', 'natural'],
  ['Sirope de agave', 'natural'], ['Eritritol', 'edulcorante'], ['Edulcorante granulado stevia', 'edulcorante'],
  ['Chocolate negro 85%', 'ninguno'], ['Cacao puro en polvo', 'ninguno'], ['Bebida de almendras 0% azúcar', 'ninguno'],
  ['Cornflakes sin azúcar', 'ninguno'], ['Azúcar o edulcorante', 'edulcorante'], ['Mielina', 'ninguno'],
]
for (const [n, e] of casos) assert.equal(endulzanteDeNombre(n), e, n)
assert.equal(endulzanteDeReceta(['Miel', 'Azúcar']), 'refinado')
assert.equal(endulzanteDeReceta(['Miel', 'Eritritol']), 'natural')
assert.equal(endulzanteDeReceta(['Avena']), 'ninguno')
assert.deepEqual(interpretarBusquedaEndulzante('tarta sin azúcar'), { texto: 'tarta', admite: ['natural', 'edulcorante', 'ninguno'] })
assert.deepEqual(interpretarBusquedaEndulzante('postre con azucar añadido').admite, ['refinado'])
assert.deepEqual(interpretarBusquedaEndulzante('Tarta de queso'), { texto: 'Tarta de queso', admite: null })
console.log('endulzante OK')
