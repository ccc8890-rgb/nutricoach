# Agente Recetario Pro Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build `AgenteRecetarioPro` in conservative mode so it can detect recipe coverage gaps, generate controlled candidate recipes, validate them hard, and initially run without writing to the database.

**Architecture:** The first implementation is rule-based and dry-run first. It adds a focused module under `lib/recetas/agente-recetario/`, a CLI script, and tests that prove the agent rejects bad ingredient matches, unsafe gramajes, weak sports timing, and automatic approval.

**Tech Stack:** TypeScript, `tsx`, existing Supabase client helpers, existing recipe quality gate (`lib/recetas/profesional.ts`), existing ingredient roles (`lib/ingredient-roles.ts`), existing image prompt helpers (`lib/recetas/imagen-prompts.ts`).

---

## Conservative Scope

This plan intentionally avoids a large autonomous recipe generator.

The first usable version must:

- Run in `--dry-run` by default.
- Generate only from local templates, not free-form IA.
- Reject any recipe with unmatched ingredients.
- Reject suspicious ingredient pairings before insert.
- Calculate macros from matched ingredients only.
- Never set `estado = 'aprobada'`.
- Never generate final images.
- Produce a clear report that Carlos can review before any `--apply` phase exists.

`--apply` is a later task in this plan and must not be implemented until dry-run tests are passing.

## File Structure

Create:

- `lib/recetas/agente-recetario/types.ts`: shared types, event names, CLI options, recipe candidate contracts.
- `lib/recetas/agente-recetario/coverage.ts`: coverage thresholds and gap selection.
- `lib/recetas/agente-recetario/templates.ts`: small controlled recipe templates for the first dry-run.
- `lib/recetas/agente-recetario/generator.ts`: deterministic candidate generator from templates.
- `lib/recetas/agente-recetario/validator.ts`: hard validation using local rules and `auditarRecetaProfesional`.
- `lib/recetas/agente-recetario/image.ts`: prompt preparation only.
- `lib/recetas/agente-recetario/learning.ts`: JSONL event writer for dry-run logs.
- `scripts/agente-recetario-pro.ts`: CLI entrypoint.
- `scripts/agente-recetario-pro.test.ts`: focused tests for conservative behavior.

Modify only if needed:

- `package.json`: optional script alias after CLI works.

Do not create database migrations in the first two tasks.

---

### Task 1: Shared Types And Safety Defaults

**Files:**
- Create: `lib/recetas/agente-recetario/types.ts`
- Test: `scripts/agente-recetario-pro.test.ts`

- [ ] **Step 1: Write the type/safety test first**

Add a test that imports the safety defaults and proves conservative mode is the default:

```ts
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
```

- [ ] **Step 2: Run the test and verify it fails**

Run:

```bash
npm exec -- tsx scripts/agente-recetario-pro.test.ts
```

Expected: fail because `lib/recetas/agente-recetario/types.ts` does not exist.

- [ ] **Step 3: Create the shared types**

Create `types.ts` with:

```ts
export type RecetaAgenteEstado = 'en_revision' | 'descartada'
export type RecetaAgentePrioridad = 'alta' | 'media' | 'baja'

export type RecetaCoverageGap = {
  objetivo: string
  deporte?: string
  momento?: string
  tipoPlato?: string
  actuales: number
  minimo: number
  prioridad: RecetaAgentePrioridad
  motivo: string
}

export type IngredienteCandidato = {
  nombre: string
  alimentoId?: string
  alimentoNombre?: string
  cantidadGramos: number
  rolIngrediente: string
  esCantidadFija?: boolean
}

export type RecetaCandidata = {
  nombre: string
  descripcion: string
  instrucciones: string[]
  objetivos: string[]
  deportes: string[]
  momentos: string[]
  tipoPlato: string
  digestibilidad?: string
  ingredientes: IngredienteCandidato[]
  macrosCalculados?: {
    kcal: number
    proteinas: number
    carbohidratos: number
    grasas: number
  }
  trazabilidad: {
    plantillaId: string
    motivoGeneracion: string
    modo: 'dry-run' | 'apply'
  }
}

export type ResultadoValidacionAgente = {
  valida: boolean
  estado: RecetaAgenteEstado
  score: number
  errores: string[]
  warnings: string[]
}

export const AGENTE_RECETARIO_DEFAULTS = {
  dryRun: true,
  forceReviewState: 'en_revision',
  allowAutoApproval: false,
  allowUnmatchedIngredients: false,
  allowImageAutoApproval: false,
  minQualityScore: 75,
  maxCandidatesPerRun: 10,
} as const
```

