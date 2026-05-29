# NutriCoach Design System v8 — "Instrument"
**Fecha:** 29-05-2026  
**Estado:** Aprobado por Carlos — listo para implementar

---

## 1. Filosofía

Un instrumento de precisión no tiene decoración. El color de un escalpelo quirúrgico o de una pantalla de avión no existe para embellecer — existe para informar. NutriCoach v8 aplica esa lógica al coaching nutricional:

- **El chrome de UI es acromático total.** Navegación, botones primarios, tarjetas, tipografía de cabecera — todo en escala de grises fría. Cero hue.
- **El color solo aparece donde lleva significado.** Estado de un cliente, alerta de adherencia, dato de macros. Nunca como decoración.
- **Dos modos de densidad, una sola identidad.** El coach usa la vista Razor (densa, plana, terminal). El cliente usa Slate Pro (superficies elevadas, más respiración). Misma paleta, distinta densidad.

Referentes: Apple Pro Display XDR, Linear, Vercel Dashboard, Bloomberg Terminal, Leica M11.  
Anti-referentes: cualquier app SaaS con acento índigo/morado/azul royal, cualquier app fitness con verde néon.

---

## 2. Paleta de color

### 2.1 Base — acromático frío

```
--bg:               #060608   /* fondo raíz — negro casi puro, temperatura fría */
--bg-subtle:        #09090B   /* fondo alternativo mínimamente más claro */
--surface:          #0E0E11   /* superficie de tarjeta (Slate Pro) */
--surface-hover:    #121216   /* hover state de superficie */
--surface-elevated: #141418   /* superficie de segundo nivel */

--border:           #161619   /* borde estándar */
--border-subtle:    #111114   /* borde de separador (hairline) */
--border-strong:    #222228   /* borde con énfasis */

--text:             #E8E8F0   /* texto primario */
--text-secondary:   #808088   /* texto secundario */
--text-muted:       #383840   /* texto muy apagado, labels */
--text-disabled:    #242428   /* texto inactivo */
```

> **Temperatura:** todos los valores tienen un sesgo azul-frío (+1-2 en canal B respecto a R/G). Esto distingue el sistema de los grises neutros genéricos y da coherencia al "metalismo frío".

### 2.2 Semántico — pastel sobre negro

Solo para estados, alertas y visualización de datos. Nunca para UI chrome.

```
/* Activo / éxito */
--semantic-active:      #6AAF85   /* verde salvia apagado */
--semantic-active-bg:   rgba(106, 175, 133, 0.08)
--semantic-active-text: #4A8F65

/* Advertencia / revisar */
--semantic-warn:        #C8A96A   /* arena/beige cálido */
--semantic-warn-bg:     rgba(200, 169, 106, 0.08)
--semantic-warn-text:   #A88848

/* Inactivo / alerta */
--semantic-alert:       #B86A6A   /* dusty rose — rojo muy apagado */
--semantic-alert-bg:    rgba(184, 106, 106, 0.08)
--semantic-alert-text:  #986060

/* Info / neutro cálido */
--semantic-info:        #8A9AB8   /* slate azul muy desaturado */
--semantic-info-bg:     rgba(138, 154, 184, 0.08)
--semantic-info-text:   #6A7A98
```

> **Regla de uso semántico:** estos colores aparecen en puntos pequeños (dots de estado, pills de badge, barras de progreso, líneas de gráfica). Nunca como fondo de componente grande ni como color de botón primario.

### 2.3 Macronutrientes (datos)

Los macros son datos, no UI — usan color semántico contenido:

```
--macro-protein:   #6AAF85   /* mismo verde salvia que activo */
--macro-carbs:     #8A9AB8   /* slate azul */
--macro-fat:       #C8A96A   /* arena/beige */
--macro-kcal:      #E8E8F0   /* blanco — es el dato principal */
```

---

## 3. Tipografía

**Familia:** `"Geist", "SF Pro Display", -apple-system, sans-serif`  
Geist (Vercel) es monoespaciada para números, proporcional para texto. Si no disponible, SF Pro Display.

```
/* Display — KPIs grandes, números hero */
font-size: 2rem;      /* 32px */
font-weight: 800;
letter-spacing: -0.04em;
color: var(--text);

/* Title — cabeceras de sección */
font-size: 0.9375rem; /* 15px */
font-weight: 700;
letter-spacing: -0.01em;
color: var(--text);

/* Body — contenido normal */
font-size: 0.8125rem; /* 13px */
font-weight: 400;
line-height: 1.55;
color: var(--text-secondary);

/* Label — etiquetas uppercase */
font-size: 0.6875rem; /* 11px */
font-weight: 600;
letter-spacing: 0.1em;
text-transform: uppercase;
color: var(--text-muted);

/* Mono — valores numéricos en tabla */
font-family: "Geist Mono", "SF Mono", monospace;
font-variant-numeric: tabular-nums;
font-size: 0.8125rem;
```

