# Informe de fluidez de navegación

Fecha: 06-06-2026
Proyecto: NutriCoach

## Problema

Al cambiar entre módulos o submódulos se percibía como una recarga completa. La causa principal era que muchas rutas top-level montan su propio `CoachShell`. En cada montaje, el shell empezaba en `ready=false`, mostraba spinner y repetía validación de sesión (`auth.getUser()` + `profiles`).

## Cambios aplicados

- `CoachShell` ahora cachea en memoria el resultado de acceso coach durante la sesión del navegador.
- El cache se limpia automáticamente en `SIGNED_OUT`, `SIGNED_IN` y `USER_UPDATED`.
- `Sidebar` precarga rutas principales y submódulos con `router.prefetch()`.
- Los `Link` principales del sidebar/topbar declaran `prefetch`.
- `useNotificaciones` cachea el usuario y el estado de notificaciones durante 10s para evitar repetir auth + queries al remontar el sidebar entre módulos.

## Verificación Playwright

Secuencia medida: `/dashboard` → `/nutricion` → `/dietas` → `/entrenos` → `/sistema`.

- No apareció spinner global de `CoachShell` en ningún salto.
- La query a `profiles` se hizo solo en el primer load.
- Navegaciones medidas tras optimización:
  - `/nutricion`: 382ms, `profileDelta=0`, spinner 0.
  - `/dietas`: 274ms, `profileDelta=0`, spinner 0.
  - `/entrenos`: 286ms, `profileDelta=0`, spinner 0.
  - `/sistema`: 229ms, `profileDelta=0`, spinner 0.

## Siguiente mejora recomendada

Algunas páginas, como `/dietas`, siguen llamando a `supabase.auth.getUser()` internamente para sus propios datos. Ya no bloquean el shell, pero pueden optimizarse en una segunda pasada moviendo datos a APIs cacheables o reutilizando un helper de usuario coach.
