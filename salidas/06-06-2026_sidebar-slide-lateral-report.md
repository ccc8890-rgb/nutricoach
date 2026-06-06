# Sidebar contextual lateral report

Fecha: 06-06-2026
Proyecto: NutriCoach

## Motivo

Carlos pidió que los submódulos, especialmente dentro de Nutrición, no se desplegaran hacia abajo en escritorio. Después pidió aplicar el mismo criterio a Entrenamiento, Sistema y el resto de módulos. Finalmente ajustó el criterio: el panel no debe flotar ni solapar contenido, sino funcionar como una segunda columna fija a la derecha del sidebar principal.

## Cambios aplicados

- En desktop (`lg`):
  - Al abrir cualquier sección del sidebar, sus submódulos aparecen en una segunda columna fija a su derecha.
  - La columna ocupa toda la altura de la página y forma parte del layout flex, por lo que empuja el contenido principal y no lo solapa.
  - La cabecera muestra el módulo activo para reforzar contexto: Nutrición, Entrenamiento o Sistema.
  - La apertura es exclusiva: si se abre Nutrición, se cierran Entrenamiento, Sistema y el resto. Evita ruido visual.

- A nivel de arquitectura:
  - `SidebarSection` queda como patrón único para todos los módulos con submódulos.
  - `SecondarySidebar` renderiza el submenú contextual en escritorio.
  - No hay lógica especial solo para Nutrición; Entrenamiento, Sistema y futuros módulos usan la misma columna secundaria.

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
