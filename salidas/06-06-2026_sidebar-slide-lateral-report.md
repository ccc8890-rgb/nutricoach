# Sidebar slide lateral report

Fecha: 06-06-2026
Proyecto: NutriCoach

## Motivo

Carlos pidió que los submódulos, especialmente dentro de Nutrición, no se desplegaran hacia abajo en escritorio. La intención es una navegación más fluida, lateral y natural, similar a patrones de dashboards modernos tipo Vercel.

## Cambios aplicados

- En desktop (`lg`):
  - Al abrir una sección del sidebar, sus submódulos aparecen en un panel lateral a la derecha.
  - El panel usa fondo translúcido, blur, borde fino y sombra suave.
  - La entrada tiene animación `sidebarFlyoutIn` con desplazamiento lateral corto y escala mínima.
  - El sidebar permite overflow visible en desktop para que el panel no se recorte.

- En móvil:
  - Se mantiene el desplegable vertical dentro del drawer.
  - Esto evita que un flyout lateral rompa el ancho útil en iPhone.

## Archivos modificados

- `components/Sidebar.tsx`
- `app/globals.css`

## Verificación

- `npx eslint components/Sidebar.tsx`: OK.
- `git diff --check`: OK.
- `npm run build`: OK.
