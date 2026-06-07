import assert from 'node:assert/strict'
import { detectarHuecosRecetario } from '../lib/recetas/agente-recetario/coverage'
import { generarCandidatasDesdeHueco } from '../lib/recetas/agente-recetario/generator'
import { prepararImagenPendiente } from '../lib/recetas/agente-recetario/image'
import { AGENTE_RECETARIO_DEFAULTS, type RecetaCandidata } from '../lib/recetas/agente-recetario/types'
import { validarCandidataConservadora } from '../lib/recetas/agente-recetario/validator'

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

function testValidatorRejectsUnmatchedIngredients() {
  const receta: RecetaCandidata = {
    nombre: 'Mango sticky rice sospechoso',
    descripcion: 'Prueba',
    instrucciones: ['Cocer arroz.', 'Servir con mango.'],
    objetivos: ['salud_general'],
    deportes: [],
    momentos: ['postre'],
    tipoPlato: 'postre',
    ingredientes: [
      { nombre: 'mango', alimentoId: 'ok-mango', alimentoNombre: 'Mango', cantidadGramos: 120, rolIngrediente: 'frutas' },
      { nombre: 'arroz glutinoso', cantidadGramos: 90, rolIngrediente: 'carbohidrato_principal' },
    ],
    trazabilidad: { plantillaId: 'test', motivoGeneracion: 'test', modo: 'dry-run' },
  }

  const resultado = validarCandidataConservadora(receta)
  assert.equal(resultado.valida, false)
  assert.equal(resultado.errores.some((error) => error.includes('sin alimento vinculado')), true)
}

function testValidatorRejectsSuspiciousStickyRiceChipsMatch() {
  const receta: RecetaCandidata = {
    nombre: 'Mango sticky rice sospechoso',
    descripcion: 'Prueba',
    instrucciones: ['Cocer arroz.', 'Servir con mango.'],
    objetivos: ['salud_general'],
    deportes: [],
    momentos: ['postre'],
    tipoPlato: 'postre',
    ingredientes: [
      { nombre: 'mango', alimentoId: 'ok-mango', alimentoNombre: 'Mango', cantidadGramos: 120, rolIngrediente: 'frutas' },
      { nombre: 'arroz glutinoso', alimentoId: 'bad-chip', alimentoNombre: 'Chips de patata sabor arroz', cantidadGramos: 90, rolIngrediente: 'carbohidrato_principal' },
    ],
    trazabilidad: { plantillaId: 'test', motivoGeneracion: 'test', modo: 'dry-run' },
  }

  const resultado = validarCandidataConservadora(receta)
  assert.equal(resultado.valida, false)
  assert.equal(resultado.errores.some((error) => error.includes('match sospechoso')), true)
}

function testImagePreparationNeverApproves() {
  const receta = generarCandidatasDesdeHueco({
    objetivo: 'rendimiento',
    deporte: 'running',
    momento: 'tapering',
    actuales: 5,
    minimo: 12,
    prioridad: 'alta',
    motivo: 'Cobertura 5/12',
  }, { cantidad: 1 })[0]

  const imagen = prepararImagenPendiente(receta)
  assert.equal(imagen.aprobada, false)
  assert.equal(imagen.estado, 'pendiente_revision')
  assert.equal(imagen.prompt.length > 30, true)
}

testDefaultsAreConservative()
testCoverageDetectsTaperingGap()
testCoverageDoesNotCreateGapWhenMinimumIsMet()
testGeneratorCreatesSmallDryRunBatch()
testGeneratorDoesNotUseUnsafeCondimentAmounts()
testValidatorRejectsUnmatchedIngredients()
testValidatorRejectsSuspiciousStickyRiceChipsMatch()
testImagePreparationNeverApproves()
console.log('agente-recetario-pro.test.ts OK')
