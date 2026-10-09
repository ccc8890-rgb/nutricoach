# Bloques configurables de sesión Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Permitir que la IA proponga y el coach configure bloques opcionales por ejercicio, mostrándolos de forma coherente en todo el portal cliente y eliminando la modalidad duplicada de los títulos.

**Architecture:** `sesion_ejercicios.bloque` será la fuente de verdad, con un módulo puro que normaliza, ordena, agrupa y etiqueta. El editor coach actualizará el bloque mediante una API autenticada que verifica propiedad; generador y consumidores cliente usarán el mismo contrato. Los registros antiguos y valores desconocidos caerán en `principal`.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript, Supabase/PostgreSQL, Tailwind/CSS, `tsx` + `node:assert`, ESLint.

**Spec:** `docs/superpowers/specs/2026-10-09-bloques-sesion-entrenamiento-design.md`

## Global Constraints

- Valores permitidos: `calentamiento`, `movilidad`, `pliometria`, `principal`, `accesorios`, `vuelta_calma`.
- El valor por defecto y fallback siempre es `principal`.
- Solo se muestran bloques con ejercicios; no se renderizan secciones vacías.
- La numeración del cliente es continua durante toda la sesión.
- La IA propone bloques; el coach puede cambiarlos por ejercicio y sesión.
- El cambio del coach debe verificar en servidor que el plan pertenece al usuario autenticado.
- Los títulos se limpian solo en presentación; no se reescriben nombres almacenados.
- No se añaden dependencias nuevas ni drag-and-drop entre bloques en esta versión.

## Review Focus

- `bloque` nulo, ausente o desconocido debe convertirse en `principal`, cubierto en Task 1.
- Un coach no puede modificar un ejercicio de un plan ajeno, cubierto en Task 2.
- Una sesión sin bloques nuevos debe verse exactamente como un solo bloque principal y conservar todos sus ejercicios, cubierto en Tasks 1 y 5.
- Un título con `Carrera` en mitad del nombre no debe truncarse, cubierto en Task 1.
- Cambiar el bloque no debe romper orden, checklist ni avance de la ejecución móvil, cubierto en Tasks 3, 5 y 6.

---

### Task 1: Contrato de bloques, limpieza de títulos y migración

**Files:**
- Create: `lib/training/session-blocks.ts`
- Create: `scripts/session-blocks.test.ts`
- Modify: `lib/training/session-type-presentation.ts`
- Modify: `scripts/session-type-presentation.test.ts`
- Create: `supabase/migrations/20261009180500_add_bloque_sesion_ejercicios.sql`

**Interfaces:**
- Produces: `TipoBloqueSesion`, `BLOQUES_SESION`, `normalizarBloqueSesion(value)`, `etiquetaBloqueSesion(tipo)`, `agruparEjerciciosPorBloque(items)`.
- Produces: `tituloSesionSinModalidad(nombre, tipoSesion)` in `session-type-presentation.ts`.
- Consumes: no application interfaces.

- [ ] **Step 1: Write the failing block-domain test**

```ts
import assert from 'node:assert/strict'
import {
  agruparEjerciciosPorBloque,
  etiquetaBloqueSesion,
  normalizarBloqueSesion,
} from '../lib/training/session-blocks'

assert.equal(normalizarBloqueSesion(null), 'principal')
assert.equal(normalizarBloqueSesion('desconocido'), 'principal')
assert.equal(normalizarBloqueSesion('pliometria'), 'pliometria')
assert.equal(etiquetaBloqueSesion('vuelta_calma'), 'VUELTA A LA CALMA')

const grupos = agruparEjerciciosPorBloque([
  { id: 'p', orden: 2, bloque: 'principal' },
  { id: 'c', orden: 1, bloque: 'calentamiento' },
  { id: 'legacy', orden: 3, bloque: null },
])
assert.deepEqual(grupos.map(g => [g.bloque, g.items.map(x => x.id)]), [
  ['calentamiento', ['c']],
  ['principal', ['p', 'legacy']],
])
```

- [ ] **Step 2: Extend the title test before implementation**

