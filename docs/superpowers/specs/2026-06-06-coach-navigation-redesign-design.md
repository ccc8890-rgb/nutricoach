# Coach Navigation Redesign - Diseño

Fecha: 06-06-2026
Proyecto: NutriCoach
Estado: aprobado por Carlos

## Objetivo

Reorganizar la navegación del coach para que la app se lea como un sistema operativo de trabajo diario, no como una colección de pantallas técnicas.

El sidebar debe ser intuitivo, minimalista y consistente. Entrenamiento no debe sentirse como el único módulo cuidado con navegación propia mientras el resto queda como listas simples.

## Dirección aprobada

1. Sidebar global por áreas:
   - Inicio
   - Nutrición
   - Entrenamiento
   - Sistema

2. Renombrar conceptos técnicos:
   - `Inbox IA` deja de ser acceso principal.
   - La entrada inicial se llama `Inicio`.
   - La pantalla central usa `Dashboard`.
   - `Dietas activas` pasa a `Planes`.
   - `Biblioteca` de recetas pasa a `Recetas`.

3. Entrenamiento se convierte en desplegable en el sidebar global, igual que Nutrición, Negocio y Sistema.

4. Precios, escandallo y rentabilidad forman parte de Nutrición porque trabajan junto a alimentos, lista de compra y costes de planes.

5. Añadir `CoachTopBar` ligero:
   - breadcrumb contextual;
   - acción rápida contextual;
   - acceso visible a revisión IA;
   - no debe ocupar demasiado alto.

## Principios

- La navegación debe responder "dónde estoy" y "qué puedo hacer ahora".
- Menos nombres internos, más nombres de trabajo real del coach.
- La IA aparece como revisión/preparación, no como estructura técnica.
- La revisión IA no debe competir como módulo principal si ya aparece integrada en dashboard, clientes y entrenamiento.
- Mantener el diseño actual: acromático, denso, con buenos contrastes.
- No introducir nuevas dependencias.

## Fuera de alcance

- Rediseñar cada página interna.
- Crear nuevas APIs.
- Crear una command palette real.
- Eliminar `TrainingWorkspaceShell`; se mantiene como navegación secundaria especializada del módulo de entrenamiento.

## Verificación

- `npx eslint components/Sidebar.tsx components/CoachShell.tsx`
- `npm run build`
- Revisar rutas principales:
  - `/dashboard`
  - `/clientes`
  - `/agentes`
  - `/dietas`
  - `/entrenos`
  - `/precios`
