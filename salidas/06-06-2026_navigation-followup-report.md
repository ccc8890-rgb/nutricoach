# Navigation follow-up report

Fecha: 06-06-2026
Proyecto: NutriCoach

## Motivo

Tras revisar la implementación en uso, Carlos detectó tres problemas de criterio:

- `Radar` no era un nombre claro para la pantalla principal.
- `Revisión IA` no debía competir como acceso principal porque ya está integrada en dashboard, clientes y entrenamiento.
- `Negocio` quedaba artificialmente separado de Nutrición, aunque precios, alimentos, lista de compra y escandallo trabajan juntos.

## Cambios aplicados

- Sidebar:
  - `Radar` pasa a `Inicio`.
  - Se elimina `Revisión IA` del bloque primario.
  - `Precios`, `Escandallo` y `Rentabilidad` pasan dentro de `Nutrición`.
  - Se elimina el grupo `Negocio`.
  - El logo `CN` enlaza a `/dashboard`.

- Topbar:
  - Se elimina el botón global `Revisión IA`.
  - `/agentes` muestra acción de vuelta al dashboard.
  - Contexto de `/precios` pasa a área `Nutrición`.

- Dashboard:
  - H1 principal pasa de `Radar diario` a `Dashboard`.

## Verificación

- `npx eslint components/Sidebar.tsx components/CoachShell.tsx app/dashboard/page.tsx`: OK.
- `git diff --check`: OK.
- `npm run build`: OK.
