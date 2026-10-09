// npx tsx scripts/equivalencia.test.ts
import assert from 'node:assert/strict'
import { formatoCantidad } from '../lib/recetas/equivalencia'
assert.equal(formatoCantidad(120, 1, null, null, 'Huevo'), '120g (2 huevos)')
assert.equal(formatoCantidad(60, 1, null, null, 'Huevo'), '60g (1 huevo)')
assert.equal(formatoCantidad(30, 1, 2, 'cucharadas', 'Crema de avellanas'), '30g (2 cucharadas)')   // equivalencia guardada manda
assert.equal(formatoCantidad(120, 2, 2, 'huevos', 'Huevo'), '240g (4 huevos)')                       // escala con las raciones
assert.equal(formatoCantidad(125, 1, null, null, 'Yogur natural'), '125g (1 yogur)')
assert.equal(formatoCantidad(125, 1, null, null, 'Salsa de yogur'), '125g')                          // salsa de yogur no es un yogur
assert.equal(formatoCantidad(125, 1, null, null, 'Yogur líquido melocotón'), '125g')
assert.equal(formatoCantidad(5, 1, null, null, 'Aceite de oliva'), '5g')                             // <1 cucharada: no se muestra
assert.equal(formatoCantidad(100, 1, null, null, 'Pechuga de pollo'), '100g')                       // sin regla: solo gramos
assert.equal(formatoCantidad(95, 1, null, null, 'Huevo'), '95g')                                     // no encaja con un nº de huevos
console.log('equivalencia.test.ts OK')
