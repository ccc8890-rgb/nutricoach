import assert from 'node:assert/strict'
import { detectarHuecosRecetario } from '../lib/recetas/agente-recetario/coverage'
import { generarCandidatasDesdeHueco } from '../lib/recetas/agente-recetario/generator'
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

function testGeneratorCreatesSmallDryRunBatch() {
  const candidatas = generarCandidatasDesdeHueco({
    objetivo: 'rendimiento',
    deporte: 'running',
    momento: 'tapering',
    actuales: 5,
    minimo: 12,
    prioridad: 'alta',
    motivo: 'Cobertura 5/12',
  }, { cantidad: 3 })

  assert.equal(candidatas.length, 3)
  assert.equal(candidatas.every((receta) => receta.trazabilidad.modo === 'dry-run'), true)
  assert.equal(candidatas.every((receta) => receta.momentos.includes('tapering')), true)
}

function testGeneratorDoesNotUseUnsafeCondimentAmounts() {
  const candidatas = generarCandidatasDesdeHueco({
    objetivo: 'rendimiento',
    deporte: 'running',
    momento: 'tapering',
    actuales: 5,
    minimo: 12,
    prioridad: 'alta',
    motivo: 'Cobertura 5/12',
  }, { cantidad: 5 })

  const sospechosos = candidatas.flatMap((receta) =>
    receta.ingredientes.filter((ing) =>
      /sal|ajo|aceite|vinagre|salsa/i.test(ing.nombre) && ing.cantidadGramos >= 50
    )
  )

  assert.equal(sospechosos.length, 0)
}

testDefaultsAreConservative()
testCoverageDetectsTaperingGap()
testCoverageDoesNotCreateGapWhenMinimumIsMet()
testGeneratorCreatesSmallDryRunBatch()
testGeneratorDoesNotUseUnsafeCondimentAmounts()
console.log('agente-recetario-pro.test.ts OK')
