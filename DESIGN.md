---
name: Casanova Nutrition
description: Plataforma profesional de coaching nutricional minimalista — Graphite Apple Pro
colors:
  accent: "#A1A1A6"
  accent-dark: "#8E8E93"
  accent-light: "#C7C7CC"
  bg: "#0A0A0B"
  bg-subtle: "#0E0E10"
  surface: "#141416"
  border: "#2C2C2E"
  text: "#F5F5F7"
  text-secondary: "#A1A1A6"
  text-muted: "#636366"
  macro-protein: "#FF453A"
  macro-carbs: "#A1A1A6"
  macro-fat: "#007AFF"
  macro-calories: "#FF9F0A"
  success: "#30D158"
  warning: "#C9A96E"
  error: "#FF453A"
  info: "#0A84FF"
typography:
  display:
    fontFamily: "Inter, system-ui, sans-serif"
    fontSize: "1.75rem"
    fontWeight: 700
    lineHeight: 1.2
  title:
    fontFamily: "Inter, system-ui, sans-serif"
    fontSize: "1.25rem"
    fontWeight: 600
    lineHeight: 1.3
  body:
    fontFamily: "Inter, system-ui, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 400
    lineHeight: 1.5
  label:
    fontFamily: "Inter, system-ui, sans-serif"
    fontSize: "0.8125rem"
    fontWeight: 500
    lineHeight: 1.25
rounded:
  sm: "8px"
  md: "10px"
  lg: "14px"
  pill: "9999px"
spacing:
  xs: "0.375rem"
  sm: "0.625rem"
  md: "0.875rem"
  lg: "1.25rem"
  xl: "1.5rem"
components:
  button-primary:
    backgroundColor: "{colors.accent}"
    textColor: "#1C1C1E"
    rounded: "{rounded.md}"
    padding: "0.625rem 1.25rem"
  button-primary-hover:
    backgroundColor: "{colors.accent-dark}"
  button-secondary:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.text-secondary}"
    rounded: "{rounded.md}"
    border: "1px solid {colors.border}"
  button-ghost:
    backgroundColor: "transparent"
    textColor: "{colors.text-secondary}"
    rounded: "{rounded.md}"
  card:
    backgroundColor: "{colors.surface}"
    rounded: "{rounded.lg}"
    border: "1px solid {colors.border}"
    padding: "1.5rem"
  input:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.text}"
    rounded: "{rounded.md}"
    border: "1.5px solid {colors.border}"
    padding: "0.625rem 0.875rem"
---

# Design System v6 — Graphite Apple Pro

> Inspirado en Apple Pro / Space Gray. Dark mode profundo con acento graphite plateado, glassmorphism, y micro-interacciones con spring physics.

## 1. Overview

**Creative North Star: "The Health Chart"**

Una aplicación de coaching nutricional que se siente como abrir la app Salud de Apple. Sereno, preciso, sin adornos. Cada pantalla comunica competencia a través del orden, no de la decoración.

El diseño rechaza explícitamente la estética de MyFitnessPal y clones: sin saturación de color, sin cards apiladas sin jerarquía, sin gradientes decorativos. La información nutricional —macros, calorías, ingredientes— es el contenido principal, y el diseño se limita a organizarla con jerarquía tipográfica clara y espaciado generoso.

El sistema es **flat por defecto**: sin sombras, sin profundidad fingida. El orden visual se consigue mediante capas tonales (fondos, bordes sutiles, cantidades justas de color), como iOS nativo.

**Key Characteristics:**
- Silencio visual: fondos oscuros, espacios que respiran
- Una sola voz cromática: el acento **Graphite** (`#A1A1A6` dark / `#8E8E93` light) como único acento, usado en ≤10% de la superficie
- Jerarquía por tipografía y espaciado, no por color ni sombras
- Macros con color funcional Apple System Colors (rojo proteína, graphite carbos, azul grasas, naranja calorías)
- Dark mode como default; light mode como variante

## 2. Colors

La paleta es **Restrained**: tinted neutrals oscuros + un acento (graphite) en ≤10% de la superficie.

### Dark Mode (default)

| Token | Hex | Uso |
|-------|-----|-----|
| `--accent` | `#A1A1A6` | Acento principal (botones, links activos, focus rings) |
| `--accent-dark` | `#8E8E93` | Hover de acento |
| `--accent-light` | `#C7C7CC` | Brillos sutiles |
| `--bg` | `#0A0A0B` | Fondo general (casi negro) |
| `--surface` | `#141416` | Cards, inputs, tablas |
| `--border` | `#2C2C2E` | Bordes de componentes |
| `--text` | `#F5F5F7` | Texto principal (blanco Apple) |
| `--text-secondary` | `#A1A1A6` | Metadatos, descripciones |
| `--text-muted` | `#636366` | Placeholders, timestamps |

