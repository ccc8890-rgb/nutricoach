# Design System v8 "Instrument" — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Migrar NutriCoach de Design System v7 (acento índigo #6366F1) al sistema v8 "Instrument" — base acromática fría con color semántico pastel solo para estados y datos.

**Architecture:** El 95% del trabajo está en `globals.css` — los 351 componentes que usan `var(--accent)` / `var(--primary)` heredan automáticamente los nuevos valores sin tocarlos. Solo hay 9 archivos con hex hardcodeados que requieren edición manual.

**Tech Stack:** Next.js 16, Tailwind v4, CSS custom properties, TypeScript

---

## Archivos afectados

| Archivo | Tipo de cambio |
|---|---|
| `app/globals.css` | **Modificar** — tokens completos + clases semánticas nuevas |
| `DESIGN.md` | **Modificar** — actualizar versión y paleta |
| `.gitignore` | **Modificar** — añadir `.superpowers/` |
| `app/dietas/alimentos/page.tsx` | **Modificar** — 1 hex hardcoded |
| `app/dietas/[id]/page.tsx` | **Modificar** — 1 hex hardcoded |
| `components/PortalCliente/IntegracionesPanel.tsx` | **Modificar** — 1 hex hardcoded |
| `components/PortalCliente/GarminMiniCard.tsx` | **Modificar** — 1 hex hardcoded |
| `components/PortalCliente/MiPlan.tsx` | **Modificar** — 1 hex hardcoded |
| `components/PortalCliente/MealCard.tsx` | **Modificar** — 2 hex hardcoded |
| `components/clientes/ClientesTabla.tsx` | **Modificar** — 1 hex hardcoded |
| `lib/alto-rendimiento/macros-por-fase.ts` | **Modificar** — 1 hex + 1 clase Tailwind indigo |
| `lib/entrenos/utils.ts` | **Modificar** — 3 clases Tailwind indigo |

---

## Task 1: Tokens base en globals.css — dark theme

**Files:**
- Modify: `app/globals.css` (`:root` block, líneas 16-88)

- [ ] **Step 1: Reemplazar el bloque `:root` completo**

Sustituir todo el bloque `:root { ... }` (líneas 16-88) por:

