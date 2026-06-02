# Client Training Tab Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Upgrade the portal client's Training tab so it mirrors the new weekly training experience without forcing the user to open `/cliente/semana`.

**Architecture:** Reuse the already-tested `crearClienteWeekSummary()` helper from `lib/training/client-week.ts`. Keep `components/PortalCliente/DashboardCliente.tsx` as the integration point because the current Training tab lives inside `EntrenoCliente`. No database or API changes.

**Tech Stack:** Next.js App Router, React client component, Tailwind classes plus existing CSS variables, `tsx` script tests, ESLint, Next build.

---

### Task 1: Add summary layer to Training tab

**Files:**
- Modify: `components/PortalCliente/DashboardCliente.tsx`
- Test: `scripts/test-training-client-week.ts`

- [ ] **Step 1: Run existing helper test**

Run: `npx tsx scripts/test-training-client-week.ts`
Expected: `training client week tests passed`

- [ ] **Step 2: Map portal sessions into `crearClienteWeekSummary()`**

Inside `EntrenoCliente`, derive a `resumenSemana` from `sesiones`, `sesionesHechas`, and `hoyIdx`.

- [ ] **Step 3: Add top Training OS card**

Render weekly progress, main session, primary CTA to `/cliente/semana`, and quick action to register/manual mark.

- [ ] **Step 4: Verify**

Run:
`npx tsx scripts/test-training-client-week.ts`
`npx eslint components/PortalCliente/DashboardCliente.tsx lib/training/client-week.ts --no-warn-ignored`
`npm run build`

- [ ] **Step 5: Smoke**

Run local dev server on port 3001 and check:
`/cliente`
`/cliente/semana`

- [ ] **Step 6: Commit and deploy**

Commit message:
`feat(training): upgrade client training tab`
