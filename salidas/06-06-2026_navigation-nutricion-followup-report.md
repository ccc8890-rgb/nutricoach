# Nutrition navigation follow-up report

Fecha: 06-06-2026
Proyecto: NutriCoach

## Motivo

Carlos pidió que Nutrición funcionara como módulo madre y que Recetario y Costes/Compra fueran submódulos internos, no secciones independientes.

## Estructura aplicada

Nutrición:

1. Planes activos
2. Plantillas
3. Recetario
   - Alimentos
   - Recetas
   - Cobertura
   - Imágenes
   - Pendientes
   - Revisión
4. Costes y compra
   - Lista compra
   - Precios
   - Escandallo
   - Rentabilidad

## Cambios técnicos

- `Sidebar.tsx` ahora soporta `NavGroup` dentro de una sección.
- `Recetario` deja de ser sección de primer nivel.
- El badge de recetas pendientes se muestra en Nutrición/Recetario y en `Pendientes`.
- La detección de ruta activa ahora funciona también para grupos internos.

## Verificación

- `npx eslint components/Sidebar.tsx components/CoachShell.tsx app/dashboard/page.tsx`: OK.
- `git diff --check`: OK.
- `npm run build`: OK.