### Light Mode

| Token | Hex | Uso |
|-------|-----|-----|
| `--accent` | `#8E8E93` | Acento principal |
| `--bg` | `#F2F2F4` | Fondo general (gris muy claro) |
| `--surface` | `#FFFFFF` | Cards, inputs |
| `--border` | `#D1D1D6` | Bordes |
| `--text` | `#1C1C1E` | Texto principal |
| `--text-secondary` | `#636366` | Metadatos |

### Functional (Macros)

Colores Apple System — solo en pills, badges y etiquetas de datos, nunca como fondos de layout o decoración.

| Macro | Dark | Light |
|-------|------|-------|
| **Proteína** | `#FF453A` | `#FF3B30` |
| **Carbohidratos** | `#A1A1A6` (graphite) | `#8E8E93` (graphite) |
| **Grasas** | `#007AFF` | `#007AFF` |
| **Calorías** | `#FF9F0A` | `#FF9500` |

### States

Apple System Colors, con su variante bg al 10%:

- **Success** — `#30D158` (dark) / `#34C759` (light)
- **Warning** — `#C9A96E` (dark) / `#B89B7A` (light) — dorado apagado, no ámbar
- **Error** — `#FF453A` (dark) / `#FF3B30` (light)
- **Info** — `#0A84FF` (dark) / `#007AFF` (light)

### Named Rules

**The One Voice Rule.** El acento Graphite aparece en ≤10% de cualquier pantalla. Su rareza es su poder. Si dos elementos compiten por el acento, uno de ellos no lo merece.

## 3. Typography

**Display & Body Font:** Inter (con system-ui y sans-serif como fallback)

Inter se usa por su legibilidad técnica, su amplio soporte de pesos, y su familiaridad en entornos profesionales.

**Character:** Funcional, serena, legible. Inter en pesos medios-ligeros comunica precisión sin llamar la atención.

### Hierarchy

| Role | Size | Weight | Line Height | Purpose |
|------|------|--------|-------------|---------|
| **Display** | 1.75rem (28px) | 700 | 1.2 | Títulos de página (h1) |
| **Title** | 1.25rem (20px) | 600 | 1.3 | Títulos de sección (h2) |
| **Subtitle** | 1rem (16px) | 600 | 1.4 | Subtítulos de card (h3) |
| **Body** | 0.875rem (14px) | 400 | 1.5 | Texto general, valores de macros |
| **Body Small** | 0.8125rem (13px) | 400 | 1.4 | Metadatos, cantidades secundarias |
| **Label** | 0.8125rem (13px) | 500 | 1.25 | Labels de formulario |
| **Small** | 0.75rem (12px) | 400 | 1.4 | Badges, timestamps |
| **Table Header** | 0.75rem (12px) | 600 | — | Cabeceras de tabla, uppercase + 0.05em letter-spacing |

Body text capped at 65–75ch max line length.

## 4. Elevation

**Flat por defecto.** No hay sombras. La profundidad se comunica exclusivamente mediante capas tonales:

- El fondo general (`--bg`) es la capa base
- Las superficies (`--surface`) se distinguen por contraste de claridad, no por sombra
- Los bordes (`1px solid --border`) definen los límites de los componentes
- En hover, los elementos interactivos cambian de color de borde o fondo, nunca de elevación

**The Flat-By-Default Rule.** Ningún componente tiene sombra en reposo. El único "elevación" aceptable es un borde más oscuro en hover o un sutil `translateY(-1px)` en botones primarios al hacer hover — y solo porque el botón en sí es plano, el movimiento es micro.

**Excepción glass:** Los componentes `.card-glass` usan `backdrop-filter: blur(20px)` y `--glass-shadow` para el efecto translúcido Apple Pro. Es la única superficie que puede tener sombra, porque la sombra es parte del efecto glass.

## 5. Components

### Buttons

Refinados y discretos. Sin sombras (salvo `--shadow-sm` minimal), sin gradientes.