- [ ] **Step 4: Run the test and verify it passes**

Run:

```bash
npm exec -- tsx scripts/agente-recetario-pro.test.ts
```

Expected: `agente-recetario-pro.test.ts OK`.

- [ ] **Step 5: Commit**

```bash
git add lib/recetas/agente-recetario/types.ts scripts/agente-recetario-pro.test.ts
git commit -m "feat: add conservative recipe agent types"
```

---

### Task 2: Coverage Gap Engine

**Files:**
- Create: `lib/recetas/agente-recetario/coverage.ts`
- Modify: `scripts/agente-recetario-pro.test.ts`

- [ ] **Step 1: Add coverage tests**

Extend `scripts/agente-recetario-pro.test.ts`:

```ts
import { detectarHuecosRecetario } from '../lib/recetas/agente-recetario/coverage'

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

testCoverageDetectsTaperingGap()
testCoverageDoesNotCreateGapWhenMinimumIsMet()
```

- [ ] **Step 2: Run the test and verify it fails**

Run:

```bash
npm exec -- tsx scripts/agente-recetario-pro.test.ts
```

Expected: fail because `coverage.ts` does not exist.

- [ ] **Step 3: Implement coverage thresholds**

Create `coverage.ts`:

```ts
import type { RecetaCoverageGap, RecetaAgentePrioridad } from './types'

type CoverageSnapshot = {
  objetivo: string
  deporte?: string
  momento?: string
  tipoPlato?: string
  actuales: number
}

const MINIMOS: Array<Omit<CoverageSnapshot, 'actuales'> & { minimo: number; prioridad: RecetaAgentePrioridad }> = [
  { objetivo: 'rendimiento', deporte: 'running', momento: 'tapering', minimo: 12, prioridad: 'alta' },
  { objetivo: 'rendimiento', deporte: 'running', momento: 'carga_cho', minimo: 15, prioridad: 'alta' },
  { objetivo: 'rendimiento', deporte: 'triatlon', momento: 'carga_cho', minimo: 15, prioridad: 'alta' },
  { objetivo: 'rendimiento', deporte: 'ciclismo', momento: 'carga_cho', minimo: 15, prioridad: 'alta' },
  { objetivo: 'rendimiento', momento: 'pre_entreno', minimo: 30, prioridad: 'alta' },
  { objetivo: 'rendimiento', momento: 'post_entreno', minimo: 30, prioridad: 'alta' },
  { objetivo: 'perdida_grasa', tipoPlato: 'cena', minimo: 30, prioridad: 'media' },
  { objetivo: 'recomposicion', tipoPlato: 'media_manana', minimo: 20, prioridad: 'media' },
]

function coincide(regla: Omit<CoverageSnapshot, 'actuales'>, snap: CoverageSnapshot) {
  return regla.objetivo === snap.objetivo
    && (!regla.deporte || regla.deporte === snap.deporte)
    && (!regla.momento || regla.momento === snap.momento)
    && (!regla.tipoPlato || regla.tipoPlato === snap.tipoPlato)
}

export function detectarHuecosRecetario(snapshot: CoverageSnapshot[]): RecetaCoverageGap[] {
  return MINIMOS.flatMap((regla) => {
    const match = snapshot.find((item) => coincide(regla, item))
    const actuales = match?.actuales ?? 0

    if (actuales >= regla.minimo) return []

    return [{
      objetivo: regla.objetivo,
      deporte: regla.deporte,
      momento: regla.momento,
      tipoPlato: regla.tipoPlato,
      actuales,
      minimo: regla.minimo,
      prioridad: regla.prioridad,
      motivo: `Cobertura ${actuales}/${regla.minimo}`,
    }]
  })
}
```

