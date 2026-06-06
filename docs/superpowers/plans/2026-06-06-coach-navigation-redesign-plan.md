# Coach Navigation Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reorganize coach navigation into clearer work areas and add a lightweight contextual head bar.

**Architecture:** Keep `CoachShell` as the global shell. Update `Sidebar` information architecture and add a `CoachTopBar` inside `CoachShell` above page content. Keep `TrainingWorkspaceShell` as training-specific secondary navigation.

**Tech Stack:** Next.js 16, React 19, TypeScript, Tailwind v4, lucide-react, existing CSS variables.

---

## File Structure

- Modify `components/Sidebar.tsx`: section grouping, labels, badges, active expansion.
- Modify `components/CoachShell.tsx`: add `CoachTopBar`, contextual breadcrumb, quick actions.
- Create `salidas/06-06-2026_navigation-redesign-report.md`: implementation notes and verification.

## Task 1: Sidebar IA

- [ ] Remove global `Inbox IA`/`Revisión IA` as a primary sidebar item.
- [ ] Move `Entrenamiento` from primary items into a `Entrenamiento` section.
- [ ] Group `Precios`, `Escandallo`, and `Rentabilidad` under `Nutrición`.
- [ ] Group methodology, knowledge base, and questionnaires under `Sistema`.
- [ ] Keep primary items short: `Inicio`, `Clientes`.

## Task 2: Sidebar Interaction Consistency

- [ ] Use the same expandable `SidebarSection` pattern for Nutrición, Entrenamiento, Negocio, Recetario, and Sistema.
- [ ] Auto-expand active section on route change.
- [ ] Keep badges for `Clientes` and recipe review queue.

## Task 3: Coach Top Bar

- [ ] Add `CoachTopBar` in `CoachShell`.
- [ ] Derive context from `pathname`.
- [ ] Show contextual title and breadcrumb.
- [ ] Add quick links to `/agentes` and the main action for the current area.
- [ ] Preserve mobile safe-area behavior.

## Task 4: Verification

- [ ] Run `npx eslint components/Sidebar.tsx components/CoachShell.tsx`.
- [ ] Run `npm run build`.
- [ ] Document result in `salidas/06-06-2026_navigation-redesign-report.md`.
