# Recetario Chef Healthy Curation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Convert the recipe library into a curator-friendly system for attractive healthy recipes and AI-ready coverage.

**Architecture:** Keep the current Supabase taxonomy as the source of truth. Add frontend curation layers and prompt presets without adding expensive model calls or changing approval rules.

**Tech Stack:** Next.js App Router, React client components, Supabase, Tailwind utility classes, existing `lucide-react` icons.

---

### Task 1: Centralize Recipe Labels And Chef Collections

**Files:**
- Modify: `lib/recetario-taxonomia.ts`

- [ ] Export shared labels for objectives, sports, moments and styles.
- [ ] Add curated chef collection presets with target taxonomy and culinary direction.
- [ ] Keep values compatible with existing database arrays.

### Task 2: Improve Coverage Page As Production Dashboard

**Files:**
- Modify: `app/recetas/cobertura/page.tsx`

- [ ] Replace local duplicated labels with shared labels.
- [ ] Add chef collection cards: comfort healthy, street-food fit, performance bowls, batch gourmet and pre-competition.
- [ ] Allow each collection to prepare a brief and optional DeepSeek generation using the existing protected endpoint.
- [ ] Add clearer guidance about review-only import.

### Task 3: Improve Recipe Library Curation Filters

**Files:**
- Modify: `app/recetas/page.tsx`
- Modify: `components/premium/RecipeCardPremium.tsx`

- [ ] Fetch taxonomy fields needed for curation.
- [ ] Add visible curator filters: chef healthy, high adherence, batch/tupper, pre/post training, running/Hyrox/endurance.
- [ ] Show strategic stats for chef recipes, batch recipes and performance recipes.
- [ ] Display key taxonomy badges on recipe cards without covering photos.

### Task 4: Verify And Commit

**Commands:**
- `npx tsc --noEmit --pretty false`
- `npm run build`
- `git status -sb`
- `git add ... && git commit -m "feat: mejora curacion chef healthy del recetario"`