- [ ] **Step 4: Run the test**

Run:

```bash
npm exec -- tsx scripts/agente-recetario-pro.test.ts
```

Expected: pass.

- [ ] **Step 5: Commit**

```bash
git add lib/recetas/agente-recetario/coverage.ts scripts/agente-recetario-pro.test.ts
git commit -m "feat: detect conservative recipe coverage gaps"
```

---

### Task 3: Controlled Templates And Generator

**Files:**
- Create: `lib/recetas/agente-recetario/templates.ts`
- Create: `lib/recetas/agente-recetario/generator.ts`
- Modify: `scripts/agente-recetario-pro.test.ts`

- [ ] **Step 1: Add generator tests**

Add tests proving the generator is controlled and avoids bad defaults:

```ts
import { generarCandidatasDesdeHueco } from '../lib/recetas/agente-recetario/generator'

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

testGeneratorCreatesSmallDryRunBatch()
testGeneratorDoesNotUseUnsafeCondimentAmounts()
```

- [ ] **Step 2: Run the test and verify it fails**

Run:

```bash
npm exec -- tsx scripts/agente-recetario-pro.test.ts
```

Expected: fail because generator/templates do not exist.

- [ ] **Step 3: Add templates**

Create `templates.ts` with a small initial battery:

```ts
import type { RecetaCandidata } from './types'

type TemplateInput = {
  objetivo: string
  deporte?: string
  momento?: string
}

type TemplateFactory = (input: TemplateInput) => RecetaCandidata

export const PLANTILLAS_RECETARIO_PRO: Array<{ id: string; momentos: string[]; factory: TemplateFactory }> = [
  {
    id: 'tapering-arroz-pollo-calabacin',
    momentos: ['tapering'],
    factory: (input) => ({
      nombre: 'Arroz suave con pollo y calabacin para tapering',
      descripcion: 'Comida digestiva alta en carbohidrato y baja en grasa para los dias previos a competicion.',
      instrucciones: [
        'Cocer el arroz hasta que quede tierno.',
        'Cocinar el pollo a la plancha con poca grasa.',
        'Saltear el calabacin brevemente y montar el plato con sal y aceite medidos.',
      ],
      objetivos: [input.objetivo],
      deportes: input.deporte ? [input.deporte, 'endurance'] : ['endurance'],
      momentos: input.momento ? [input.momento] : ['tapering'],
      tipoPlato: 'comida',
      digestibilidad: 'alta',
      ingredientes: [
        { nombre: 'arroz blanco', cantidadGramos: 95, rolIngrediente: 'carbohidrato_principal' },
        { nombre: 'pechuga de pollo', cantidadGramos: 125, rolIngrediente: 'proteina_principal' },
        { nombre: 'calabacin', cantidadGramos: 100, rolIngrediente: 'verdura_fibra' },
        { nombre: 'aceite de oliva', cantidadGramos: 6, rolIngrediente: 'grasas' },
        { nombre: 'sal', cantidadGramos: 2, rolIngrediente: 'especias_aromaticos', esCantidadFija: true },
      ],
      trazabilidad: {
        plantillaId: 'tapering-arroz-pollo-calabacin',
        motivoGeneracion: 'Hueco de tapering endurance',
        modo: 'dry-run',
      },
    }),
  },
  {
    id: 'carga-cho-pasta-pavo-tomate',
    momentos: ['carga_cho'],
    factory: (input) => ({
      nombre: 'Pasta con pavo y tomate para carga de carbohidratos',
      descripcion: 'Plato alto en carbohidratos con proteina magra y grasa controlada.',
      instrucciones: [
        'Cocer la pasta al dente.',
        'Cocinar el pavo picado sin exceso de aceite.',
        'Mezclar con tomate triturado y ajustar sal.',
      ],
      objetivos: [input.objetivo],
      deportes: input.deporte ? [input.deporte, 'endurance'] : ['endurance'],
      momentos: input.momento ? [input.momento] : ['carga_cho'],
      tipoPlato: 'comida',
      digestibilidad: 'media',
      ingredientes: [
        { nombre: 'pasta', cantidadGramos: 110, rolIngrediente: 'carbohidrato_principal' },
        { nombre: 'pavo', cantidadGramos: 110, rolIngrediente: 'proteina_principal' },
        { nombre: 'tomate triturado', cantidadGramos: 90, rolIngrediente: 'salsas_condimentos' },
        { nombre: 'aceite de oliva', cantidadGramos: 7, rolIngrediente: 'grasas' },
        { nombre: 'sal', cantidadGramos: 2, rolIngrediente: 'especias_aromaticos', esCantidadFija: true },
      ],
      trazabilidad: {
        plantillaId: 'carga-cho-pasta-pavo-tomate',
        motivoGeneracion: 'Hueco de carga de carbohidratos',
        modo: 'dry-run',
      },
    }),
  },
  {
    id: 'post-entreno-yogur-avena-platano',
    momentos: ['post_entreno'],
    factory: (input) => ({
      nombre: 'Bol de yogur, avena y platano post-entreno',
      descripcion: 'Recuperacion simple con carbohidrato, proteina y baja complejidad culinaria.',
      instrucciones: [
        'Mezclar yogur y avena.',
        'Anadir platano laminado.',
        'Servir frio o dejar reposar diez minutos.',
      ],
      objetivos: [input.objetivo],
      deportes: input.deporte ? [input.deporte] : ['general'],
      momentos: input.momento ? [input.momento] : ['post_entreno'],
      tipoPlato: 'merienda',
      digestibilidad: 'media',
      ingredientes: [
        { nombre: 'yogur griego natural', cantidadGramos: 180, rolIngrediente: 'proteina_principal' },
        { nombre: 'avena', cantidadGramos: 45, rolIngrediente: 'carbohidrato_principal' },
        { nombre: 'platano', cantidadGramos: 120, rolIngrediente: 'frutas' },
        { nombre: 'miel', cantidadGramos: 8, rolIngrediente: 'salsas_condimentos' },
      ],
      trazabilidad: {
        plantillaId: 'post-entreno-yogur-avena-platano',
        motivoGeneracion: 'Hueco de post-entreno',
        modo: 'dry-run',
      },
    }),
  },
]
```

