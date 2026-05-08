---
name: NutriCoach
description: Plataforma profesional de coaching nutricional minimalista
colors:
  primary: "#0D9488"
  primary-dark: "#0F766E"
  primary-light: "#14B8A6"
  neutral-bg: "#F8FAFC"
  surface: "#FFFFFF"
  border: "#E2E8F0"
  text: "#0F172A"
  text-secondary: "#475569"
  text-muted: "#94A3B8"
  macro-protein: "#EF4444"
  macro-carbs: "#F59E0B"
  macro-fat: "#8B5CF6"
  macro-calories: "#3B82F6"
  success: "#10B981"
  warning: "#F59E0B"
  error: "#EF4444"
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
  lg: "12px"
  pill: "9999px"
spacing:
  xs: "0.375rem"
  sm: "0.625rem"
  md: "0.875rem"
  lg: "1.25rem"
  xl: "1.5rem"
components:
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "#FFFFFF"
    rounded: "{rounded.md}"
    padding: "0.625rem 1.25rem"
  button-primary-hover:
    backgroundColor: "{colors.primary-dark}"
  button-secondary:
    backgroundColor: "#FFFFFF"
    textColor: "{colors.text}"
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
    backgroundColor: "#FFFFFF"
    textColor: "{colors.text}"
    rounded: "{rounded.md}"
    border: "1.5px solid {colors.border}"
    padding: "0.625rem 0.875rem"
---

# Design System: NutriCoach

## 1. Overview

**Creative North Star: "The Health Chart"**

Una aplicación de coaching nutricional que se siente como abrir la app Salud de Apple. Sereno, preciso, sin adornos. Cada pantalla comunica competencia a través del orden, no de la decoración.

El diseño rechaza explícitamente la estética de MyFitnessPal y clones: sin saturación de color, sin cards apiladas sin jerarquía, sin gradientes decorativos. La información nutricional —macros, calorías, ingredientes— es el contenido principal, y el diseño se limita a organizarla con jerarquía tipográfica clara y espaciado generoso.

El sistema es **flat por defecto**: sin sombras, sin profundidad fingida. El orden visual se consigue mediante capas tonales (fondos, bordes sutiles, cantidades justas de color), como iOS nativo.

**Key Characteristics:**
- Silencio visual: fondos limpios, espacios que respiran
- Una sola voz cromática: el teal (Clinical Teal) como único acento, usado en ≤10% de la superficie
- Jerarquía por tipografía y espaciado, no por color ni sombras
- Macros con color funcional propio (rojo proteína, ámbar carbos, púrpura grasas, azul calorías)
- Dark mode completo con la misma filosofía flat

## 2. Colors

La paleta es **Restrained**: tinted neutrals + un acento (teal) en ≤10% de la superficie.

### Primary

- **Clinical Teal** (`#0D9488`): El único acento cromático. Se usa exclusivamente para acciones primarias (botones, enlaces activos, indicadores de estado) y detalles funcionales (focus rings). Nunca como color de fondo decorativo.

### Neutral

- **Ice Slate** (`#F8FAFC`): Fondo general de la app. Gris azulado apenas perceptible, más cálido que blanco puro.
- **Surface** (`#FFFFFF`): Superficies de cards, inputs, tablas. Contraste limpio sobre Ice Slate.
- **Border** (`#E2E8F0`): Líneas divisorias, bordes de componentes. Siempre sutiles.
- **Text** (`#0F172A`): Texto principal. Casi negro con un susurro de azul, no `#000`.
- **Text Secondary** (`#475569`): Metadatos, descripciones, labels.
- **Text Muted** (`#94A3B8`): Placeholders, timestamps, información no crítica.

### Functional (Macros)

Los colores de macronutrientes solo aparecen en pills, badges, y etiquetas de datos — nunca como fondos de layout o decoración.

- **Proteína** — `#EF4444` (rojo)
- **Carbohidratos** — `#F59E0B` (ámbar)
- **Grasas** — `#8B5CF6` (púrpura)
- **Calorías** — `#3B82F6` (azul)

### States

- **Success** — `#10B981` (verde)
- **Warning** — `#F59E0B` (ámbar)
- **Error** — `#EF4444` (rojo)

### Named Rules

**The One Voice Rule.** Clinical Teal aparece en ≤10% de cualquier pantalla. Su rareza es su poder. Si dos elementos compiten por el teal, uno de ellos no lo merece.

## 3. Typography

**Display & Body Font:** Inter (con system-ui y sans-serif como fallback)

Inter se usó por su legibilidad técnica, su amplio soporte de pesos, y su familiaridad en entornos profesionales. Es la fuente de iOS, macOS, y la mayoría de herramientas de desarrollo.

**Character:** Funcional, serena, legible. Inter en pesos medios-ligeros comunica precisión sin llamar la atención.

### Hierarchy

| Role | Size | Weight | Line Height | Purpose |
|------|------|--------|-------------|---------|
| **Display** | 1.75rem (28px) | 700 | 1.2 | Títulos de página (h1) |
| **Title** | 1.25rem (20px) | 600 | 1.3 | Títulos de sección (h2), nombres de receta/alimento |
| **Subtitle** | 1rem (16px) | 600 | 1.4 | Subtítulos de card (h3) |
| **Body** | 0.875rem (14px) | 400 | 1.5 | Texto general, valores de macros |
| **Body Small** | 0.8125rem (13px) | 400 | 1.4 | Metadatos, cantidades secundarias |
| **Label** | 0.8125rem (13px) | 500 | 1.25 | Labels de formulario |
| **Small** | 0.75rem (12px) | 400 | 1.4 | Badges, timestamps, texto auxiliar |
| **Table Header** | 0.75rem (12px) | 600 | — | Cabeceras de tabla, uppercase + 0.05em letter-spacing |

