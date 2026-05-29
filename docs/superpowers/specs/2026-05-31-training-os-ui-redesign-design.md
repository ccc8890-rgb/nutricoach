# Training OS UI Redesign — Design Spec

## Goal

Rediseño visual completo del módulo de entrenamiento de NutriCoach. El módulo actual tiene 7 páginas sin cohesión visual, navegación fragmentada y sin experiencia real en móvil para el cliente. Este rediseño unifica coach y cliente bajo una estructura coherente, intuitiva y a la vanguardia.

## Decisiones de diseño aprobadas

| Área | Decisión |
|------|----------|
| Navegación coach | Sub-sidebar anidado (Coach / Biblioteca / IA) |
| Dashboard clientes | Lista densa tipo CRM — fila por cliente |
| Editor de plan | Timeline vertical continuo con drag & drop |
| Sesión cliente móvil | Card por ejercicio + sets en grid |
| Vista pasiva cliente | Toggle "Registrar / Solo ver" + vista semana |

---

## Arquitectura de páginas

### Coach

```
/entrenos                    → Dashboard (lista CRM clientes)
/entrenos/[id]               → Plan individual (timeline + drag&drop)
/entrenos/plantillas         → Biblioteca de plantillas
/entrenos/ejercicios         → Biblioteca de ejercicios
/entrenos/brain-ia           → Training Brain — proposals kanban
/entrenos/nueva              → Crear nuevo plan
/entrenos/generar-ia         → Generar plan con IA
```

### Cliente (portal)

```
/cliente/[codigo]            → Dashboard cliente (sin cambios)
/cliente/sesion/[id]         → Ejecutar sesión (rediseño completo)
/cliente/semana              → Vista semanal pasiva (nueva)
```

---

## 1. Navegación coach — Sub-sidebar Training OS

**Componente:** `components/training/TrainingSubNav.tsx`

El layout `app/entrenos/layout.tsx` envuelve todas las páginas del módulo con un sub-sidebar secundario que aparece dentro del `CoachShell` existente (no reemplaza el sidebar principal).

### Estructura del sub-sidebar

```
┌─────────────────────┐
│ 🏋️ Training OS      │  ← título de sección
├─────────────────────┤
│ COACH               │  ← label uppercase gris
│  ○ Dashboard        │  ← /entrenos
│  ○ Planes           │  ← lista planes por cliente
│  ○ Brain IA         │  ← /entrenos/brain-ia (kanban)
├─────────────────────┤
│ BIBLIOTECA          │
│  ○ Plantillas       │  ← /entrenos/plantillas
│  ○ Ejercicios       │  ← /entrenos/ejercicios
├─────────────────────┤
│ HERRAMIENTAS        │
│  ○ Generar plan IA  │  ← /entrenos/generar-ia
└─────────────────────┘
```

**Ancho:** 140px. Item activo: borde izquierdo morado + fondo rgba(168,85,247,0.06). Labels de sección en 8px gris oscuro uppercase.

---

## 2. Dashboard clientes — Lista CRM

**Archivo:** `app/entrenos/page.tsx` (reescritura)

### Layout

Cabecera con 3 chips de stats globales (sesiones/semana, planes activos, clientes activos). Buscador con `autoComplete="off"`. Tabla/lista densa debajo.

### Columnas por fila de cliente

```
[Avatar] [Nombre + plan] [Dots L M X J V S D] [Badge] [RPE] [Última sesión] [→]
```

- **Avatar:** Iniciales con gradiente morado/índigo
- **Nombre:** `font-weight:500` + nombre del plan en gris muted abajo
- **Dots:** 7 círculos de 7px, L→D. Morado si entrenó ese día, borde morado tenue si es hoy, gris si no
- **Badge:** `PR 🏆` verde / `Fatiga` rojo / `OK` morado / `—` gris — basado en datos de `prs_por_ejercicio` + RPE
- **RPE:** número RPE medio de últimas 2 sesiones, rojo si ≥8.5
- **Última sesión:** texto relativo ("Hoy", "Ayer", "Hace 3 días")
- **→:** link a `/entrenos/[plan_id]`

### Ordenación por defecto

Clientes con `Fatiga` o sin actividad reciente primero, luego activos con PR, luego resto.

---

## 3. Editor de plan — Timeline vertical con drag & drop

**Archivo:** `app/entrenos/[id]/page.tsx` (reescritura)
**Componente:** `components/training/PlanTimeline.tsx`

### Estructura

Cabecera con nombre del plan, cliente, badge activo/inactivo y botón "Guardar cambios".

El cuerpo es un scroll vertical continuo:

```
── Semana 1 ──────────────────────  ← divider morado + línea gris
  Lunes
  [⠿] Press banca      4×6 @RPE8  [↕]  ← card ejercicio
  [⠿] Press inclinado  3×8        [↕]
  [+ Añadir ejercicio]

  Miércoles
  [⠿] Dominadas       4×5 @RPE8  [↕]
  [zona drop punteada si drag activo]

── Semana 2 ──────────────────────
  ...
```

### Drag & drop