```ts
import { etiquetaTipoSesion, tituloSesionSinModalidad } from '../lib/training/session-type-presentation'

assert.equal(tituloSesionSinModalidad('Híbrida: SkiErg + fuerza', 'hibrido'), 'SkiErg + fuerza')
assert.equal(tituloSesionSinModalidad('Carrera — Series cortas', 'carrera'), 'Series cortas')
assert.equal(tituloSesionSinModalidad('Mixta: Fuerza + carrera', 'mixto'), 'Fuerza + carrera')
assert.equal(tituloSesionSinModalidad('Carrera + SkiErg combinado', 'hibrido'), 'Carrera + SkiErg combinado')
```

- [ ] **Step 3: Run both tests and verify RED**

Run: `npx tsx scripts/session-blocks.test.ts && npx tsx scripts/session-type-presentation.test.ts`

Expected: FAIL because `session-blocks.ts` and `tituloSesionSinModalidad` do not exist.

- [ ] **Step 4: Implement the pure domain module**

```ts
export const BLOQUES_SESION = [
  'calentamiento', 'movilidad', 'pliometria',
  'principal', 'accesorios', 'vuelta_calma',
] as const

export type TipoBloqueSesion = typeof BLOQUES_SESION[number]

const LABELS: Record<TipoBloqueSesion, string> = {
  calentamiento: 'CALENTAMIENTO',
  movilidad: 'MOVILIDAD / ACTIVACIÓN',
  pliometria: 'PLIOMETRÍA',
  principal: 'BLOQUE PRINCIPAL',
  accesorios: 'ACCESORIOS',
  vuelta_calma: 'VUELTA A LA CALMA',
}

export function normalizarBloqueSesion(value: unknown): TipoBloqueSesion {
  return typeof value === 'string' && BLOQUES_SESION.includes(value as TipoBloqueSesion)
    ? value as TipoBloqueSesion
    : 'principal'
}

export function etiquetaBloqueSesion(tipo: TipoBloqueSesion) {
  return LABELS[tipo]
}

export function agruparEjerciciosPorBloque<T extends { orden: number; bloque?: unknown }>(items: T[]) {
  return BLOQUES_SESION.flatMap(bloque => {
    const agrupados = items
      .filter(item => normalizarBloqueSesion(item.bloque) === bloque)
      .sort((a, b) => a.orden - b.orden)
    return agrupados.length ? [{ bloque, items: agrupados }] : []
  })
}
```

- [ ] **Step 5: Implement conservative title cleanup**

Add to `session-type-presentation.ts` a prefix map anchored to the beginning. Accept `:`, `-`, `–` or `—` only when the prefix matches `tipoSesion`; return the trimmed original if cleanup would produce an empty string.

```ts
export function tituloSesionSinModalidad(nombre: string, tipo: TipoSesion) {
  const prefijo = tipo === 'hibrido' ? 'h(?:í|i)brid[oa]' : tipo === 'carrera' ? 'carrera' : 'mixt[oa]'
  const limpio = nombre.replace(new RegExp(`^\\s*${prefijo}\\s*[:\\-\\u2013\\u2014]\\s*`, 'i'), '').trim()
  return limpio || nombre.trim()
}
```

- [ ] **Step 6: Create the backward-compatible SQL migration**

```sql
alter table public.sesion_ejercicios
  add column if not exists bloque text not null default 'principal';

alter table public.sesion_ejercicios
  drop constraint if exists sesion_ejercicios_bloque_check;

alter table public.sesion_ejercicios
  add constraint sesion_ejercicios_bloque_check
  check (bloque in ('calentamiento', 'movilidad', 'pliometria', 'principal', 'accesorios', 'vuelta_calma'));

comment on column public.sesion_ejercicios.bloque is
  'Bloque funcional del ejercicio dentro de la sesión; principal mantiene compatibilidad con planes anteriores.';
```

- [ ] **Step 7: Run tests and verify GREEN**

Run: `npx tsx scripts/session-blocks.test.ts && npx tsx scripts/session-type-presentation.test.ts`

Expected: both scripts print their success message and exit 0.

- [ ] **Step 8: Commit Task 1**

```bash
git add lib/training/session-blocks.ts lib/training/session-type-presentation.ts scripts/session-blocks.test.ts scripts/session-type-presentation.test.ts supabase/migrations/20261009180500_add_bloque_sesion_ejercicios.sql
git commit -m "feat: define bloques de sesiones de entrenamiento"
```

