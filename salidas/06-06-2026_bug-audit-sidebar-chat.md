# Bug audit sidebar y chat

Fecha: 06-06-2026
Proyecto: NutriCoach

## Bugs corregidos

- Ficha de cliente: el contador de mensajes no leídos llamaba `HEAD /api/clientes/[id]/chat` y después intentaba leer `res.json()`. Un `HEAD` no tiene cuerpo, por lo que el contador podía quedarse sin actualizar.
- API chat coach: `HEAD` intentaba devolver JSON. Ahora devuelve el contador en el header `x-no-leidos`.
- API chat coach: `GET /api/clientes/[id]/chat` devuelve también `no_leidos`, manteniendo `mensajes` para compatibilidad con `ChatPanel`.
- Historial de entreno: se reemplazó una ternaria usada solo por efecto lateral por un `if/else` explícito.

## Mejora responsive aplicada

- El sidebar contextual fijo ahora se muestra desde `xl` en escritorio ancho.
- Entre `lg` y `xl`, los submódulos se muestran dentro del sidebar principal para no dejar el contenido central en solo 512px.
- Verificación Playwright:
  - 390px: sin overflow horizontal.
  - 1024px: 1 sidebar visible, `mainWidth = 768`.
  - 1280px: 2 sidebars visibles, `mainWidth = 768`.
  - 1440px: 2 sidebars visibles, `mainWidth = 928`.

## Mejoras detectadas para siguiente pasada

- `app/clientes/[id]/page.tsx` mantiene warnings de dependencias en `useEffect`. Conviene separar `loadData` y `cargarInforme` con `useCallback` o mover la lógica dentro de los efectos, pero hacerlo requiere una pasada específica para evitar recargas en bucle.
- Lint global sigue con warnings históricos de `any`, imports sin uso e imágenes `<img>`. No bloquean build, pero conviene atacar por módulos.