- [ ] **Step 4: Add generator**

Create `generator.ts`:

```ts
import type { RecetaCandidata, RecetaCoverageGap } from './types'
import { AGENTE_RECETARIO_DEFAULTS } from './types'
import { PLANTILLAS_RECETARIO_PRO } from './templates'

export function generarCandidatasDesdeHueco(
  gap: RecetaCoverageGap,
  options: { cantidad?: number } = {},
): RecetaCandidata[] {
  const cantidad = Math.min(
    options.cantidad ?? 3,
    AGENTE_RECETARIO_DEFAULTS.maxCandidatesPerRun,
  )

  const compatibles = PLANTILLAS_RECETARIO_PRO.filter((template) =>
    !gap.momento || template.momentos.includes(gap.momento)
  )

  return compatibles
    .slice(0, cantidad)
    .map((template) => template.factory({
      objetivo: gap.objetivo,
      deporte: gap.deporte,
      momento: gap.momento,
    }))
}
```

- [ ] **Step 5: Run the test**

Run:

```bash
npm exec -- tsx scripts/agente-recetario-pro.test.ts
```

Expected: pass.

- [ ] **Step 6: Commit**

```bash
git add lib/recetas/agente-recetario/templates.ts lib/recetas/agente-recetario/generator.ts scripts/agente-recetario-pro.test.ts
git commit -m "feat: generate controlled recipe candidates"
```

---

### Task 4: Hard Validator Before Database Writes

**Files:**
- Create: `lib/recetas/agente-recetario/validator.ts`
- Modify: `scripts/agente-recetario-pro.test.ts`

- [ ] **Step 1: Add validator tests**

Add tests for the exact failure class Carlos saw:

```ts
import { validarCandidataConservadora } from '../lib/recetas/agente-recetario/validator'
import type { RecetaCandidata } from '../lib/recetas/agente-recetario/types'

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

testValidatorRejectsUnmatchedIngredients()
testValidatorRejectsSuspiciousStickyRiceChipsMatch()
```

- [ ] **Step 2: Run the test and verify it fails**

Run:

```bash
npm exec -- tsx scripts/agente-recetario-pro.test.ts
```

Expected: fail because validator does not exist.

- [ ] **Step 3: Implement the conservative validator**

Create `validator.ts`:

```ts
import type { RecetaCandidata, ResultadoValidacionAgente } from './types'
import { AGENTE_RECETARIO_DEFAULTS } from './types'

const MATCHES_SOSPECHOSOS: Array<{ ingrediente: RegExp; alimento: RegExp; motivo: string }> = [
  { ingrediente: /arroz|sticky|glutinoso/i, alimento: /chip|patata frita|cereal chocolate/i, motivo: 'arroz vinculado a snack/cereal' },
  { ingrediente: /nata|crema/i, alimento: /chip|aperitivo|patata frita/i, motivo: 'nata vinculada a aperitivo' },
  { ingrediente: /cebolla roja|cebolla morada/i, alimento: /cebolla frita|crujiente/i, motivo: 'cebolla fresca vinculada a cebolla frita' },
  { ingrediente: /tortilla|wrap|pita/i, alimento: /^huevo$|huevo/i, motivo: 'wrap/tortilla vinculado a huevo' },
]

const LIMITES_POR_ROL: Record<string, { min: number; max: number }> = {
  especias_aromaticos: { min: 0.2, max: 15 },
  salsas_condimentos: { min: 2, max: 120 },
  grasas: { min: 1, max: 35 },
  proteina_principal: { min: 40, max: 260 },
  carbohidrato_principal: { min: 25, max: 180 },
  verdura_fibra: { min: 20, max: 300 },
  frutas: { min: 30, max: 250 },
}

export function validarCandidataConservadora(receta: RecetaCandidata): ResultadoValidacionAgente {
  const errores: string[] = []
  const warnings: string[] = []

  if (!receta.nombre.trim()) errores.push('nombre vacio')
  if (receta.instrucciones.length < 2) errores.push('instrucciones insuficientes')
  if (receta.ingredientes.length < 3) errores.push('menos de 3 ingredientes')

  for (const ingrediente of receta.ingredientes) {
    if (!ingrediente.alimentoId || !ingrediente.alimentoNombre) {
      errores.push(`ingrediente sin alimento vinculado: ${ingrediente.nombre}`)
    }

    if (ingrediente.cantidadGramos <= 0) {
      errores.push(`cantidad invalida: ${ingrediente.nombre}`)
    }

    const limite = LIMITES_POR_ROL[ingrediente.rolIngrediente]
    if (limite && (ingrediente.cantidadGramos < limite.min || ingrediente.cantidadGramos > limite.max)) {
      errores.push(`cantidad fuera de rango para ${ingrediente.rolIngrediente}: ${ingrediente.nombre} ${ingrediente.cantidadGramos}g`)
    }

    for (const regla of MATCHES_SOSPECHOSOS) {
      if (regla.ingrediente.test(ingrediente.nombre) && regla.alimento.test(ingrediente.alimentoNombre ?? '')) {
        errores.push(`match sospechoso: ${ingrediente.nombre} -> ${ingrediente.alimentoNombre} (${regla.motivo})`)
      }
    }
  }

  return {
    valida: errores.length === 0,
    estado: errores.length === 0 ? AGENTE_RECETARIO_DEFAULTS.forceReviewState : 'descartada',
    score: errores.length === 0 ? AGENTE_RECETARIO_DEFAULTS.minQualityScore : 0,
    errores,
    warnings,
  }
}
```

- [ ] **Step 4: Run the test**

Run:

```bash
npm exec -- tsx scripts/agente-recetario-pro.test.ts
```

Expected: pass.

- [ ] **Step 5: Commit**

