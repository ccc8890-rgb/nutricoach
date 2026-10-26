import assert from 'node:assert/strict'
import { familiaElaboracion, familiaPlato, clasificarFicha, camposAlCambiarTipo, tipoEfectivo, visibleEnTipo, migrarCategoriaAntigua } from '../lib/recetas/clasificacion'
import { inferirTipoReceta } from '../lib/recetas/tipo-receta'
import { FAMILIAS_ELABORACION, FAMILIAS_PLATO, CATEGORIAS_PLATO } from '../lib/recetas-constants'

// Familias de elaboración (las 14 reales y las de la cola de revisión)
const ELAB: Record<string, string[]> = {
  'Panes y masas': ['Turbo Poolish para Pizza Rápida', 'Pan de hamburguesa de puré de papa', 'Pan plano sin amasado con mantequilla de ajo', 'Brioche', 'Focaccia sin amasar con romero', 'Masa madre de centeno'],
  'Salsas': ['Mayonesa de camarón', 'Mayonesa de camarones', 'Ajonesa de huevo cocido', 'Mayonesa de albahaca de huevo cocido', 'Mayonesa picante de huevo cocido', 'Chimichurri',
    'Salsa de Hamburguesa y Salsa de Trufa', 'Salsa de queso cheddar fit', 'Salsas de yogur altas en proteína', 'Hollandaise en bolsa', 'Pesto de rúcula', 'Vinagreta de mostaza', 'Hummus clásico'],
  'Condimentos y mezclas': ['Mix de especias barbacoa', 'Adobo de pollo', 'Marinada de yogur', 'Marinado mayak de verduras y aceitunas', 'Sazonador para carne'],
  'Fondos y caldos': ['Demi-Glace Vegetal', 'Caldo de huesos', 'Fondo de ave'],
  'Grasas aromáticas': ['Aceite de Cebollino', 'Aceite verde de hierbas', 'Chili oil casero'],
  'Mantequillas compuestas': ['Mantequilla Café de París'],
  'Cremas y rellenos': ['Ganache de caramelo y café', 'Caramelo salado sin azúcar'],
  'Fermentos y curados': ['Yema curada ahumada', 'Kimchi casero'],
}
for (const [familia, nombres] of Object.entries(ELAB)) for (const n of nombres) assert.equal(familiaElaboracion(n), familia, n)
for (const f of Object.keys(ELAB)) assert.ok((FAMILIAS_ELABORACION as readonly string[]).includes(f), f)

// Los platos no son elaboraciones
for (const n of ['Pan con tomate', 'Pollo con salsa barbacoa', 'Salmón al Horno con Espárragos y Vinagreta', 'Pizza rápida', 'Tostada de aguacate',
  'Tostada de pan integral con aguacate', 'Palitos de Zanahoria con Hummus Casero', 'Pasta con pesto', 'Wraps de filete proteicos con pan plano de yogur',
  'Puré de zanahoria con mantequilla avellana']) assert.equal(familiaElaboracion(n), null, n)

// Familias de plato
assert.equal(familiaPlato({ nombre: 'Firecracker Beef and Broccoli' }), 'Carnes')
assert.equal(familiaPlato({ nombre: 'Arroz de montaña con butifarra, costilla de cerdo y trompetas de la muerte' }), 'Arroces')
assert.equal(familiaPlato({ nombre: 'Puré de zanahoria con mantequilla avellana', tipo_receta: 'guarnicion' }), 'Guarniciones')
assert.equal(familiaPlato({ nombre: 'Babă Neagră moldava (pastel panal)', categoria: 'Postre' }), 'Postres')
assert.equal(familiaPlato({ nombre: 'Bao perezoso' }), 'Bocadillos y bowls')
assert.equal(familiaPlato({ nombre: 'Ñoquis crujientes con Gula del Norte y tomates cherry' }), 'Pastas')
assert.equal(familiaPlato({ nombre: 'Tortilla de espinacas y champiñones con tomate' }), 'Huevos')
assert.equal(familiaPlato({ nombre: 'Bowl de salmón con aguacate y edamame' }), 'Bocadillos y bowls')
assert.equal(familiaPlato({ nombre: 'Gazpacho andaluz' }), 'Sopas y cremas')
assert.equal(familiaPlato({ nombre: 'Ensalada de quinoa con aguacate y granada' }), 'Verduras y ensaladas')
assert.equal(familiaPlato({ nombre: 'Merluza al horno con limón' }), 'Pescados')
assert.equal(familiaPlato({ nombre: 'Buñuelo relleno crujiente', categoria: 'Entrante' }), 'Entrantes')
assert.equal(familiaPlato({ nombre: 'Tofu Lava' }), null)
assert.equal(familiaPlato({ nombre: 'Plato misterioso', tags: ['Pollo'] }), 'Carnes')       // las etiquetas deciden si el nombre no
for (const f of ['Carnes', 'Arroces', 'Guarniciones', 'Postres', 'Bocadillos y bowls', 'Pastas', 'Huevos', 'Sopas y cremas', 'Verduras y ensaladas', 'Pescados', 'Entrantes']) assert.ok((FAMILIAS_PLATO as readonly string[]).includes(f), f)