### Task 2: API segura para actualizar el bloque desde coach

**Files:**
- Create: `app/api/entrenos/sesion-ejercicio/[id]/bloque/route.ts`
- Create: `lib/training/session-block-update.ts`
- Create: `scripts/session-block-update.test.ts`

**Interfaces:**
- Consumes: `normalizarBloqueSesion(value)` and `TipoBloqueSesion` from Task 1.
- Produces: `PATCH /api/entrenos/sesion-ejercicio/:id/bloque` with body `{ bloque }` and response `{ ok: true, bloque }`.
- Produces: `resolverActualizacionBloque(input)` pure decision helper for validation/authorization tests.

- [ ] **Step 1: Write the failing authorization decision test**

```ts
import assert from 'node:assert/strict'
import { resolverActualizacionBloque } from '../lib/training/session-block-update'

assert.deepEqual(resolverActualizacionBloque({ solicitado: 'movilidad', coachId: 'a', propietarioId: 'a' }), {
  ok: true, bloque: 'movilidad',
})
assert.deepEqual(resolverActualizacionBloque({ solicitado: 'otro', coachId: 'a', propietarioId: 'a' }), {
  ok: false, status: 400, error: 'Bloque no válido',
})
assert.deepEqual(resolverActualizacionBloque({ solicitado: 'principal', coachId: 'a', propietarioId: 'b' }), {
  ok: false, status: 403, error: 'Sin acceso',
})
```

- [ ] **Step 2: Run the test and verify RED**

Run: `npx tsx scripts/session-block-update.test.ts`

Expected: FAIL because `session-block-update.ts` does not exist.

- [ ] **Step 3: Implement the pure decision helper**

Validate strictly with `BLOQUES_SESION.includes`; do not silently normalize invalid coach input. Return the exact discriminated union asserted above.

- [ ] **Step 4: Implement the authenticated PATCH route**

The route must:

1. call `createApiSupabase(request).auth.getUser()` and return 401 without user;
2. load the target through `sesion_ejercicios -> sesiones_entrenamiento -> planes_entrenamiento(coach_id)` using `createServiceSupabase()`;
3. return 404 if the relation is absent;
4. call `resolverActualizacionBloque` with authenticated user and plan owner;
5. update only the resolved exercise ID and return the persisted block.

Use a select shaped like:

```ts
const { data: target } = await admin
  .from('sesion_ejercicios')
  .select('id, sesion:sesiones_entrenamiento(plan:planes_entrenamiento(coach_id))')
  .eq('id', id)
  .maybeSingle()
```

- [ ] **Step 5: Run focused tests and lint**

Run: `npx tsx scripts/session-block-update.test.ts`

Run: `npx eslint app/api/entrenos/sesion-ejercicio/'[id]'/bloque/route.ts lib/training/session-block-update.ts`

Expected: test passes; ESLint exits 0.

- [ ] **Step 6: Commit Task 2**

```bash
git add app/api/entrenos/sesion-ejercicio/'[id]'/bloque/route.ts lib/training/session-block-update.ts scripts/session-block-update.test.ts
git commit -m "feat: protege edicion de bloques de entreno"
```

### Task 3: Agrupación y selector de bloque en el editor coach

**Files:**
- Modify: `app/api/entrenos/[id]/route.ts`
- Modify: `app/entrenos/[id]/page.tsx`
- Modify: `components/training/PlanTimeline.tsx`
- Create: `components/training/ExerciseBlockSelect.tsx`
- Create: `lib/training/plan-editor-blocks.ts`
- Create: `scripts/plan-editor-blocks.test.ts`

**Interfaces:**
- Consumes: API PATCH from Task 2 and `agruparEjerciciosPorBloque`, `BLOQUES_SESION`, `etiquetaBloqueSesion` from Task 1.
- Produces: `EjercicioTimeline.bloque: TipoBloqueSesion`, `crearGruposEditorSesion(items)` and `onUpdateBloque(id, bloque)`.

- [ ] **Step 1: Write the failing editor grouping test**

