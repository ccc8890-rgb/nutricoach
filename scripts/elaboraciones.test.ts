import assert from 'node:assert/strict'
import { categoriaElaboracion, tipoRecetaTrasCambioCategoria, inferirTipoReceta } from '../lib/recetas/tipo-receta'
import { esCategoriaElaboracion, categoriaCoincide, filtroExcluyeElaboraciones, CATEGORIAS, TIPOS_PLATO } from '../lib/recetas-constants'

// Las 14 reales
const BASE = ['Turbo Poolish para Pizza Rápida', 'Masa madre de centeno', 'Caldo de huesos', 'Fondo de ave', 'Levain']
const SALSA = ['Mayonesa de camarón', 'Mayonesa de camarones', 'Ajonesa de huevo cocido', 'Mayonesa de albahaca de huevo cocido',
  'Mayonesa picante de huevo cocido', 'Chimichurri', 'Salsa de Hamburguesa y Salsa de Trufa', 'Salsa de queso cheddar fit',
  'Salsas de yogur altas en proteína', 'Pesto de rúcula', 'Vinagreta de mostaza', 'Hummus clásico']
const CONDIMENTO = ['Aceite de Cebollino', 'Aceite verde de hierbas', 'Chili oil casero', 'Mix de especias barbacoa',
  'Adobo de pollo', 'Marinada de yogur', 'Sazonador para carne']
for (const n of BASE) assert.equal(categoriaElaboracion(n), 'Elaboración base', n)
for (const n of SALSA) assert.equal(categoriaElaboracion(n), 'Salsa', n)
for (const n of CONDIMENTO) assert.equal(categoriaElaboracion(n), 'Condimento', n)

// Los platos no son elaboraciones
for (const n of ['Pollo con salsa barbacoa', 'Salmón al Horno con Espárragos y Vinagreta', 'Pizza rápida', 'Tostada de aguacate',
  'Palitos de Zanahoria con Hummus Casero', 'Pasta con pesto']) assert.equal(categoriaElaboracion(n), null, n)

// Categorías
assert.equal(esCategoriaElaboracion('Salsa'), true)
assert.equal(esCategoriaElaboracion('Comida'), false)
assert.equal(esCategoriaElaboracion(null), false)
assert.ok(CATEGORIAS.includes('Elaboración base') && CATEGORIAS.includes('Condimento'))
assert.ok(!(TIPOS_PLATO as readonly string[]).includes('Condimento'))

// «Todos» no mezcla elaboraciones, salvo que se busque por texto
assert.equal(categoriaCoincide('Salsa', 'Todos', false), false)
assert.equal(categoriaCoincide('Salsa', 'Todos', true), true)
assert.equal(categoriaCoincide('Comida', 'Todos', false), true)
assert.equal(categoriaCoincide('Salsa', 'Salsa', false), true)
assert.equal(categoriaCoincide('Comida', 'Salsa', false), false)
assert.equal(categoriaCoincide(null, 'Todos', false), true)
assert.equal(filtroExcluyeElaboraciones('', ''), true)
assert.equal(filtroExcluyeElaboraciones('Todos', ''), true)
assert.equal(filtroExcluyeElaboraciones('Todos', 'poolish'), false)
assert.equal(filtroExcluyeElaboraciones('Salsa', ''), false)

// Editor: categoría ↔ tipo_receta coherentes
assert.deepEqual(tipoRecetaTrasCambioCategoria({ nombre: 'Adobo', categoria: 'Condimento', tipoActual: 'completa' }), { tipo_receta: 'salsa_base', tipo_plato: 'Salsa' })
assert.deepEqual(tipoRecetaTrasCambioCategoria({ nombre: 'Pollo al horno', categoria: 'Comida', kcal: 400, proteinas: 40, tipoActual: 'salsa_base' }),
  { tipo_receta: inferirTipoReceta({ nombre: 'Pollo al horno', categoria: 'Comida', kcal: 400, proteinas: 40 }) })
assert.deepEqual(tipoRecetaTrasCambioCategoria({ nombre: 'Bowl', categoria: 'Comida', tipoActual: 'completa' }), { tipo_receta: 'completa' })

console.log('elaboraciones.test OK')