- Handle `⠿` en el lado izquierdo de cada card
- Reordenar dentro del mismo día: drag vertical, zona de drop punteada entre cards
- Mover a otro día/semana: botón `↕` en el lado derecho abre un popup modal con selector de semana y día destino
- Al soltar: actualiza `orden` en `sesion_ejercicios` via PATCH
- Librería: `@dnd-kit/core` + `@dnd-kit/sortable` (ya estaba en el proyecto o instalar)

### Click en card ejercicio

Expande inline: muestra series/reps/descanso/RPE target editables + campo `instruccion_ejercicio` (textarea) + botón 🤖 para generar `contexto_ia`.

---

## 4. Sesión cliente móvil — Card + sets en grid

**Archivo:** `app/cliente/sesion/[id]/page.tsx` (reescritura)
**Componente:** `components/training/SesionCardMobile.tsx`

### Toggle modo

En la cabecera de la sesión: toggle pill **"Registrar | Solo ver"**.

- Por defecto: **Registrar** (comportamiento actual mejorado)
- Alternativa: **Solo ver** — vista de solo lectura

### Modo Registrar

Una card por ejercicio, pantalla completa:

```
┌─────────────────────────┐
│ Progreso: ████░░  2/6   │  ← barra + fracción
│ Press banca             │  ← nombre grande
│ Objetivo: 4×6 @RPE8    │  ← target en gris
│                         │
│ [Set 1✓] [Set 2✓] [Set 3▶] [Set 4○]  │  ← grid 2×2 o 2×n
│  80kg×6   80kg×6  ← tap  ←            │
│                         │
│ [← Anterior] [Registrar set →]        │
└─────────────────────────┘
```

Al tocar el set activo: modal/sheet con inputs `kg` y `reps` (números grandes) + selector RPE 1-10.
Sets completados: fondo morado tenue, checkmark. Set activo: borde morado sólido.

Al completar todos los sets del ejercicio: avanza automáticamente al siguiente.
Al terminar todos los ejercicios: pantalla de cierre con RPE global + notas opcionales.

### Modo Solo ver

Lista limpia de todos los ejercicios con número, nombre, series×reps, y la `instruccion_ejercicio` del coach si existe. Sin inputs, sin registro. Botón al final: "Cambiar a modo registro".

---

## 5. Vista semanal cliente

**Archivo:** `app/cliente/semana/page.tsx` (nuevo)

Accesible desde el dashboard del cliente. Muestra todas las sesiones de la semana actual:

```
Semana 3 — Gym Fuerza Base

[L] Empuje A    6 ej · ~55 min   [HOY]
[X] Tirón A     5 ej · ~50 min   Mié
[V] Pierna A    7 ej · ~65 min   Vie
[S] Descanso
```

- Día de hoy resaltado con badge morado
- Click en sesión → `/cliente/sesion/[id]` en modo Solo ver por defecto
- Sesiones ya realizadas con checkmark verde

---

## Componentes nuevos

| Componente | Responsabilidad |
|------------|----------------|
| `TrainingSubNav.tsx` | Sub-sidebar con secciones Coach / Biblioteca / Herramientas |
| `PlanTimeline.tsx` | Timeline vertical con semanas, días y cards de ejercicio |
| `SesionCardMobile.tsx` | Card de ejercicio con grid de sets para móvil |
| `SetRegistroSheet.tsx` | Modal/sheet para introducir kg, reps y RPE por set |

---

## Archivos modificados

| Archivo | Cambio |
|---------|--------|
| `app/entrenos/layout.tsx` | Añadir `TrainingSubNav` |
| `app/entrenos/page.tsx` | Reescribir como lista CRM |
| `app/entrenos/[id]/page.tsx` | Reescribir como timeline con drag & drop |
| `app/cliente/sesion/[id]/page.tsx` | Reescribir con cards + toggle |

## Archivos nuevos

| Archivo | |
|---------|--|
| `app/cliente/semana/page.tsx` | Vista semanal pasiva |
| `components/training/TrainingSubNav.tsx` | |
| `components/training/PlanTimeline.tsx` | |
| `components/training/SesionCardMobile.tsx` | |
| `components/training/SetRegistroSheet.tsx` | |

---

## Fases de implementación sugeridas

| Fase | Scope | Prioridad |
|------|-------|-----------|
| F-UI-1 | Sub-sidebar + layout | Alta — desbloquea todo lo demás |
| F-UI-2 | Dashboard CRM lista | Alta — lo que el coach ve a diario |
| F-UI-3 | Timeline plan + drag & drop | Alta — núcleo del editor |
| F-UI-4 | Sesión cliente card + sets grid + toggle | Alta — experiencia cliente |
| F-UI-5 | Vista semanal cliente | Media — nice-to-have |

---

## Restricciones técnicas

- No añadir nuevas tablas SQL — todo se construye sobre el schema existente
- Drag & drop con `@dnd-kit` (instalar si no está) — no otras librerías DnD
- CSS variables existentes (`var(--text)`, `var(--surface)`, `var(--border)`) — no hardcodear colores
- Paleta: morado `rgb(168,85,247)` para Training OS, semánticos pastel para badges
- Mobile-first en todo el portal cliente — mínimo 44px de touch target
- `autoComplete="off"` en todos los inputs de búsqueda
