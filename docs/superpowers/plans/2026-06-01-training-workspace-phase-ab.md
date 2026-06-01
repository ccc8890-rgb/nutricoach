# Training Workspace Phase A+B Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Convert the training module from separate admin pages into a first Training Workspace experience with a dedicated shell and an operational coach cockpit.

**Architecture:** Keep the current Next.js routes and APIs. Add a reusable `TrainingWorkspaceShell` wrapper for the module, then rewrite `/entrenos` as a two-panel decision cockpit using the existing `/api/entrenos/command-center` data. Avoid database changes in this phase.

**Tech Stack:** Next.js 16 App Router, React 19, Tailwind v4, CSS variables, Phosphor icons for new shell UI, existing command-center API.

---

### Task 1: Training Workspace Shell

**Files:**
- Create: `components/training/TrainingWorkspaceShell.tsx`
- Modify: `app/entrenos/layout.tsx`

- [x] **Step 1: Create shell component**

Create `TrainingWorkspaceShell.tsx` with:

- Header: `Training Workspace`, subtitle, mode tabs.
- Search-style command input visual.
- Right-side daily status slots.
- Desktop left navigation grouped by work mode.
- Mobile horizontal work modes.
- Main canvas slot.

- [x] **Step 2: Update training layout**

Replace the current flex layout using `TrainingSubNav` with:

```tsx
<CoachShell>
  <TrainingWorkspaceShell>{children}</TrainingWorkspaceShell>
</CoachShell>
```

- [x] **Step 3: Verify routes still render**

Run:

```bash
npx eslint components/training/TrainingWorkspaceShell.tsx app/entrenos/layout.tsx
```

Expected: no errors.

### Task 2: Operate Cockpit

**Files:**
- Modify: `app/entrenos/page.tsx`

- [x] **Step 1: Keep existing data contract**

Keep:

- `CommandCenterRow`.
- `/api/entrenos/command-center`.
- `stats`.
- Current filters and search.

- [x] **Step 2: Add selected client state**

Add:

```ts
const [selectedId, setSelectedId] = useState<string | null>(null)
```

Derive:

```ts
const seleccionado = useMemo(() => filtrados.find(c => c.id === selectedId) ?? filtrados[0] ?? null, [filtrados, selectedId])
```

- [x] **Step 3: Replace page layout**

Render `/entrenos` as:

- Top summary row: active plans, action needed, fatigue, AI pending, progress.
- Main grid:
  - Left priority rail with filtered clients.
  - Center selected client decision panel.
  - Right action panel with next action, evidence summary and links.

- [x] **Step 4: Preserve loading/error/empty states**

Loading must use skeletons matching the new layout. Error and empty states must remain visible.

- [x] **Step 5: Verify page**

Run:

```bash
npx eslint app/entrenos/page.tsx
npm run build
```

Expected: no lint errors, build succeeds.

### Task 3: Supabase temp handling and deploy

**Files:**
- Do not commit: `supabase/.temp/cli-latest`

- [x] **Step 1: Leave Supabase temp uncommitted**

The file only changes Supabase CLI cache from `v2.101.0` to `v2.102.0`. It is local tooling state, not product code.

- [ ] **Step 2: Commit product changes**

Commit only:

- `components/training/TrainingWorkspaceShell.tsx`
- `app/entrenos/layout.tsx`
- `app/entrenos/page.tsx`
- this plan if not already committed.

- [ ] **Step 3: Push and confirm deployment**

Run:

```bash
git push origin main
vercel inspect <latest-production-deployment>
```

Expected: production `Ready`, alias `https://nutricoach-delta.vercel.app`.