```bash
git add lib/recetas/agente-recetario/validator.ts scripts/agente-recetario-pro.test.ts
git commit -m "feat: validate recipe agent candidates conservatively"
```

---

### Task 5: Image Prompt Preparation Only

**Files:**
- Create: `lib/recetas/agente-recetario/image.ts`
- Modify: `scripts/agente-recetario-pro.test.ts`

- [ ] **Step 1: Add image safety test**

Add:

```ts
import { prepararImagenPendiente } from '../lib/recetas/agente-recetario/image'

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

testImagePreparationNeverApproves()
```

- [ ] **Step 2: Implement image preparation**

Create `image.ts`:

```ts
import type { RecetaCandidata } from './types'

export type ImagenPendienteAgente = {
  estado: 'pendiente_revision'
  aprobada: false
  prompt: string
  fuente?: string
}

export function prepararImagenPendiente(receta: RecetaCandidata): ImagenPendienteAgente {
  const ingredientesPrincipales = receta.ingredientes
    .filter((ingrediente) => !['especias_aromaticos', 'salsas_condimentos'].includes(ingrediente.rolIngrediente))
    .slice(0, 4)
    .map((ingrediente) => ingrediente.nombre)
    .join(', ')

  return {
    estado: 'pendiente_revision',
    aprobada: false,
    prompt: `Fotografia culinaria realista de ${receta.nombre}. Ingredientes visibles: ${ingredientesPrincipales}. Luz natural, plato reconocible, composicion limpia, sin texto, sin manos, sin elementos que contradigan la receta.`,
  }
}
```

- [ ] **Step 3: Run the test**

Run:

```bash
npm exec -- tsx scripts/agente-recetario-pro.test.ts
```

Expected: pass.

- [ ] **Step 4: Commit**

```bash
git add lib/recetas/agente-recetario/image.ts scripts/agente-recetario-pro.test.ts
git commit -m "feat: prepare recipe agent image prompts"
```

---

### Task 6: Dry-Run CLI

**Files:**
- Create: `scripts/agente-recetario-pro.ts`
- Modify: `scripts/agente-recetario-pro.test.ts`

- [ ] **Step 1: Add CLI smoke test**

Add a test using `node:child_process`:

```ts
import { execFileSync } from 'node:child_process'

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

testCliDryRunDoesNotApply()
```

- [ ] **Step 2: Implement CLI without database writes**

Create `scripts/agente-recetario-pro.ts`:

```ts
import { detectarHuecosRecetario } from '../lib/recetas/agente-recetario/coverage'
import { generarCandidatasDesdeHueco } from '../lib/recetas/agente-recetario/generator'
import { prepararImagenPendiente } from '../lib/recetas/agente-recetario/image'
import { validarCandidataConservadora } from '../lib/recetas/agente-recetario/validator'

function arg(name: string, fallback = '') {
  const found = process.argv.find((item) => item.startsWith(`--${name}=`))
  return found ? found.split('=').slice(1).join('=') : fallback
}

const objetivo = arg('objetivo', 'rendimiento')
const deporte = arg('deporte', 'running')
const momento = arg('momento', 'tapering')
const cantidad = Number(arg('cantidad', '3'))
const apply = process.argv.includes('--apply')

if (apply) {
  console.error('ERROR: --apply no esta implementado en la fase dry-run conservadora.')
  process.exit(1)
}

const gaps = detectarHuecosRecetario([{ objetivo, deporte, momento, actuales: 0 }])
const gap = gaps[0]

if (!gap) {
  console.log('AgenteRecetarioPro')
  console.log('Modo: dry-run')
  console.log('Sin huecos detectados para los filtros indicados.')
  process.exit(0)
}

const candidatas = generarCandidatasDesdeHueco(gap, { cantidad })
const validadas = candidatas.map((receta) => ({
  receta,
  validacion: validarCandidataConservadora(receta),
  imagen: prepararImagenPendiente(receta),
}))

console.log('AgenteRecetarioPro')
console.log('Modo: dry-run')
console.log(`Objetivo: ${objetivo}`)
console.log(`Deporte: ${deporte}`)
console.log(`Momento: ${momento}`)
console.log(`Hueco: ${gap.motivo}`)
console.log(`Generadas: ${candidatas.length}`)
console.log(`Validas para en_revision: ${validadas.filter((item) => item.validacion.valida).length}`)
console.log(`Descartadas: ${validadas.filter((item) => !item.validacion.valida).length}`)
console.log('Insertadas: 0')

for (const item of validadas) {
  console.log(`- ${item.receta.nombre} -> ${item.validacion.estado}`)
}
```