---

## 4. Componentes

### 4.1 Botón primario

```css
/* Acromático — el único botón "de acción" */
background: var(--text);          /* #E8E8F0 */
color: var(--bg);                  /* #060608 — negro sobre blanco */
border-radius: 8px;
padding: 0.5rem 1rem;
font-size: 0.8125rem;
font-weight: 600;
letter-spacing: 0.01em;

/* Hover */
background: #C8C8D0;

/* No hay botón primario de color — el blanco ES el acento */
```

### 4.2 Botón secundario / ghost

```css
background: transparent;
border: 1px solid var(--border-strong);
color: var(--text-secondary);
border-radius: 8px;
padding: 0.5rem 1rem;

/* Hover */
background: var(--surface);
border-color: var(--border-strong);
```

### 4.3 Badge / pill de estado

```css
/* Activo */
background: var(--semantic-active-bg);
border: 1px solid rgba(106, 175, 133, 0.18);
color: var(--semantic-active-text);
font-size: 0.6875rem;
font-weight: 600;
padding: 0.125rem 0.5rem;
border-radius: 99px;

/* Advertencia: misma estructura con --semantic-warn-* */
/* Alerta:      misma estructura con --semantic-alert-* */
```

### 4.4 Tarjeta — modo Slate Pro (cliente + coach)

```css
background: var(--surface);         /* #0E0E11 */
border: 1px solid var(--border);    /* #161619 */
border-radius: 10px;
padding: 1rem 1.125rem;

/* Hover */
background: var(--surface-hover);
border-color: var(--border-strong);
```

### 4.5 Tabla — modo Razor (coach)

```css
/* Sin contenedor visible — solo separadores hairline */
border-top: 1px solid var(--border-subtle);

/* Fila */
display: grid;
padding: 0.5rem 0;
border-bottom: 1px solid var(--border-subtle);

/* Sin background en hover — solo cambio de color de texto */
```

### 4.6 Input

```css
background: var(--surface);
border: 1px solid var(--border);
border-radius: 8px;
padding: 0.5rem 0.75rem;
color: var(--text);
font-size: 0.8125rem;

/* Focus */
border-color: var(--border-strong);
outline: none;
box-shadow: 0 0 0 3px rgba(232, 232, 240, 0.06);
```

### 4.7 Barra de progreso

```css
/* Track */
height: 3px;
background: var(--border-subtle);
border-radius: 2px;

/* Fill — usa color semántico según valor */
/* >75%: --semantic-active    verde salvia */
/* 50-75%: --semantic-warn    arena */
/* <50%: --semantic-alert     dusty rose */
```

---

## 5. Layout

### 5.1 Vista coach — modo Razor

```
┌─────────────────────────────────────────────────────────┐
│ CN   Dashboard   Clientes   Dietas   Entrenos   Agentes  │  ← topbar 44px, bg: --bg, border-bottom hairline
├─────────────────────────────────────────────────────────┤
│                                                          │
│  12        87%       2.140      3                        │  ← KPI row, números 32px, sin tarjetas
│  clientes  adher.    kcal       pendientes               │
│                                                          │
├─────────────────────────────────────────────────────────┤  ← separador hairline
│  CLIENTES ACTIVOS                                        │  ← label uppercase 11px --text-muted
│                                                          │
│  ● Laura M.          ▓▓▓▓▓▓▓▓░░   92%                   │  ← fila plana, sin bg
│  ● Carlos R.         ▓▓▓▓▓▓░░░░   78%                   │
│  ○ Sofía G.          ▓▓▓░░░░░░░   54%   revisar          │
│  ◌ Javier P.         ▓░░░░░░░░░   31%   inactivo         │
│                                                          │
└─────────────────────────────────────────────────────────┘
```

- Sin sidebar. Topbar con logo + nav items.
- KPIs sin tarjeta — números directamente sobre `--bg`.
- Tablas sin contenedor — solo separadores de 1px.
- Estado de cliente: dot de 5px en color semántico + texto en gris más oscuro para los de menor adherencia.

### 5.2 Vista cliente — modo Slate Pro

