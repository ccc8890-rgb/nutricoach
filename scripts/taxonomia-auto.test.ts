import assert from 'node:assert/strict'
import { completarTaxonomia } from '../lib/recetas/taxonomia-auto'

// Desayuno proteico y rápido
const a = completarTaxonomia({ tipo_plato: 'Desayuno', kcal: 400, proteinas: 35, carbohidratos: 30, tiempo_prep_min: 10 })
assert.deepEqual(a.momentos, ['desayuno'])
assert.ok(a.objetivos.includes('perdida_grasa') && !a.objetivos.includes('salud_general'))
assert.deepEqual(a.deportes, [])
assert.deepEqual(a.estilos, ['rapida'])

// Pre-entreno declarado: momento exacto + rendimiento
const b = completarTaxonomia({ tipo_plato: 'Merienda', kcal: 380, proteinas: 12, carbohidratos: 70, perfil: 'pre' })
assert.deepEqual(b.momentos, ['merienda', 'pre_entreno'])
assert.ok(b.objetivos.includes('rendimiento'))
assert.deepEqual(b.deportes, ['endurance'])

// Postre sin pistas: mantenimiento, sin deporte
const c = completarTaxonomia({ tipo_plato: 'Postre', kcal: 250, proteinas: 5, carbohidratos: 35 })
assert.deepEqual(c.momentos, ['postre', 'merienda'])
assert.deepEqual(c.objetivos, ['mantenimiento'])
assert.deepEqual(c.deportes, [])

// Lo ya informado se respeta; los valores fuera de vocabulario se descartan
const d = completarTaxonomia({ tipo_plato: 'Cena', momentos: ['cena', 'comida_social'], deportes: ['entreno_fuerza', 'running'], objetivos: ['rendimiento'] })
assert.deepEqual(d.momentos, ['cena'])
assert.deepEqual(d.deportes, ['running'])
assert.deepEqual(d.objetivos, ['rendimiento'])

// Nunca devuelve vacío en momentos para un tipo conocido
assert.ok(completarTaxonomia({ tipo_plato: 'Comida' }).momentos.length === 1)
console.log('taxonomia-auto OK')