- **Shape:** Bordes de 10px (`.btn`). Botones pequeños: 8px (`.btn-sm`). Botones grandes: 12px (`.btn-lg`).
- **Primary:** Fondo `--accent`, texto casi negro (`#1C1C1E`), weight 600. Sin sombra decorativa. Hover: `--accent-dark`, `--shadow-glow`. Micro lift -1px.
- **Secondary:** Fondo `--surface`, borde `--border`, texto `--text-secondary`. Hover: `--surface-hover`, borde `--border-accent`.
- **Ghost:** Sin fondo ni borde. Hover: `--accent-bg`, color `--accent`.
- **Danger:** Fondo `--error-bg`, texto `--error`. Hover: bg más intenso.
- **Disabled:** Opacidad 0.35, cursor not-allowed. Sin hover states.

### Cards

Contenedores sutiles sin sombra. Borde de 1px `--border`, fondo `--surface`, radios de 14px. Padding interno de 1.5rem.

Cards hoverables (como listas) cambian de borde a `--border-accent` en hover con micro lift -2px.

**Nested cards están prohibidas.** Si un card necesita sub-contenedores, se usa separación por espaciado o líneas divisorias, no otro card dentro.

### Glass Cards

Variante premium: `--glass-bg` translúcido, `backdrop-filter: blur(20px)`, borde `--glass-border`. Usado para elementos superpuestos o modales.

### Inputs & Forms

- Shape: Borde 1.5px `--border`, radio 10px, fondo `--surface`.
- Focus: Borde cambia a `--accent` + ring de 3px con `--accent-ring`.
- Error: Borde `--error` + ring rojo suave.
- Placeholder: `--text-muted`.
- Labels: 13px, weight 500, color `--text-secondary`, 6px margin-bottom.

### Badges / Pills

Formato píldora (`border-radius: 9999px`). Usados exclusivamente para estados, fuentes y etiquetas funcionales.

Clases disponibles:
- `.badge-graphite` — `--accent-bg` / `--accent`
- `.badge-green` — `--success-bg` / `--success`
- `.badge-blue` — `--info-bg` / `--info`
- `.badge-gray` — `--surface-hover` / `--text-muted`
- `.badge-red` — `--error-bg` / `--error`
- `.badge-purple` — `--info-bg` / `--info` (idem blue)
- `.badge-orange` — `--warning-bg` / `--warning`

### Macro Pills

Tarjetas pequeñas de 72px min-width, con el valor numérico arriba (semibold) y la etiqueta debajo (small, muted). Cada macro usa su color funcional:

- Calorías: borde/background naranja suave (`rgba(255, 159, 10, 0.3/0.08)`)
- Proteína: borde/background rojo suave (`rgba(255, 69, 58, 0.3/0.08)`)
- Carbohidratos: borde/background graphite (`--border-accent` / `--accent-bg`)
- Grasas: borde/background azul suave (`rgba(10, 132, 255, 0.3/0.08)`)

### Tables

Borde exterior de 14px radius. Cabeceras: 12px, uppercase, 600 weight, 0.05em letter-spacing, color `--text-muted`, fondo `--bg-subtle`. Celdas: 14px, bordes inferiores de 1px `--border-light`. Hover row: fondo `--surface-hover`. Última fila sin borde inferior.

### Sidebar Navigation

Links con 10px radius, padding 0.6rem 0.875rem, 14px, weight 500. Hover/active: `--accent-bg`, color `--accent`, active con weight 600.

### Loading (Skeleton)

Animación pulse con `linear-gradient(90deg)` moviéndose 200% → -200%. Los componentes `SkeletonCard`, `SkeletonTable`, etc. replican la estructura del contenido real para transición suave. Dark/light mode via CSS variables.

### Modal

Overlay `rgba(0, 0, 0, 0.45)` con `backdrop-filter: blur(8px)`. Content: fondo `--surface`, 16px radius, max-width 448px. Animación: fade-in + scale. Cierre con Escape.

### Empty State

Componente `EmptyState` para estados vacíos: icono grande en círculo `--accent-bg`, título semibold, descripción opcional, botón CTA opcional.

## 6. Do's and Don'ts

| Do | Don't |
|----|-------|
| Usar Graphite solo para acciones primarias y detalles funcionales | Poner graphite en fondos de card o decoración |
| Dejar respirar el contenido con espaciado generoso | Apilar cards sin jerarquía visual |
| Usar color de macro solo en pills y etiquetas de datos | Usar rojo/azul/naranja como colores de layout |
| Mantener bordes sutiles (1-1.5px) | Usar bordes gruesos (>2px) o side-stripe borders |
| Preferir capas tonales para jerarquía espacial | Usar sombras para crear profundidad (salvo glass) |
| Inter para todo (títulos y cuerpo) | Mezclar fuentes sin razón |
| Dark mode como default, light como variante | Dark mode con brillos, sombras o glows excesivos |
| Badge para estados y fuentes de datos | Badge para decoración |
