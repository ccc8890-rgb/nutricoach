# Navigation redesign report

Fecha: 06-06-2026
Proyecto: NutriCoach

## Objetivo

Ordenar el sidebar y la cabecera global para que la app del coach sea más intuitiva, minimalista y consistente entre módulos.

## Cambios realizados

### Sidebar

- `Inbox IA` pasa a `Revisión IA`.
- `Entrenamiento` deja de ser un link primario suelto y pasa a ser un desplegable.
- `Nutrición` queda centrado en planes, plantillas, alimentos y lista de compra.
- `Recetario` mantiene su propio grupo por volumen operativo.
- `Negocio` agrupa precios, escandallo y rentabilidad.
- `Sistema` agrupa metodología, base de conocimiento y cuestionarios.
- Se añade soporte `exact` para que rutas padre como `/entrenos`, `/dietas` o `/recetas` no aparezcan activas en todas sus subrutas.
- Las secciones se autoexpanden cuando la ruta activa pertenece a ellas.

### Head bar

- Nuevo `CoachTopBar` en `CoachShell`.
- Muestra breadcrumb: `Coach OS / Área`.
- Muestra contexto del módulo actual.
- Añade búsqueda visual global como placeholder operativo.
- Añade accesos rápidos a `Revisión IA` y a la acción principal del área.

## Decisión de producto

Se mantiene `TrainingWorkspaceShell` como navegación secundaria especializada de entrenamiento. No se elimina porque ya aporta una capa útil para un módulo complejo.

La unificación se hace en la capa global:

- Sidebar global = áreas principales.
- Head bar = contexto y acción rápida.
- Subnav interna = solo para módulos complejos.

## Verificación

- `npx eslint components/Sidebar.tsx components/CoachShell.tsx`: OK.
- `npm run build`: OK.