```ts
import assert from 'node:assert/strict'
import { combinarOrdenBloque, crearGruposEditorSesion } from '../lib/training/plan-editor-blocks'

const grupos = crearGruposEditorSesion([
  { id: 'principal-2', orden: 4, bloque: 'principal' },
  { id: 'calentamiento', orden: 1, bloque: 'calentamiento' },
  { id: 'principal-1', orden: 2, bloque: 'principal' },
])

assert.deepEqual(grupos.map(g => g.label), ['CALENTAMIENTO', 'BLOQUE PRINCIPAL'])
assert.deepEqual(grupos[1].items.map(item => item.id), ['principal-1', 'principal-2'])

const reordenados = combinarOrdenBloque(
  [
    { id: 'warm', orden: 1, bloque: 'calentamiento' },
    { id: 'main-a', orden: 2, bloque: 'principal' },
    { id: 'main-b', orden: 3, bloque: 'principal' },
  ],
  'principal',
  ['main-b', 'main-a'],
)
assert.deepEqual(reordenados.map(item => item.id), ['warm', 'main-b', 'main-a'])
```

Run: `npx tsx scripts/plan-editor-blocks.test.ts`

Expected: FAIL because `plan-editor-blocks.ts` does not exist.

- [ ] **Step 2: Implement the editor view model**

```ts
import {
  agruparEjerciciosPorBloque,
  etiquetaBloqueSesion,
  normalizarBloqueSesion,
  type TipoBloqueSesion,
} from './session-blocks'

export function crearGruposEditorSesion<T extends { orden: number; bloque?: unknown }>(items: T[]) {
  return agruparEjerciciosPorBloque(items).map(grupo => ({
    ...grupo,
    label: etiquetaBloqueSesion(grupo.bloque),
  }))
}

export function combinarOrdenBloque<T extends { id: string; orden: number; bloque?: unknown }>(
  items: T[],
  bloque: TipoBloqueSesion,
  idsOrdenados: string[],
) {
  const porId = new Map(items.map(item => [item.id, item]))
  const sustitutos = idsOrdenados.map(id => porId.get(id)).filter((item): item is T => Boolean(item))
  let cursor = 0
  return [...items]
    .sort((a, b) => a.orden - b.orden)
    .map(item => normalizarBloqueSesion(item.bloque) === bloque ? sustitutos[cursor++] : item)
    .map((item, orden) => ({ ...item, orden }))
}
```

- [ ] **Step 3: Request and map `bloque` in plan data**

Add `bloque` to `PLAN_EDITOR_SESIONES_SELECT`, `RawEjercicio`, `EjercicioTimeline`, and the mapper in `app/entrenos/[id]/page.tsx`. Normalize at the mapper boundary.

- [ ] **Step 4: Add the compact selector component**

`ExerciseBlockSelect` receives:

```ts
interface Props {
  value: TipoBloqueSesion
  disabled?: boolean
  onChange: (value: TipoBloqueSesion) => void
}
```

Render a labelled native `<select>` using all `BLOQUES_SESION` options and `etiquetaBloqueSesion`. Keep typography compact and consistent with the editor; include `aria-label="Bloque del ejercicio"`.

- [ ] **Step 5: Replace direct Supabase mutation with the secure API call**

Add `handleUpdateBloque` in `app/entrenos/[id]/page.tsx`. It must update local state optimistically, call the PATCH route, restore the previous value if the request fails, and write the response message into a new `blockError: string | null` inline alert above `PlanTimeline`.

- [ ] **Step 6: Group cards by populated block in `PlanTimeline`**

For each session, iterate `crearGruposEditorSesion(sesion.ejercicios)`, render a monospaced uppercase header, then a `DndContext`/`SortableContext` for that block. Pass `ExerciseBlockSelect` into each card. On drag end, call `combinarOrdenBloque` with the complete session array and persist the resulting complete ID order; never send only the active group to the existing `handleReorder`.

- [ ] **Step 7: Verify editor behavior**

Run: `npx tsx scripts/plan-editor-blocks.test.ts`

Run: `npx eslint app/api/entrenos/'[id]'/route.ts app/entrenos/'[id]'/page.tsx components/training/PlanTimeline.tsx components/training/ExerciseBlockSelect.tsx`

Run: `npx tsc --noEmit`

Expected: all commands exit 0.

