# Informe fluidez interna de paginas

Fecha: 06-06-2026
Proyecto: NutriCoach

## Problema revisado

Aunque el shell principal ya no parpadeaba al cambiar de modulo, algunas paginas seguian mostrando skeleton o sensacion de recarga porque hacian sus propias consultas en `useEffect` al montar.

## Causa

- `/dietas` repetia `auth.getUser()` + query de planes cada vez que se volvia a la ruta.
- `/clientes` repetia una carga pesada: clientes, check-ins, dietas activas, entrenos activos, tareas IA, chats, comidas y sesiones.
- `/entrenos` repetia la llamada a `/api/entrenos/command-center`.
- `useCachedFetch` existia, pero aun arrancaba con `loading=true` aunque hubiera cache fresco.

## Cambios aplicados

- `lib/useCachedFetch.ts`
  - Ahora inicializa `data` y `loading` desde cache fresco de forma sincronica.
  - Evita flashes de skeleton al volver a una pagina cacheada.

- `app/dietas/page.tsx`
  - Usa `useCachedFetch` con TTL 20s para el listado de planes.

- `app/clientes/page.tsx`
  - Usa `useCachedFetch` con TTL 20s para la carga pesada de clientes y metricas.
  - Mantiene la carga lazy de formularios solo cuando se abre esa tab.

- `app/entrenos/page.tsx`
  - Usa `useCachedFetch` con TTL 20s para el command center de entrenamiento.

- Invalidacion
  - Crear cliente invalida `clientes-index`.
  - Crear dieta invalida `dietas-index`.
  - Crear entreno invalida `entrenos-command-center`.
  - Marcar formularios como leidos invalida `clientes-index`.

## Verificacion

- ESLint especifico limpio.
- `git diff --check` limpio.
- `npm run build` correcto.

## Siguiente mejora

Si se quiere llevar al siguiente nivel, migrar estas cargas a APIs cacheables por modulo y anadir invalidacion fina tras crear/editar cliente, dieta o plan de entreno.
