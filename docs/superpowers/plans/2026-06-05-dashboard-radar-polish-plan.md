# Dashboard Radar Polish Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Polish `/dashboard` into a clearer daily coach radar with stronger text contrast and a review/approve mental model.

**Architecture:** Keep the existing aggregate APIs and current dashboard page. Modify only the client UI hierarchy and global contrast tokens needed for readability across light and dark themes.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript, Tailwind v4, project CSS variables, Phosphor icons.

---

## File Structure

- Modify `app/dashboard/page.tsx`: copy, hierarchy, queue row presentation, AI section naming, weekly context layout.
- Modify `app/globals.css`: raise text-muted contrast in both themes and keep existing design-system variables.

## Task 1: Improve Global Text Contrast

**Files:**
- Modify: `app/globals.css`

- [ ] **Step 1: Raise muted text in dark mode**

Change dark mode `--text-muted` from very low contrast to a readable secondary-muted value:

```css
--text-muted: #6F6F78;
```

- [ ] **Step 2: Raise disabled text in dark mode slightly**

Use:

```css
--text-disabled: #3F3F46;
```

- [ ] **Step 3: Raise light mode muted text**

Change light mode `--text-muted` to:

```css
--text-muted: #7A7A82;
```

- [ ] **Step 4: Run lint**

Run:

```bash
npm run lint
```

Expected: no new dashboard/CSS errors.

## Task 2: Reframe Dashboard Header and Tabs

**Files:**
- Modify: `app/dashboard/page.tsx`

- [ ] **Step 1: Rename the main heading**

Change `Dashboard` to `Radar diario`.

- [ ] **Step 2: Add an operational subtitle**

Add short copy under the heading:

```tsx
Trabajo preparado para revisar, ajustar y aprobar.
```

- [ ] **Step 3: Update the pending badge copy**

Use:

```tsx
`${pendingActions} por revisar`
```

- [ ] **Step 4: Rename tabs**

Use:

- `Hoy`
- `Negocio`

## Task 3: Make the Daily Queue the Primary Work Surface

**Files:**
- Modify: `app/dashboard/page.tsx`

- [ ] **Step 1: Restyle `TodayActionQueue` rows**

Each row keeps the current link behavior but uses:

- stronger title contrast;
- visible severity rail;
- clear action label on the right;
- less reliance on tiny muted text.

- [ ] **Step 2: Rename the section**

Change `Hoy requiere atención` to:

```tsx
Cola de revisión
```

- [ ] **Step 3: Add action-oriented meta**

Keep existing `action.cta`, but render it as the visible action chip.

- [ ] **Step 4: Preserve loading, empty, and error states**

Do not remove existing skeleton/error behavior.

## Task 4: Clarify AI and Weekly Context

**Files:**
- Modify: `app/dashboard/page.tsx`

- [ ] **Step 1: Rename `Inbox IA` section**

Use:

```tsx
Trabajo preparado por IA
```

- [ ] **Step 2: Rename row fallback copy**

When `tarea.propuesta` is missing, use:

```tsx
Propuesta pendiente de revisión
```

- [ ] **Step 3: Add weekly focus panel**

Add a compact `WeeklyFocusPanel` next to the queue on desktop. It summarizes:

- check-ins pending;
- AI tasks pending;
- clients at risk;
- renewals in 30 days.

It uses existing `command.operacion`, `command.inbox_ia`, and `command.clientes_riesgo`.

## Task 5: Verify

**Files:**
- Verify project

- [ ] **Step 1: Run lint**

```bash
npm run lint
```

- [ ] **Step 2: Run build**

```bash
npm run build
```

- [ ] **Step 3: Manual route check**

Start:

```bash
npm run dev
```

Open `/dashboard` and inspect light/dark readability.