```
┌─────────────────────────────────────────────────────────┐
│ [CN]  Mi Plan   Progreso   Recetas   Entreno   Apps      │  ← topbar con superficie --surface
├─────────────────────────────────────────────────────────┤
│                                                          │
│  ┌──────────────────────────────────────────────────┐   │
│  │  2.140 kcal objetivo · hoy          [anillo 87%] │   │  ← hero card --surface con border
│  └──────────────────────────────────────────────────┘   │
│                                                          │
│  ┌─────────┐  ┌─────────┐  ┌─────────┐                  │
│  │ 168g    │  │ 87%     │  │ Semana 3│                  │  ← mini stats --surface con border
│  │ proteína│  │ adher.  │  │ entreno │                  │
│  └─────────┘  └─────────┘  └─────────┘                  │
│                                                          │
│  ┌──────────────────────────────────────────────────┐   │
│  │  Plan de hoy                                     │   │  ← tabla de comidas --surface
│  │  Desayuno      Avena + proteína    420 kcal  ✓   │   │
│  │  Almuerzo      Pollo + arroz       580 kcal  ─   │   │
│  │  Cena          Merluza + verdura   380 kcal  ─   │   │
│  └──────────────────────────────────────────────────┘   │
│                                                          │
└─────────────────────────────────────────────────────────┘
```

- Topbar con superficie levemente elevada respecto al fondo.
- Tarjetas con `background: --surface` y `border: 1px solid --border`.
- Números grandes como jerarquía primaria.
- Checkmarks y estados de comida en semántico pastel.

---

## 6. Migración desde v7

### Cambios en `globals.css`

| Token actual | Token nuevo | Cambio |
|---|---|---|
| `--accent: #6366F1` | eliminado | No hay acento de color |
| `--accent-dark: #4F46E5` | eliminado | — |
| `--accent-light: #818CF8` | eliminado | — |
| `--bg: #0A0A0B` | `--bg: #060608` | Más oscuro, temperatura fría |
| `--surface: #141416` | `--surface: #0E0E11` | Más oscuro, temperatura fría |
| `--border: #2C2C2E` | `--border: #161619` | Más sutil |
| `--primary: var(--accent)` | `--primary: var(--text)` | Blanco como primario |
| `--macro-protein: #52B788` | `--macro-protein: #6AAF85` | Más apagado |
| `--macro-carbs: #74B9E0` | `--macro-carbs: #8A9AB8` | Slate azul desaturado |
| `--macro-fat: #F4A261` | `--macro-fat: #C8A96A` | Arena/beige |
| `--info: #0A84FF` | `--semantic-info: #8A9AB8` | Eliminar azul brillante |

### Pasos de implementación

1. **`globals.css`** — reemplazar tokens completos (`:root` y `.light`)
2. **Clases Tailwind** → **variables CSS** — reemplazar cualquier `text-indigo-*`, `bg-indigo-*`, `border-indigo-*` por variables
3. **Botones primarios** — cambiar `bg-[--accent]` a `bg-[--text] text-[--bg]`
4. **Badges de estado** — actualizar colores con semántico pastel
5. **Barras de progreso** — lógica condicional por valor (>75 verde / 50-75 arena / <50 rose)
6. **Coach layout** — migrar sidebar a topbar (ya existe en algunas vistas, unificar)
7. **Cliente portal** — añadir elevación de superficie a tarjetas

---

## 7. Criterios de éxito

- Ningún componente usa `#6366F1` (índigo) ni ningún azul/morado puro
- El color aparece **solo** en badges de estado, barras de progreso, dots, y datos de macros
- Mockup del dashboard a un colega no relacionado: debe evocar "premium, instrumento de precisión" antes que "app de salud genérica"
- Legibilidad: contraste mínimo 4.5:1 en texto normal, 3:1 en texto grande (WCAG AA)
- El portal de cliente se puede navegar sin conocimiento previo en menos de 10 segundos

---

## 8. Notas técnicas

### Fuente Geist
Instalar con `npm install geist` e importar en `app/layout.tsx`:
```ts
import { GeistSans, GeistMono } from 'geist/font'
```
Si no se quiere añadir dependencia, SF Pro Display (sistema macOS/iOS) cubre el mismo registro visual.

### Light mode
El sistema v8 es **dark-first**. La clase `.light` en `globals.css` se mantiene por compatibilidad pero no es prioridad de implementación. Si en el futuro se activa, los colores semánticos pastel funcionan igualmente sobre fondos claros.

---

## 9. Lo que NO cambia

- Estructura de componentes y layouts existentes
- Lógica de negocio, APIs, BD
- Animaciones y easing curves (`--ease-out-strong`, etc.)
- Tipografía base (Plus Jakarta Sans se mantiene como fallback, Geist se añade como primaria)
- Radios de borde (`--rounded-*`)
- Safe areas y header heights