Body text capped at 65–75ch max line length.

Los valores de macros (gramos, kcal) usan body size con weight 600 (semibold) para destacar sobre sus etiquetas.

## 4. Elevation

**Flat por defecto.** No hay sombras. La profundidad se comunica exclusivamente mediante capas tonales:

- El fondo general (Ice Slate `#F8FAFC`) es la capa base
- Las superficies (Surface `#FFFFFF`) se distinguen por contraste de claridad, no por sombra
- Los bordes (`1px solid #E2E8F0`) definen los límites de los componentes
- En hover, los elementos interactivos cambian de color de borde o fondo, nunca de elevación

**The Flat-By-Default Rule.** Ningún componente tiene sombra en reposo. El único "elevación" aceptable es un borde más oscuro en hover o un sutil `translateY(-1px)` en botones primarios al hacer hover — y solo porque el botón en sí es plano, el movimiento es micro.

## 5. Components

### Buttons

Refinados y discretos. Sin sombras, sin gradientes. El botón primario es la única superficie que lleva Clinical Teal.

- **Shape:** Bordes de 10px (md). Botones pequeños: 8px (sm). Botones grandes: 12px (lg).
- **Primary:** Fondo Clinical Teal, texto blanco. Sin sombra. Hover: primary-dark (`#0F766E`), translateY(-1px) sutil. Active: translateY(0).
- **Secondary:** Fondo blanco, borde `#E2E8F0`. Hover: fondo `#F8FAFC`, borde `#CBD5E1`.
- **Ghost:** Sin fondo ni borde. Hover: fondo `#F1F5F9`.
- **Danger:** Fondo rojo suave (`#FEF2F2`), texto rojo (`#EF4444`), borde rojo claro.
- **Disabled:** Opacidad 0.5, cursor not-allowed. Sin hover states.

### Cards

Contenedores sutiles sin sombra. Borde de 1px sólido `#E2E8F0`, fondo blanco, radios de 12px. Padding interno de 1.5rem.

Cards hoverables (como listas de recetas o alimentos) cambian de borde a Clinical Teal light en hover.

**Nested cards están prohibidas.** Si un card necesita sub-contenedores, se usa separación por espaciado o líneas divisorias, no otro card dentro.

### Inputs & Forms

- Shape: Borde 1.5px `#E2E8F0`, radio 10px, fondo blanco.
- Focus: Borde cambia a Clinical Teal + ring de 3px con `rgba(13, 148, 136, 0.2)`.
- Error: Borde rojo (`#EF4444`) + ring rojo.
- Select: Flecha personalizada SVG en gris.
- Labels: 13px, weight 500, color text-secondary, 6px margin-bottom.

### Badges / Pills

Formato píldora (`border-radius: 9999px`). Usados exclusivamente para estados, fuentes (BEDCA, OFF, IA), y etiquetas funcionales.

Colores predefinidos: green (éxito/completado), blue (info), teal (coach), orange (OFF), purple (IA), red (error/alerta), gray (neutral), amber (BEDCA).

### Macro Pills

Tarjetas pequeñas de 72px min-width, con el valor numérico arriba (semibold) y la etiqueta debajo (small, muted). Cada macro usa su color funcional:

- Calorías: borde/background azul suave
- Proteína: borde/background rojo suave
- Carbohidratos: borde/background ámbar suave
- Grasas: borde/background púrpura suave

### Tables

Borde exterior de 12px radius. Cabeceras: 12px, uppercase, 600 weight, 0.05em letter-spacing, color text-muted, fondo `#F8FAFC`. Celdas: 14px, bordes inferiores de 1px `#F1F5F9`. Hover row: fondo `#FAFAFA`. Última fila sin borde inferior.

### Sidebar Navigation

Links con 10px radius, padding 0.6rem 0.875rem, 14px, weight 500. Hover: fondo primary-bg (`#F0FDFA`), color Clinical Teal. Active: mismo que hover pero weight 600.

### Loading (Skeleton)

Animación pulse con gradiente linear de 90deg. Dark mode: tonos slate oscuro. El componente `SkeletonCard`, `SkeletonTable`, etc. replican la estructura del contenido real para transición suave.

### Modal

Overlay black/50 con backdrop-blur-sm. Content: fondo blanco, 24px radius, max-width 448px. Animación de entrada: fade-in + scale. Cierre con Escape. Sin sombras (flat).

## 6. Do's and Don'ts

| Do | Don't |
|----|-------|
| Usar Clinical Teal solo para acciones primarias y detalles funcionales | Poner teal en fondos de card o decoración |
| Dejar respirar el contenido con espaciado generoso | Apilar cards sin jerarquía visual |
| Usar color de macro solo en pills y etiquetas de datos | Usar rojo/ámbar/púrpura como colores de layout |
| Mantener bordes sutiles (1-1.5px) | Usar bordes gruesos (>2px) o side-stripe borders |
| Preferir capas tonales para jerarquía espacial | Usar sombras para crear profundidad |
| Inter para todo (títulos y cuerpo) | Mezclar fuentes sin razón |
| Dark mode con la misma filosofía flat | Dark mode con brillos, sombras o glows |
| Badge para estados y fuentes de datos | Badge para decoración |
