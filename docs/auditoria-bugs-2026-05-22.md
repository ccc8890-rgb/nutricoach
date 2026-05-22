# Auditoría de Bugs — 22 Mayo 2026

## Resumen

3 bugs reportados + 1 bug hermano encontrado durante la auditoría + 2 bugs adicionales encontrados en [`PlanificacionCalendario.tsx`](components/PlanificacionCalendario.tsx) + 1 code smell severo. Todos corregidos y desplegados a producción.

---

## Bug 1 — Plan inicial de dieta no muestra lo establecido por IA

### Síntoma
Cuando la IA genera un plan inicial, las recetas que inventa (nombres no existentes en el recetario DB) se silencian silenciosamente. El plan se crea con comidas vacías.

### Causa raíz
En [`app/api/generar-plan-inicial/route.ts:719`](app/api/generar-plan-inicial/route.ts:719), cuando `recetaFull` es `null` (la IA inventó un nombre), el código hacía `continue`, saltando cualquier inserción en `comida_alimentos`.

### Fix
- Se calculan `kcalEstimadasComida` y `protEstimadaComida` para cada comida basándose en la distribución del plan
- Cuando una receta IA no existe en DB, se crea un [`alimento`](app/api/generar-plan-inicial/route.ts:724) con `categoria: 'receta_ia'`, nombre IA y macros estimados
- Se vincula vía [`comida_alimentos`](app/api/generar-plan-inicial/route.ts:741)
- Fix adicional: el `.catch()` no es soportado por [`PostgrestFilterBuilder`](node_modules/@supabase/postgrest-js/dist/index.d.mts:1863) → reemplazado con `try/catch`

### Archivos modificados
- [`app/api/generar-plan-inicial/route.ts`](app/api/generar-plan-inicial/route.ts)

---

## Bug 2 — Productos no comestibles visibles en búsqueda

### Síntoma
Al buscar alimentos en el editor de dieta, aparecen alcoholes, cosméticos, productos de limpieza, etc.

### Causa raíz
La query directa a Supabase en [`app/dietas/[id]/page.tsx:148`](app/dietas/[id]/page.tsx:148) no incluía `.eq('es_comestible', true)`. El editor de dieta bypassa la API route (`/api/alimentos`) que sí tenía el filtro.

### Fix
Añadido `.eq('es_comestible', true)` a la query de `supabase.from('alimentos')`.

### Archivos modificados
- [`app/dietas/[id]/page.tsx`](app/dietas/[id]/page.tsx)

---

## Bug 3 — Recetas no aprobadas aparecen en resultados

### Síntoma
Al buscar recetas en el editor de dieta, aparecen recetas en estado `borrador` o `en_revision` que el coach aún no ha aprobado.

### Causa raíz
La query directa a Supabase en [`app/dietas/[id]/page.tsx:169`](app/dietas/[id]/page.tsx:169) no incluía `.eq('estado', 'aprobada')`.

### Fix
Añadido `.eq('estado', 'aprobada')` a la query de `supabase.from('recetas')`.

### Archivos modificados
- [`app/dietas/[id]/page.tsx`](app/dietas/[id]/page.tsx)

---

## Bug 3b (Hermano) — Productos no comestibles visibles al crear receta nueva

### Síntoma
Al buscar ingredientes en [`app/recetas/nueva/page.tsx`](app/recetas/nueva/page.tsx), aparecen productos no comestibles.

### Causa raíz
Mismo patrón que Bug 2 — query directa sin `.eq('es_comestible', true)`.

### Fix
Añadido `.eq('es_comestible', true)` a la query en línea 57.

### Archivos modificados
- [`app/recetas/nueva/page.tsx`](app/recetas/nueva/page.tsx)

---

## Bug 4 — Planificación: días del calendario no seleccionables

### Síntoma
Los días del calendario en [`PlanificacionCalendario.tsx`](components/PlanificacionCalendario.tsx) eran `<div>` sin `onClick`. El usuario no podía pulsar un día para ver qué tenía asignado (entrenos, dieta, revisión).

### Causa raíz
No existía estado `diaSeleccionado` ni handler de click. Los días eran elementos inertes.

### Fix
- Convertidos a `<button>` con `onClick`
- Nuevo estado `diaSeleccionado` + panel de detalle con sesiones, dieta y revisión
- Cierre del detalle al hacer clic fuera (via `detalleRef` + `useEffect`)
- Toggle on/off al hacer clic en el mismo día

### Archivos modificados
- [`components/PlanificacionCalendario.tsx`](components/PlanificacionCalendario.tsx)

---

## Bug 5 — Planificación: sin responsividad en mobile

### Síntoma
El calendario usaba layout fijo sin breakpoints. En pantallas pequeñas los días se comprimían, las cabeceras ocupaban demasiado espacio y los dots de actividad se superponían.

