# Training OS 2.0 Phase 1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the first usable Training OS 2.0 delivery: a real coach Command Center powered by server-side prioritization, client signals, pending IA tasks, and clear UI actions.

**Architecture:** Move Command Center calculation out of the client page into a pure scoring module plus an authenticated API. The `/entrenos` UI consumes that API and renders priority-ranked clients with status, next action, evidence summary, and fast links. This phase reuses existing `agente_tareas`, `registros_sets`, `prs_por_ejercicio`, `planes_entrenamiento`, `clientes`, and `profiles`.

**Tech Stack:** Next.js App Router, TypeScript, Supabase service role on API routes, React client UI, CSS variables, lucide-react.

---

## File Map

| Action | File | Responsibility |
|--------|------|----------------|
| Create | `lib/training/command-center.ts` | Pure scoring, labels, priority order, type definitions |
| Create | `scripts/test-training-command-center.ts` | Node/tsx assertions for scoring behavior |
| Create | `app/api/entrenos/command-center/route.ts` | Authenticated server aggregation for coach dashboard |
| Modify | `app/entrenos/page.tsx` | Render Command Center from API instead of direct Supabase client queries |

---

## Task 1: Pure Command Center Scoring

**Files:**
- Create: `lib/training/command-center.ts`
- Create: `scripts/test-training-command-center.ts`

- [ ] **Step 1: Create failing test script**

Create `scripts/test-training-command-center.ts` with assertions for:

```ts
import assert from 'node:assert/strict'
import {
  calcularCommandCenterRow,
  ordenarCommandCenterRows,
  type CommandCenterInput,
} from '../lib/training/command-center'

const base: CommandCenterInput = {
  cliente_id: 'c1',
  plan_id: 'p1',
  nombre: 'Carlos',
  apellidos: 'Casanova',
  plan_nombre: 'Hyrox Base',
  sesiones_objetivo: 4,
  sesiones_7d: 4,
  sesiones_28d: 14,
  rpe_media_7d: 6.4,
  pr_count_7d: 0,
  ultima_fecha: '2026-06-01',
  dots: [true, false, true, false, true, false, true],
  tareas_pendientes: [],
  flags_altas: 0,
}

const fatiga = calcularCommandCenterRow({
  ...base,
  cliente_id: 'fatiga',
  rpe_media_7d: 9.1,
  sesiones_7d: 6,
})
assert.equal(fatiga.estado, 'fatiga')
assert.equal(fatiga.accion_principal, 'Revisar carga')
assert.equal(fatiga.requiere_accion, true)

const ia = calcularCommandCenterRow({
  ...base,
  cliente_id: 'ia',
  tareas_pendientes: [{ id: 't1', tipo: 'training_brain', prioridad: 2, propuesta: 'Bajar volumen' }],
})
assert.equal(ia.estado, 'revision_ia')
assert.equal(ia.accion_principal, 'Aprobar IA')

const progreso = calcularCommandCenterRow({
  ...base,
  cliente_id: 'progreso',
  pr_count_7d: 2,
  rpe_media_7d: 6.1,
})
assert.equal(progreso.estado, 'progreso')
assert.equal(progreso.accion_principal, 'Progresar')

const ordenadas = ordenarCommandCenterRows([progreso, ia, fatiga])
assert.deepEqual(ordenadas.map(r => r.cliente_id), ['fatiga', 'ia', 'progreso'])

console.log('training command center tests passed')
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
npx tsx scripts/test-training-command-center.ts
```

Expected: fails because `lib/training/command-center.ts` does not exist.

- [ ] **Step 3: Implement scoring module**

Create `lib/training/command-center.ts` exporting:

- `CommandCenterInput`
- `CommandCenterRow`
- `calcularCommandCenterRow(input)`
- `ordenarCommandCenterRows(rows)`

Rules:

- `fatiga`: `flags_altas > 0` OR `rpe_media_7d >= 8.5` OR `sesiones_7d >= 6`
- `revision_ia`: pending tasks exist
- `sin_actividad`: no last session OR adherence below 50%
- `progreso`: PR count > 0 OR adherence >= 90 with RPE <= 7
- `estable`: fallback

Priority score:

- fatigue: 500
- IA review: 400
- no activity: 300
- progress: 200
- stable: 100
- add lower task priority bonus: `Math.max(0, 20 - prioridad)`

- [ ] **Step 4: Run test to verify it passes**

Run:

```bash
npx tsx scripts/test-training-command-center.ts
```

Expected: prints `training command center tests passed`.

---

## Task 2: Authenticated Command Center API

**Files:**
- Create: `app/api/entrenos/command-center/route.ts`

- [ ] **Step 1: Create API route**

Create `GET /api/entrenos/command-center`.

Behavior:

- Validate coach auth with `createApiSupabase(request).auth.getUser()`.
- Use `createServiceSupabase()` for aggregation.
- Load active `planes_entrenamiento` for `coach_id = user.id`, joined with `clientes` and `profiles`.
- Load last 28 days from `registros_sets`.
- Load current-week PRs from `prs_por_ejercicio`.
- Load pending/modificado `agente_tareas` for those clients and training-related task types.
- Build `CommandCenterInput[]`.
- Return:

```ts
{
  clientes: CommandCenterRow[],
  stats: {
    total: number,
    requiere_accion: number,
    fatiga: number,
    revision_ia: number,
    progreso: number,
    sin_actividad: number
  }
}
```

- [ ] **Step 2: Verify API compiles**

Run:

```bash
npx eslint app/api/entrenos/command-center/route.ts lib/training/command-center.ts scripts/test-training-command-center.ts
```

Expected: 0 errors.

---

## Task 3: Command Center UI

**Files:**
- Modify: `app/entrenos/page.tsx`

- [ ] **Step 1: Replace client Supabase aggregation**

Change `/entrenos` to:

- Fetch `/api/entrenos/command-center` in `useEffect`.
- Store `clientes` and `stats`.
- Keep local search.
- Keep skeleton and empty state.

- [ ] **Step 2: Render priority UI**

Each client card must show:

- Name and plan.
- `accion_principal`.
- `razon`.
- TLS/load score approximation from API row.
- RPE.
- PR count.
- Pending IA count.
- Weekly dots.
- Last session.
- Link to `/entrenos/[plan_id]`.
- Link button to `/clientes/[cliente_id]` or `/entrenos/brain-ia` when IA review is pending.

- [ ] **Step 3: Verify page compiles**

Run:

```bash
npx eslint app/entrenos/page.tsx app/api/entrenos/command-center/route.ts lib/training/command-center.ts
npm run build
```

Expected: build exits 0.

---

## Task 4: Commit and Deploy

**Files:**
- Commit all phase files.

- [ ] **Step 1: Check worktree**

Run:

```bash
git status --short
```

Expected: only phase files plus known uncommitted `supabase/.temp/cli-latest`.

- [ ] **Step 2: Commit phase**

Run:

```bash
git add lib/training/command-center.ts scripts/test-training-command-center.ts app/api/entrenos/command-center/route.ts app/entrenos/page.tsx docs/superpowers/plans/2026-06-01-training-os-2-phase1.md
git commit -m "feat(training): add Training OS command center"
```

- [ ] **Step 3: Push**

Run:

```bash
git push origin main
```

- [ ] **Step 4: Verify Vercel**

Run:

```bash
vercel inspect https://nutricoach-delta.vercel.app
```

Expected: latest production deployment eventually reaches `Ready`.

