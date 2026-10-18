import assert from 'node:assert/strict'
import { inferirTipoReceta } from '../lib/recetas/tipo-receta'
import { cumplePreEntreno, cumplePostEntreno } from '../lib/recetas/criterios-momento-entreno'

// El fallo original: «agua» dentro de «aguacate» y «pesto/vinagreta» dentro de un plato
assert.equal(inferirTipoReceta({ nombre: 'Tostada de aguacate con huevo poché', categoria: 'Desayuno', kcal: 450, proteinas: 21 }), 'desayuno')
assert.equal(inferirTipoReceta({ nombre: 'Bowl de salmón con aguacate y edamame', categoria: 'Comida', kcal: 468, proteinas: 23 }), 'completa')
assert.equal(inferirTipoReceta({ nombre: 'Pollo al pesto con verduras', categoria: 'Comida', kcal: 288, proteinas: 38 }), 'completa')
assert.equal(inferirTipoReceta({ nombre: 'Salmón al Horno con Espárragos y Vinagreta', categoria: 'Cena', kcal: 445, proteinas: 34 }), 'completa')
assert.equal(inferirTipoReceta({ nombre: 'Palitos de Zanahoria con Hummus Casero', categoria: 'Snack', kcal: 129, proteinas: 5 }), 'snack_postre')
// Lo que sí es salsa o bebida
assert.equal(inferirTipoReceta({ nombre: 'Mayonesa de camarones', categoria: 'Comida' }), 'salsa_base')
assert.equal(inferirTipoReceta({ nombre: 'Aceite de Cebollino', categoria: 'Comida' }), 'salsa_base')
assert.equal(inferirTipoReceta({ nombre: 'Canelón de arroz al sofrito', categoria: 'Comida', kcal: 266, proteinas: 8 }), 'completa')
assert.equal(inferirTipoReceta({ nombre: 'Chimichurri', categoria: 'Snack' }), 'salsa_base')
assert.equal(inferirTipoReceta({ nombre: 'Salsas de yogur altas en proteína', categoria: 'Snack' }), 'salsa_base')
assert.equal(inferirTipoReceta({ nombre: 'Batido de proteínas con plátano', categoria: 'Merienda' }), 'bebida')
assert.equal(inferirTipoReceta({ nombre: 'Migaítoriz natural (bebida isotónica casera)', categoria: 'Snack' }), 'bebida')
assert.equal(inferirTipoReceta({ nombre: 'Smoothie Bowl de Mango y Coco', categoria: 'Desayuno', kcal: 315, proteinas: 6 }), 'desayuno')

// Pre-entreno: hidratos suficientes, poca grasa y fibra
assert.equal(cumplePreEntreno({ carbohidratos: 60, grasas: 8, fibra: 4, proteinas: 15 }), true)
assert.equal(cumplePreEntreno({ carbohidratos: 55, grasas: 35, fibra: 7, proteinas: 32 }), false)   // bowl salmón-aguacate
assert.equal(cumplePreEntreno({ carbohidratos: 79, grasas: 7, fibra: 9, proteinas: 18 }), false)    // fibra alta
assert.equal(cumplePreEntreno({ carbohidratos: 127, grasas: 4, fibra: 16, proteinas: 32, nivel_fit: 'indulgente' }), false)
// Post-entreno: ≥20 g de proteína y hidratos para reponer
assert.equal(cumplePostEntreno({ proteinas: 30, carbohidratos: 55 }), true)
assert.equal(cumplePostEntreno({ proteinas: 35, carbohidratos: 8 }), false)                           // mug cake sin hidratos
assert.equal(cumplePostEntreno({ proteinas: 13, carbohidratos: 108 }), false)
console.log('tipo-receta y criterios OK')