- [ ] **Step 3: Run CLI manually**

Run:

```bash
npm exec -- tsx scripts/agente-recetario-pro.ts --dry-run --objetivo=rendimiento --deporte=running --momento=tapering --cantidad=2
```

Expected:

```text
AgenteRecetarioPro
Modo: dry-run
...
Insertadas: 0
```

- [ ] **Step 4: Run tests**

Run:

```bash
npm exec -- tsx scripts/agente-recetario-pro.test.ts
```

Expected: pass.

- [ ] **Step 5: Commit**

```bash
git add scripts/agente-recetario-pro.ts scripts/agente-recetario-pro.test.ts
git commit -m "feat: add dry run recipe agent cli"
```

---

### Task 7: Ingredient Resolution Against Real Database

**Files:**
- Modify: `lib/recetas/agente-recetario/generator.ts`
- Create: `lib/recetas/agente-recetario/matcher.ts`
- Modify: `scripts/agente-recetario-pro.ts`
- Modify: `scripts/agente-recetario-pro.test.ts`

- [ ] **Step 1: Add matcher contract test with in-memory foods**

Add:

```ts
import { resolverIngredientesCandidata } from '../lib/recetas/agente-recetario/matcher'

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

testMatcherRejectsMissingFood()
```

- [ ] **Step 2: Implement matcher as pure function first**

Create `matcher.ts`:

```ts
import type { RecetaCandidata } from './types'

export type AlimentoLigero = {
  id: string
  nombre: string
}

export type ResultadoMatcher = {
  ok: boolean
  receta: RecetaCandidata
  errores: string[]
}

function normalizar(texto: string) {
  return texto.toLowerCase().normalize('NFD').replace(/\p{Diacritic}/gu, '').trim()
}

export function resolverIngredientesCandidata(
  receta: RecetaCandidata,
  alimentos: AlimentoLigero[],
): ResultadoMatcher {
  const errores: string[] = []
  const index = new Map(alimentos.map((alimento) => [normalizar(alimento.nombre), alimento]))

  const ingredientes = receta.ingredientes.map((ingrediente) => {
    const alimento = index.get(normalizar(ingrediente.nombre))
    if (!alimento) {
      errores.push(`sin match exacto: ${ingrediente.nombre}`)
      return ingrediente
    }

    return {
      ...ingrediente,
      alimentoId: alimento.id,
      alimentoNombre: alimento.nombre,
    }
  })

  return {
    ok: errores.length === 0,
    receta: { ...receta, ingredientes },
    errores,
  }
}
```

- [ ] **Step 3: Integrate database fetch only in CLI**

In the CLI, add a dedicated function that fetches required food names from Supabase, then calls the pure matcher. Keep DB access out of the matcher so tests stay fast.

- [ ] **Step 4: Run tests and TypeScript**

Run:

```bash
npm exec -- tsx scripts/agente-recetario-pro.test.ts
npm exec -- tsc --noEmit
```

Expected: both pass.

- [ ] **Step 5: Commit**

```bash
git add lib/recetas/agente-recetario/matcher.ts lib/recetas/agente-recetario/generator.ts scripts/agente-recetario-pro.ts scripts/agente-recetario-pro.test.ts
git commit -m "feat: resolve recipe agent ingredients conservatively"
```

---

### Task 8: Apply Mode Only After Dry-Run Is Clean

**Files:**
- Create: `lib/recetas/agente-recetario/importer.ts`
- Modify: `scripts/agente-recetario-pro.ts`
- Modify: `scripts/agente-recetario-pro.test.ts`

