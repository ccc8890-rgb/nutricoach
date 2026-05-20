# Continuidad Codex hasta vuelta de Claude

**Fecha:** 20-05-2026  
**Proyecto:** NutriCoach  
**Uso:** guía operativa para seguir implementando sin desviarse del plan estratégico de Claude.

---

## Regla base

Claude sigue siendo el planeador estratégico. Codex actúa temporalmente como ejecutor/director operativo para:

1. Validar flujos ya implementados.
2. Corregir bugs claros.
3. Implementar bloques que ya estén descritos en specs o planes de Claude.
4. Dejar evidencia para que Claude pueda revisar y continuar.

No abrir líneas nuevas grandes hasta que Claude revise, salvo desbloqueos obvios.

---

## Fuentes madre

- `NUTRICION/CLAUDE.md`
- `nutricoach/CLAUDE.md`
- `nutricoach/ESTADO.md`
- `docs/superpowers/ESTADO.md`
- `docs/superpowers/specs/2026-05-20-cerebro-coach-onboarding-design.md`
- `docs/superpowers/plans/2026-05-20-cerebro-coach-onboarding.md`
- `docs/superpowers/specs/2026-05-17-training-pro-design.md`
- `plans/PLAN_MEJORAS_BD_FLUJOS.md`

---

## Dirección estratégica actual

La línea principal de Claude es cerrar el producto alrededor de:

1. **Cerebro del Coach:** metodología de Carlos + evidencia científica + recetario + IA.
2. **Onboarding inteligente:** cliente completa perfil, plan se genera en background, Carlos revisa.
3. **Revisión rápida:** aprobar, ajustar o regenerar planes con fricción mínima, idealmente móvil.
4. **Training Pro:** entreno como diferenciador real.
5. **Retención:** check-ins, feedback, fotos, alertas, adherencia y seguimiento.
6. **Escalabilidad futura:** SaaS multicoach, Stripe, Garmin/Strava, pero no ahora.

---

## Estado verificado por Codex

### Build

- `npm run build` en `nutricoach/` pasa correctamente.
- Next.js genera 103 rutas/páginas sin errores TypeScript.

### Cerebro del Coach

Implementado:

- `/coach/metodologia`
- `/api/metodologia-coach`
- `generar-plan-inicial` lee `metodologia_coach`
- `generar-plan-inicial` inyecta metodología en el prompt
- `onboarding/perfil` dispara generación de plan en background
- `AutoCoachPanel` está integrado en dashboard
- señales `sin_actividad_portal` y `sin_entreno`
- columna `clientes.last_portal_access`
- recetas sugeridas por comida en `revisar-plan`

Pendiente de validación:

- `metodologia_coach` existe, pero está vacía. Carlos debe rellenar su metodología desde `/coach/metodologia`.
- `last_portal_access` existe, pero todavía no hay accesos registrados tras la migración.
- Falta validar E2E real: onboarding profundo → plan IA con metodología → revisión → aprobación → portal cliente.

### Training Pro

Implementado:

- Plan 1 Foundation
- Perfil Atleta
- Motor-entreno conectado al selector
- Ejecución de sesión desde portal cliente
- Registro de sets/RPE/duración
- Historial coach con PRs y timeline
- Modal demo de ejercicio con `video_url`
- Asignar plantilla a cliente desde `/entrenos/plantillas`
- Dashboard `/entrenos` con stats de actividad

Verificado:

- El bug `prs_por_ejercicio` ya está corregido en Supabase. La vista remota usa `s.set_data`, no `sets_ejecutados -> 0`.

Pendiente:

- Adherencia semanal en ficha cliente.
- Completar sesión rápido desde `SemanaEntrenoCard`.
- Historial de sesiones dentro de `/entrenos/[id]`.
- Biblioteca coach de ejercicios/media.
- Ajustes IA de entrenamiento pendientes de aprobar.

---

## Cola recomendada para Codex

### Bloque 1 — QA Cerebro del Coach

Objetivo: validar el núcleo del producto diseñado por Claude.

Tareas:

1. Rellenar metodología en `/coach/metodologia`.
2. Confirmar guardado en `metodologia_coach`.
3. Generar/regenerar plan de un cliente.
4. Confirmar que el plan usa metodología y evidencia.
5. Confirmar recetas sugeridas por comida en `revisar-plan`.
6. Aprobar cliente y confirmar portal/email.

Verificación:

- `npm run build`
- Query: `select count(*) from metodologia_coach;`
- QA visual en navegador.

### Bloque 2 — Revisión express móvil

Fuente: `2026-05-20-cerebro-coach-onboarding-design.md`.

Crear:

- `app/clientes/[id]/revisar-rapido/page.tsx`

Mínimo funcional:

- Header cliente: nombre, objetivo, estado.
- Card compacta con kcal/macros/distribución.
- Recetas sugeridas por comida.
- Botones grandes: Aprobar, Ajustar, Regenerar.
- Reutilizar `/api/aprobar-cliente` y `/api/generar-plan-inicial`.

### Bloque 3 — Training Pro: adherencia semanal

Fuente: `nutricoach/ESTADO.md`.

Objetivo:

- Añadir vista de adherencia semanal de entrenos en ficha cliente, probablemente dentro de `HistorialEntreno.tsx`.

Datos:

- `registros_sets`
- `planes_entrenamiento`
- `sesiones_entrenamiento`

### Bloque 4 — Training Pro: completar sesión rápido

Objetivo:

- Desde `SemanaEntrenoCard`, marcar sesión como completada hoy sin abrir toda la pantalla de ejecución.

Regla:

- No sustituye la pantalla completa. Es un atajo para sesiones simples.

### Bloque 5 — Training Pro: historial en `/entrenos/[id]`

Objetivo:

- En detalle de plan, mostrar días completados, duración, RPE y resumen de sets.

---

## No hacer por ahora

- Stripe.
- Garmin/Strava.
- App nativa.
- Rediseño completo del dashboard.
- Regenerar 147 imágenes malas salvo decisión explícita.
- Re-scrapear supermercados si estamos trabajando producto/Training.

---

## Notas para Claude

- Hay docs antiguos que marcan tareas como pendientes aunque ya estén hechas. Contrastar siempre con código y Supabase.
- El plan `2026-05-20-cerebro-coach-onboarding.md` tiene checks sin marcar, pero buena parte está implementada.
- Supabase CLI saltó migraciones locales sin timestamp; no usar eso como prueba de que la BD remota no cambió.
- Hay cambios locales no relacionados en `.superpowers/` y `docs/auditoria-2026-05-20-antigravity-ide-vscode.md`.

---

## Siguiente acción recomendada

Ejecutar **Bloque 1 — QA Cerebro del Coach** antes de añadir nuevas funcionalidades.  
Después, elegir entre:

- **Bloque 2 — Revisión express móvil**, si la prioridad es acelerar entrega de planes.
- **Bloque 3 — Adherencia semanal Training Pro**, si la prioridad es avanzar en entrenos.