```css
:root {
  color-scheme: dark;

  /* ── Easing curves ── */
  --ease-out-strong: cubic-bezier(0.23, 1, 0.32, 1);
  --ease-in-out-strong: cubic-bezier(0.77, 0, 0.175, 1);
  --ease-drawer: cubic-bezier(0.32, 0.72, 0, 1);
  --ease-spring: cubic-bezier(0.34, 1.56, 0.64, 1);

  /* ── Acento — acromático frío (reemplaza índigo) ── */
  /* --accent es ahora el blanco/plata: usado como bg de btn-primary */
  --accent: #E8E8F0;
  --accent-dark: #C8C8D0;
  --accent-light: #F5F5F7;
  --accent-bg: rgba(232, 232, 240, 0.07);
  --accent-glow: rgba(232, 232, 240, 0.08);
  --accent-ring: rgba(232, 232, 240, 0.12);

  /* ── Neutral — Deep Dark Cold ── */
  --bg: #060608;
  --bg-subtle: #09090B;
  --surface: #0E0E11;
  --surface-hover: #121216;
  --surface-elevated: #141418;
  --border: #161619;
  --border-light: #111114;
  --border-strong: #222228;
  --border-accent: rgba(232, 232, 240, 0.08);

  /* ── Text ── */
  --text: #E8E8F0;
  --text-secondary: #808088;
  --text-muted: #383840;
  --text-disabled: #242428;

  /* ── Glass ── */
  --glass-bg: rgba(14, 14, 17, 0.72);
  --glass-border: rgba(22, 22, 25, 0.6);
  --glass-shadow: 0 8px 32px rgba(0, 0, 0, 0.6);

  /* ── Macronutrientes — soft pastel sobre negro ── */
  --macro-protein: #6AAF85;
  --macro-carbs: #8A9AB8;
  --macro-fat: #C8A96A;
  --macro-calories: #E8E8F0;

  /* ── Semántico — SOLO para estados, alertas y datos ── */
  --semantic-active: #6AAF85;
  --semantic-active-bg: rgba(106, 175, 133, 0.08);
  --semantic-active-border: rgba(106, 175, 133, 0.18);
  --semantic-active-text: #4A8F65;

  --semantic-warn: #C8A96A;
  --semantic-warn-bg: rgba(200, 169, 106, 0.08);
  --semantic-warn-border: rgba(200, 169, 106, 0.18);
  --semantic-warn-text: #A88848;

  --semantic-alert: #B86A6A;
  --semantic-alert-bg: rgba(184, 106, 106, 0.08);
  --semantic-alert-border: rgba(184, 106, 106, 0.18);
  --semantic-alert-text: #986060;

  --semantic-info: #8A9AB8;
  --semantic-info-bg: rgba(138, 154, 184, 0.08);
  --semantic-info-border: rgba(138, 154, 184, 0.18);
  --semantic-info-text: #6A7A98;

  /* ── Estados legacy (backward compat — apuntan a semánticos) ── */
  --success: var(--semantic-active);
  --success-bg: var(--semantic-active-bg);
  --warning: var(--semantic-warn);
  --warning-bg: var(--semantic-warn-bg);
  --error: var(--semantic-alert);
  --error-bg: var(--semantic-alert-bg);
  --info: var(--semantic-info);
  --info-bg: var(--semantic-info-bg);

  /* ── Shadows ── */
  --shadow-sm: 0 1px 2px rgba(0, 0, 0, 0.4);
  --shadow-md: 0 4px 12px rgba(0, 0, 0, 0.5);
  --shadow-lg: 0 8px 24px rgba(0, 0, 0, 0.6);
  --shadow-xl: 0 12px 48px rgba(0, 0, 0, 0.7);
  --shadow-glow: 0 0 20px var(--accent-glow);
  --shadow-glow-strong: 0 0 36px var(--accent-glow);

  /* ── Safe areas ── */
  --safe-top: env(safe-area-inset-top, 0px);
  --safe-bottom: env(safe-area-inset-bottom, 0px);
  --safe-left: env(safe-area-inset-left, 0px);
  --safe-right: env(safe-area-inset-right, 0px);
  --header-height: 56px;

  /* ── Aliases para compatibilidad ── */
  --primary: var(--accent);
  --primary-dark: var(--accent-dark);
  --primary-bg: var(--accent-bg);
}
```

- [ ] **Step 2: Reemplazar bloque `.light`**

Sustituir el bloque `.light { ... }` (líneas 93-152) por:

```css
.light {
  color-scheme: light;

  /* Light mantiene tokens estructurales pero no es prioridad v8 */
  --accent: #1C1C1E;
  --accent-dark: #2C2C2E;
  --accent-light: #3A3A3C;
  --accent-bg: rgba(28, 28, 30, 0.06);
  --accent-glow: rgba(28, 28, 30, 0.08);
  --accent-ring: rgba(28, 28, 30, 0.14);

  --bg: #F5F5F7;
  --bg-subtle: #EBEBED;
  --surface: #FFFFFF;
  --surface-hover: #F8F8FA;
  --surface-elevated: #FFFFFF;
  --border: #D1D1D6;
  --border-light: #E5E5EA;
  --border-strong: #AEAEB2;
  --border-accent: rgba(60, 60, 67, 0.12);

  --text: #1C1C1E;
  --text-secondary: #636366;
  --text-muted: #AEAEB2;
  --text-disabled: #C7C7CC;

  --glass-bg: rgba(255, 255, 255, 0.78);
  --glass-border: rgba(209, 209, 214, 0.6);
  --glass-shadow: 0 8px 32px rgba(0, 0, 0, 0.06);

  --macro-protein: #3D9E6B;
  --macro-carbs: #5A7A9E;
  --macro-fat: #A87840;
  --macro-calories: #1C1C1E;

  --semantic-active: #3D9E6B;
  --semantic-active-bg: rgba(61, 158, 107, 0.08);
  --semantic-active-border: rgba(61, 158, 107, 0.2);
  --semantic-active-text: #2D7A52;

  --semantic-warn: #A87840;
  --semantic-warn-bg: rgba(168, 120, 64, 0.08);
  --semantic-warn-border: rgba(168, 120, 64, 0.2);
  --semantic-warn-text: #8A6030;

  --semantic-alert: #C05050;
  --semantic-alert-bg: rgba(192, 80, 80, 0.08);
  --semantic-alert-border: rgba(192, 80, 80, 0.2);
  --semantic-alert-text: #A03838;

  --semantic-info: #5A7A9E;
  --semantic-info-bg: rgba(90, 122, 158, 0.08);
  --semantic-info-border: rgba(90, 122, 158, 0.2);
  --semantic-info-text: #426080;

  --success: var(--semantic-active);
  --success-bg: var(--semantic-active-bg);
  --warning: var(--semantic-warn);
  --warning-bg: var(--semantic-warn-bg);
  --error: var(--semantic-alert);
  --error-bg: var(--semantic-alert-bg);
  --info: var(--semantic-info);
  --info-bg: var(--semantic-info-bg);

  --shadow-sm: 0 1px 2px rgba(0, 0, 0, 0.04);
  --shadow-md: 0 4px 12px rgba(0, 0, 0, 0.06);
  --shadow-lg: 0 8px 24px rgba(0, 0, 0, 0.08);
  --shadow-xl: 0 12px 48px rgba(0, 0, 0, 0.1);
  --shadow-glow: 0 0 15px var(--accent-glow);
  --shadow-glow-strong: 0 0 25px var(--accent-glow);

  --primary: var(--accent);
  --primary-dark: var(--accent-dark);
  --primary-bg: var(--accent-bg);
}
```

- [ ] **Step 3: Actualizar `.btn-primary`**

Localizar el bloque `.btn-primary` (buscar `background: var(--accent)`) y reemplazar:

```css
.btn-primary {
  background: var(--accent);
  color: var(--bg);
}

.btn-primary:hover:not(:disabled) {
  background: var(--accent-dark);
  box-shadow: 0 0 16px var(--accent-glow);
  transform: translateY(-1px);
}
```

> Antes era `color: #ffffff`. Ahora es `color: var(--bg)` porque `--accent` es casi blanco y necesita el fondo oscuro como contraste.

- [ ] **Step 4: Actualizar `.sidebar-link.active`**

Localizar `.sidebar-link.active` y reemplazar:

```css
.sidebar-link.active {
  background: var(--surface-elevated);
  color: var(--text);
  border-left: 2px solid var(--text-secondary);
}
```

> Antes usaba `--accent-bg` (fondo índigo). Ahora usa superficie elevada + borde izquierdo plateado.

- [ ] **Step 5: Actualizar `.input:focus`**

Localizar `.input:focus` y reemplazar:

```css
.input:focus {
  border-color: var(--border-strong);
  box-shadow: 0 0 0 3px var(--accent-bg);
}
```

- [ ] **Step 6: Actualizar `::selection`**

Localizar `::selection` y reemplazar:

```css
::selection {
  background: var(--accent-bg);
  color: var(--text);
}
```

- [ ] **Step 7: Añadir clases de badge semántico** al final de globals.css, antes del último `}`:

