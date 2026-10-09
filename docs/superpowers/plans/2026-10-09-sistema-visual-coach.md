# Sistema visual unificado para coach — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Aplicar a toda la app coach el sistema visual del portal cliente, optimizado para MacBook, sin cambiar rutas, datos ni flujos.

**Architecture:** Consolidar primero primitivas y tokens compartidos; actualizar después `CoachShell` y `Sidebar`; migrar los módulos por familias funcionales usando esos contratos. La compatibilidad se apoyará en las clases globales actuales para que las pantallas no migradas no se rompan entre fases.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript, Tailwind CSS 4, Geist, `@phosphor-icons/react`, Framer Motion, Playwright.

**Spec:** `docs/superpowers/specs/2026-10-09-sistema-visual-coach-design.md`

## Global Constraints

- Mantener rutas, APIs, modelos de datos, autenticación, permisos y lógica de negocio.
- Mantener la sidebar y la organización actual de navegación coach.
- No añadir dependencias; Phosphor, Geist y Framer Motion ya están instalados.
- Priorizar 1440×900 y 1512×982; conservar compatibilidad móvil.
- Mantener modo claro, oscuro y `prefers-reduced-motion`.
- Usar variables semánticas; no introducir colores decorativos aislados.
- No mezclar Lucide y Phosphor dentro de una pantalla migrada.
- No modificar archivos del portal cliente salvo primitivas realmente compartidas y retrocompatibles.

## Review Focus

- Una ruta coach profunda debe conservar sidebar, sección activa y acción contextual al recargar.
- Un MacBook de 1440×900 debe mostrar el contenido principal sin solapamientos ni scroll horizontal.
- Claro y oscuro deben conservar contraste y estados semánticos legibles.
- Sidebar, pestañas, modales y acciones deben poder recorrerse por teclado con foco visible.
- Un viewport móvil debe conservar menú, safe areas y acciones esenciales sin regresiones.

---

### Task 1: Contratos visuales y prueba de arquitectura

**Files:**
- Create: `components/ui/CoachPrimitives.tsx`
- Create: `scripts/test-coach-visual-system.ts`
- Modify: `app/globals.css`

**Interfaces:**
- Produces: `CoachPage`, `PageHeader`, `SectionHeader`, `Surface`, `Metric`, `StatusBadge`, `IconButton`.
- Produces: clases `.coach-page`, `.coach-page-header`, `.coach-surface`, `.coach-metric`, `.coach-status`.

- [ ] **Step 1: Escribir la prueba estática que exige las primitivas, tokens, focus y reduced motion**

La prueba leerá los archivos como texto y fallará si faltan exports, variables semánticas, `:focus-visible`, `font-variant-numeric: tabular-nums` o `prefers-reduced-motion`.

- [ ] **Step 2: Ejecutar la prueba y confirmar el fallo**

Run: `npx tsx scripts/test-coach-visual-system.ts`
Expected: FAIL porque `CoachPrimitives.tsx` y las clases nuevas aún no existen.

- [ ] **Step 3: Crear las primitivas mínimas y estilos compartidos**

Las props serán composición React estándar; ninguna primitiva realizará fetch, navegación o mutaciones. `CoachPage` impondrá ancho máximo y espaciado; `Surface` admitirá `level: 'base' | 'raised' | 'quiet'`; `StatusBadge` admitirá `tone: 'neutral' | 'success' | 'warning' | 'danger' | 'info'`.

- [ ] **Step 4: Ejecutar prueba, TypeScript y lint**

Run: `npx tsx scripts/test-coach-visual-system.ts && npx tsc --noEmit && npx eslint components/ui/CoachPrimitives.tsx`
Expected: PASS sin errores.

- [ ] **Step 5: Commit**

```bash
git add app/globals.css components/ui/CoachPrimitives.tsx scripts/test-coach-visual-system.ts
git commit -m "feat: consolida sistema visual coach"
```

### Task 2: Shell y navegación coach para MacBook