// Ficha completa
assert.deepEqual(clasificarFicha({ nombre: 'Brioche' }), { tipo_contenido: 'elaboracion', familia: 'Panes y masas' })
assert.deepEqual(clasificarFicha({ nombre: 'Bao perezoso' }), { tipo_contenido: 'plato', familia: 'Bocadillos y bowls' })
assert.deepEqual(clasificarFicha({ nombre: 'Tofu Lava' }), { tipo_contenido: 'plato', familia: null })

// Editor: tipo ↔ categoría ↔ tipo_receta coherentes
assert.deepEqual(camposAlCambiarTipo({ nombre: 'Adobo', tipo: 'elaboracion', familia: 'Condimentos y mezclas', categoria: 'Comida', tipoRecetaActual: 'completa' }),
  { tipo_contenido: 'elaboracion', familia: 'Condimentos y mezclas', categoria: 'Elaboración', tipo_receta: 'salsa_base' })
assert.deepEqual(camposAlCambiarTipo({ nombre: 'Pollo al horno', tipo: 'plato', familia: 'Carnes', categoria: 'Elaboración', kcal: 400, proteinas: 40, tipoRecetaActual: 'salsa_base' }),
  { tipo_contenido: 'plato', familia: 'Carnes', categoria: null, tipo_receta: inferirTipoReceta({ nombre: 'Pollo al horno', categoria: null, kcal: 400, proteinas: 40 }) })
assert.deepEqual(camposAlCambiarTipo({ nombre: 'Bowl', tipo: 'plato', familia: null, categoria: 'Comida', tipoRecetaActual: 'completa' }),
  { tipo_contenido: 'plato', familia: null, categoria: 'Comida', tipo_receta: 'completa' })

// Vista
assert.equal(tipoEfectivo('elaboraciones', true), 'elaboraciones')
assert.equal(tipoEfectivo(null, true), 'todo')
assert.equal(tipoEfectivo(null, false), 'platos')
assert.equal(tipoEfectivo('xx', false), 'platos')
assert.equal(visibleEnTipo({ tipo_contenido: 'elaboracion' }, 'platos'), false)
assert.equal(visibleEnTipo({ tipo_contenido: 'elaboracion' }, 'elaboraciones'), true)
assert.equal(visibleEnTipo({ tipo_contenido: 'elaboracion' }, 'todo'), true)
assert.equal(visibleEnTipo({ tipo_contenido: 'plato' }, 'elaboraciones'), false)
assert.equal(visibleEnTipo({ tipo_contenido: null }, 'platos'), true)

// Enlaces antiguos
assert.deepEqual(migrarCategoriaAntigua('Salsa'), { tipo: 'elaboraciones', familia: 'Salsas' })
assert.deepEqual(migrarCategoriaAntigua('Condimento'), { tipo: 'elaboraciones', familia: 'Condimentos y mezclas' })
assert.deepEqual(migrarCategoriaAntigua('Elaboración base'), { tipo: 'elaboraciones', familia: 'Panes y masas' })
assert.equal(migrarCategoriaAntigua('Comida'), null)
assert.deepEqual([...CATEGORIAS_PLATO], ['Todos', 'Desayuno', 'Comida', 'Cena', 'Merienda', 'Snack', 'Postre'])

console.log('clasificacion.test OK')
