import { execFileSync } from 'node:child_process'
import assert from 'node:assert/strict'
import { detectarHuecosRecetario } from '../lib/recetas/agente-recetario/coverage'
import { generarCandidatasDesdeHueco } from '../lib/recetas/agente-recetario/generator'
import { prepararImagenPendiente } from '../lib/recetas/agente-recetario/image'
import { construirPayloadInsercionReceta, insertarRecetaEnRevision } from '../lib/recetas/agente-recetario/importer'
import { resolverIngredientesCandidata } from '../lib/recetas/agente-recetario/matcher'
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

function testGeneratorCreatesPreTrainingCandidates() {
  const candidatas = generarCandidatasDesdeHueco({
    objetivo: 'rendimiento',
    momento: 'pre_entreno',
    actuales: 14,
    minimo: 30,
    prioridad: 'alta',
    motivo: 'Cobertura 14/30',
  }, { cantidad: 2 })

  assert.equal(candidatas.length, 2)
  assert.equal(candidatas.every((receta) => receta.momentos.includes('pre_entreno')), true)
  assert.equal(candidatas.every((receta) => receta.digestibilidad === 'alta'), true)
}

function testGeneratorCreatesFatLossDinnerCandidate() {
  const candidatas = generarCandidatasDesdeHueco({
    objetivo: 'perdida_grasa',
    tipoPlato: 'cena',
    actuales: 12,
    minimo: 30,
    prioridad: 'media',
    motivo: 'Cobertura 12/30',
  }, { cantidad: 1 })

  assert.equal(candidatas.length, 1)
  assert.equal(candidatas[0].tipoPlato, 'Cena')
  assert.equal(candidatas[0].objetivos.includes('perdida_grasa'), true)
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
      { nombre: 'mango', alimentoId: 'ok-mango', alimentoNombre: 'Mango', cantidadGramos: 120, rolIngrediente: 'fruta_complemento' },
      { nombre: 'arroz glutinoso', cantidadGramos: 90, rolIngrediente: 'carbohidrato_base' },
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
      { nombre: 'mango', alimentoId: 'ok-mango', alimentoNombre: 'Mango', cantidadGramos: 120, rolIngrediente: 'fruta_complemento' },
      { nombre: 'arroz glutinoso', alimentoId: 'bad-chip', alimentoNombre: 'Chips de patata sabor arroz', cantidadGramos: 90, rolIngrediente: 'carbohidrato_base' },
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

function testMatcherRejectsMissingFood() {
  const receta = generarCandidatasDesdeHueco({
    objetivo: 'rendimiento',
    deporte: 'running',
    momento: 'tapering',
    actuales: 5,
    minimo: 12,
    prioridad: 'alta',
    motivo: 'Cobertura 5/12',
  }, { cantidad: 1 })[0]

  const resultado = resolverIngredientesCandidata(receta, [{ id: '1', nombre: 'arroz blanco' }])
  assert.equal(resultado.ok, false)
  assert.equal(resultado.errores.length > 0, true)
}

function testMatcherResolvesExactNormalizedFood() {
  const receta = generarCandidatasDesdeHueco({
    objetivo: 'rendimiento',
    deporte: 'running',
    momento: 'tapering',
    actuales: 5,
    minimo: 12,
    prioridad: 'alta',
    motivo: 'Cobertura 5/12',
  }, { cantidad: 1 })[0]

  const resultado = resolverIngredientesCandidata(receta, [
    { id: '1', nombre: 'Arroz blanco' },
    { id: '2', nombre: 'Pechuga de pollo' },
    { id: '3', nombre: 'Calabacín' },
    { id: '4', nombre: 'Aceite de oliva' },
    { id: '5', nombre: 'Sal' },
  ])

  assert.equal(resultado.ok, true)
  assert.equal(resultado.receta.ingredientes.every((ing) => ing.alimentoId && ing.alimentoNombre), true)
}

function testCliDryRunDoesNotApply() {
  const output = execFileSync('npm', [
    'exec',
    '--',
    'tsx',
    'scripts/agente-recetario-pro.ts',
    '--dry-run',
    '--objetivo=rendimiento',
    '--deporte=running',
    '--momento=tapering',
    '--cantidad=2',
  ], { encoding: 'utf8' })

  assert.equal(output.includes('Modo: dry-run'), true)
  assert.equal(output.includes('Insertadas: 0'), true)
  assert.equal(output.includes('en_revision'), true)
}

function testImporterAlwaysUsesReviewState() {
  const receta = generarCandidatasDesdeHueco({
    objetivo: 'rendimiento',
    deporte: 'running',
    momento: 'tapering',
    actuales: 5,
    minimo: 12,
    prioridad: 'alta',
    motivo: 'Cobertura 5/12',
  }, { cantidad: 1 })[0]

  const recetaMatcheada = resolverIngredientesCandidata(receta, [
    { id: '1', nombre: 'Arroz blanco', calorias: 130, proteinas: 2.7, carbohidratos: 28, grasas: 0.3, fibra: 0.4 },
    { id: '2', nombre: 'Pechuga de pollo', calorias: 165, proteinas: 31, carbohidratos: 0, grasas: 3.6, fibra: 0 },
    { id: '3', nombre: 'Calabacín', calorias: 17, proteinas: 1.2, carbohidratos: 3.1, grasas: 0.3, fibra: 1 },
    { id: '4', nombre: 'Aceite de oliva', calorias: 884, proteinas: 0, carbohidratos: 0, grasas: 100, fibra: 0 },
  ]).receta

  const payload = construirPayloadInsercionReceta(recetaMatcheada)
  assert.equal(payload.receta.estado, 'en_revision')
  assert.notEqual(payload.receta.estado, 'aprobada')
  assert.deepEqual(payload.receta.intolerancias, [])
}

function testImporterRejectsUnmatchedIngredients() {
  const receta = generarCandidatasDesdeHueco({
    objetivo: 'rendimiento',
    deporte: 'running',
    momento: 'tapering',
    actuales: 5,
    minimo: 12,
    prioridad: 'alta',
    motivo: 'Cobertura 5/12',
  }, { cantidad: 1 })[0]

  assert.throws(() => construirPayloadInsercionReceta(receta), /sin alimento_id/)
}

function testImporterCalculatesMacrosFromIngredients() {
  const receta = generarCandidatasDesdeHueco({
    objetivo: 'rendimiento',
    deporte: 'running',
    momento: 'tapering',
    actuales: 5,
    minimo: 12,
    prioridad: 'alta',
    motivo: 'Cobertura 5/12',
  }, { cantidad: 1 })[0]

  const recetaMatcheada = resolverIngredientesCandidata(receta, [
    { id: '1', nombre: 'Arroz blanco', calorias: 130, proteinas: 2.7, carbohidratos: 28, grasas: 0.3, fibra: 0.4 },
    { id: '2', nombre: 'Pechuga de pollo', calorias: 165, proteinas: 31, carbohidratos: 0, grasas: 3.6, fibra: 0 },
    { id: '3', nombre: 'Calabacín', calorias: 17, proteinas: 1.2, carbohidratos: 3.1, grasas: 0.3, fibra: 1 },
    { id: '4', nombre: 'Aceite de oliva', calorias: 884, proteinas: 0, carbohidratos: 0, grasas: 100, fibra: 0 },
  ]).receta

  const payload = construirPayloadInsercionReceta(recetaMatcheada)
  assert.equal(payload.receta.kcal > 350, true)
  assert.equal(payload.receta.proteinas > 40, true)
  assert.equal(payload.receta.grasas > 10, true)
}

function recetaMatcheadaParaInsert() {
  const receta = generarCandidatasDesdeHueco({
    objetivo: 'rendimiento',
    deporte: 'running',
    momento: 'tapering',
    actuales: 5,
    minimo: 12,
    prioridad: 'alta',
    motivo: 'Cobertura 5/12',
  }, { cantidad: 1 })[0]

  return resolverIngredientesCandidata(receta, [
    { id: '1', nombre: 'Arroz blanco', calorias: 130, proteinas: 2.7, carbohidratos: 28, grasas: 0.3, fibra: 0.4 },
    { id: '2', nombre: 'Pechuga de pollo', calorias: 165, proteinas: 31, carbohidratos: 0, grasas: 3.6, fibra: 0 },
    { id: '3', nombre: 'Calabacín', calorias: 17, proteinas: 1.2, carbohidratos: 3.1, grasas: 0.3, fibra: 1 },
    { id: '4', nombre: 'Aceite de oliva', calorias: 884, proteinas: 0, carbohidratos: 0, grasas: 100, fibra: 0 },
  ]).receta
}

function fakeSupabase(options: { duplicate?: boolean } = {}) {
  const state = {
    recetas: [] as any[],
    ingredientes: [] as any[],
    deleted: [] as string[],
  }

  return {
    state,
    from(table: string) {
      return {
        select() { return this },
        eq(column: string, value: unknown) {
          if (table === 'recetas' && column === 'nombre' && options.duplicate) {
            return this
          }
          if (table === 'recetas' && column === 'id') {
            state.deleted.push(String(value))
          }
          return this
        },
        in() { return this },
        async limit() {
          return { data: options.duplicate ? [{ id: 'dup', nombre: 'duplicada', estado: 'en_revision' }] : [], error: null }
        },
        insert(payload: any) {
          if (table === 'recetas') {
            const receta = { id: 'receta-1', ...payload }
            state.recetas.push(receta)
            return {
              select() {
                return {
                  async single() {
                    return { data: receta, error: null }
                  },
                }
              },
            }
          }
          state.ingredientes.push(...payload)
          return Promise.resolve({ data: payload, error: null })
        },
        delete() { return this },
      }
    },
  }
}

async function testImporterSkipsDuplicates() {
  const supabase = fakeSupabase({ duplicate: true })
  const resultado = await insertarRecetaEnRevision(supabase as any, recetaMatcheadaParaInsert())

  assert.equal(resultado.estado, 'duplicada')
  assert.equal(supabase.state.recetas.length, 0)
}

async function testImporterInsertsRecipeAndIngredients() {
  const supabase = fakeSupabase()
  const resultado = await insertarRecetaEnRevision(supabase as any, recetaMatcheadaParaInsert())

  assert.equal(resultado.estado, 'insertada')
  assert.equal(resultado.recetaId, 'receta-1')
  assert.equal(supabase.state.recetas[0].estado, 'en_revision')
  assert.equal(supabase.state.ingredientes.length, 4)
  assert.equal(supabase.state.ingredientes.every((ing) => ing.receta_id === 'receta-1'), true)
}

testDefaultsAreConservative()
testCoverageDetectsTaperingGap()
testCoverageDoesNotCreateGapWhenMinimumIsMet()
testGeneratorCreatesSmallDryRunBatch()
testGeneratorDoesNotUseUnsafeCondimentAmounts()
testGeneratorCreatesPreTrainingCandidates()
testGeneratorCreatesFatLossDinnerCandidate()
testValidatorRejectsUnmatchedIngredients()
testValidatorRejectsSuspiciousStickyRiceChipsMatch()
testImagePreparationNeverApproves()
testMatcherRejectsMissingFood()
testMatcherResolvesExactNormalizedFood()
testCliDryRunDoesNotApply()
testImporterAlwaysUsesReviewState()
testImporterRejectsUnmatchedIngredients()
testImporterCalculatesMacrosFromIngredients()

async function main() {
  await testImporterSkipsDuplicates()
  await testImporterInsertsRecipeAndIngredients()
  console.log('agente-recetario-pro.test.ts OK')
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
