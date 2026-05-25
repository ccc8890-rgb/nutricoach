# Recetario Inteligente v2 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a scalable recipe taxonomy and retrieval layer for weekly and 14-day AI meal planning.

**Architecture:** Add professional classification fields to `recetas`, backfill existing approved recipes, expose coverage through an authenticated API, and update recipe suggestion scoring so agents can retrieve recipes by objective, sport, meal moment, macros, adherence, and chef healthy positioning.

**Tech Stack:** Next.js App Router, TypeScript, Supabase Postgres, PostgREST, Vercel.

---

### Task 1: Database Taxonomy

**Files:**
- Create: `supabase/migrations/20260525_recetario_inteligente_v2.sql`

- [x] Add `objetivos`, `deportes`, `momentos`, `estilos`, `densidad_energetica`, `digestibilidad`, `nivel_elaboracion`, `adherencia_score`, `premium_chef`, `uso_personal`, `batch_cooking`, `tupper`, `coste_estimado_nivel`, `taxonomia_version`, `taxonomia_actualizada_at`.
- [x] Backfill approved recipes from existing `tipo_plato`, `categoria`, `tags`, `apta_cliente`, macros and timings.
- [x] Add GIN indexes for array filters and btree indexes for scoring fields.

### Task 2: Shared Taxonomy Module

**Files:**
- Create: `lib/recetario-taxonomia.ts`
- Modify: `types/index.ts`

- [x] Define objective, sport, moment and style constants.
- [x] Define coverage minimums.
- [x] Add `scoreRecetaParaAgente()` for agent ranking.
- [x] Extend `RecetaCandidata` with taxonomy fields.

### Task 3: Coverage API

**Files:**
- Create: `app/api/recetas/cobertura/route.ts`

- [x] Require authenticated coach.
- [x] Count coverage by slots, objectives, sports and styles.
- [x] Return gaps sorted by priority.

### Task 4: Retrieval Integration

**Files:**
- Modify: `app/api/recetas/sugeridas/route.ts`
- Modify: `lib/plan-recetas.ts`

- [x] Accept optional `objetivo`, `deporte`, `momento`, `chef`.
- [x] Filter candidates by taxonomy when available.
- [x] Sort by agent score before macro distance.
- [x] Add taxonomy/adherence/chef signals into plan-recipe scoring.

### Task 5: Verification

**Files:**
- All modified files

- [x] Run `npx tsc --noEmit --pretty false`.
- [x] Apply SQL to linked Supabase.
- [x] Verify columns exist.
- [x] Verify scoring module with `npx tsx`.
- [x] Run `npm run build`.
- [x] Deploy with `npx vercel --prod --yes`.

### Task 6: Coach Coverage Workspace

**Files:**
- Create: `app/recetas/cobertura/page.tsx`
- Modify: `components/Sidebar.tsx`

- [x] Add Recetario → Cobertura entry in the coach sidebar.
- [x] Build a responsive coverage dashboard for approved recipes, chef healthy recipes, average coverage and priority gaps.
- [x] Show actionable production briefs for the next recipe blocks to create.
- [x] Run `npx tsc --noEmit --pretty false`.
- [x] Run `npm run build`.
- [x] Deploy with `npx vercel --prod --yes`.
