import assert from 'node:assert/strict'
import { requiereMomentoExacto, scoreRecetaParaAgente } from '../lib/recetario-taxonomia'

assert.equal(requiereMomentoExacto('pre_entreno'), true)
assert.equal(requiereMomentoExacto('post_entreno'), true)
assert.equal(requiereMomentoExacto('carga_cho'), true)
assert.equal(requiereMomentoExacto('merienda'), false)
assert.equal(requiereMomentoExacto(null), false)

const recetaNormal = {
  kcal: 320,
  proteinas: 20,
  carbohidratos: 50,
  grasas: 8,
  score_calidad: 90,
  recipe_intelligence_score: 90,
  macro_flex_score: 80,
  planning_roles: ['portion_scalable'],
  objetivos: ['rendimiento'],
  deportes: ['running'],
  momentos: ['merienda'],
  adherencia_score: 80,
}

const recetaPre = {
  ...recetaNormal,
  momentos: ['pre_entreno'],
}

const scoreNormalComoPre = scoreRecetaParaAgente(recetaNormal, {
  objetivo: 'rendimiento',
  deporte: 'running',
  momento: 'pre_entreno',
  targetKcal: 320,
  targetProteinas: 20,
})

const scorePreReal = scoreRecetaParaAgente(recetaPre, {
  objetivo: 'rendimiento',
  deporte: 'running',
  momento: 'pre_entreno',
  targetKcal: 320,
  targetProteinas: 20,
})

assert.equal(scorePreReal > scoreNormalComoPre, true)
assert.equal(scoreNormalComoPre < 0.65, true)

console.log('recetario-taxonomia.test.ts OK')
