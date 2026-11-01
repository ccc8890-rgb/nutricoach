import assert from 'node:assert/strict'
import { claveAgrupacion, rankearParaSelector } from '../lib/alimentos/ranking-selector'

const f = (nombre: string, fuente = 'ia', es_base = false, categoria = 'Lácteos') => ({ id: nombre, nombre, fuente, es_base, categoria })
const nombres = (xs: { nombre: string | null }[]) => xs.map(x => x.nombre)

// «mantequilla»: el alimento antes que los productos que la contienen; variantes de envase agrupadas
let r = rankearParaSelector([
  f('Fácil de Untar con Mantequilla'), f('Croissant de mantequilla 26%'), f('Mantequilla Tarrina'), f('Mantequilla Pastilla'),
  f('Mantequilla', 'bedca', true, 'Grasas y aceites'), f('Mantequilla con sal', 'openfoodfacts'), f('Palomitas sabor mantequilla'),
], 'mantequilla')
assert.equal(r[0].nombre, 'Mantequilla')
assert.ok(nombres(r).indexOf('Mantequilla con sal') < nombres(r).indexOf('Croissant de mantequilla 26%'))
assert.ok(nombres(r).indexOf('Mantequilla con sal') < nombres(r).indexOf('Palomitas sabor mantequilla'))
assert.equal(nombres(r).filter(n => /Tarrina|Pastilla/.test(n ?? '')).length, 0)       // agrupadas con «Mantequilla»

// una palabra dentro de otra no cuenta («repollo» no es «pollo») y va al final
r = rankearParaSelector([f('Repollo'), f('Pollo', 'ia', true, 'Carnes'), f('Muslo de pollo', 'ia', true, 'Carnes')], 'pollo')
assert.deepEqual(nombres(r), ['Pollo', 'Muslo de pollo', 'Repollo'])

// «Atún fresco» y «Atún (fresco)» son lo mismo; el paréntesis que aclara se conserva (cocido ≠ crudo)
assert.equal(claveAgrupacion('Atún fresco'), claveAgrupacion('Atún (fresco)'))
assert.notEqual(claveAgrupacion('Pollo (muslo sin piel)'), claveAgrupacion('Pollo'))
assert.equal(claveAgrupacion('Aceite de oliva Hacendado 1 L'), claveAgrupacion('Aceite de oliva'))

// base antes que no base, y fuente fiable antes que estimada
r = rankearParaSelector([f('Arroz basmati', 'ia'), f('Arroz basmati exprés', 'ia'), f('Arroz bomba', 'bedca', true, 'Cereales')], 'arroz')
assert.equal(r[0].nombre, 'Arroz bomba')

// varias palabras: la frase completa antes que las palabras sueltas
r = rankearParaSelector([f('Queso de cabra crema'), f('Queso crema'), f('Crema de queso')], 'queso crema')
assert.equal(r[0].nombre, 'Queso crema')
// «yogur»: los yogures sin apellido de sabor antes que «yogur sabor coco» o «chocolate con avellanas»
r = rankearParaSelector([f('Yogur sabor coco'), f('Yogur natural'), f('Yogur griego')], 'yogur')
assert.equal(r[2].nombre, 'Yogur sabor coco')
r = rankearParaSelector([f('Chocolate con Avellanas'), f('Chocolate negro 70%'), f('Chocolate')], 'chocolate')
assert.deepEqual(nombres(r), ['Chocolate', 'Chocolate negro 70%', 'Chocolate con Avellanas'])
// mismo producto simple: marcas desconocidas con los mismos macros salen en una sola fila y con el nombre limpio
const m = (nombre: string, calorias: number, proteinas: number, es_base = false) => ({ ...f(nombre, 'ia', es_base), calorias, proteinas, carbohidratos: 1, grasas: 40 })
r = rankearParaSelector([
  m('Bacon 1/ 5 M', 541, 12, true), m('Bacón Hacendado cintas', 541, 12.5), m('Bacón ahumado sin corteza La Selva', 541, 12.4),
  m('Bacón Oscar Mayer lonchas', 290, 16), m('Bacón ahumado La Selva lonchas', 290, 16, true), m('Cintas de Bacón', 541, 12),
], 'bacon')
assert.equal(r.length, 3)  // «Cintas de Bacón» empieza por otra palabra: queda aparte y al final
assert.equal(r[2].nombre, 'Cintas de Bacón')
assert.ok(!nombres(r).some(n => /Hacendado|Oscar|Selva/.test(n ?? '')))
// fuentes fiables con apellido distinto NO se mezclan aunque los macros se parezcan
const t = (nombre: string) => ({ ...f(nombre, 'bedca', true, 'Cereales'), calorias: 350, proteinas: 7, carbohidratos: 78, grasas: 1 })
assert.equal(rankearParaSelector([t('Arroz bomba'), t('Arroz basmati'), t('Arroz integral')], 'arroz').length, 3)
console.log('ranking-selector OK')