- [ ] **Step 8: Commit Task 3**

```bash
git add app/api/entrenos/'[id]'/route.ts app/entrenos/'[id]'/page.tsx components/training/PlanTimeline.tsx components/training/ExerciseBlockSelect.tsx lib/training/plan-editor-blocks.ts scripts/plan-editor-blocks.test.ts
git commit -m "feat: configura bloques desde el editor coach"
```

### Task 4: Bloques reales en la generación IA

**Files:**
- Modify: `app/api/entrenos/proponer-plan-ciencia/route.ts`
- Create: `lib/training/generated-session-blocks.ts`
- Create: `scripts/generated-session-blocks.test.ts`

**Interfaces:**
- Consumes: `normalizarBloqueSesion` and `TipoBloqueSesion` from Task 1.
- Produces: `bloqueEjercicioGenerado(value): TipoBloqueSesion` and persisted `sesion_ejercicios.bloque`.

- [ ] **Step 1: Write the failing normalization test**

```ts
import assert from 'node:assert/strict'
import { bloqueEjercicioGenerado } from '../lib/training/generated-session-blocks'

assert.equal(bloqueEjercicioGenerado('calentamiento'), 'calentamiento')
assert.equal(bloqueEjercicioGenerado(undefined), 'principal')
assert.equal(bloqueEjercicioGenerado('potencia'), 'principal')
```

- [ ] **Step 2: Run the test and verify RED**

Run: `npx tsx scripts/generated-session-blocks.test.ts`

Expected: FAIL because the helper does not exist.

- [ ] **Step 3: Implement normalization and update the JSON contract**

Add `bloque` to the exercise schema in the prompt, using the exact six allowed values. Replace the old absolute rule `Siempre incluir calentamiento implícito en notas del primer ejercicio` with explicit rules from the spec: specific warm-up, conditional mobility/plyometrics, principal stimulus, non-competing accessories, useful cooldown.

- [ ] **Step 4: Persist the generated block**

In the `sesion_ejercicios` insert, add:

```ts
bloque: bloqueEjercicioGenerado(ej.bloque),
```

Keep all current matching, load, RPE and note behavior unchanged.

- [ ] **Step 5: Verify generator changes**

Run: `npx tsx scripts/generated-session-blocks.test.ts`

Run: `npx eslint app/api/entrenos/proponer-plan-ciencia/route.ts lib/training/generated-session-blocks.ts`

Expected: both exit 0.

- [ ] **Step 6: Commit Task 4**

```bash
git add app/api/entrenos/proponer-plan-ciencia/route.ts lib/training/generated-session-blocks.ts scripts/generated-session-blocks.test.ts
git commit -m "feat: genera estructura funcional de sesiones"
```

### Task 5: Agrupación compartida en Hoy, Semana y Mes

**Files:**
- Modify: `app/api/cliente/sesion/[id]/route.ts`
- Modify: `components/training/ExpandableExercises.tsx`
- Modify: `components/training/EntrenoSubTabs.tsx`
- Modify: `components/training/EntrenoKanban.tsx`
- Modify: `components/training/CalendarioMesEntreno.tsx`
- Create: `scripts/client-session-blocks.test.ts`

**Interfaces:**
- Consumes: block domain from Task 1.
- Produces: `EjercicioDetalle.bloque` and grouped `ListaEjerciciosExpandible` in every summary view.

- [ ] **Step 1: Write the failing client presentation test**

```ts
import assert from 'node:assert/strict'
import { crearPresentacionEjercicios } from '../lib/training/session-blocks'

const vista = crearPresentacionEjercicios([
  { id: 'warm', orden: 1, bloque: 'calentamiento' },
  { id: 'main-a', orden: 2, bloque: 'principal' },
  { id: 'main-b', orden: 3, bloque: null },
  { id: 'cool', orden: 4, bloque: 'vuelta_calma' },
])

assert.deepEqual(vista.map(grupo => grupo.label), [
  'CALENTAMIENTO', 'BLOQUE PRINCIPAL', 'VUELTA A LA CALMA',
])
assert.deepEqual(vista.flatMap(grupo => grupo.items.map(item => item.indiceGlobal)), [1, 2, 3, 4])
assert.equal(vista.some(grupo => grupo.label === 'MOVILIDAD / ACTIVACIÓN'), false)
```