```css
/* ═══════════════════════════════════════════════════════════════
   SEMANTIC BADGES — solo para estados y datos, nunca UI chrome
   ═══════════════════════════════════════════════════════════════ */
.badge-active {
  background: var(--semantic-active-bg);
  border: 1px solid var(--semantic-active-border);
  color: var(--semantic-active-text);
}

.badge-warn {
  background: var(--semantic-warn-bg);
  border: 1px solid var(--semantic-warn-border);
  color: var(--semantic-warn-text);
}

.badge-alert {
  background: var(--semantic-alert-bg);
  border: 1px solid var(--semantic-alert-border);
  color: var(--semantic-alert-text);
}

.badge-info {
  background: var(--semantic-info-bg);
  border: 1px solid var(--semantic-info-border);
  color: var(--semantic-info-text);
}

/* Punto de estado (5-6px, inline) */
.status-dot {
  display: inline-block;
  width: 5px;
  height: 5px;
  border-radius: 50%;
  flex-shrink: 0;
}

.status-dot-active { background: var(--semantic-active); }
.status-dot-warn   { background: var(--semantic-warn); }
.status-dot-alert  { background: var(--semantic-alert); }
.status-dot-muted  { background: var(--text-disabled); border: 1px solid var(--border); }
```

- [ ] **Step 8: Actualizar cabecera del fichero**

Reemplazar el comentario inicial (líneas 1-8) por:

```css
/* ═══════════════════════════════════════════════════════════════
   Casanova Nutrition — Design System v8 "Instrument"
   ═══════════════════════════════════════════════════════════════
   - Base acromática fría (negro #060608, plata #E8E8F0)
   - Color semántico pastel solo para estados y datos
   - Coach: Razor (flat, hairlines) / Cliente: Slate Pro (elevación)
   - Cero índigo, cero azul royal, cero verde néon
   ═══════════════════════════════════════════════════════════════ */
```

- [ ] **Step 9: Verificar build**

```bash
npm run build 2>&1 | tail -20
```

Esperado: `✓ Compiled successfully` o similar. Si hay errores de CSS, son de sintaxis — revisar llaves balanceadas.

- [ ] **Step 10: Commit**

```bash
git add app/globals.css
git commit -m "feat(design): v8 Instrument — tokens acromáticos fríos + semántico pastel"
```

---

## Task 2: Corregir hex hardcoded — archivos de datos/lógica

**Files:**
- Modify: `lib/alto-rendimiento/macros-por-fase.ts:79`
- Modify: `lib/entrenos/utils.ts:25`

- [ ] **Step 1: Actualizar `macros-por-fase.ts`**

En `lib/alto-rendimiento/macros-por-fase.ts`, localizar la línea con `race_day`:

```ts
// ANTES:
race_day: { bg: '#4F46E5', text: '#FFFFFF', badge: 'bg-indigo-600 text-white' },

// DESPUÉS:
race_day: { bg: '#222228', text: '#E8E8F0', badge: 'bg-[#222228] text-[#E8E8F0] border border-[#383840]' },
```

- [ ] **Step 2: Actualizar `entrenos/utils.ts`**

En `lib/entrenos/utils.ts`, localizar la entrada `calistenia`:

```ts
// ANTES:
calistenia: { label: 'Calistenia', Icon: Dumbbell, color: 'text-indigo-600', bg: 'bg-indigo-50', border: 'border-indigo-200', bgRgba: 'rgba(99,102,241,0.15)', colorRgb: 'rgb(99,102,241)' },

// DESPUÉS:
calistenia: { label: 'Calistenia', Icon: Dumbbell, color: 'text-[#808088]', bg: 'bg-[#0E0E11]', border: 'border-[#161619]', bgRgba: 'rgba(128,128,136,0.12)', colorRgb: 'rgb(128,128,136)' },
```

- [ ] **Step 3: Commit**

```bash
git add lib/alto-rendimiento/macros-por-fase.ts lib/entrenos/utils.ts
git commit -m "fix(design): reemplazar clases indigo hardcoded en lógica de datos"
```

---

## Task 3: Corregir hex hardcoded — componentes UI

**Files:**
- Modify: `app/dietas/alimentos/page.tsx:101`
- Modify: `app/dietas/[id]/page.tsx:742`
- Modify: `components/PortalCliente/IntegracionesPanel.tsx:502`
- Modify: `components/PortalCliente/GarminMiniCard.tsx:361`
- Modify: `components/PortalCliente/MiPlan.tsx:437`
- Modify: `components/PortalCliente/MealCard.tsx:13,177`
- Modify: `components/clientes/ClientesTabla.tsx:34`

