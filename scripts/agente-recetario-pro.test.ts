import assert from 'node:assert/strict'
import { detectarHuecosRecetario } from '../lib/recetas/agente-recetario/coverage'
import { AGENTE_RECETARIO_DEFAULTS } from '../lib/recetas/agente-recetario/types'

function testDefaultsAreConservative() {
  assert.equal(AGENTE_RECETARIO_DEFAULTS.dryRun, true)
  assert.equal(AGENTE_RECETARIO_DEFAULTS.forceReviewState, 'en_revision')
  assert.equal(AGENTE_RECETARIO_DEFAULTS.allowAutoApproval, false)
  assert.equal(AGENTE_RECETARIO_DEFAULTS.allowUnmatchedIngredients, false)
  assert.equal(AGENTE_RECETARIO_DEFAULTS.allowImageAutoApproval, false)
}

function testCoverageDetectsTaperingGap() {
  const gaps = detectarHuecosRecetario([
    { objetivo: 'rendimiento', deporte: 'running', momento: 'tapering', actuales: 5 },
  ])

  assert.equal(gaps.length, 1)
  assert.equal(gaps[0].momento, 'tapering')
  assert.equal(gaps[0].prioridad, 'alta')
  assert.equal(gaps[0].minimo > gaps[0].actuales, true)
}

function testCoverageDoesNotCreateGapWhenMinimumIsMet() {
  const gaps = detectarHuecosRecetario([
    { objetivo: 'rendimiento', deporte: 'running', momento: 'tapering', actuales: 12 },
  ])

  assert.equal(gaps.length, 0)
}

testDefaultsAreConservative()
testCoverageDetectsTaperingGap()
testCoverageDoesNotCreateGapWhenMinimumIsMet()
console.log('agente-recetario-pro.test.ts OK')
