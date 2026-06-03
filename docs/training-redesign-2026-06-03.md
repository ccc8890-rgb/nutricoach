# Training redesign — 03-06-2026

## Cambios implementados

- `AI Review Inbox` incluye tareas `actualizacion_plan` cuando el payload declara `accion_aplicable: actualizar_plan_entreno`.
- Las recomendaciones de plan se muestran como acciones aplicables si incluyen `plan_update.sesiones_por_semana` o `plan_update.duracion_semanas`.
- `aplicarTarea()` ahora puede aplicar de forma segura actualizaciones de entrenamiento aprobadas por el coach.
- `plan_update.sesiones_por_semana` no se escribe como columna porque no existe en `planes_entrenamiento`; se transforma en nota operativa dentro de `descripcion`.
- `plan_update.duracion_semanas` se escribe solo en la columna real `duracion_semanas`.
- `AI Review Inbox` muestra una previsualización antes de aprobar: qué se aplicará, si se enviará mensaje y qué queda manual.
- `plan_update.sesiones[]` permite aplicar ajustes concretos sobre sesiones y ejercicios del plan activo:
  - Sesiones: match por `id`, `dia_semana` o `nombre`.
  - Ejercicios: match por `id`, `ejercicio_id` o `ejercicio_nombre`.
  - Campos permitidos en sesión: `duracion_estimada_min`, `notas`, `contexto_ia`.
  - Campos permitidos en ejercicio: `series`, `repeticiones`, `descanso_segundos`, `peso_sugerido`, `rpe`, `notas`, `instruccion_ejercicio`.
  - Las notas de IA se añaden con prefijo `[IA coach]` para mantener trazabilidad.

## Bug encontrado y corregido

- Antes, una tarea `actualizacion_plan` con payload estructural podía acabar marcada como aplicada aunque no existiera un plan activo de entrenamiento.
- Ahora, si no hay `planes_entrenamiento` activo para el cliente, la aplicación devuelve error y no marca la tarea como aplicada.
- La vista remota `prs_por_ejercicio` fue verificada con `pg_get_viewdef`: ya usa `s.set_data ->> 'peso_kg'` y no `sets_ejecutados -> 0`.
- La aplicación IA ya no se limita a anotar el plan cuando trae sesiones concretas: ajusta la sesión o ejercicio real si encuentra un match seguro y reporta qué no pudo aplicar.

## Verificación

- `npx tsx scripts/supercoach-engine.test.ts`
- `npx tsx scripts/test-agentes-aplicar-training.ts`
- `npx tsx scripts/test-training-workspace.ts`
- `supabase db query --linked "select pg_get_viewdef('public.prs_por_ejercicio'::regclass, true) as viewdef;"`
- `npx eslint app/entrenos/brain-ia/page.tsx lib/agentes/aplicar.ts lib/training/workspace.ts scripts/test-agentes-aplicar-training.ts scripts/test-training-workspace.ts --no-warn-ignored`
- `npm run build`

## Siguiente mejora recomendada

- Añadir historial visible de cambios IA por sesión para que el coach pueda comparar antes/después y revertir un ajuste concreto.
