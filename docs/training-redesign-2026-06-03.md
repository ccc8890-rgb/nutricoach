# Training redesign — 03-06-2026

## Cambios implementados

- `AI Review Inbox` incluye tareas `actualizacion_plan` cuando el payload declara `accion_aplicable: actualizar_plan_entreno`.
- Las recomendaciones de plan se muestran como acciones aplicables si incluyen `plan_update.sesiones_por_semana` o `plan_update.duracion_semanas`.
- `aplicarTarea()` ahora puede aplicar de forma segura actualizaciones de entrenamiento aprobadas por el coach.
- `plan_update.sesiones_por_semana` no se escribe como columna porque no existe en `planes_entrenamiento`; se transforma en nota operativa dentro de `descripcion`.
- `plan_update.duracion_semanas` se escribe solo en la columna real `duracion_semanas`.

## Bug encontrado y corregido

- Antes, una tarea `actualizacion_plan` con payload estructural podía acabar marcada como aplicada aunque no existiera un plan activo de entrenamiento.
- Ahora, si no hay `planes_entrenamiento` activo para el cliente, la aplicación devuelve error y no marca la tarea como aplicada.

## Verificación

- `npx tsx scripts/supercoach-engine.test.ts`
- `npx tsx scripts/test-agentes-aplicar-training.ts`
- `npx tsx scripts/test-training-workspace.ts`
- `npx eslint app/entrenos/brain-ia/page.tsx lib/agentes/aplicar.ts lib/training/workspace.ts scripts/test-agentes-aplicar-training.ts scripts/test-training-workspace.ts --no-warn-ignored`
- `npm run build`

## Siguiente mejora recomendada

- Añadir una vista de previsualización antes de aprobar una `actualizacion_plan`: qué se va a anotar, qué mensaje se enviará y qué parte deberá ajustar manualmente el coach.