- [ ] **Step 1: Add importer tests that forbid approval**

Add a pure payload builder test:

```ts
import { construirPayloadInsercionReceta } from '../lib/recetas/agente-recetario/importer'

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

  const payload = construirPayloadInsercionReceta(receta)
  assert.equal(payload.receta.estado, 'en_revision')
  assert.notEqual(payload.receta.estado, 'aprobada')
}

testImporterAlwaysUsesReviewState()
```

- [ ] **Step 2: Implement payload builder before real DB insert**

Create `importer.ts` with a pure builder first. Do not write DB in the first commit:

```ts
import type { RecetaCandidata } from './types'

export function construirPayloadInsercionReceta(receta: RecetaCandidata) {
  return {
    receta: {
      nombre: receta.nombre,
      descripcion: receta.descripcion,
      instrucciones: receta.instrucciones.join('\n'),
      estado: 'en_revision' as const,
      objetivos: receta.objetivos,
      deportes: receta.deportes,
      momentos: receta.momentos,
      tipo_plato: receta.tipoPlato,
      digestibilidad: receta.digestibilidad,
      planning_roles: receta.trazabilidad,
    },
    ingredientes: receta.ingredientes.map((ingrediente) => ({
      alimento_id: ingrediente.alimentoId,
      cantidad_gramos: ingrediente.cantidadGramos,
      rol_ingrediente: ingrediente.rolIngrediente,
      es_cantidad_fija: ingrediente.esCantidadFija ?? false,
    })),
  }
}
```

- [ ] **Step 3: Add real DB insert only after payload test passes**

Add DB insert in a separate function `insertarRecetaEnRevision()` that receives a Supabase client and the payload. It must return an error if any ingredient lacks `alimento_id`.

- [ ] **Step 4: Run full verification**

Run:

```bash
npm exec -- tsx scripts/agente-recetario-pro.test.ts
npm exec -- tsc --noEmit
npm run build
```

Expected: all pass.

- [ ] **Step 5: Commit**

```bash
git add lib/recetas/agente-recetario/importer.ts scripts/agente-recetario-pro.ts scripts/agente-recetario-pro.test.ts
git commit -m "feat: stage recipe agent review inserts"
```

---

### Task 9: Final Guardrail Audit

**Files:**
- Modify only files from previous tasks if verification exposes issues.

- [ ] **Step 1: Run dry-run examples**

Run:

```bash
npm exec -- tsx scripts/agente-recetario-pro.ts --dry-run --objetivo=rendimiento --deporte=running --momento=tapering --cantidad=5
npm exec -- tsx scripts/agente-recetario-pro.ts --dry-run --objetivo=rendimiento --deporte=triatlon --momento=carga_cho --cantidad=5
npm exec -- tsx scripts/agente-recetario-pro.ts --dry-run --objetivo=rendimiento --momento=post_entreno --cantidad=5
```

Expected: all print `Insertadas: 0` and no recipe status is `aprobada`.

- [ ] **Step 2: Run quality and build checks**

Run:

```bash
npm exec -- tsx scripts/agente-recetario-pro.test.ts
npm exec -- tsc --noEmit
npm run build
```

Expected: all pass.

- [ ] **Step 3: Inspect generated recipe names and ingredients manually**

Check dry-run output for:

- No chips/snacks in dessert or rice templates.
- No 100 g salt/garlic/oil/sauce defaults.
- No peri-entreno meals high in fat by template design.
- No generated recipe claims final image approval.

- [ ] **Step 4: Commit fixes if needed**

Only commit if Step 3 reveals defects:

```bash
git add lib/recetas/agente-recetario scripts/agente-recetario-pro.ts scripts/agente-recetario-pro.test.ts
git commit -m "fix: tighten recipe agent guardrails"
```

---

## Execution Handoff

Recommended execution path:

1. Implement Tasks 1-6 only.
2. Run dry-run examples.
3. Review the generated candidates manually.
4. Only then implement Tasks 7-8 for real ingredient resolution and eventual `--apply`.

This keeps the agent conservative while we polish the exact failure modes before it can create many records.