**Files:**
- Modify: `components/CoachShell.tsx`
- Modify: `components/Sidebar.tsx`
- Modify: `app/globals.css`
- Modify: `scripts/test-coach-visual-system.ts`

**Interfaces:**
- Consumes: tokens y primitivas de Task 1.
- Produces: shell estable con sidebar primaria/secundaria, topbar contextual y menú móvil.

- [ ] **Step 1: Ampliar la prueba para exigir Phosphor, landmarks y estado activo**

La prueba comprobará ausencia de `lucide-react` en ambos archivos, presencia de `nav`, `main`, `aria-current`, botón móvil etiquetado y clases de ancho MacBook.

- [ ] **Step 2: Ejecutar y confirmar el fallo por imports Lucide actuales**

Run: `npx tsx scripts/test-coach-visual-system.ts`
Expected: FAIL mencionando `lucide-react` en `CoachShell.tsx` y `Sidebar.tsx`.

- [ ] **Step 3: Migrar iconos y pulir estructura sin cambiar rutas**

Sustituir los iconos por equivalentes Phosphor, tipar con `Icon`, conservar matrices de navegación y funciones de path, normalizar pesos/tamaños y aplicar el nuevo contenedor al área principal.

- [ ] **Step 4: Verificar navegación y responsive**

Run: `npx tsx scripts/test-coach-visual-system.ts && npx tsc --noEmit && npx eslint components/CoachShell.tsx components/Sidebar.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add components/CoachShell.tsx components/Sidebar.tsx app/globals.css scripts/test-coach-visual-system.ts
git commit -m "feat: unifica shell visual del coach"
```

### Task 3: Dashboard e índice de clientes

**Files:**
- Modify: `app/dashboard/page.tsx`
- Modify: `components/dashboard/comun.tsx`
- Modify: `components/dashboard/NumerosClave.tsx`
- Modify: `components/dashboard/HoyCards.tsx`
- Modify: `components/dashboard/Accesos.tsx`
- Modify: `components/dashboard/CheckinsPendientes.tsx`
- Modify: `components/dashboard/AutoCoachPanel.tsx`
- Modify: `components/dashboard/KBPanel.tsx`
- Modify: `app/clientes/page.tsx`
- Modify: `components/clientes/ClientesToolbar.tsx`
- Modify: `components/clientes/ClientesTabla.tsx`
- Modify: `components/clientes/ClientesListaMobile.tsx`
- Create: `scripts/test-coach-primary-surfaces.ts`

**Interfaces:**
- Consumes: primitivas de Task 1 y shell de Task 2.
- Produces: patrón de referencia para cabeceras, métricas, filtros, tablas y estados.

- [ ] **Step 1: Escribir prueba estática de las superficies principales**

Comprobar `CoachPage`/`PageHeader`, Phosphor, cifras tabulares, tabla accesible, estado vacío y ausencia de anchos que provoquen overflow.

- [ ] **Step 2: Ejecutar y confirmar el fallo**

Run: `npx tsx scripts/test-coach-primary-surfaces.ts`
Expected: FAIL por el marcado anterior.

- [ ] **Step 3: Migrar dashboard preservando composición y datos**

Reutilizar las consultas y callbacks existentes. Cambiar únicamente estructura visual, iconos y clases; agrupar métricas sin añadir nuevas peticiones.

- [ ] **Step 4: Migrar listado de clientes preservando filtros, enlaces y acciones**

Usar `PageHeader`, controles compartidos, tabla para escritorio y lista actual para móvil. Mantener estados de onboarding, actividad y revisión.

- [ ] **Step 5: Verificar el bloque**