Run: `npx tsx scripts/client-session-blocks.test.ts`

Expected: FAIL until a pure `crearPresentacionEjercicios` helper exists.

- [ ] **Step 2: Return `bloque` from the authenticated client session API**

Add `bloque` to the `sesion_ejercicios` select in `app/api/cliente/sesion/[id]/route.ts`.

- [ ] **Step 3: Implement a presentation model in `session-blocks.ts`**

Add `crearPresentacionEjercicios(items)`, returning canonical groups whose items include `indiceGlobal`, assigned while traversing the final block order. This avoids resetting or desordenar visible numbers between blocks.

```ts
export function crearPresentacionEjercicios<T extends { orden: number; bloque?: unknown }>(items: T[]) {
  let indiceGlobal = 0
  return agruparEjerciciosPorBloque(items).map(grupo => ({
    ...grupo,
    label: etiquetaBloqueSesion(grupo.bloque),
    items: grupo.items.map(item => ({ ...item, indiceGlobal: ++indiceGlobal })),
  }))
}
```

- [ ] **Step 4: Render populated blocks in `ExpandableExercises`**

Extend `EjercicioDetalle` with `bloque`. Replace the flat map with `crearPresentacionEjercicios(ejercicios)`. Render a monospaced header before each group; use `indiceGlobal` for the number and keep `ej.id` as checklist identity. Do not alter expand/collapse or localStorage behavior.

- [ ] **Step 5: Apply conservative title cleanup in all three summary views**

Use `tituloSesionSinModalidad(nombre, tipo_sesion)` in:

- `EntrenoSubTabs` for Hoy;
- `EntrenoKanban` for Semana and expanded detail title;
- `CalendarioMesEntreno` for cards and modal/detail title.

Do not mutate fetched data.

- [ ] **Step 6: Verify summary views**

Run: `npx tsx scripts/client-session-blocks.test.ts && npx tsx scripts/session-type-presentation.test.ts`

Run: `npx eslint app/api/cliente/sesion/'[id]'/route.ts components/training/ExpandableExercises.tsx components/training/EntrenoSubTabs.tsx components/training/EntrenoKanban.tsx components/training/CalendarioMesEntreno.tsx`

Run: `npx tsc --noEmit`

Expected: all commands exit 0.

- [ ] **Step 7: Commit Task 5**

```bash
git add app/api/cliente/sesion/'[id]'/route.ts components/training/ExpandableExercises.tsx components/training/EntrenoSubTabs.tsx components/training/EntrenoKanban.tsx components/training/CalendarioMesEntreno.tsx lib/training/session-blocks.ts scripts/client-session-blocks.test.ts
git commit -m "feat: muestra bloques en el portal de entrenamiento"
```

### Task 6: Contexto de bloque en la ejecución móvil

**Files:**
- Modify: `app/cliente/sesion/[id]/page.tsx`
- Modify: `components/training/SesionCardMobile.tsx`
- Modify: `app/cliente/cliente.css`
- Create: `scripts/session-execution-blocks.test.ts`

**Interfaces:**
- Consumes: `EjercicioCard.bloque`, `normalizarBloqueSesion`, `etiquetaBloqueSesion` from Task 1.
- Produces: current block label and boundary marker in the execution flow without extra navigation steps.

- [ ] **Step 1: Write the failing execution-boundary test**

```ts
import assert from 'node:assert/strict'
import { esInicioDeBloque } from '../lib/training/session-blocks'

const ejercicios = [
  { bloque: null },
  { bloque: 'principal' },
  { bloque: 'accesorios' },
]

assert.equal(esInicioDeBloque(ejercicios, 0), true)
assert.equal(esInicioDeBloque(ejercicios, 1), false)
assert.equal(esInicioDeBloque(ejercicios, 2), true)
```

Run: `npx tsx scripts/session-execution-blocks.test.ts`

Expected: FAIL because the helper does not exist.

- [ ] **Step 2: Pass `bloque` into `EjercicioCard`**

Add `bloque` when mapping the session API response in `app/cliente/sesion/[id]/page.tsx`, normalized at the component boundary.

Implement the boundary helper in `session-blocks.ts`:

