# Dashboard Command Center Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild `/dashboard` as an operational Command Center with a separate `Negocio` tab for payments, renewals, and commercial health.

**Architecture:** Add two server-side aggregate endpoints, then replace the current chart-heavy dashboard client with focused, data-driven sections. Keep all UI inside `/dashboard` and use existing Supabase tables, Stripe columns on `clientes`, Phosphor icons, Tailwind v4, and project CSS variables.

**Tech Stack:** Next.js 16 App Router, React 19 client component page, Supabase SSR/API clients, TypeScript, Tailwind v4, Phosphor icons.

---

## File Structure

- Create `app/api/dashboard/command-center/route.ts`: authenticated aggregate endpoint for daily coach actions.
- Create `app/api/dashboard/negocio/route.ts`: authenticated aggregate endpoint for payments, memberships, and renewals.
- Replace `app/dashboard/page.tsx`: tabbed dashboard UI using the two aggregate endpoints.
- Keep `components/dashboard/*` unchanged unless a compile error requires import cleanup.

## Task 1: Command Center API

**Files:**
- Create: `app/api/dashboard/command-center/route.ts`

- [ ] **Step 1: Implement authenticated route**

Create a `GET` route that uses `createServerSupabase()`, calls `auth.getUser()`, and returns `401` when unauthenticated.

- [ ] **Step 2: Query real data**

Fetch:

- `clientes` for the coach with profile, onboarding, active state, revision dates, membership dates, Stripe flags.
- `planes_nutricion` active plans for the coach.
- `planes_entrenamiento` active plans for the coach.
- `respuestas_clientes` for pending responses.
- `checkins` for coach client IDs.
- `registros_sets` for coach client IDs.
- `agente_tareas` pending tasks joined to clients.
- `competiciones` active future competitions.
- `precios_actuales` indirectly is not needed here; costs live in the business/current cost endpoint if used later.

- [ ] **Step 3: Return stable JSON**

Return:

- `hoy`: prioritized action queue.
- `clientes_riesgo`: max 8 risk rows.
- `inbox_ia`: max 8 AI task rows.
- `operacion`: dense operational counts.
- `competiciones`: max 6 competition rows.
- `timestamp`.

- [ ] **Step 4: Keep calculations defensive**

Use local date helpers. Treat missing arrays as empty. Do not throw if optional relations are missing.

## Task 2: Negocio API

**Files:**
- Create: `app/api/dashboard/negocio/route.ts`

- [ ] **Step 1: Implement authenticated route**

Use `createServerSupabase()`, `auth.getUser()`, and `401` when unauthenticated.

- [ ] **Step 2: Use current persisted business data**

Fetch active and inactive coach clients with profile, membership fields, Stripe fields, `plan_tipo`, `plan_precio`, `fecha_inicio_plan`, and `pagado_via_stripe`.

- [ ] **Step 3: Return stable JSON**

Return:

- `resumen`: income and commercial counts.
- `transacciones_recientes`: completed Stripe-paid clients sorted by `fecha_inicio_plan`.
- `pagos_pendientes`: clients active without membership/payment setup, and expired memberships.
- `renovaciones`: memberships expiring in 30 days.
- `embudo`: new clients without payment, Stripe-paid clients, active clients.
- `timestamp`.

- [ ] **Step 4: Avoid fake transaction data**

If no transaction table exists, only use completed payments inferred from `clientes.pagado_via_stripe`, `plan_precio`, and `fecha_inicio_plan`.

## Task 3: Dashboard UI

**Files:**
- Modify: `app/dashboard/page.tsx`

- [ ] **Step 1: Replace chart dashboard with tabs**

Build a client component with `Command Center` and `Negocio` tabs. Fetch both APIs lazily: command center on mount, business data when the `Negocio` tab is opened.

- [ ] **Step 2: Build Command Center sections**

Render:

- compact header;
- `Hoy requiere atención`;
- two-column desktop grid for `Clientes en riesgo` and `Inbox IA`;
- `Operación semanal`;
- two-column desktop grid for `Coste/fricción alimentaria` placeholder from available business endpoint if needed and `Calendario deportivo`.

- [ ] **Step 3: Build Negocio sections**

Render:

- `Resumen económico`;
- `Renovaciones`;
- `Pagos pendientes`;
- `Transacciones recientes`.

- [ ] **Step 4: Implement states**

Use list skeletons for loading, inline retry for errors, and composed empty states for no data.

- [ ] **Step 5: Keep UI non-generic**

No decorative charts. Use dense rows, severity chips, direct action links, tabular numbers, and project CSS variables.

## Task 4: Verification

**Files:**
- Verify project

- [ ] **Step 1: Static checks**

Run `npm run lint`.

- [ ] **Step 2: Production build**

Run `npm run build`.

- [ ] **Step 3: Manual route check**

Start `npm run dev` and open `/dashboard`. Confirm both tabs render without runtime errors.

- [ ] **Step 4: Commit implementation**

Commit only files changed for this dashboard implementation.

