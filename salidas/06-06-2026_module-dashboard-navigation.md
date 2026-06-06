# Module dashboard navigation

Fecha: 06-06-2026
Proyecto: NutriCoach

## Problema

Al pulsar un módulo del sidebar, por ejemplo Nutrición, se abría el submenú lateral pero el contenido central seguía mostrando el dashboard general. La interacción quedaba rara porque el contexto visual del sidebar y el contenido principal no coincidían.

## Cambios aplicados

- Los módulos principales del sidebar ahora navegan a una ruta raíz propia:
  - Nutrición → `/nutricion`
  - Entrenamiento → `/entrenos`
  - Sistema → `/sistema`
- Se añadió `Dashboard` como primer acceso dentro de los submódulos de Nutrición, Entrenamiento y Sistema.
- Se creó dashboard operativo para Nutrición en `/nutricion`.
- Se creó dashboard operativo para Sistema en `/sistema`.
- El topbar reconoce `/nutricion` y `/sistema` como contextos propios.

## Verificación

- `npx eslint components/Sidebar.tsx components/CoachShell.tsx app/nutricion/page.tsx app/nutricion/layout.tsx app/sistema/page.tsx app/sistema/layout.tsx`: OK.
- `npm run build`: OK.
- Playwright local:
  - Click Nutrición → `/nutricion`, aparece dashboard de Nutrición y sidebar contextual Nutrición.
  - Click Entrenamiento → `/entrenos`, aparece dashboard de Entrenamiento y sidebar contextual Entrenamiento.
  - Click Sistema → `/sistema`, aparece dashboard de Sistema y sidebar contextual Sistema.
  - En los tres casos no aparece el dashboard general.