- [ ] **Step 1: `app/dietas/alimentos/page.tsx` — calcio_mg color**

Localizar línea ~101 con `color: '#6366F1'` en el array de micronutrientes. Reemplazar:

```ts
// ANTES:
{ key: 'calcio_mg', label: 'Ca', unit: 'mg', color: '#6366F1' },

// DESPUÉS:
{ key: 'calcio_mg', label: 'Ca', unit: 'mg', color: '#8A9AB8' },
```

> `#8A9AB8` es el slate azul desaturado del sistema semántico (`--semantic-info`).

- [ ] **Step 2: `app/dietas/[id]/page.tsx` — vitamina_a_ug color**

Localizar línea ~742 con `color: '#6366F1'` en el objeto de micronutrientes. Reemplazar:

```ts
// ANTES:
vitamina_a_ug: { label: 'Vit A', idr: 800, unit: 'µg', color: '#6366F1' },

// DESPUÉS:
vitamina_a_ug: { label: 'Vit A', idr: 800, unit: 'µg', color: '#8A9AB8' },
```

- [ ] **Step 3: `components/PortalCliente/IntegracionesPanel.tsx` — sueño color**

Localizar línea ~502 con `color="#818CF8"`:

```tsx
// ANTES:
<StatPill label="Sueño" value={hoy.sueno_h.toFixed(1)} unit="h" color="#818CF8" />

// DESPUÉS:
<StatPill label="Sueño" value={hoy.sueno_h.toFixed(1)} unit="h" color="#8A9AB8" />
```

- [ ] **Step 4: `components/PortalCliente/GarminMiniCard.tsx` — sleep color**

Localizar línea ~361 con `color: '#818CF8'`:

```ts
// ANTES:
color: '#818CF8',

// DESPUÉS:
color: '#8A9AB8',
```

- [ ] **Step 5: `components/PortalCliente/MiPlan.tsx` — día de descanso color**

Localizar línea ~437 con `#6366f1`:

```ts
// ANTES:
const color = esDescanso ? '#6366f1' : '#f59e0b'

// DESPUÉS:
const color = esDescanso ? '#808088' : '#C8A96A'
```

> Día de descanso → gris neutro. Día de entrenamiento → ámbar del sistema.

- [ ] **Step 6: `components/PortalCliente/MealCard.tsx` — tipo Cena**

Localizar líneas ~13 y ~177 con `#4F46E5`:

```ts
// ANTES (línea ~13):
'Cena': '#4F46E5',

// DESPUÉS:
'Cena': '#6AAF85',
```

```tsx
// ANTES (línea ~177):
<span className="text-xs font-medium px-2 py-1 rounded-full"
  style={{ backgroundColor: '#4F46E520', color: '#4F46E5' }}>

// DESPUÉS:
<span className="text-xs font-medium px-2 py-1 rounded-full badge badge-info">
```

> Eliminar el style inline, usar la clase `.badge.badge-info` del sistema.

- [ ] **Step 7: `components/clientes/ClientesTabla.tsx` — barra membresía**

Localizar línea ~34:

```ts
// ANTES:
const barColor = dias !== null && dias <= 30 ? 'var(--error)' : 'var(--primary, #6366f1)'

// DESPUÉS:
const barColor = dias !== null && dias <= 30 ? 'var(--semantic-alert)' : 'var(--semantic-active)'
```

> Membresía próxima a vencer (≤30d) → rojo dusty rose. Vigente → verde salvia.

- [ ] **Step 8: Verificar TypeScript**

```bash
npx tsc --noEmit --pretty false 2>&1 | grep -E "error TS" | head -20
```

Esperado: 0 errores. Si hay errores relacionados con el cambio de clase en MealCard.tsx (Step 6), verificar que `.badge` y `.badge-info` existen en globals.css (Task 1, Step 7).

- [ ] **Step 9: Commit**

