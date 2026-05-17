# ESTADO — NutriCoach Training Pro

**Última actualización:** 17-05-2026 (sesión 26 — flujo E2E onboarding→plan, auditoría científica, 6 fixes, commits `d78c721` + `677c0b4`)

---

## Flujo E2E — Onboarding → Plan inicial [COMPLETADO ✅]

### Qué es
El flujo completo desde que un cliente se registra vía invitación hasta que el coach le entrega una dieta y un entrenamiento iniciales. Operativo en producción (Vercel).

### Pasos del flujo (todos funcionando)

```
1. Coach invita al cliente → /registro/[token]
2. Cliente completa onboarding básico (6 pasos) → /onboarding
3. Cliente completa perfil profundo → /onboarding/perfil
   → guarda en onboarding_perfil_profundo
   → marca onboarding_completado = true
   → dispara generar-plan-inicial (fire-and-forget)
   → redirige a /cliente (portal cliente)
4. Coach ve badge "Nuevo" en /clientes → va a /clientes/[id]/revisar-plan
5. Coach revisa:
   - Datos corporales y perfil del cliente
   - Plan IA (kcal, macros, distribución comidas) — si aún genera: spinner + Recargar
   - Selecciona plantilla de entrenamiento con PlantillaEntrenoSelector
6. Coach hace click en:
   - "Crear plan de dieta" → inserta planes_nutricion + comidas en BD
   - "Asignar entrenamiento" → copia plantilla a planes_entrenamiento + sesiones + ejercicios
   - "Aprobar y activar cliente" → activo=true + revisado_por_coach=true
7. Coach redirigido a /clientes/[id] (ficha completa)
```

### Commits del flujo
| Commit | Contenido |
|--------|-----------|
| `d78c721` | Tasks 1-3: link lista→revisar-plan, botones crear dieta/entreno, aprobar |
| `677c0b4` | 6 fixes: proteína científica, redirect onboarding, validaciones, UX race condition |

---

## Fixes científicos y de bugs — sesión 26 (commit `677c0b4`)

### Fix 1 — Redirect post-onboarding ✅
- **Antes:** redirigía a `/cliente/${id}/dashboard` (ruta inexistente)
- **Fix:** redirige a `/cliente?onboarding=completo` (portal real)
- **Archivo:** `app/onboarding/perfil/page.tsx`

### Fix 2 — Proteína diferenciada por objetivo ✅
- **Antes:** todos los objetivos → 2.0 g/kg (INCORRECTO para salud_general: 2.5x RDA/WHO)
- **Fix:** tabla por objetivo basada en evidencia:

| Objetivo | g/kg | Referencia |
|----------|------|-----------|
| salud_general | 1.0 | RDA WHO/FAO 0.8–1.0 |
| mantener | 1.6 | Phillips & Van Loon 2011 |
| rendimiento | 1.8 | ISSN Position Stand 2017 |
| ganar_musculo | 2.0 | Helms 2014 / Morton 2018 BJSM |
| perder_grasa | 2.4 | Helms 2014 (2.3–3.1 en déficit, conservador) |

- Factor mujer × 0.9 en `ganar_musculo` (diferencias hormonales síntesis proteica)
- **Archivo:** `app/api/generar-plan-inicial/route.ts`

### Fix 3 — Aprobar activa `activo=true` ✅
- **Antes:** `{ revisado_por_coach: true }` — cliente quedaba inactivo
- **Fix:** `{ revisado_por_coach: true, activo: true }`
- **Archivo:** `app/clientes/[id]/revisar-plan/page.tsx`

### Fix 4 — Validaciones defensivas ✅
- `crearPlan()`: aborta si `distribucion_comidas` está vacía con mensaje claro
- `crearPlanDesdeEntrenamiento()`: aborta si plantilla no tiene sesiones
- `autoeficacia >= 0` en onboarding/perfil (antes `> 0` bloqueaba el valor válido 0)

### Fix 5 — UX race condition ✅
- **Antes:** coach abría revisar-plan antes de que terminara la IA → sección plan vacía sin explicación
- **Fix:** card "Generando plan con IA… Suele tardar menos de 1 minuto" + botón Recargar que re-consulta `registros_ia` sin recargar la página

### Fix 5b — `errorEntreno` visible al usuario ✅
- **Antes:** errores en `crearPlanDesdeEntrenamiento` → `console.error` silencioso
- **Fix:** `errorEntreno` state mostrado al usuario bajo los botones de acción

---

## Plan 1 — Foundation ✅ COMPLETADO

| Task | Estado | Commit |
|------|--------|--------|
| SQL Migration (`supabase_training_pro_v2.sql`) | ✅ Aplicado en Supabase | `ce6e91c`, `fa9f0e7` |
| TypeScript types (`SportModality`, `TrainingTier`, `PerfilEntrenoCliente`, `AjusteSesionCliente`) | ✅ | `24a560c` |
| Seed 8 plantillas élite por modalidad | ✅ | `a5b5b0f` |
| UI filtros modalidad/tier en `PlantillaEntrenoSelector` | ✅ | `0607c3b` |
| Bugs T01-T04 resueltos | ✅ | `ba427a1` |

