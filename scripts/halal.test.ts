import assert from 'node:assert/strict'
import { contieneCerdo, contieneAlcohol, esHalalPorIngredientes, cumpleRestriccionesReligiosas } from '../lib/recetas/halal'

const r = (nombre: string, ...ings: string[]) => ({ nombre, receta_ingredientes: ings.map(n => ({ nombre_libre: n, alimento: { nombre: n } })) })

// Cerdo
assert.equal(contieneCerdo(r('Lentejas con pollo', 'Lentejas', 'Huesos de jamón')), true)
assert.equal(contieneCerdo(r('Pizza', 'Jamón serrano')), true)
assert.equal(contieneCerdo(r('Cheesecake', 'Gelatina neutra en hojas')), true) // ante la duda, cuenta como cerdo
assert.equal(contieneCerdo(r('Pasta', 'Guanciale')), true)
// No es cerdo
assert.equal(contieneCerdo(r('Salmón', 'Salmón fresco en lomo')), false)
assert.equal(contieneCerdo(r('Bocata', 'Jamón cocido de pavo')), false)
assert.equal(contieneCerdo(r('Costillas de ternera asadas', 'Costillas de ternera')), false)
assert.equal(contieneCerdo(r('Tostada', 'Pan', 'Aguacate', 'Huevo')), false)
assert.equal(contieneCerdo(r('Burger', 'Chorizo vegetal')), false)
// Alcohol
assert.equal(contieneAlcohol(r('Guiso', 'Vino blanco')), true)
assert.equal(contieneAlcohol(r('Salsa', 'Mirin')), true)
assert.equal(contieneAlcohol(r('Ensalada', 'Vinagre de vino')), false)
assert.equal(contieneAlcohol(r('Pollo', 'Cerveza sin alcohol')), false)
// Halal = sin cerdo ni alcohol
assert.equal(esHalalPorIngredientes(r('Pollo al horno', 'Pollo', 'Limón')), true)
assert.equal(esHalalPorIngredientes(r('Pollo al vino', 'Pollo', 'Vino tinto')), false)
// Restricciones del cliente
assert.equal(cumpleRestriccionesReligiosas(r('Pollo al vino', 'Pollo', 'Vino tinto'), ['Halal']), false)
assert.equal(cumpleRestriccionesReligiosas(r('Pollo al vino', 'Pollo', 'Vino tinto'), ['Sin cerdo']), true)
assert.equal(cumpleRestriccionesReligiosas(r('Pizza', 'Jamón serrano'), ['sin cerdo']), false)
assert.equal(cumpleRestriccionesReligiosas(r('Pizza', 'Jamón serrano'), []), true)
console.log('halal.test OK')