```bash
git add \
  app/dietas/alimentos/page.tsx \
  app/dietas/[id]/page.tsx \
  components/PortalCliente/IntegracionesPanel.tsx \
  components/PortalCliente/GarminMiniCard.tsx \
  components/PortalCliente/MiPlan.tsx \
  components/PortalCliente/MealCard.tsx \
  components/clientes/ClientesTabla.tsx
git commit -m "fix(design): reemplazar hex índigo hardcoded en componentes UI"
```

---

## Task 4: Actualizar DESIGN.md y .gitignore

**Files:**
- Modify: `DESIGN.md`
- Modify: `.gitignore`

- [ ] **Step 1: Actualizar DESIGN.md**

Reemplazar el bloque `colors:` en `DESIGN.md` por:

```yaml
colors:
  accent: "#E8E8F0"
  accent-dark: "#C8C8D0"
  accent-light: "#F5F5F7"
  bg: "#060608"
  bg-subtle: "#09090B"
  surface: "#0E0E11"
  border: "#161619"
  text: "#E8E8F0"
  text-secondary: "#808088"
  text-muted: "#383840"
  semantic-active: "#6AAF85"
  semantic-warn: "#C8A96A"
  semantic-alert: "#B86A6A"
  semantic-info: "#8A9AB8"
  macro-protein: "#6AAF85"
  macro-carbs: "#8A9AB8"
  macro-fat: "#C8A96A"
  macro-calories: "#E8E8F0"
```

También actualizar la primera línea del yaml:

```yaml
# ANTES:
name: Casanova Nutrition
description: Plataforma profesional de coaching nutricional y entrenamiento — Instrumento clínico deportivo premium

# DESPUÉS: (sin cambio, la descripción ya es correcta)
```

Actualizar la cabecera del archivo si tiene referencia a "Indigo Pro":

Buscar cualquier mención de "Indigo" o "índigo" en `DESIGN.md` y reemplazar por "Instrument" o "acromático".

- [ ] **Step 2: Añadir `.superpowers/` a .gitignore**

```bash
echo "" >> .gitignore
echo "# Visual brainstorming sessions" >> .gitignore
echo ".superpowers/" >> .gitignore
```

- [ ] **Step 3: Commit**

```bash
git add DESIGN.md .gitignore
git commit -m "docs(design): actualizar DESIGN.md a v8 + ignorar .superpowers/"
```

---

## Task 5: Verificación final

**Files:** ninguno nuevo

- [ ] **Step 1: Build de producción**

```bash
npm run build 2>&1 | tail -30
```

Esperado: build exitoso, 0 errores TypeScript.

- [ ] **Step 2: Grep de verificación — sin índigo residual**

```bash
grep -rn "#6366F1\|#4F46E5\|#818CF8\|indigo-[0-9]" \
  app components lib \
  --include="*.tsx" --include="*.ts" \
  2>/dev/null | grep -v "node_modules\|.next\|design\|spec\|plan"
```

Esperado: 0 resultados. Si hay resultados, son hex residuales — reemplazar por el token semántico más apropiado de la tabla:

| Color residual | Reemplazar por |
|---|---|
| `#6366F1` (índigo) | `#8A9AB8` (slate info) o `var(--text-secondary)` |
| `#4F46E5` (índigo dark) | `#222228` (superficie elevada) |
| `#818CF8` (índigo light) | `#8A9AB8` (slate info) |
| `indigo-600` | `[#808088]` |
| `indigo-50` | `[#0E0E11]` |
| `indigo-200` | `[#161619]` |

- [ ] **Step 3: Commit final si hubo arreglos**

```bash
git add -A
git commit -m "fix(design): limpiar hex índigo residuales detectados en verificación"
```

---

## Resultado esperado

Tras completar los 5 tasks:
- `var(--accent)` → `#E8E8F0` (plata fría) en todos los componentes automáticamente
- `.btn-primary` → fondo blanco/plata, texto negro — el único "acento" visible
- Estados de cliente → verde salvia / ámbar / dusty rose según adherencia
- Macros → paleta pastel desaturada (no néon)
- 0 referencias a índigo en toda la codebase
- `npm run build` sin errores