### Causa raíz
Layout con `aspect-square` + `grid grid-cols-7` fijo sin adaptación responsive. Padding, gaps, tamaños de texto y dots sin variantes `sm:`.

### Fix
- Texto del mes: `text-xs sm:text-sm md:text-base`, `min-w-[130px] sm:min-w-[180px]`
- Padding general: `p-2 sm:p-4`, `p-px sm:p-0.5`, `px-2 sm:px-4`, `p-3 sm:p-4`
- Gaps: `gap-px sm:gap-1`
- Cabeceras de días: inicial en mobile, nombre completo en desktop (`hidden sm:inline` / `sm:hidden`)
- Dots: `w-1 h-1` mobile → `sm:w-1.5 sm:h-1.5`
- Layout columnas: `grid-cols-1 xl:grid-cols-3`
- Hint responsivo al final de la leyenda

### Archivos modificados
- [`components/PlanificacionCalendario.tsx`](components/PlanificacionCalendario.tsx)

---

## Bug 6 — Sesiones mal contadas si se cambia entrenoActivo

### Síntoma
Cuando se cambia la rutina activa, `entrenoActivo` se actualiza, pero el `useEffect` depende de `entrenoActivo?.id` con optional chaining. Si `entrenoActivo` pasa de existir a no existir (se desactiva la rutina), `entrenoActivo?.id` es `undefined` que es distinto del valor anterior, y el efecto se ejecuta limpiando sesiones. Correcto.

Sin embargo, **si la consulta a Supabase falla** (error de red, RLS, timeout), el `.then()` nunca se ejecuta y `loadingSesiones` queda en `true` permanentemente. El usuario ve "Cargando…" infinito.

### Causa raíz
Falta `.catch()` en la promesa de Supabase.

### Fix
Añadir `.catch(console.error)` con `setLoadingSesiones(false)`.

### Archivos modificados
- [`components/PlanificacionCalendario.tsx`](components/PlanificacionCalendario.tsx) (pendiente de aplicar)

---

## Bug 7 — `fechaRevision` desincronizada con `nuevaFecha`

### Síntoma
Si el componente padre actualiza `fechaRevision` (ej. otro componente), el input de edición de fecha puede mostrar un valor desactualizado porque `nuevaFecha` es estado local inicializado con `fechaRevision || ''` pero no se sincroniza con cambios externos.

### Causa raíz
`nuevaFecha` solo se resetea a `fechaRevision` al cancelar la edición, no cuando cambia la prop externamente.

### Fix
Añadir `useEffect` que sincronice `nuevaFecha` con `fechaRevision` cuando no se está editando.

### Archivos modificados
- [`components/PlanificacionCalendario.tsx`](components/PlanificacionCalendario.tsx) (pendiente de aplicar)

---

## Code Smell 1 — Lógica duplicada de eliminación de revisión

### Síntoma
El mismo fetch para eliminar la fecha de revisión aparece en dos lugares: botón en modo edición (líneas 494-511) y botón en modo vista (líneas 528-542).

### Impacto
Mantenimiento duplicado. Si cambia la lógica (ej. cambiar endpoint), hay que modificar dos sitios.

### Fix propuesto
Extraer a función `eliminarRevision()` compartida.

---

## Archivos verificados sin errores

Estos archivos ya tenían los filtros correctos y no requirieron cambios:

| Archivo | Filtro |
|---------|--------|
| [`app/api/alimentos/route.ts:23`](app/api/alimentos/route.ts:23) | `.eq('es_comestible', true)` |
| [`app/api/intercambios/route.ts:25,38,54`](app/api/intercambios/route.ts:25) | `.eq('es_comestible', true)` |
| [`app/api/recetas/route.ts:13`](app/api/recetas/route.ts:13) | `.eq('estado', 'aprobada')` |
| [`app/api/recetas/sugeridas/route.ts:50`](app/api/recetas/sugeridas/route.ts:50) | `.eq('estado', 'aprobada')` |
| [`app/api/recetas/[id]/ingredientes/route.ts:37`](app/api/recetas/[id]/ingredientes/route.ts:37) | `.eq('estado', 'aprobada')` |
| [`app/api/recetas/[id]/healthify/route.ts:55,65,84`](app/api/recetas/[id]/healthify/route.ts:55) | `.eq('es_comestible', true)` |
| [`lib/scraping/guard-no-comestible.ts`](lib/scraping/guard-no-comestible.ts) | Runtime guard (38 patrones + 17 excepciones) |

## Deploy

- Commit: `bb779f2`
- Bug 4-5: pendiente de commit
- Producción: https://nutricoach-delta.vercel.app
- Fecha: 2026-05-22
