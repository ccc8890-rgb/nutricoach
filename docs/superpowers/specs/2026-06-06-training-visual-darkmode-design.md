# Spec — Training visual diferenciado + dark mode fixes

**Fecha:** 06-06-2026  
**Scope:** Portal cliente — tab "plan" + página `/cliente/semana`  
**Archivos afectados:** `SemanaEntrenoCard.tsx`, `app/cliente/page.tsx`, `app/cliente/semana/page.tsx`

---

## Problema

1. En el tab "plan" del portal cliente, la sección de dieta y la de entrenamiento tienen el mismo nivel visual. Un divider fino con texto es la única separación — no hay jerarquía perceptual clara.
2. En dark mode, varios textos secundarios (subtítulos de sesión, leyenda de dots, metadata de ejercicios, labels de stats) usan `var(--text-muted)` (`#6F6F78`) o valores hardcoded aún más oscuros (`#3A3A45`, `#4A4A55`) que tienen ratio de contraste insuficiente (<4.5:1) sobre el fondo `#0E0E11`.
3. El botón "Ver entreno" usa un fondo sutil que en dark mode apenas se distingue del fondo de la card.

---

## Decisiones de diseño

- **Variante elegida: B1** — La sección de entrenamiento se convierte en un bloque visual propio con header diferenciado (gradiente indigo sutil + pill "Hoy: [día]"). No se añade un tab nuevo ni se mueve a otra página.
- El separador existente (divider con texto "Entrenamiento") se elimina porque el header de la nueva card ya actúa como separador.
- Los fixes de dark mode se aplican en todos los archivos de training del portal cliente.

---

## Cambios por archivo

### 1. `components/training/SemanaEntrenoCard.tsx`

**Header nuevo (envuelve el contenido existente):**
```
┌─────────────────────────────────────────────┐
│ 🏋️ Entrenamiento          [Hoy: Viernes]   │  ← gradiente indigo sutil
│    Híbrido Elite · 4 días / semana                                │
├─────────────────────────────────────────────┤
│  L   M   ✓   J  [V]  S   D                 │  ← dots existentes
│  ● Hoy  ● Entreno  ● Hecho  ● Descanso     │  ← leyenda con colores correctos
│                                             │
│  [▶] Fuerza + Carrera         [Empezar]    │  ← CTA sólido indigo
│       8 ej · ~55 min · RPE 7-8             │
│                                             │
│  RESTO DE LA SEMANA                         │
│  L  Upper + HYROX          6 ej · 50m  ›   │
│  X  Lower + Running        ✓ Completada    │
│  S  Cardio Zona 2          60m          ›   │
│                                             │
│  Ver semana completa                    ›   │
└─────────────────────────────────────────────┘
```

**Tokens de color a aplicar:**
| Elemento | Color actual | Color nuevo |
|---|---|---|
| Subtítulo plan (días/semana) | `var(--text-muted)` | `#9898A0` |
| Leyenda dot "Hoy" | `var(--semantic-active)` | `#818CF8` |
| Leyenda dot "Entreno" | `var(--semantic-info)` | `#8A9AB8` |
| Leyenda dot "Completado" | `var(--semantic-active)` | `#4ADE80` |
| Leyenda dot "Descanso" | `rgba(128,128,128,0.5)` | `#45454F` |
| Metadata sesión (día, ej, min) | `var(--text-muted)` | `#9898A0` |
| Botón CTA día actual | bg sutil + texto azul | bg `#6366F1` + texto `white` |
| Botón "Ver entreno" días no-hoy | bg sutil + texto azul | `rgba(99,102,241,0.12)` + texto `#818CF8` |
| Badge "Completada" en lista | `var(--semantic-active)` | `#4ADE80` |
| Nombres otras sesiones | `var(--text)` | `#E8E8F0` |

**Header wrapper:**
```tsx
// background del header
background: "linear-gradient(135deg, rgba(99,102,241,0.08) 0%, transparent 60%)"
// pill "Hoy: X" solo cuando todaySession existe
background: rgba(99,102,241,0.12), color: #818CF8, border: rgba(99,102,241,0.22)
// cuando es día de descanso: mostrar solo el día en text-muted, sin pill
```

---

### 2. `app/cliente/page.tsx`

- Eliminar el bloque del divider separador (lines 504–512 aproximadamente):
  ```tsx
  {/* Separador */}
  <div className="flex items-center gap-3 my-1">...</div>
  ```
- No hay más cambios en este archivo — `SemanaEntrenoCard` ya aporta la separación visual.

---

### 3. `app/cliente/semana/page.tsx`

**Fixes de contraste (mismos tokens que SemanaEntrenoCard):**

| Elemento | Fix |
|---|---|
| Labels stats ("sesiones", "completadas", "duración media") | `color: #9898A0` |
| Subtítulo de sesión (día + ej + min) | `color: #9898A0` |
| Badge "✓ Hecha" / "Completada" | `color: #4ADE80` |
| Numeración de ejercicios (número) | bg `rgba(99,102,241,0.10)` + color `#818CF8` |
| Metadata ejercicio (sets × reps, RPE) | `color: #9898A0` |
| Días sin sesión en header semanal | `color: #45454F` |

Este archivo usa iconos de Lucide (`CheckCircle2`, `Dumbbell`, etc.) — no migrar iconos, solo corregir colores en los estilos inline y clases.

---

## Lo que NO cambia

- Estructura de datos y APIs — ningún cambio en fetches ni endpoints
- Layout general del tab "plan" — `MiPlan.tsx` no se toca
- Lógica de `completadasHoy`, `todaySession`, `nextSession` — sin cambios
- La página `/cliente/sesion/[id]` — fuera de scope
- Light mode — los fixes son específicos para dark mode mediante los valores de color explícitos (las variables CSS ya tienen valores correctos en light)

---

## Criterios de aceptación

1. En el tab "plan" del portal, el bloque de entrenamiento tiene header con fondo indigo sutil + pill "Hoy: [día]" cuando hay sesión hoy.
2. Todos los textos secundarios en la sección training (leyenda, metadata, labels) son legibles en dark mode (ratio ≥ 4.5:1).
3. El botón "Empezar" del día actual es sólido (fondo `#6366F1`), no sutil.
4. El divider separador anterior está eliminado.
5. En `/cliente/semana`, los labels de stats, metadata de sesiones y numeración de ejercicios son legibles.
6. Build `npx next build` sin errores TypeScript.
7. Light mode sin regresiones visuales.