```ts
export function esInicioDeBloque(items: Array<{ bloque?: unknown }>, index: number) {
  if (index === 0) return true
  if (index < 0 || index >= items.length) return false
  return normalizarBloqueSesion(items[index].bloque) !== normalizarBloqueSesion(items[index - 1].bloque)
}
```

- [ ] **Step 3: Render block context without an intermediate screen**

In `SesionCardMobile`, show the current block as a monospaced uppercase eyebrow above the exercise name. In the exercise navigator/list, add a subtle divider only where `esInicioDeBloque` is true. Preserve current/complete state, timers, set map, automatic advance and finish behavior.

- [ ] **Step 4: Verify execution flow**

Run: `npx tsx scripts/session-execution-blocks.test.ts`

Run: `npx eslint app/cliente/sesion/'[id]'/page.tsx components/training/SesionCardMobile.tsx`

Run: `npx tsc --noEmit`

Expected: all commands exit 0.

- [ ] **Step 5: Commit Task 6**

```bash
git add app/cliente/sesion/'[id]'/page.tsx components/training/SesionCardMobile.tsx app/cliente/cliente.css lib/training/session-blocks.ts scripts/session-execution-blocks.test.ts
git commit -m "feat: contextualiza bloques durante la sesion"
```

### Task 7: Migración remota, comprobación integral y despliegue

**Files:**
- Modify only if verification reveals a scoped defect in files from Tasks 1-6.

**Interfaces:**
- Consumes: all prior tasks.
- Produces: production schema and deployed feature.

- [ ] **Step 1: Run all focused tests**

```bash
npx tsx scripts/session-blocks.test.ts
npx tsx scripts/session-type-presentation.test.ts
npx tsx scripts/session-block-update.test.ts
npx tsx scripts/plan-editor-blocks.test.ts
npx tsx scripts/generated-session-blocks.test.ts
npx tsx scripts/client-session-blocks.test.ts
npx tsx scripts/session-execution-blocks.test.ts
```

Expected: seven scripts exit 0 with no assertion failures.

- [ ] **Step 2: Run repository verification**

Run: `npx eslint app/api/entrenos app/api/cliente/sesion components/training app/entrenos/'[id]'/page.tsx app/cliente/sesion/'[id]'/page.tsx lib/training`

Run: `npx tsc --noEmit`

Run: `npm run build`

Expected: no ESLint errors, TypeScript exit 0, Next.js build exit 0. Existing warnings must be reported explicitly rather than hidden.

- [ ] **Step 3: Apply and verify the Supabase migration**

Confirm the linked project before mutation with `npx supabase projects list` and `cat supabase/.temp/project-ref`. Then run the repository's established migration command (`npx supabase db push`) from `nutricoach/`. Verify read-only with:

```sql
select column_name, column_default, is_nullable
from information_schema.columns
where table_schema = 'public'
  and table_name = 'sesion_ejercicios'
  and column_name = 'bloque';
```

Expected: column exists, default is `principal`, nullable is `NO`.

- [ ] **Step 4: Manual acceptance test as coach and client**

Coach:

1. open an active plan;
2. assign one exercise to `Calentamiento`, one to `Pliometría`, and retain principal exercises;
3. reload and confirm persistence;
4. confirm no empty block headers.

Client:

1. open Training > Hoy, Semana and Mes;
2. confirm modal label and non-duplicated title;
3. confirm canonical block order and continuous numbering;
4. open the session execution, mark sets, advance across a block boundary and finish;
5. confirm checklist/timer/progress behavior is unchanged.

- [ ] **Step 5: Push and verify Vercel production**

```bash
git status --short
git push origin main
vercel project inspect --non-interactive
vercel list nutricoach --yes
```

Copy the exact newest production URL printed by `vercel list`, then run `vercel inspect` with that URL plus `--wait --timeout 5m`. Finally request `/cliente` through the production alias and require HTTP 200.

- [ ] **Step 6: Record completion**

Update `CLAUDE.md` or the active project handoff with commit IDs, migration status, production deployment ID, tested flows and any remaining manual visual decision. Commit only that documentation change:

```bash
git add CLAUDE.md
git commit -m "docs: registra bloques de entrenamiento desplegados"
git push origin main
```