Run: `npx tsx scripts/test-coach-primary-surfaces.ts && npx tsc --noEmit && npx eslint app/dashboard/page.tsx app/clientes/page.tsx components/dashboard components/clientes/ClientesToolbar.tsx components/clientes/ClientesTabla.tsx components/clientes/ClientesListaMobile.tsx`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add app/dashboard components/dashboard app/clientes/page.tsx components/clientes/ClientesToolbar.tsx components/clientes/ClientesTabla.tsx components/clientes/ClientesListaMobile.tsx scripts/test-coach-primary-surfaces.ts
git commit -m "feat: aplica sistema visual a dashboard y clientes"
```

### Task 4: Operación principal — ficha, nutrición y entrenamiento

**Files:**
- Modify: `app/clientes/[id]/page.tsx`
- Modify: `components/clientes/ResumenCliente.tsx`
- Modify: `components/clientes/TrainingCoachPanel.tsx`
- Modify: `components/clientes/AnaliticasPanel.tsx`
- Modify: `app/nutricion/page.tsx`
- Modify: `app/dietas/page.tsx`
- Modify: `app/dietas/[id]/page.tsx`
- Modify: `app/entrenos/page.tsx`
- Modify: `app/entrenos/[id]/page.tsx`
- Modify: `app/entrenos/plantillas/page.tsx`
- Modify: `app/entrenos/ejercicios/page.tsx`
- Modify: `components/training/EntrenoKanban.tsx`
- Modify: `components/training/PlanTimeline.tsx`
- Modify: `components/training/PerfilEntrenoForm.tsx`
- Create: `scripts/test-coach-core-modules.ts`

**Interfaces:**
- Consumes: patrón de página, cabecera, surface, status y controles.
- Produces: patrón visual uniforme para detalle, edición, timeline, planificación y formularios densos.

- [ ] **Step 1: Escribir prueba de invariantes de módulos principales**

Comprobar cabeceras compartidas, tabs accesibles, inputs etiquetados, Phosphor en los archivos migrados y preservación textual de rutas/API críticas.

- [ ] **Step 2: Ejecutar y confirmar el fallo**

Run: `npx tsx scripts/test-coach-core-modules.ts`
Expected: FAIL antes de la migración.

- [ ] **Step 3: Migrar ficha de cliente y paneles principales**

Conservar carga diferida, query param `tab`, componentes funcionales y acciones. Normalizar navegación local, encabezado, estados y rejilla de MacBook.

- [ ] **Step 4: Migrar nutrición y dietas**

Conservar creación, edición, drag-and-drop y cálculos. Aplicar superficies, controles, tablas y jerarquía compartida.

- [ ] **Step 5: Migrar entrenamiento**

Conservar builders, calendarios, DnD, historial y acciones IA. Adaptar paneles densos a escritorio sin cambiar contratos.

- [ ] **Step 6: Verificar el bloque**

Run: `npx tsx scripts/test-coach-core-modules.ts && npx tsc --noEmit && npm run lint`
Expected: PASS o únicamente avisos preexistentes documentados.

- [ ] **Step 7: Commit**

```bash
git add app/clientes components/clientes app/nutricion app/dietas app/entrenos components/training scripts/test-coach-core-modules.ts
git commit -m "feat: unifica modulos operativos del coach"
```

### Task 5: Biblioteca, contenido y administración

**Files:**
- Modify: `app/recetas/page.tsx`
- Modify: `app/recetas/nueva/page.tsx`
- Modify: `app/recetas/[id]/page.tsx`
- Modify: `app/recetas/[id]/editar/page.tsx`
- Modify: `app/recetas/revisar/page.tsx`
- Modify: `app/recetas/auditoria/page.tsx`
- Modify: `app/recetas/cobertura/page.tsx`
- Modify: `app/recetas/imagenes/page.tsx`
- Modify: `components/recetas/ClasificacionEditor.tsx`
- Modify: `components/recetas/RecetaIngredienteItem.tsx`
- Modify: `components/recetas/RevisionTabs.tsx`
- Modify: `components/recetas/TaxonomiaRecetaPanel.tsx`
- Modify: `app/contenido/page.tsx`
- Modify: `components/contenido/*.tsx`
- Modify: `app/precios/page.tsx`
- Modify: `app/precios/escandallo/page.tsx`
- Modify: `app/precios/rentabilidad/page.tsx`
- Modify: `app/precios/scraping/page.tsx`
- Modify: `app/precios/browser-agent/page.tsx`
- Modify: `components/AdminPrecios.tsx`
- Modify: `components/EscandalloReceta.tsx`
- Modify: `components/DashboardRentabilidad.tsx`
- Modify: `app/compra/page.tsx`
- Modify: `components/ListaCompra.tsx`
- Modify: `app/agentes/page.tsx`
- Modify: `app/conocimiento/page.tsx`
- Modify: `app/conocimiento/nueva/page.tsx`
- Modify: `app/ajustes/page.tsx`
- Modify: `components/ajustes/AjustesPanel.tsx`
- Modify: `app/sistema/page.tsx`
- Create: `scripts/test-coach-secondary-modules.ts`

**Interfaces:**
- Consumes: sistema y patrones consolidados en Tasks 1–4.
- Produces: cobertura visual completa del coach.

- [ ] **Step 1: Crear inventario automático de rutas coach y prueba de cobertura**

La prueba enumerará páginas bajo layouts `CoachShell`, excluirá auth/onboarding/portal cliente y fallará si una pantalla migrada conserva imports Lucide o no usa el sistema compartido/compatibilidad aprobada.

- [ ] **Step 2: Ejecutar y confirmar el inventario fallido**

Run: `npx tsx scripts/test-coach-secondary-modules.ts`
Expected: FAIL con lista concreta de páginas pendientes.

- [ ] **Step 3: Migrar recetario y contenido**

Preservar filtros, estados de revisión, editores, calendarios y acciones. Sustituir iconografía y estilos locales incompatibles.

- [ ] **Step 4: Migrar costes, compra y administración**

Preservar scraping, cálculos, agentes, conocimiento y ajustes. Unificar tablas, formularios, estados y feedback.

- [ ] **Step 5: Ejecutar prueba de cobertura hasta quedar limpia**

Run: `npx tsx scripts/test-coach-secondary-modules.ts && npx tsc --noEmit && npm run lint`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add app/recetas components/recetas app/contenido components/contenido app/precios components/AdminPrecios.tsx components/EscandalloReceta.tsx components/DashboardRentabilidad.tsx app/compra components/ListaCompra.tsx app/agentes app/conocimiento app/ajustes components/ajustes app/sistema scripts/test-coach-secondary-modules.ts
git commit -m "feat: completa sistema visual de la app coach"
```

### Task 6: Verificación visual y regresión global

**Files:**
- Create: `tests/e2e/coach-visual-system.spec.ts`
- Modify: `scripts/test-coach-visual-system.ts`
- Modify: `docs/superpowers/plans/2026-10-09-sistema-visual-coach.md`

**Interfaces:**
- Consumes: app coach completa.
- Produces: evidencia reproducible de navegación, responsive, temas y accesibilidad básica.

- [ ] **Step 1: Añadir E2E para shell, dashboard y clientes**

Cubrir 1440×900, 1512×982 y 390×844; comprobar ausencia de overflow horizontal, navegación visible, `aria-current`, foco, apertura/cierre móvil y cambio de tema.

- [ ] **Step 2: Ejecutar pruebas estáticas, TypeScript y build**

Run: `npx tsx scripts/test-coach-visual-system.ts && npx tsx scripts/test-coach-primary-surfaces.ts && npx tsx scripts/test-coach-core-modules.ts && npx tsx scripts/test-coach-secondary-modules.ts && npx tsc --noEmit && npm run build`
Expected: PASS.

- [ ] **Step 3: Ejecutar E2E con entorno autenticado disponible**

Run: `npx playwright test tests/e2e/coach-visual-system.spec.ts`
Expected: PASS. Si el entorno no dispone de sesión coach, registrar el bloqueo exacto y ejecutar al menos las comprobaciones públicas/estáticas.

- [ ] **Step 4: Revisar diff y marcar checklist del plan**

Run: `git diff --check && git status --short`
Expected: sin errores de whitespace y sin archivos ajenos incluidos.

- [ ] **Step 5: Commit final**

```bash
git add tests/e2e/coach-visual-system.spec.ts scripts/test-coach-visual-system.ts docs/superpowers/plans/2026-10-09-sistema-visual-coach.md
git commit -m "test: verifica sistema visual unificado coach"
```
