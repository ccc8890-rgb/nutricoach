# Training OS 2.0 Phase 2 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn `/entrenos/brain-ia` into the Training OS AI Review Inbox where the coach reviews, edits, approves, or rejects training recommendations.

**Architecture:** Reuse the existing `GET/PATCH /api/agentes/tareas` endpoint so approvals continue to trigger `aplicarTarea()` and `registrarAprendizaje()`. The page filters training-related agent task types, renders cards grouped by operational status, and exposes evidence, signals, and editable final proposal.

**Tech Stack:** Next.js client component, existing API route, TypeScript, lucide-react, CSS variables.

---

## Task 1: Rewrite AI Review Inbox UI

**Files:**
- Modify: `app/entrenos/brain-ia/page.tsx`

- [ ] **Step 1: Replace direct Supabase reads**

Fetch `/api/agentes/tareas?limite=100` instead of querying Supabase directly.

- [ ] **Step 2: Filter training task types**

Keep task types:

- `training_brain`
- `revision_semanal_entreno`
- `alerta_riesgo_entreno`
- `alerta_readiness`
- `ajuste_nutricion_carga`

- [ ] **Step 3: Render review cards**

Each card shows:

- Client name.
- Task type label.
- Status.
- Priority.
- Proposal.
- Reasoning.
- Signals from payload.
- Plan adjustments from payload.
- Scientific sources.
- Buttons: `Aprobar`, `Editar`, `Ignorar`.

- [ ] **Step 4: Implement edit flow**

When editing:

- Show textarea with current proposal.
- Optional coach comment.
- Save through `PATCH /api/agentes/tareas` with `decision: 'modificado'`.

- [ ] **Step 5: Verify**

Run:

```bash
npx eslint app/entrenos/brain-ia/page.tsx
npm run build
```

Expected: 0 errors and build exits 0.

---

## Task 2: Commit and deploy

- [ ] **Step 1: Commit**

```bash
git add app/entrenos/brain-ia/page.tsx docs/superpowers/plans/2026-06-01-training-os-2-phase2.md
git commit -m "feat(training): add AI review inbox"
```

- [ ] **Step 2: Push**

```bash
git push origin main
```

- [ ] **Step 3: Verify Vercel**

Inspect latest deployment until status is `Ready`.

