# Training OS 2.0 Phase 3 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Improve the coach-side module structure so Training OS is not the old dashboard/templates/exercises layout with nicer styling.

**Architecture:** Reframe navigation by workflow: Operativa, Planificación, Biblioteca, Automatización. Upgrade templates into a Plan Library and exercises into an Exercise Library. Fix the currently unreachable template assignment modal.

**Tech Stack:** Next.js client pages, TypeScript, CSS variables, lucide-react.

---

## Task 1: Navigation Structure

**Files:**
- Modify: `components/training/TrainingSubNav.tsx`

- [ ] Rename sections to:
  - Operativa: Command Center, AI Review
  - Planificación: Crear plan, Generar con IA
  - Biblioteca: Plan Library, Exercise Library
- [ ] Add compact workflow helper text under section title.
- [ ] Keep existing routes; only change labels, grouping and visual hierarchy.

## Task 2: Plan Library

**Files:**
- Modify: `app/entrenos/plantillas/page.tsx`

- [ ] Rename page from generic “Planificación de entrenos” to “Plan Library”.
- [ ] Add top stats: total templates, elite templates, modalities, average weekly days.
- [ ] Add action rail: create from template, seed templates, generate with IA.
- [ ] Fix unreachable assignment modal by moving `handleAsignar` and modal into the main return.
- [ ] Keep existing filtering and assignment behavior.

## Task 3: Exercise Library

**Files:**
- Modify: `app/entrenos/ejercicios/page.tsx`

- [ ] Rename page to “Exercise Library”.
- [ ] Add quality-oriented header explaining use in coach and client flows.
- [ ] Add quick filters for missing media/completion quality.
- [ ] Keep existing media editing behavior.

## Task 4: Verification and Deploy

- [ ] Run:

```bash
npx eslint components/training/TrainingSubNav.tsx app/entrenos/plantillas/page.tsx app/entrenos/ejercicios/page.tsx
npm run build
```

- [ ] Commit:

```bash
git add components/training/TrainingSubNav.tsx app/entrenos/plantillas/page.tsx app/entrenos/ejercicios/page.tsx docs/superpowers/plans/2026-06-01-training-os-2-phase3.md
git commit -m "feat(training): improve coach library structure"
```

- [ ] Push and verify Vercel `Ready`.

