// Tests de las reglas deterministas del recetario. Ejecutar: npx tsx scripts/campos-auto.test.ts
import assert from 'node:assert/strict'
import { deducirCoccion, normalizarDificultad, deducirDificultad, deducirObjetivos, cumplePreEntreno, cumplePostEntreno, MOMENTOS_POR_TIPO } from '../lib/recetas/campos-auto'

// cocción: negaciones y empates
assert.equal(deducirCoccion('1. Hornea 20 minutos a 180 °C. 2. Sirve.'), 'Horno')
assert.equal(deducirCoccion('Mezcla todo, sin horno ni cocción, y refrigera 2 horas en la nevera para que cuaje bien.'), 'No Bake')
assert.equal(deducirCoccion('Calienta la sartén y saltea. Luego hornea 5 minutos. Mete en la freidora de aire.'), 'Freidora de Aire')
assert.equal(deducirCoccion('corto'), null)
// dificultad
assert.equal(normalizarDificultad('fácil'), 'Fácil'); assert.equal(normalizarDificultad('facil'), 'Fácil'); assert.equal(normalizarDificultad('media'), 'Medio')
assert.equal(normalizarDificultad(null), null)
assert.equal(deducirDificultad({ instrucciones: '1. a\n2. b\n3. c', tiempo_prep_min: 10 }, 5), 'Fácil')
assert.equal(deducirDificultad({ instrucciones: Array.from({ length: 15 }, (_, i) => `${i + 1}. paso`).join('\n') }, 8), 'Difícil')
assert.equal(deducirDificultad({}, 5), null)
// objetivos
assert.deepEqual(deducirObjetivos({ kcal: 0 }), [])
assert.deepEqual(deducirObjetivos({ kcal: 500, proteinas: 5 }), ['salud_general', 'mantenimiento'])
assert.ok(deducirObjetivos({ kcal: 400, proteinas: 35 }).includes('perdida_grasa'))
assert.deepEqual(deducirObjetivos({ kcal: 500, proteinas: 40, nivel_fit: 'indulgente' }), [])
assert.deepEqual(deducirObjetivos({ kcal: 1200, proteinas: 5 }), [])
// criterio de entreno
assert.ok(cumplePreEntreno({ kcal: 350, carbohidratos: 60, grasas: 6, fibra: 4, tipo_plato: 'Desayuno' }))
assert.ok(!cumplePreEntreno({ kcal: 350, carbohidratos: 60, grasas: 25, fibra: 4, tipo_plato: 'Desayuno' }))
assert.ok(!cumplePreEntreno({ kcal: 300, carbohidratos: 66, grasas: 5, fibra: 4, tipo_plato: 'Salsa' }))
assert.ok(cumplePostEntreno({ kcal: 500, proteinas: 35, carbohidratos: 50, grasas: 12, tipo_plato: 'Comida' }))
assert.ok(!cumplePostEntreno({ kcal: 364, proteinas: 39, carbohidratos: 12, grasas: 18, tipo_plato: 'Cena' }))
// momentos: nunca los de entreno
for (const v of Object.values(MOMENTOS_POR_TIPO)) for (const m of v) assert.ok(!/entreno|tapering|carga/.test(m))
console.log('campos-auto.test.ts OK')