### Plantillas en BD (29 total)
| Modalidad | Nombre | Tier | Nivel |
|-----------|--------|------|-------|
| calistenia | Calistenia — Muscle-Up Estricto (Elite) | elite | avanzado |
| ciclismo | Ciclismo Potencia — Intermedio (FTP base) | elite | intermedio |
| funcional | Funcional — Pérdida de Peso Intermedio | general | intermedio |
| gym_estetica | Gym Estética — Upper/Lower Intermedio | general | intermedio |
| gym_fuerza | Gym Fuerza — Press Banca + Fuerza General | general | intermedio |
| hibrido | Híbrido Elite — Hyrox + Muscle-Up (Carlos) | elite | avanzado |
| hyrox | Hyrox Open — Preparación Intermedio | elite | intermedio |
| running | Running — Fondo Intermedio (VDOT 40-50) | elite | intermedio |
| null (legacy) | 21 plantillas antiguas sin sport_modality | general | varios |

---

## 🔴 Plan 2 — Perfil Atleta + Fix UI [PRÓXIMA SESIÓN]

**Prioridad:** Alta. Depende de Plan 1 (completado).

### Tareas estimadas

1. **`PerfilEntrenoCliente` form** — componente de edición del perfil de entreno (FTP, VDOT, 1RM, días disponibles, equipo disponible, capacidad recuperación)
2. **API `/api/perfil-entreno/[clienteId]`** — GET/PUT para leer y actualizar `perfil_entreno_cliente`
3. **Tab "Perfil Atleta"** en ficha de cliente (`/clientes/[id]`) — integrar el form del perfil junto al perfil nutricional
4. **`lib/entrenos/motor-entreno.ts`** — árbol de 9 decisiones según spec sección 3 (HRV, energía check-in, TLS, molestias, fase, adherencia, plateau, días competición)

### Plan 3 (futuro) — Vista semanal cliente + Ajustes IA

- Vista semanal mejorada en portal cliente (semana visual por día con sesiones detalladas)
- Badge de ajuste IA cuando algo cambió
- `RegistrarEntrenoModal` ampliado con feedback post-sesión (RPE real, molestia nueva, nota libre)
- Dashboard coach: panel de ajustes propuestos pendientes de aprobar

---

## 🟠 Backlog — Flujo E2E (mejoras post-MVP)

| Prioridad | Tarea | Contexto |
|-----------|-------|---------|
| 🔴 Alta | **Regenerar plan IA** desde `revisar-plan` | Si el coach no le gusta el plan generado, no hay botón para pedir uno nuevo. Necesita llamar a `/api/generar-plan-inicial` desde la UI con feedback de loading |
| 🔴 Alta | **Email al cliente cuando coach aprueba** | Al hacer click en "Aprobar y activar", enviar email Resend al cliente diciéndole que ya tiene su plan listo en el portal |
| 🟠 Media | **onboarding_perfil_profundo en revisar-plan** | El coach solo ve `onboarding_responses` (básico). Datos del perfil profundo (autoeficacia, historial dietas, hora entreno, etc.) no se muestran en la ficha de revisión |
| 🟠 Media | **Indicador de progreso onboarding multi-paso** | El formulario de perfil profundo es muy largo. Un stepper visual (Paso 2/5) reduciría abandono |
| 🟠 Media | **Validación de TDEE antes de guardar plan** | Si kcal_objetivo < 1200 (mujeres) o < 1500 (hombres), mostrar advertencia al coach antes de crear la dieta |
| 🟡 Baja | **`revisado_por_coach` en tiempo real** | El badge del sidebar cuenta clientes con `revisado_por_coach=false`. Si hay 0, el link "Clientes" debería no mostrar badge. Actualmente puede quedar badge 0 hasta refrescar |
| 🟡 Baja | **Historial de planes IA generados** | Si se regenera el plan, el anterior se pierde. Guardar histórico en `registros_ia` (ya existe la tabla) y permitir al coach ver versiones anteriores |
| 🟡 Baja | **Confirmar antes de aprobar** | Modal de confirmación antes de `aprobar()`: "¿Confirmas que este cliente tiene dieta y entrenamiento asignados?" |

---

## 🟠 Backlog — Training Pro Plan 2 (Tareas feas pendientes para DeepSeek)

| Prioridad | Tarea | Descripción |
|-----------|-------|-------------|
| 🔴 Alta | **Re-scrapear supermercados** | `match_alimento` mejorada a 6 pasos. Re-scrapear Mercadona y Consum para que productos nuevos usen la versión mejorada |
| 🟠 Media | **7 recetas con macros altas** | Carlos revisa porciones desde `/recetas/[id]`. Las más urgentes: Mayonesa camarón (1305 kcal), Burrito Pollo Chipotle (1045 kcal), Bowl salmón aguacate (979 kcal) |
| 🟠 Media | **BUG-T02 residual** (búsqueda plantillas) | La búsqueda en `/entrenos/plantillas` no filtra por `sport_modality` ni `tier` — detectado sesión 25, no prioritario |

---

## Estado de la BD (17-05-2026)

| Tabla | Filas | Notas |
|-------|-------|-------|
| `plantillas_entrenamiento` | 29 | 8 con sport_modality, 21 legacy |
| `plantilla_sesiones` | ~120 | — |
| `plantilla_sesion_ejercicios` | ~500 | Nuevas cols: unidad, carga_tipo, carga_valor, notas_tecnicas, sustituciones |
| `perfil_entreno_cliente` | 0 | Tabla creada, sin datos aún |
| `ajustes_sesion_cliente` | 0 | Tabla creada, sin datos aún |
| `ejercicios` | ~270 | ~50 nuevos creados por seed Plan 1 |
| `registros_ia` | variable | tipo='plan_inicial' para cada cliente que completó onboarding |
| `onboarding_responses` | variable | onboarding básico (6 pasos) |
| `onboarding_perfil_profundo` | variable | perfil profundo (atletismo, historial, hábitos) |
