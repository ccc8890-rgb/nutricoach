import assert from 'node:assert/strict'
import { AGENTE_RECETARIO_DEFAULTS } from '../lib/recetas/agente-recetario/types'

function testDefaultsAreConservative() {
  assert.equal(AGENTE_RECETARIO_DEFAULTS.dryRun, true)
  assert.equal(AGENTE_RECETARIO_DEFAULTS.forceReviewState, 'en_revision')
  assert.equal(AGENTE_RECETARIO_DEFAULTS.allowAutoApproval, false)
  assert.equal(AGENTE_RECETARIO_DEFAULTS.allowUnmatchedIngredients, false)
  assert.equal(AGENTE_RECETARIO_DEFAULTS.allowImageAutoApproval, false)
}

testDefaultsAreConservative()
console.log('agente-recetario-pro.test.ts OK')
