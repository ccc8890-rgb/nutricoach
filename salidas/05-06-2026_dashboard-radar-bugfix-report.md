# Dashboard Radar - Bugfix report

Fecha: 05-06-2026
Proyecto: NutriCoach

## Resumen

Se revisó el pulido del dashboard y se ejecutó una búsqueda de errores de lint/build. Además del polish visual del `Radar diario`, se corrigieron tres errores reales que hacían fallar `npm run lint`.

## Cambios UI/UX guardados

- `app/dashboard/page.tsx`
  - Cabecera `Radar diario`.
  - Pestaña principal `Hoy`.
  - Cola de revisión como primer bloque operativo.
  - Nuevo panel `Foco semanal`.
  - `Inbox IA` renombrado a `Trabajo preparado por IA`.
  - Filas de riesgo e IA con siguiente acción explícita.
  - Enlaces de sección concretos: `Ver clientes`, `Revisar IA`, `Abrir escandallo`.

- `app/globals.css`
  - Subido contraste de `--text-muted` y `--text-disabled` en modo oscuro.
  - Subido contraste de `--text-muted` en modo claro.

## Bugs corregidos

1. `app/api/entrenos/registrar-sesion/route.ts`
   - Problema: `prs` estaba declarado con `let` aunque nunca se reasignaba.
   - Fix: cambiado a `const`.

2. `components/landing/LandingPage.tsx`
   - Problema: comillas dobles sin escapar en JSX, regla `react/no-unescaped-entities`.
   - Fix: cambiado a `&ldquo;{t.texto}&rdquo;`.

3. `lib/integraciones/terra.ts`
   - Problema: uso de `require('crypto')`, regla `@typescript-eslint/no-require-imports`.
   - Fix: import ES de `createHmac` y `timingSafeEqual`.
   - Limpieza adicional: eliminado `movement_data` asignado a `mov` porque no se usaba.

## Verificación

- `npx eslint app/dashboard/page.tsx`: OK.
- `npx eslint app/dashboard/page.tsx app/api/entrenos/registrar-sesion/route.ts components/landing/LandingPage.tsx lib/integraciones/terra.ts`: OK.
- `git diff --check`: OK.
- `npm run lint`: OK con 0 errores, quedan warnings históricos.
- `npm run build`: OK.

## Warnings restantes

Quedan 292 warnings de deuda previa: `any`, imports no usados, hooks con dependencias incompletas e imágenes `<img>`. No bloquean build ni lint, pero conviene tratarlos por áreas en una sesión específica.
