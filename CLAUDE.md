# CLAUDE.md — NutriCoach (Human Lab)

## ✅ SESIÓN 28-05-2026 (Sesión 43) — Revisión código Codex + lote recetas recomposición

### Qué se hizo

**Revisión y corrección de 3 bugs críticos introducidos por Codex en las últimas sesiones:**

| Bug | Severidad | Fix | Commit |
|-----|-----------|-----|--------|
| `sync-integraciones`: fallback a credenciales Garmin del coach sincronizaba datos del **coach** bajo el ID del **cliente** (mezcla de datos privados) | 🔴 CRÍTICO | Fallback eliminado. Solo sincroniza si el cliente tiene sus propias credenciales. | `075ee23` |
| `generar-plan-inicial`: `guardarDietaHabitualCliente()` sin `await` — datos del onboarding podían perderse si Vercel cortaba la función | 🟠 ALTO | Añadido `await` | `075ee23` |
| `lib/deepseek.ts`: 5 llamadas a la API sin timeout — peticiones podían quedar colgadas hasta 300s | 🟠 ALTO | `AbortSignal.timeout(60_000)` en los 5 fetch calls | `075ee23` |

**Lote de recetas importado:**
- 10 recetas "recomposición Chef Healthy" → BD Supabase (`aae4fc6`)
- Quality gate: 10/10 OK, 0 críticos, 0 avisos
- Categorías: Desayuno (2), Comida (4), Cena (2), Postre (1), Merienda (1)

**Lo que Codex dejó bien (no tocar):**
- Aislamiento datos cliente-cliente correcto
- Quality gate recetas robusto
- Normalizador de alimentos sólido
- Feature dieta habitual bien diseñada

**Pendientes menores no urgentes (para Codex o próxima sesión):**
- Test scripts con email del coach hardcodeado (`ccc8890@gmail.com`) → mover a env var `NUTRICOACH_TEST_COACH_EMAIL`
- Validación alérgenos en `validar-lote-deepseek.ts` solo por regex — no cubre todos los casos de BD

---

## ✅ SESIÓN 27-05-2026 (Sesión 42) — Auditoría de seguridad + hardening

### Qué se hizo

**Auditoría completa de seguridad** disparada por aviso del Security Advisor de Supabase (`rls_disabled_in_public`). Informe completo: [`salidas/27-05-2026_auditoria-seguridad.md`](salidas/27-05-2026_auditoria-seguridad.md)

**5 problemas corregidos (commit `0152859`):**

| # | Severidad | Problema | Fix |
|---|-----------|----------|-----|
| 1 | 🔴 CRÍTICO | `recetas_auditoria` sin RLS | Migration `20260527_fix_rls_recetas_auditoria.sql` aplicada en Supabase |
| 2 | 🟠 ALTO | GET/PUT `/api/clientes/[id]` sin `getUser()` | Auth + verificación `coach_id` añadidos |
| 3 | 🟠 ALTO | Seed endpoints sin protección en producción | Guard `NODE_ENV === 'production'` → 403 |
| 4 | 🟠 ALTO | `/api/importar-receta` sin auth (SSRF potencial) | Auth check + SSRF guard (IPs privadas bloqueadas) |
| 5 | 🟡 MEDIO | Sin HTTP security headers | `X-Frame-Options`, `X-Content-Type-Options`, `Referrer-Policy`, `Permissions-Policy`, `CSP` globales en `next.config.mjs` |

**Estado actual de seguridad:**
- ✅ 0 tablas Supabase sin RLS
- ✅ Todos los endpoints de coach requieren auth explícita
- ✅ Seed/import endpoints bloqueados en producción
- ✅ SSRF guard activo en fetch de URLs externas
- ✅ Security headers HTTP en todas las respuestas

**Falso positivo confirmado:** Los endpoints `/api/cliente/[codigo]/*` del portal cliente usan `codigo_publico` UUID como token de acceso (diseño intencional, no bug).

**Pendientes de seguridad (no urgentes):**
- Rate limiting en endpoints de IA generativa (Vercel Edge o Upstash)
- Review periódico de RLS en tablas nuevas (añadir al flujo de migrations)

---

## ✅ SESIÓN 24-05-2026 (Sesión 41) — Auditoría E2E + 2 SQL migrations + arranque Fase B/C

### Qué se hizo

**Auditoría completa del estado E2E de la app** — revisión de todos los bugs y pendientes acumulados desde sesión 22 hasta 40. Resultado: la mayoría ya estaban resueltos en sesiones anteriores.

**2 SQL aplicadas en Supabase:**
| Migration | Resultado |
|-----------|-----------|
| `20260524_garmin_connect_perclient.sql` | ✅ Aplicada — CHECK ampliado + columna `credenciales_json TEXT` en `integraciones_cliente` |
| `fix_prs_por_ejercicio_v2.sql` | ✅ Aplicada — vista `prs_por_ejercicio` ahora lee `s.set_data ->> 'peso_kg'` (el set más pesado, no el primero) |

**Verificaciones de código (ya resueltos en sesiones anteriores):**
- `getSummaryLast7d` ya reconoce `garmin_connect` — query sin filtro de proveedor, `garmin_connect` en el tipo `Proveedor`
- `IntegracionesPanel` ya correcto — form credenciales (no OAuth), badge "Sync automático"
- `revisar-rapido` ya correcto — interfaz `PlanInicial` con `recetas[]`, chips púrpura DeepSeek
- BUG-T01 ya correcto — `entrenos/plantillas` filtra por `sport_modality` desde sesión 25

**Arranque Fase B/C — brainstorming iniciado:**
- Decisión: empezar por **adherencia** (Fase C) — más impacto inmediato como coach
- Siguiente paso: registro de comidas en portal (tabla `registro_comidas_dia` ya existe: id, cliente_id, plan_id, comida_id, fecha, estado, notas)
- Pendiente decidir granularidad del registro (binario / 3 estados / porcentaje) — sesión parada en esa pregunta

### ⚠️ PRÓXIMA SESIÓN — Continuación Fase C: Adherencia

**Punto exacto donde se paró el brainstorming:**
> Cuando el cliente marca una comida, ¿qué registra?
> A) Solo "completada / saltada" (binario)
> B) Completada / parcialmente / saltada + motivo opcional
> C) Completada + porcentaje de porciones

Carlos elige A, B o C → a partir de ahí se diseña el sistema completo y se implementa.

**Piezas a construir (en orden):**
1. **Portal cliente**: botón/checkbox en cada comida de `MiPlan.tsx` → llama `POST /api/cliente/[codigo]/registro-comidas`
2. **API registro**: inserta/actualiza `registro_comidas_dia` (tabla ya existe en BD)
3. **Cálculo adherencia**: `%_adherencia = comidas_completadas / comidas_totales` por semana
4. **Vista coach**: en ficha cliente (`/clientes/[id]`) — tab o sección con adherencia semanal + histórico

---

## ✅ SESIÓN 24-05-2026 (Sesión 40) — Garmin Connect por cliente + GARMIN_CREDENTIALS_KEY

### Qué se construyó

Arquitectura completa para que cada cliente vincule su propia cuenta Garmin Connect usando sus credenciales personales, cifradas con AES-256-CBC.

| Archivo | Cambio |
|---------|--------|
| `supabase/migrations/20260524_garmin_connect_perclient.sql` | CHECK ampliado para incluir `garmin_connect`; columna `credenciales_json TEXT` en `integraciones_cliente` |
| `lib/integraciones/garmin-connect-perclient.ts` | `cifrarCredenciales()`, `descifrarCredenciales()`, `verificarCredencialesGarmin()`, `syncGarminClientDays()` |
| `lib/integraciones/garmin-connect-sync.ts` | `syncGarminDay(date, gc?, displayName?)` — acepta cliente pre-autenticado opcional (per-client sync) o usa credenciales del coach (legacy) |
| `app/api/integraciones/garmin-connect/route.ts` | **NUEVO** — POST: verifica login Garmin, cifra y guarda en BD. DELETE: borra integración |
| `app/api/cron/sync-integraciones/route.ts` | Itera `integraciones_cliente` con `proveedor='garmin_connect'`, descifra credenciales, llama `syncGarminClientDays` por cliente |
| `components/PortalCliente/IntegracionesPanel.tsx` | Form email+password cuando no vinculado; muestra "Sync automático" + botón Desconectar cuando activo |

### Infraestructura

- `GARMIN_CREDENTIALS_KEY` (64 hex chars) generada y añadida a `.env.local` + Vercel Production
- Cifrado: AES-256-CBC, IV aleatorio por credencial, almacenado como `iv_hex:encrypted_hex`
- Cron horario: sincroniza hoy+ayer para todos los clientes con garmin_connect activo

### ⚠️ PENDIENTE MANUAL

| # | Tarea | Cómo |
|---|-------|------|
| 🔴 | **Aplicar SQL migration** `20260524_garmin_connect_perclient.sql` en Supabase | Dashboard → SQL Editor → ejecutar el archivo |
| 🟠 | **Google Fit**: crear proyecto en Google Cloud Console, habilitar Fitness API, crear OAuth credentials, añadir `GOOGLE_FIT_CLIENT_ID` + `GOOGLE_FIT_CLIENT_SECRET` a Vercel | El código está listo en `lib/integraciones/google-fit.ts` |

### Commits sesión 40
- `2028736` — feat: Garmin Connect por cliente + form credenciales en portal

---

## ✅ SESIÓN 24-05-2026 (Sesión 39) — Panel wellness Garmin + normalizer garmin fields

### Qué se construyó

| Archivo | Cambio |
|---------|--------|
| `lib/integraciones/types.ts` | `garmin_connect` en `Proveedor` union; 4 campos nuevos en `ResumenActividadSemanal`: `body_battery_media`, `stress_avg_media`, `training_readiness_media`, `rhr_media` |
| `lib/integraciones/normalizer.ts` | `getSummaryLast7d()` calcula los 4 nuevos campos de las filas garmin_connect; empty-state inicializado |
| `app/api/cliente/[codigo]/integraciones/route.ts` | Detecta garmin_connect en `actividad_externa_cliente` (no OAuth). Devuelve `garmin_connect: { activa, ultima_sync, datos_hoy }` separado del array integraciones OAuth |
| `app/api/cliente/[codigo]/garmin-resumen/route.ts` | **NUEVO** — devuelve últimos 7 días de garmin_connect + promedios (pasos, TDEE, RHR, HRV, body_battery, stress, training_readiness) |
| `components/PortalCliente/IntegracionesPanel.tsx` | **Reescrito** — card Garmin Connect con badge "Sync automático", datos último día (body battery gauge, training readiness gauge, estrés con label semántico, pasos, RHR, HRV, TDEE), promedios 7 días con chips, sparkline body battery 7 días, nota "datos de sueño aparecerán cuando duermas con el reloj" |

### Comportamiento Garmin Connect en UI

- Si hay datos en BD → badge verde "Sync automático", datos del último día visibles
- Body Battery: gauge de color (verde ≥70, naranja ≥40, rojo <40)
- Training Readiness: gauge igual + score /100
- Estrés: Bajo (<26), Medio (<51), Alto (<76), Muy alto (≥76)
- Sparkline: barras por día de body_battery_end, colores por valor
- No tiene botón "Conectar" (no es OAuth) — sync lo hace el cron del coach

### Nota sueño (confirmado por Carlos)
Carlos no duerme con el Garmin aún → `sueno_h` y `sueno_calidad` serán null en todos los días. El panel muestra: "Los datos de sueño aparecerán cuando duermas con el reloj puesto."

### ✅ PRODUCCIÓN 100% OPERATIVA

| Tarea | Estado |
|-------|--------|
| `GARMIN_EMAIL` en Vercel Production | ✅ Añadida sesión 39 |
| `GARMIN_PASSWORD` en Vercel Production | ✅ Añadida sesión 39 |
| `STRAVA_CLIENT_ID=250183` en Vercel | ✅ Ya estaba |
| `STRAVA_CLIENT_SECRET` en Vercel | ✅ Ya estaba |
| `STRAVA_WEBHOOK_VERIFY_TOKEN=nutricoach-webhook-2026` | ✅ Actualizado sesión 39 |
| Webhook Strava ID 348546 registrado | ✅ Ya estaba activo (`nutricoach-delta.vercel.app/api/integraciones/strava-webhook`) |
| Redeploy producción con nuevos env vars | ✅ `nutricoach-otjku4whh` — sesión 39 |

### Commits sesión 39
- `61b808f` — docs: sesión 38 CLAUDE.md
- `06e1889` — feat: Garmin Connect panel wellness + normalizer garmin fields

---

## ✅ SESIÓN 24-05-2026 (Sesión 38) — Strava OAuth real + Garmin Connect wellness sync completo

### Qué se construyó / arregló

**Bugs críticos corregidos:**

| Bug | Causa raíz | Fix |
|-----|-----------|-----|
| "This page couldn't load" al clickar tab Apps | `dashboard/route.ts` devolvía `cliente:null` por join inline Supabase fallido → `data.cliente.id` TypeError | Split en 2 queries separadas + null guard en DashboardCliente |
| `clientes.codigo_portal` no existe | Columna incorrecta en 3 rutas | Siempre buscar por `planes_nutricion.codigo_publico` |
| Strava callback redirigía a `/cliente/integraciones` | Ruta inexistente (se trataba como `[codigo]='integraciones'`) | Lookup `planes_nutricion.codigo_publico` desde `cliente_id` |
| SW cache servía HTML viejo con chunks viejos tras deploy | service worker cache-first en navegaciones | Cambiado a network-first para navegaciones, cache-first solo para `_next/static/` |

**Strava real conectado:**
- Athlete ID: `62828992` → cliente `b18d795f-d416-485b-aeca-8144f004420b` (portal `nyv4l1Vm`)
- SQL migration `20260524_integraciones_dispositivos.sql` aplicada en Supabase (índices únicos + RLS)
- 9 actividades Strava sincronizadas (25-mar → 24-may) con datos COMPLETOS:
  - Splits por km (pace + FC + zona + desnivel), potencia media/NP/max watts, cadencia
  - Mejores esfuerzos (400m, 1mi, 5K...), elevación, kilojoules, suffer_score
  - Todo en `raw_data` JSONB para análisis posterior

**Garmin Connect wellness sync (nuevo, unofficial API):**
- Paquete: `garmin-connect` npm (v1.6.2) — login con email/password, sin OAuth partner
- `lib/integraciones/garmin-connect-sync.ts` — módulo completo con `syncGarminDay()` + `persistirGarminDays()`
- `scripts/backfill-garmin-connect.mjs` — backfill configurable con `--dias N --cliente-id UUID`
- 61 días sincronizados (24-mar → 23-may) con:
  - Pasos, TDEE, BMR, calorías activas, RHR, distancia diaria
  - Body Battery (máximo, mínimo, final del día)
  - Estrés medio + porcentaje bajo/medio/alto
  - Training Readiness (score 0-100 + nivel + feedback + tiempo recuperación)
  - HRV semanal media (en ms, desde hrvWeeklyAverage / 10)
  - Sueño cuando disponible (horas totales + deep/REM/light/despertar + SpO2 + respiración)
- Cron horario actualizado para sincronizar hoy+ayer de Garmin Connect automáticamente
- Nuevas columnas en BD: `body_battery_max`, `body_battery_min`, `body_battery_end`, `stress_avg`, `training_readiness`, `vo2max`, `distancia_km`
- Portal auto-abre tab Apps cuando URL tiene `?connected=strava` (o garmin/google_fit)

**Credenciales Garmin Connect:**
- `GARMIN_EMAIL=ccc8890@gmail.com` — en `.env.local` y pendiente añadir a Vercel
- `GARMIN_PASSWORD` — en `.env.local`, pendiente añadir a Vercel Production

### ⚠️ PENDIENTE MANUAL — Próxima sesión (prioritario)

| # | Tarea | Cómo |
|---|-------|------|
| 🔴 | **Añadir GARMIN_EMAIL + GARMIN_PASSWORD a Vercel Production** | Dashboard Vercel → Settings → Environment Variables |
| 🔴 | **Registrar webhook Strava** (para push en tiempo real de nuevos entrenos) | `curl -X POST https://www.strava.com/api/v3/push_subscriptions -d "client_id=$STRAVA_CLIENT_ID&client_secret=$STRAVA_CLIENT_SECRET&callback_url=https://nutricoach-delta.vercel.app/api/integraciones/strava-webhook&verify_token=$STRAVA_WEBHOOK_VERIFY_TOKEN"` |
| 🟠 | **Usar datos integraciones en agentes IA** | `getSummaryLast7d()` en `normalizer.ts` no reconoce `proveedor='garmin_connect'` — añadir a la query |
| 🟠 | **Capa de análisis: TDEE recalibrado** | Usar `calorias_totales` real de Garmin para ajustar macro targets del plan de dieta |
| 🟠 | **Panel resumen en tab Apps del portal** | Mostrar body battery, training readiness, pasos, sueño del día (datos ya en BD, solo UI) |
| 🟡 | **Nodos N_TDEE/N_TSS/N_HRV/N_PASOS del revisor-semanal** | Leer de `actividad_externa_cliente` para calcular ajustes automáticos |
| 🟡 | **IntegracionesPanel: mostrar Garmin Connect como "sincronizado"** | Actualmente muestra botón OAuth de Garmin Health API oficial — confuso. Cambiar a "Garmin Connect activo (sync automático)" |
| 🟡 | **Sleep tracking Garmin** | La mayoría de días sin datos de sueño — verificar si el reloj registra sueño automáticamente o necesita configuración |

### Lecciones aprendidas esta sesión

1. **Supabase inline join falla silenciosamente** cuando PostgREST no detecta la FK automáticamente → siempre hacer queries separadas para tablas no directamente relacionadas
2. **`clientes` NO tiene `codigo_publico` ni `codigo_portal`** — el código público siempre está en `planes_nutricion.codigo_publico`
3. **Strava sandbox = límite 1 atleta** — si ya hay uno conectado con token manual, hay que revocar en strava.com/settings/apps antes de reconectar
4. **`garmin-connect` npm usa URL absoluta en `gc.get()`** — pasar `https://connectapi.garmin.com/...` completo
5. **Garmin daily summary tiene body battery integrado** — no hace falta endpoint separado de body battery (devuelve 404), todo está en `usersummary-service/usersummary/daily/{displayName}?calendarDate={date}`
6. **Training readiness devuelve array** (múltiples lecturas del día) — coger `[0]` = más reciente
7. **HRV direct endpoint devuelve `""`** — el HRV diario no está disponible; usar `hrvWeeklyAverage` de training readiness (dividir por 10 para obtener ms)
8. **Analizar ANTES de codificar** — esta sesión hubo 7 iteraciones antes de encontrar la causa raíz del bug del tab Apps. La próxima: testear el endpoint directamente con curl/node primero, trazar el flujo completo antes de tocar código

### Commits sesión 38
- `e8d8713` — fix: service worker network-first para navegaciones
- `fe12eda` — fix: dashboard cliente query profiles separada + null guard
- `d2b4327` — fix: strava callback redirige a /cliente/[codigo] correcto
- `083fa1c` — fix: portal auto-abre tab Apps tras OAuth
- `57cc2c8` — feat: Garmin Connect sync completo (wellness 60d) + columnas BD

---

## ✅ SESIÓN 24-05-2026 (Sesión 37) — Integraciones dispositivos fitness (Strava, Garmin, Google Fit, Whoop)

### Qué se construyó

Arquitectura completa de integraciones con apps y wearables. Todos los providers escriben en una tabla normalizada `actividad_externa_cliente` que los agentes IA leen directamente — nunca llaman a APIs externas.

**Archivos creados/modificados (29 ficheros, +3.321 líneas):**

| Archivo | Rol |
|---------|-----|
| `supabase/migrations/20260524_integraciones_dispositivos.sql` | Tablas BD + RLS (⚠️ aplicar manualmente) |
| `lib/integraciones/types.ts` | Tipos: Proveedor, IntegracionCliente, ActividadExterna, ResumenActividadSemanal, ProveedorIntegracion |
| `lib/integraciones/normalizer.ts` | `persistirActividades()` + `getSummaryLast7d()` |
| `lib/integraciones/strava.ts` | Conector Strava: OAuth2, refresh, sync 14d, webhook push, TSS = suffer_score × 0.4 |
| `lib/integraciones/garmin.ts` | Conector Garmin: wellness-api dailies, steps/rhr/sleep |
| `lib/integraciones/google-fit.ts` | Conector Google Fit: 3 data streams, timestamps nanosegundos |
| `lib/integraciones/whoop.ts` | Skeleton Whoop (pendiente partner approval) |
| `lib/integraciones/sync.ts` | `sincronizarTodosProveedores()` — excluye strava/manual (push) |
| `app/api/integraciones/strava/{connect,callback,disconnect}/route.ts` | OAuth Strava |
| `app/api/integraciones/strava-webhook/route.ts` | GET hub.challenge + POST push |
| `app/api/integraciones/garmin/{connect,callback,disconnect}/route.ts` | OAuth Garmin |
| `app/api/integraciones/google-fit/{connect,callback,disconnect}/route.ts` | OAuth Google Fit |
| `app/api/cron/sync-integraciones/route.ts` | Cron horario CRON_SECRET-protected |
| `app/api/cliente/[codigo]/integraciones/route.ts` | Estado integraciones para portal |
| `components/PortalCliente/IntegracionesPanel.tsx` | UI 4 providers + Whoop "Próximamente" |
| `components/PortalCliente/DashboardCliente.tsx` | Tab "Apps" (Smartphone icon) añadido |
| `components/PortalCliente/CheckInForm.tsx` | Sección manual pasos/kcal/HRV (colapsable) |
| `app/api/cliente/[codigo]/checkin/route.ts` | Persiste datos manuales en actividad_externa_cliente |
| `lib/agentes/types.ts` | `actividad_semanal: ResumenActividadSemanal | null` en ContextoCliente |
| `lib/agentes/executor.ts` | `getSummaryLast7d()` cargado en `cargarContextoCliente()` |
| `lib/agentes/revisor-semanal.ts` | 4 nuevos nodos árbol: N_TDEE, N_TSS, N_HRV, N_PASOS |
| `vercel.json` | Cron `sync-integraciones` cada hora añadido |

### Arquitectura

```
Strava (webhook push) ──→┐
Garmin (polling horario) ─┼→ actividad_externa_cliente (tabla normalizada)
Google Fit (polling)  ──→┤      ↓
Manual (check-in form)──→┘  getSummaryLast7d()
                                ↓
                     ContextoCliente.actividad_semanal
                                ↓
                     revisor-semanal árbol 4 nodos nuevos:
                     N_TDEE / N_TSS / N_HRV / N_PASOS
```

### Coste estimado
- Strava webhook: 0 (push, no polling)
- Garmin + Google Fit: sync horario = ~24 llamadas/día/cliente (batch de todos los activos)
- Whoop: pendiente activar

### ⚠️ PENDIENTE MANUAL — Antes del primer uso

**1. Aplicar SQL en Supabase** → Dashboard → SQL Editor → ejecutar:
`supabase/migrations/20260524_integraciones_dispositivos.sql`

**2. Variables de entorno en Vercel** (Production):
```
STRAVA_CLIENT_ID
STRAVA_CLIENT_SECRET
STRAVA_WEBHOOK_VERIFY_TOKEN    ← string secreto que tú eliges
GARMIN_CLIENT_ID
GARMIN_CLIENT_SECRET
GOOGLE_FIT_CLIENT_ID
GOOGLE_FIT_CLIENT_SECRET
```

**3. Registrar webhook Strava** (una vez, tras deploy con vars):
```bash
curl -X POST https://www.strava.com/api/v3/push_subscriptions \
  -d "client_id=$STRAVA_CLIENT_ID&client_secret=$STRAVA_CLIENT_SECRET&callback_url=https://nutricoach-delta.vercel.app/api/integraciones/strava-webhook&verify_token=$STRAVA_WEBHOOK_VERIFY_TOKEN"
```

**4. Configurar OAuth redirect URIs** en cada consola de developer:
- Strava: `https://nutricoach-delta.vercel.app/api/integraciones/strava/callback`
- Garmin: `https://nutricoach-delta.vercel.app/api/integraciones/garmin/callback`
- Google Fit: `https://nutricoach-delta.vercel.app/api/integraciones/google-fit/callback`

### Commit
`b356ea0` — feat: integraciones dispositivos

---

## ✅ SESIÓN 24-05-2026 (Sesión 36) — Sistema Multi-Agente IA Completo

### Qué se construyó

Sistema de 8 agentes IA autónomos que monitorizan todos los clientes a diario y proponen acciones al coach mediante un kanban de aprobación.

**Archivos creados/modificados:**

| Archivo | Rol |
|---------|-----|
| `lib/agentes/types.ts` | Tipos TypeScript compartidos del sistema |
| `lib/agentes/executor.ts` | Routing inteligente de modelos (Gemini/DeepSeek) |
| `lib/agentes/director.ts` | Orquestador — cron entry point |
| `lib/agentes/riesgo.ts` | Riesgo abandono nutrición (Gemini Flash, diario) |
| `lib/agentes/riesgo-entreno.ts` | Inactividad entrenamiento (Gemini Flash, diario) |
| `lib/agentes/revisor-semanal.ts` | Revisión macros/adherencia (DeepSeek V3, lunes) |
| `lib/agentes/revisor-semanal-entreno.ts` | Revisión TLS/RPE/sesiones (Gemini Flash, lunes) |
| `lib/agentes/motivacion.ts` | Mensaje motivacional semanal (Gemini Flash, lunes) |
| `lib/agentes/memoria.ts` | Aprendizaje de decisiones coach (DeepSeek V3) |
| `lib/agentes/aplicar.ts` | Motor decisiones — ejecuta acciones reales en BD |
| `app/api/agentes/ejecutar/route.ts` | Endpoint cron GET+POST con CRON_SECRET |
| `app/api/agentes/tareas/route.ts` | Kanban GET+PATCH con aplicarTarea() |
| `app/api/cliente/[codigo]/chat/leer/route.ts` | Marcar mensajes leídos (portal) |
| `app/agentes/page.tsx` | UI kanban 3 columnas + badge sidebar |
| `components/PortalCliente/MensajeCoach.tsx` | Banner mensajes coach en portal |
| `components/PortalCliente/DashboardCliente.tsx` | MensajeCoach integrado |
| `components/Sidebar.tsx` | Link /agentes + badge pendientes con polling |
| `vercel.json` | Crons: diario 7am + semanal lunes 6am |

### Coste estimado a 100 clientes: ~$1.50/mes

### Commits: `e0f8b20`, `09a6151`

---

## 0. Spec-Kit + Superpowers — Flujo de desarrollo estructurado (instalado 23-05-2026)

### Qué es

[spec-kit](https://github.com/github/spec-kit) es un toolkit de Spec-Driven Development (SDD) de GitHub. Obliga a escribir especificaciones, planes y tareas ANTES de tocar código. Instalado con integración Claude Code nativa.

[superspec](https://github.com/WangX0111/superspec) es el bridge que conecta spec-kit con las skills de obra/superpowers (brainstorming, TDD, code-review), instalado como skill local en `.claude/skills/superspec/`.

### Versiones instaladas

| Herramienta | Versión | Método |
|-------------|---------|--------|
| `specify-cli` | v0.8.13 | `uv tool install` (global) |
| `superspec` bridge | v1.0.0 | Skill local en `.claude/skills/superspec/` |

### Estructura creada

```
.specify/
├── memory/
│   └── constitution.md        ← Principios del proyecto (LEER PRIMERO)
├── templates/                 ← Templates de spec/plan/tasks
├── extensions/                ← git extension activa
└── workflows/speckit/         ← Workflow automático

specs/                         ← Una carpeta por feature
└── [nombre-feature]/
    ├── spec.md                ← Qué se construye y por qué
    ├── plan.md                ← Cómo se construye técnicamente
    └── tasks.md               ← Tareas concretas con criterios de aceptación
```

### Skills disponibles en Claude Code

| Skill | Invocación | Cuándo usar |
|-------|-----------|-------------|
| `speckit-constitution` | `/speckit-constitution` | Revisar o actualizar principios del proyecto |
| `speckit-specify` | `/speckit-specify` | Definir requisitos de una feature nueva |
| `speckit-clarify` | `/speckit-clarify` | Clarificar antes de planificar (opcional) |
| `speckit-plan` | `/speckit-plan` | Crear plan técnico desde una spec |
| `speckit-checklist` | `/speckit-checklist` | Validar completitud de una spec/plan |
| `speckit-tasks` | `/speckit-tasks` | Generar tareas accionables desde el plan |
| `speckit-analyze` | `/speckit-analyze` | Consistencia cross-artifact (spec+plan+tasks) |
| `speckit-implement` | `/speckit-implement` | Ejecutar implementación siguiendo tasks |
| `superspec` | `/superspec` | Bridge completo SDD + superpowers (brainstorm+TDD+review) |

### Flujo estándar para features nuevas

```
1. /speckit-clarify  → preguntas para desambiguar (opcional)
2. /speckit-specify  → spec.md con requisitos
3. /speckit-plan     → plan.md con diseño técnico
4. /speckit-checklist → validar calidad de la spec
5. /speckit-tasks    → tasks.md con criterios de aceptación
6. /speckit-analyze  → verificar consistencia entre artefactos
7. /speckit-implement → implementar siguiendo tasks
```

O usando el bridge completo: `/superspec` gestiona todo el ciclo con superpowers integrado.

### Comando CLI

```bash
# Ver estado de extensiones y configuración
specify extension list

# Crear spec para una nueva feature (desde el directorio nutricoach)
specify workflow run speckit

# Verificar prerrequisitos
specify check
```

### Constitution

Los principios del proyecto están en [`.specify/memory/constitution.md`](.specify/memory/constitution.md). **Leer antes de cualquier feature nueva.**

Principios clave:
- Evidencia científica obligatoria en planes IA
- Coach aprueba todo antes de llegar al cliente
- Build verde antes de merge
- Mobile-first siempre
- Quality gates documentados en la constitution

---

## 1. Regeneración de Imágenes de Recetas

### Modelo único: `gpt-image-1` (OpenAI)

- Usar exclusivamente el modelo `gpt-image-1` de OpenAI para generar imágenes de recetas.

### Clasificación de imágenes en BD (18-05-2026)

Tras regenerar 150 imágenes, se añadió columna `imagen_tipo` a la tabla `recetas`:
- valores posibles: `'propia' | 'txt2img' | 'placeholder'`
- `'propia'`: imagen real del plato (subida por coach)
- `'txt2img'`: generada por IA
- `'placeholder'`: sin imagen (icono por defecto)

### Scripts de imagen disponibles

| Script | Uso |
|--------|-----|
| [`scripts/subir-imagen-manual.mjs`](scripts/subir-imagen-manual.mjs) | Una receta concreta |
| [`scripts/regenerar-flux-masivo.mjs`](scripts/regenerar-flux-masivo.mjs) | Regenerar N recetas por IDs |
| [`scripts/piloto-regeneracion-imagenes.mjs`](scripts/piloto-regeneracion-imagenes.mjs) | Prueba 6 imágenes |
| [`scripts/capturar-y-refinar-18.mjs`](scripts/capturar-y-refinar-18.mjs) | Capturar+refinar iterativo |
| [`scripts/subir-imagenes-aprobadas.mjs`](scripts/subir-imagenes-aprobadas.mjs) | Subir imágenes locales |

## 2. Regenerar las 147 imágenes malas con estilo food blogger:

Las imágenes muestran **comida real**, preparada, en plato, con luz natural tipo food blogger. NO queremos ilustraciones, dibujos, ni collages.

### Prompt estándar txt2img
```
Real food photography of [PLATO], served on a ceramic plate, natural window lighting, shallow depth of field, wooden table surface, fresh ingredients visible, appetizing, food blogger style, 4K, shot on Sony A7 III.
```
*Prompt guardado en `scripts/regenerar-flux-masivo.mjs`*

### Lo que NO hacer nunca
1. **NO** regenerar imágenes de recetas sin antes consultar qué enfoque usar (`gpt-image-1`, flux, etc.)
2. **NO** subir imágenes desde URLs de internet sin verificar derechos
3. **NO** usar placeholders genéricos
4. **NO** tocar `imagen_tipo` al actualizar URL de imagen — la clasificación es manual del coach

## 3. Diagnóstico de Coincidencias de Imágenes

### Cómo funciona la visualización (crítico para diagnosticar)
Cuando un cliente ve una receta en el plan de nutrición, la app muestra la imagen asociada a esa receta en la BD (`recetas.imagen_url`). Si la imagen no coincide con el plato, el problema está en el matching.

### Cómo diagnosticar un match incorrecto
1. Abrir la receta en `/recetas/[id]` y ver qué imagen tiene
2. Consultar `scripts/diagnostico-completo-recetas.ts` para ver el estado global
3. Si hay 0 resultados pero sabes que hay recetas, filtrar por `imagen_tipo` en la BD

### Cómo corregir un match incorrecto en BD
```sql
UPDATE recetas SET imagen_url = 'nueva_url', imagen_tipo = 'txt2img' WHERE id = 'uuid';
```

### Cómo prevenir que vuelva a pasar
- `imagen_tipo` permite filtrar: `WHERE imagen_tipo IS NULL OR imagen_tipo = 'placeholder'`
- Las regeneraciones deben actualizar `imagen_tipo` a `'txt2img'`
- Si el coach sube una foto real, poner `imagen_tipo = 'propia'`

### 🛡️ GUARD — Productos No Comestibles (22-05-2026)
**Archivo único**: [`lib/scraping/guard-no-comestible.ts`](lib/scraping/guard-no-comestible.ts)

Este es el **ÚNICO PUNTO DE VERDAD** para detectar productos no comestibles. TODOS los entry points importan `esProductoNoComestible()` desde aquí.

**Entry points que importan del guard**:
| Entry point | Archivo |
|---|---|
| Pipeline scraping | [`lib/scraping/index.ts`](lib/scraping/index.ts) → `esNoComestible()` delega |
| Normalizador | [`lib/scraping/normalizador.ts`](lib/scraping/normalizador.ts) → `crearAlimentoSiNoExiste()` |
| API alimentos | [`app/api/alimentos/route.ts`](app/api/alimentos/route.ts) → POST inline regex reemplazado |
| Matcher recetas | [`app/api/scrape-receta/route.ts`](app/api/scrape-receta/route.ts) → `puntuarCandidato()` |

**Cobertura**: mascotas, higiene, dental, capilar, jabón/gel, desodorante, cremas, facial, labial, maquillaje, uñas, brochas, Deliplus, solar, depilación, limpieza hogar, menaje, bebés, alcohol, bebidas energéticas, electrodomésticos (vatios).

**Excepciones documentadas**: miel+dosificador, chorizo+vela, jabón+glicerina, freidora+aire, microondas, alcohol en platos (al vino, estofado, vinagre, etc.).

**Reglas**:
- NO duplicar listas en otros archivos — siempre importar del guard
- Para añadir un patrón nuevo, edit SOLO `guard-no-comestible.ts`
- Para verificar cobertura, ejecutar: `tsx scripts/limpiar-cosmeticos-bd.ts --dry-run`

### MATCH_FIXES vigentes (15-05-2026)
Los fixes aplicados en [`lib/foods-data.ts`](lib/foods-data.ts) para corregir matches incorrectos entre ingredientes de recetas y alimentos de la BD.

### Regla del algoritmo matchIngrediente (healthify/route.ts)
El algoritmo busca en este orden:
1. `nombre_original` exacto (case-insensitive)
2. `nombre` exacto (case-insensitive)
3. `nombre` contiene el ingrediente
4. fallback: fuzzy match con `trigram` de pg_trgm

## 4. Configuración del Proyecto

### Instalación
```bash
npm install
cp .env.example .env.local  # configurar claves
```

### Comandos útiles
- `npm run dev` — servidor de desarrollo
- `npm run build` — build de producción
- `npx next build` — build con diagnóstico
- `npx tsx scripts/[script]` — ejecutar scripts TypeScript
- `node scripts/[script]` — ejecutar scripts JS

### Limitaciones detectadas
- Playwright solo funciona en macOS/Linux
- DeepSeek puede rate-limit si se exceden requests concurrentes
- NCBI E-utilities: 10 req/s sin API key

## 5. Scraping de Recetas

#### [`nutricoach/app/api/scrape-receta/route.ts`](nutricoach/app/api/scrape-receta/route.ts)
- Endpoint para scrapear recetas desde URLs
- Usa `cheerio` para parsear HTML
- Extrae ingredientes, instrucciones, tiempo de cocción

## 6. Build

- `npx next build` / `npm run build`
- Build verificado sin errores (sesiones recientes)
- Next.js 16.2.4

## 7. Archivos copiados de feature/ui-estetica (worktree)

### Archivos copiados de nutricoach-ui (feature/ui-estetica)
- `DESIGN.md`
- `PLAN_ESTETICO.md`

### Archivos copiados de nutricoach-modulos (feature/modulos)
- `lib/periodizacion/` (todo)
- `lib/auto-coach.ts`
- `lib/nutricion-peri-entreno.ts`
- `lib/validacion-micronutrientes.ts`
- `components/dashboard/AutoCoachPanel.tsx`
- `components/dashboard/KBPanel.tsx`

### Scripts verificados (sin cambios necesarios)
- `lib/knowledge-base.ts`
- `lib/knowledge.ts`
- `scripts/backfill-planes-evidencia.ts`
- `scripts/analizar-uso-papers.ts`
- `scripts/diagnosticar-tags-kb.ts`
- `scripts/test-tag-bridge.ts`
- `scripts/test-e2e-bridge.ts`

### Archivos idénticos verificados (sin cambios)
No hay conflictos entre worktrees.

### Build de verificación
- Build ejecutado y verificado sin errores
- 107 páginas, 0 errores

### Notas importantes
- Los scripts de backfill y auto-entrenamiento están verificados
- La KB tiene 230 papers
- TAG_BRIDGE tiene ~95 entradas, ~500 bridge values

## 8. Comandos y Scripts Importantes

- `npx tsx scripts/ingestar-papers.ts` — Ingesta papers PubMed (14 fuentes)
- `npx tsx scripts/backfill-planes-evidencia.ts` — Backfill evidencia a planes activos
- `npx tsx scripts/analizar-uso-papers.ts` — Auto-entrenamiento (analizar uso papers)
- `npx tsx scripts/test-tag-bridge.ts` — Test cobertura TAG_BRIDGE por cliente
- `npx tsx scripts/diagnosticar-tags-kb.ts` — Diagnóstico tags en knowledge_base
- `node scripts/ejecutar-scraping.mjs` — Scraping supermercados (--mercadona, --consum, --all, etc.)

## 9. Dashboard

### Dashboard NutriCoach — Rediseño completo ✅
- Dashboard en `app/dashboard/page.tsx` — 638 líneas
- Componentes: `KBPanel`, `AutoCoachPanel`, `CheckinsPendientes`
- Analytics con gráficos: barras, stacked bars, donuts
- Acciones rápidas, estado, revisiones, competiciones

## 10. Scraping Supermercados

### Lidl scraper v4 — Híbrido Playwright + gridboxes API ✅
- Playwright obtiene ERP numbers desde la web de folletos
- Gridboxes API devuelve precios + categorías reales
- 74 productos actualizados

### Archivos clave v4
- [`lib/scraping/supermercados/lidl.ts`](lib/scraping/supermercados/lidl.ts) — Scraper híbrido
- [`lib/scraping/motores/motor-playwright.ts`](lib/scraping/motores/motor-playwright.ts) — Motor Playwright
- [`lib/scraping/helpers-scraping.mjs`](lib/scraping/helpers-scraping.mjs) — Helpers

### API gridboxes — Notas para futura referencia
- Endpoint: `https://www.lidl.es/api/v1/grid-boxes/...`
- Rate limit: ~2 req/s
- Cache: 24h

## 11. Estado de Scrapers

### Estado actual de productos por supermercado (21-05-2026)
| Supermercado | Productos | Método | Estado |
|---|---|---|---|
| Consum | 4,765 | API HTTP | ✅ (re-scrapeando) |
| Mercadona | 2,895 | API HTTP | ✅ Re-scrapeado |
| Alcampo | 38 | API Ocado | ✅ Re-scrapeado |
| Carrefour | 20 | Playwright homepage | ✅ (0 nuevos) |
| Bonpreu | 21 | Híbrido | ✅ |
| Esclat | 21 | Híbrido | ✅ |
| Eroski | 11 | Playwright | ✅ Re-scrapeado |
| Lidl | 74 | Híbrido v4 | ✅ |
| Día | ~130 | API HTTP (SSR) | ✅ |
| Hipercor | ~308 | Puppeteer | ✅ |
| El Corte Inglés | ~308 | Puppeteer (vía Hipercor) | ✅ |
| Aldi | 0 | — | ❌ |
| **Total** | **~8,672** | | |

### Pendiente para próxima sesión
1. **Día**: Investigar si hay API subyacente tras el WAF de Cloudflare
2. **Carrefour**: Investigar por qué devuelve 0 comestibles
3. **Aldi**: Nuevo scraper
4. **Consum**: Verificar que terminó el re-scrapeo

## 12. Estado KB y TAG_BRIDGE

### KB actual: 230 papers
- 14 fuentes PubMed activas (8 originales + 6 clínicas)
- TAG_BRIDGE: ~95 entradas, ~500 bridge values
- Cobertura funcional: +300-1650% por cliente (test-tag-bridge)

### Dashboard KB
- [`components/dashboard/KBPanel.tsx`](components/dashboard/KBPanel.tsx) — Panel en dashboard principal
- Muestra stats, últimas fichas, disciplinas, puentes por categoría

## 13. Sesiones de Trabajo

### ✅ SESIÓN 21-05-2026 (5ª ronda) — PORTAL CLIENTE COMPLETO: CIENCIA + ALTERNATIVAS + SEMANA 🚀

**Arquitectura ciencia-first + feedback loop cerrado**

| Fix | Archivo | Detalle |
|-----|---------|---------|
| IDs receta falsos DeepSeek | `generar-plan-inicial` | `recetasPorNombre` index + `resolverReceta()` fallback por nombre |
| Filtro estado recetas | `generar-plan-inicial` | `.eq('estado', 'aprobada').gt('kcal', 0)` + límite 8/categoría |
| Evidencia no guardada | `generar-plan-inicial` | Guardada server-side en `evidencia_cientifica` |
| `from('dietas')` inexistente | `checkin/route.ts` | Cambiado a `planes_nutricion` + columna `carbohidratos_objetivo` |
| Feedback loop check-in | `checkin/route.ts` | Periodización → `aplicarAjusteAlPlan()` → actualiza plan real |
| Aprobación coach | `periodizacion/refeed/aprobar` | Importa `aplicarAjusteAlPlan()` compartida |

**Alternativas accionables por comida**
- `GET /api/recetas/sugeridas`: filtro `tipo_plato` + fallback + límite 7 + distancia euclidiana
- `GET /api/recetas/[id]/ingredientes`: nuevo endpoint — retorna ingredientes como `AlimentoEnComida[]`
- `MiPlan.tsx`: "Ver alternativas" → 4 recetas filtradas por tipo comida → botón "Usar" → swap real de alimentos en `planLocal`

**Vista semanal Lun-Dom**
- `PlanSemanal.tsx` (nuevo): pool de 7 recetas por franja, rotación circular por día, botón ↻ por slot
- Toggle "Hoy / Semana" en MiPlan

**Bugs corregidos (auditoría)**

| # | Gravedad | Bug | Fix |
|---|----------|-----|-----|
| 1 | 🔴 CRÍTICO | `sugeridas`: `NOT IN ()` SQL inválido con pool vacío | Guard `pool.length > 0` |
| 2 | 🔴 CRÍTICO | `PlanSemanal`: `useEffect` se re-disparaba al cada swap | `useMemo(plan.comidas)` — ref estable |
| 3 | 🟠 MENOR | `sugeridas`: límite 6 impide 7 recetas distintas/semana | Límite subido a 7 |
| 4 | 🟡 MENOR | `knowledge-base.ts`: clave `sop` duplicada → TS1117 | Merge + eliminado duplicado |

**Commits**: `8a36671` (generar-plan-inicial ciencia-first) · `bb969ee` (checkin + periodización) · `e9bb370` (alternativas comida) · `62955ba` (vista semanal) · `c41a9c1` (bug fixes)

---

### ✅ SESIÓN 21-05-2026 (4ª ronda) — PENDIENTES EJECUTADOS COMPLETOS 🚀

**Ejecución completa de pendientes**:

| Tarea | Estado | Detalle |
|-------|--------|---------|
| Consum verificado | ✅ | Terminó en background (~60 min, 4.765 prod) |
| Re-backfill nuevos papers | ✅ | 11 clientes, 62 referencias |
| Auto-entrenamiento post-backfill | ✅ | 216 protocolos no usados |
| Test tag-bridge | ✅ | Laura +1700%, Sofía +900% 🚀 |
| Bug #5 — Carrefour fix | ✅ | Migrado a scraper modular [`carrefour.ts`](lib/scraping/supermercados/carrefour.ts) |
| `npx next build` | ✅ | Sin errores |
| Día investigado | ✅ | Ya resuelto vía SSR HTTP directo |

**Bug #5 — FIXED**:
- **Causa**: El scraper inline legacy usaba URLs antiguas (`/supermercado/c/alimentacion`) y navegaba cat-por-cat activando Cloudflare.
- **Fix**: Reemplazado por wrapper que ejecuta [`carrefour.ts`](lib/scraping/supermercados/carrefour.ts) vía `npx tsx`. El scraper modular extrae ~444 productos directamente del homepage con selectores actualizados (`.product-card__parent`, `catalog="food"`).

---

### ✅ SESIÓN 22-05-2026 (noche) — Sistema de tags del recetario completo 🏷️

**Objetivo**: tags automáticos por ingredientes, filtros por tipo en todas las vistas, editor manual.

| Tarea | Commits | Detalle |
|-------|---------|---------|
| Ocultar chips #tag de RecipeCardPremium | `0c79a7d` | Limpio, solo categoría pill |
| Rediseño filtros `/recetas` | `0c79a7d` | 2 filas fijas + popover avanzado, chips lima #A3E635 |
| Sub-categorías contextuales por tipo de plato | `0c79a7d` | SUBCATEGORIAS en recetas-constants.ts |
| `lib/auto-tag.ts` + `KNOWN_TAGS` | `83e1df0` | autoTagReceta() + vocabulario exportado |
| Script batch auto-etiquetado | `83e1df0` | 254/254 recetas actualizadas, 33 sin tags (legítimos) |
| Hook auto-tag en scrape-receta (nuevas) | `83e1df0` | Recetas nuevas se etiquetan al insertar |
| Tags: Donut, Yogur, Salsa añadidos | `850ff49` | 57→33 recetas sin tags |
| Sub-cats multi-categoría + filtro cross-cat | `6c532a6` | Donut en Postre+Merienda+Snack; tagFilter ignora categoría principal |
| Editor chips en `/recetas/[id]/editar` | `6c532a6` | Chips toggle vocabulario + TagInput custom |
| Autocomplete buscador `/recetas` | `635afd1` | Dropdown tags al escribir ≥2 chars, click activa filtro |
| Autocomplete buscador dietas | `6e1284f` | Chips tipo en buscador recetas del constructor |
| Fix: tag+texto combinables en dietas | `43e9cf4` | ilike + contains simultáneos, panel visible con tagReceta solo |

**Arquitectura tags**:
- `lib/auto-tag.ts` — fuente única de verdad: NAME_TAGS (por nombre de plato) + INGREDIENT_TAGS (por ingrediente). Exporta `autoTagReceta()` y `KNOWN_TAGS[]`.
- Script: `npx tsx scripts/auto-etiquetar-recetas.ts [--dry-run] [--todas]` — re-ejecutar si se añaden keywords
- Tags en BD: `recetas.tags: string[]` — array de strings capitalizados (Pollo, Arroz, Donut…)

**Comportamiento filtros**:
- Seleccionar categoría (Comida) → filtra por `r.categoria === 'Comida'`
- Seleccionar categoría + sub-tag (Merienda → Donut) → ignora categoría, muestra todos los Donuts
- Esto permite que un Donut categorizado como Postre aparezca en Merienda→Donut ✅

**Bugs corregidos esta sesión**:
| # | Bug | Fix |
|---|-----|-----|
| 1 | Placeholder "Filtrar dentro de X" pero onChange limpiaba el tag | Eliminado `setTagReceta(null)` del onChange |
| 2 | Panel resultados no aparecía con tagReceta activo + queryReceta vacío | Añadido `|| !!tagReceta` a la condición del panel |
| 3 | tag y texto no se podían combinar | useEffect unificado: aplica ambos filtros simultáneamente |

---

### ✅ SESIÓN 23-05-2026 (tarde) — Recetario Capa 1 + Portal S1 + Batch Audit

**Recetario Capa 1 — completado** (commits `e45a6ff`, `74008d7`, `54d3120`, `a18a971`):
- SQL: `comidas.receta_id` + tabla `receta_interacciones_cliente` aplicado en Supabase
- `lib/plan-recetas.ts` v2: `filtrarRecetasPorSlot` con score compuesto (calidad×0.40 + apta×0.35 + macro×0.25)
- `generar-plan-inicial`: guarda `receta_id` en comidas + fire-and-forget tracking en `receta_interacciones_cliente`
- `scripts/batch-audit-profesional.ts`: audita recetas con `score_calidad` null, con contador `[N/total]` por ítem

**Batch audit ejecutado**: 62/62 recetas auditadas — **score medio 95.1/100**, min 76, max 100, 0 errores.

**Portal cliente S1 — Pantalla bienvenida** (`da711b2`):
- `DashboardCliente.tsx`: tarjeta de bienvenida en primer acceso detectada por `localStorage`
- Lista de 3 features con iconos + botón "Empezar →" que cierra y no vuelve a aparecer

**SQL aplicado en Supabase (listo para DeepSeek S2-S5)**:
- `checkins`: +5 columnas de medidas corporales (cintura, cadera, pecho, brazo, muslo)
- `registro_comidas_dia`: nueva tabla para S3
- `chat_mensajes`: nueva tabla para S5

**Briefs DeepSeek actualizados**: S2/S3/S5 tienen nota "⚠️ YA APLICADO" en Paso 1 SQL.

**Emails** (`cbd0d8f`): asuntos personalizados (plan-listo + welcome con nombre del cliente).

---

## 🔀 Historial de Worktrees — Ya unificados en main

Todos los worktrees han sido mergeados y unificados en `main`. No hay worktrees activos.

### Comandos para futura referencia:
```bash
git worktree add -b feature/nueva-rama ../nutricoach-nueva-rama main
cd ../nutricoach-nueva-rama && code .
```

## ⚡ End Session — Cierre de jornada

```bash
# Commit en main (siempre):
git add -A && git commit -m "Sesion [FECHA]: [RESUMEN]" && git push
```

## 🧠 LECCIONES APRENDIDAS — Aciertos y Errores

### ✅ ACIERTOS
1. **Diagnóstico completo antes de tocar nada**: Ejecutar scripts de diagnóstico primero da visibilidad del estado real antes de decidir qué priorizar.
2. **Estimación de macros por reglas locales**: En vez de llamar a una IA para cada alimento (costoso y lento), crear reglas con datos reales de BEDCA. Rápido, gratuito.
3. **`--dry-run` en scripts de modificación masiva**: Los scripts nuevos incluían modo dry-run para ver qué se iba a cambiar antes de aplicar.
4. **Dos pases para metadatos**: Primero inferencia por reglas, luego segundo pase manual para remanentes.

### ❌ ERRORES
1. **Ejecutar pipeline sin preguntar**: Preguntar siempre antes de consumir APIs externas.
2. **`URL` como nombre de variable**: Sombrea constructor global. Usar `SB`, `API_URL`.
3. **Typos en variables**: `grasa` vs `grasas`. Usar `node --check` antes de ejecutar.
4. **No verificar 416 en paginación**: Manejar 416 en toda paginación con Supabase REST API.
5. **Asumir que ingredientes de recetas tienen `alimento_id` vinculado**: El primer intento de fix usó `/api/recetas/[id]/ingredientes` para obtener ingredientes con `alimento_id`, pero muchas recetas en BD solo tienen `nombre_libre` (sin vínculo a la tabla `alimentos`). El filtro `ing.alimento_id && ing.cantidad_gramos > 0` resultaba en array vacío y no se guardaba nada.
6. **No revisar sistemas/planes existentes antes de crear soluciones**: En la sesión de bugs del recetario, se asumió que no había infraestructura de precios y que "Dátiles medjool" no tendría cómo asignarle precio. Pero el sistema `mejores_precios_por_alimento` + `Precio referencia coach` + [`AdminPrecios.tsx`](components/AdminPrecios.tsx) ya existía completamente operativo. Se perdió tiempo diseñando soluciones desde cero que ya existían.

### ⚡ REGLAS PARA PRÓXIMAS SESIONES
1. Preguntar siempre antes de consumir APIs externas.
2. Probar scripts con `node --check` primero.
3. Usar `--limit N` pequeño primero.
4. NUNCA usar `URL` como nombre de variable.
5. Manejar 416 en toda paginación.
6. Siempre tener plan B.
7. Documentar en CALIENTE.
8. **Antes de crear código nuevo, revisar sistemas existentes**: Leer `CLAUDE.md`, `ESTADO_Y_PROXIMOS_PASOS.md`, `DIAGNOSTICO_FALLOS.md`, schemas SQL, vistas Supabase, y componentes UI relacionados antes de diseñar cualquier solución.
9. Verificar existencia de vistas/funciones/tablas relacionadas en Supabase antes de diseñar soluciones desde cero.
10. Consultar [`supabase_productos_vs_alimentos.sql`](supabase_productos_vs_alimentos.sql) y otros SQL de schema para conocer la arquitectura real de datos.
11. Usar `--dry-run` siempre antes de `--apply` en scripts de modificación masiva.

---

### ✅ SESIÓN 22-05-2026 — FIX: Recetas DeepSeek no se persistían en plan de dieta 🔴

**Bug crítico**: Las recetas que DeepSeek seleccionaba en `distribucion_comidas[].recetas` no se guardaban en la BD. [`crearPlan()`](app/clientes/[id]/revisar-plan/page.tsx:324) usaba `recetasPorComida[index]` (recetas sugeridas al azar por rango de kcal) en vez de las recetas reales de DeepSeek.

**Causa raíz**: La interfaz [`PlanInicial`](app/clientes/[id]/revisar-plan/page.tsx:32-44) no definía el campo `recetas` en `distribucion_comidas`, aunque [`generar-plan-inicial/route.ts`](app/api/generar-plan-inicial/route.ts:463-490) sí lo incluía en el JSON persistido.

**Fix (2 cambios)** en [`app/clientes/[id]/revisar-plan/page.tsx`](app/clientes/[id]/revisar-plan/page.tsx):

| # | Cambio | Líneas | Detalle |
|---|--------|--------|---------|
| 1 | Interfaz `PlanInicial` | 35-40 | Añadido `recetas?: { receta_id; receta_nombre; cantidad_porciones }[]` |
| 2a | Detectar plan existente | 340-355 | `crearPlan()` consulta `planes_nutricion` activo primero. Si existe (persistido por server route), redirige sin duplicar |
| 2b | Usar recetas DeepSeek | 397-490 | Persiste `plan.distribucion_comidas[].recetas`. Fallback a `recetasPorComida` solo si DeepSeek no asignó ninguna |

**Flujo corregido**:
1. `generar-plan-inicial/route.ts:648-800` ya persiste plan + comidas + alimentos en BD con recetas reales de DeepSeek
2. El frontend carga `registros_ia.respuesta_json` que contiene `distribucion_comidas[].recetas`
3. Al hacer clic "Crear plan de dieta", `crearPlan()` detecta el plan existente → `setDietaCreada({ id })` → UI muestra "Ver dieta →"
4. El coach ve las recetas que DeepSeek asignó a cada comida

**Archivo modificado**: solo [`app/clientes/[id]/revisar-plan/page.tsx`](app/clientes/[id]/revisar-plan/page.tsx) (+62 líneas efectivas)

**Auditoría de bugs (22-05-2026)**:

| # | Gravedad | Bug | Archivo | Estado |
|---|----------|-----|---------|--------|
| 1 | 🔴 CRÍTICO | `crearPlan()` usaba `recetasPorComida[idx]` (aleatorias por kcal) en vez de `distribucion_comidas[].recetas` (DeepSeek). Las recetas seleccionadas por IA nunca llegaban a la BD | [`revisar-plan/page.tsx:400-490`](app/clientes/[id]/revisar-plan/page.tsx:400-490) | ✅ FIXED |
| 2 | 🟡 MEDIO | `revisar-rapido/page.tsx` interfaz `PlanInicial` sin campo `recetas`. La UI muestra `recetasPorComida` (aleatorias) en vez de las recetas de DeepSeek | [`revisar-rapido/page.tsx:15-28`](app/clientes/[id]/revisar-rapido/page.tsx:15-28) + línea 325 | ❌ PENDIENTE |
| 3 | 🟡 MEDIO | `revisar-plan/page.tsx` UI preview muestra `recetasPorComida[idx]` (aleatorias) en vez de `comida.recetas` de DeepSeek en la card de distribución | [`revisar-plan/page.tsx:839`](app/clientes/[id]/revisar-plan/page.tsx:839) | ❌ PENDIENTE |

**Auditoría de bugs (22-05-2026) — TODOS CORREGIDOS ✅**:

| # | Gravedad | Bug | Archivo | Estado |
|---|----------|-----|---------|--------|
| 1 | 🔴 CRÍTICO | `crearPlan()` usaba `recetasPorComida[idx]` (aleatorias por kcal) en vez de `distribucion_comidas[].recetas` (DeepSeek). Las recetas seleccionadas por IA nunca llegaban a la BD | [`revisar-plan/page.tsx:400-490`](app/clientes/[id]/revisar-plan/page.tsx:400-490) | ✅ FIXED |
| 2 | 🟡 MEDIO | `revisar-rapido/page.tsx` interfaz `PlanInicial` sin campo `recetas`. UI mostraba recetas aleatorias en vez de DeepSeek | [`revisar-rapido/page.tsx:15-28`](app/clientes/[id]/revisar-rapido/page.tsx:15-28) + línea 325 | ✅ FIXED |
| 3 | 🟡 MEDIO | `revisar-plan/page.tsx` UI preview mostraba `recetasPorComida[idx]` (aleatorias) en vez de `comida.recetas` de DeepSeek | [`revisar-plan/page.tsx:839`](app/clientes/[id]/revisar-plan/page.tsx:839) | ✅ FIXED |

**Arquitectura de la solución**: Las recetas DeepSeek fluyen desde `generar-plan-inicial/route.ts:463-490` (donde se construye `distribucion_comidas[].recetas`) hasta el frontend que las lee del `respuesta_json` persistido en `registros_ia`. El fix asegura que en todos los puntos (persistencia en BD + UI preview + creación de plan) se usen las recetas reales de DeepSeek.

**Archivos modificados** (22-05-2026):
- [`app/clientes/[id]/revisar-plan/page.tsx`](app/clientes/[id]/revisar-plan/page.tsx) — Interfaz + lógica + UI (~+90 líneas)
- [`app/clientes/[id]/revisar-rapido/page.tsx`](app/clientes/[id]/revisar-rapido/page.tsx) — Interfaz + UI (~+30 líneas)

---

### ✅ SESIÓN 22-05-2026 (tarde) — FIX: Buscadores mostraban contactos del móvil 📱

**Bug**: Al escribir en cualquier buscador de la app (recetas, dietas, entrenos, alimentos), Safari/Chrome en iOS mostraba la agenda de contactos en lugar de sugerencias de búsqueda.

**Causa raíz**: Los `<input>` de búsqueda no tenían el atributo `autoComplete="off"`. Los navegadores móviles detectan placeholders como "Buscar por nombre…" y asumen que es un campo de contacto, mostrando la agenda del teléfono.

**Fix**: Añadir `autoComplete="off"` a todos los inputs de búsqueda (6 archivos):

| Archivo | Línea | Input |
|---------|-------|-------|
| [`app/recetas/page.tsx`](app/recetas/page.tsx:335) | Buscador principal de recetas |
| [`app/entrenos/page.tsx`](app/entrenos/page.tsx:130) | Buscador de planes de entreno |
| [`app/dietas/page.tsx`](app/dietas/page.tsx:67) | Buscador de dietas |
| [`app/dietas/alimentos/page.tsx`](app/dietas/alimentos/page.tsx:425) | Buscador de alimentos (OFF) |
| [`app/recetas/nueva/page.tsx`](app/recetas/nueva/page.tsx:262) | Buscador de ingredientes al crear receta |
| [`app/recetas/[id]/editar/page.tsx`](app/recetas/[id]/editar/page.tsx:463) | Buscador de ingredientes al editar receta |

**Fix adicional**: Dropdown de sugerencias de tags en [`app/recetas/page.tsx`](app/recetas/page.tsx:338) se cortaba — añadido `minWidth: 260px` al contenedor, `min-w-0` + `truncate max-w-[180px]` al chip del tag.

**Archivos modificados** (22-05-2026 tarde):
- `app/recetas/page.tsx` — `autoComplete="off"` + fix visual dropdown tags
- `app/entrenos/page.tsx` — `autoComplete="off"`
- `app/dietas/page.tsx` — `autoComplete="off"`
- `app/dietas/alimentos/page.tsx` — `autoComplete="off"`
- `app/recetas/nueva/page.tsx` — `autoComplete="off"`
- `app/recetas/[id]/editar/page.tsx` — `autoComplete="off"`

**Lección aprendida**: Todos los `<input>` con placeholder que incluya "nombre" o "buscar" deben llevar `autoComplete="off"` para evitar que Safari/Chrome móvil los confunda con campos de contacto.

---

### ✅ SESIÓN 23-05-2026 — Auditoría Ingredientes Recetario + Fix 12 Bugs 🐛🔴

**Auditoría completa de ingredientes mal vinculados en el recetario.** Se detectaron 12 bugs en 4 recetas + 1 ingrediente huérfano.

| # | Gravedad | Receta | Ingrediente | Problema | Fix |
|---|----------|--------|-------------|----------|-----|
| 1 | 🔴 CRÍTICO | Tarta de chocolate fundente | `huevos 200g` | Vinculado a "Huevos cocidos" en vez de "Huevo entero" | Re-vinculado a [`Huevo entero`](seed_alimentos.sql) |
| 2 | 🔴 CRÍTICO | Brownie de 3 chocolates | `huevo 55g` | Vinculado a "Huevos cocidos" | Re-vinculado a `Huevo entero` |
| 3 | 🔴 CRÍTICO | Shakshuka de piquillos asados | `huevos 200g` | Vinculado a "Huevos cocidos" | Re-vinculado a `Huevo entero` |
| 4 | 🔴 CRÍTICO | Revuelto cremoso de espárragos | `huevo 150g` | Vinculado a "Huevos cocidos" | Re-vinculado a `Huevo entero` |
| 5 | 🔴 CRÍTICO | Brownie de 3 chocolates | `Chocolate negro 70%` | Vinculado a "Fresas Chocolate Blanco Chocolate Negro" | Re-vinculado a [`Chocolate negro 85%`](seed_alimentos.sql) (598 kcal, 12.50 €/kg Consum) |
| 6 | 🟠 GRAVE | Brownie de 3 chocolates | `Chocolate con leche (decorar)` | Vinculado a "Leche líquida entera" | Re-vinculado a [`Chocolate con leche Milka`](seed_alimentos.sql) (540 kcal, 2 precios supermercado) |
| 7 | 🟠 GRAVE | Brownie de 3 chocolates | `Chocolate blanco` | Vinculado a "Fresas Chocolate producto" | Re-vinculado a [`Chocolate Blanco Postres`](seed_alimentos.sql) (540 kcal, 11.25 €/kg Consum) |
| 8 | 🟠 GRAVE | Brownie de 3 chocolates | `Chocolate blanco 50g (base)` | Vinculado a "Fresas Chocolate Blanco Chocolate Negro" | Re-vinculado a `Chocolate Blanco Postres` |
| 9 | 🟡 MEDIO | Dátiles rellenos de almendra y chocolate negro | `dátil medjool 60g` | `alimento_id = null` (huérfano, sin kcal ni precio) | Vinculado a [`Dátiles medjool`](seed_alimentos.sql) (277 kcal, precio ref. 19.07 €/kg creado) |
| 10 | 🟡 MEDIO | Brownie de 3 chocolates | `harina de avena 45g` | `alimento_id = null` (huérfano) | Vinculado a [`Harina de avena`](seed_alimentos.sql) |
| 11 | 🟠 GRAVE | Dulce de Leche Saludable | `Leche semidesnatada` | Vinculado a "Leche entera" | Re-vinculado a [`Leche semidesnatada`](seed_alimentos.sql) |
| 12 | 🟠 GRAVE | Dulce de Leche Saludable | `Leche desnatada` | Vinculado a "Leche entera" | Re-vinculado a [`Leche desnatada`](seed_alimentos.sql) |

**Script**: [`scripts/fix-bugs-recetario-v2.mjs`](scripts/fix-bugs-recetario-v2.mjs) — idempotente, usa `findAlimento()` dinámico via `ilike` search en runtime, modo `--dry-run` y `--apply`.

**Ejecución**: `node scripts/fix-bugs-recetario-v2.mjs --apply` ✅ — 12/12 bugs corregidos exitosamente.

**Verificación post-fix**: Todos los ingredientes corregidos muestran kcal correctas y vinculación a precios de supermercado. Para Dátiles medjool se creó precio referencia coach a 19.07 €/kg basado en "Dátiles Medjoul con hueso" de Mercadona (3.99 €/209g).

**⚠️ Lección aprendida — Siempre revisar sistemas existentes antes de crear soluciones desde cero**:
- El sistema de precios (`mejores_precios_por_alimento`, `Precio referencia coach`, `AdminPrecios.tsx`) ya existía pero NO se consultó. Se asumió incorrectamente que no había infraestructura para asignar precios a alimentos raros.
- **REGLAS para próximas sesiones**:
  1. Antes de crear código nuevo, revisar `CLAUDE.md`, `ESTADO_Y_PROXIMOS_PASOS.md`, `DIAGNOSTICO_FALLOS.md` y archivos SQL de schema para entender sistemas existentes
  2. Verificar existencia de vistas, funciones y tablas relacionadas en Supabase antes de diseñar soluciones
  3. Consultar componentes UI existentes (`AdminPrecios.tsx`, `EscandalloReceta.tsx`) antes de crear nuevos flujos de gestión
  4. Ejecutar `--dry-run` siempre antes de `--apply` en scripts de modificación masiva

---

---

### ✅ SESIÓN 23-05-2026 — Auditoría completa de recetario (12 anomalías) + FALLO #24 🕵️

**Auditoría exhaustiva** de toda la BD: 353 recetas, 2.569 ingredientes, 13.349 alimentos. 12 tipos de anomalías analizadas.

**Hallazgos reales vs falsos positivos**:

| Código | Tipo | Hallazgos | ¿Real? | Acción |
|--------|------|-----------|--------|--------|
| F01+F06 | Receta duplicada vacía (Solomillo pistachos, 0 ingredientes) | 1 | ✅ Real | Eliminada |
| F02+F12 | Alimentos duplicados por acento (sin tilde → 0kcal) | 133 | ✅ Real | Macros copiados |
| F03 | Valores imposibles (kcal>2000, prot>100) | 45 | ✅ Real (aceites/especias) | Bajo impacto |
| F04 | Macros incompletos | 113 | ⚠️ Bajo | Diferido |
| F05 | Recetas sin tags/categoría | 220/104 | ⚠️ Cosméticos | Diferido |
| F09 | Macros incoherentes | 275 | **❌ FALSO POSITIVO** | Bug en script |
| F10 | Alimentos con nombre de receta | 1.046 | ❌ Ruido (supermercado) | 0 usados en recetas |
| F11 | Ingrediente duplicado (aceite oliva x2) | 2 | ✅ Real | Fusionado 30+60=90g |
| F12 | Mismo nombre, macros distintos | 25 | ⚠️ 1 corregible | Litines Caja ✅ |

**Scripts creados**:
- [`scripts/auditar-recetario-completo.mjs`](scripts/auditar-recetario-completo.mjs) — Auditoría 12 anomalías, paginación 1000, `norm()` para normalizar nombres
- [`scripts/fix-hallazgos-auditoria.mjs`](scripts/fix-hallazgos-auditoria.mjs) — 3 fixes: receta duplicada, 133 acentos, aceite duplicado
- [`scripts/auditar-y-corregir-f09-f12.mjs`](scripts/auditar-y-corregir-f09-f12.mjs) — Fix F09 (división por porciones) + F12 (Litines Caja)

**Documentación**: [`DIAGNOSTICO_FALLOS.md`](DIAGNOSTICO_FALLOS.md) — FALLO #23 (fase 1) y FALLO #24 (fase 2 auditoría completa)

---

## 🧠 LECCIONES APRENDIDAS — Auditoría de datos (23-05-2026)

### 📌 Conocimiento crítico del schema
1. **`recetas.kcal` es POR RACIÓN, no total**. Si comparas suma de ingredientes (total receta) vs `recetas.kcal`, obtienes falsos positivos. Siempre dividir por `recetas.porciones` antes de comparar. Verificado con "Cookies de mantequilla tostada": 72.69 kcal × 32 porciones = 2.326 ≈ suma ingredientes ✅
2. **Columnas de `recetas`**: `kcal`, `proteinas`, `carbohidratos`, `grasas`, `porciones` (NO `calorias`, NO `raciones`)
3. **Columnas de `alimentos`**: `calorias`, `proteinas`, `carbohidratos`, `grasas` (por 100g)
4. **`receta_ingredientes`**: `alimento_id`, `nombre_libre`, `cantidad_gramos`

### 📌 Patrones técnicos probados
1. **Paginación Supabase (>1000 rows)**: Usar `pag(table, select, filters, pageSize)` con `.range(from, from+pageSize-1)`. El SDK de Supabase lanza 416 si pides `range(0, 999)` cuando solo hay 500 rows — eso no es error, es que `data.length < pageSize` → break.
2. **Normalización de nombres**: `norm(str)` = `.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')` → quita acentos. Útil para detectar duplicados.
3. **Detección de duplicados por acento**: Si dos alimentos tienen el mismo `norm(nombre)` pero distinto nombre exacto, y uno tiene `calorias=0` mientras el otro tiene macros reales, la variante sin acento es un error de importación.
4. **Dry-run siempre**: Todo script de modificación masiva debe tener `DRY = !process.argv.includes('--apply')` por defecto.
5. **Carga de .env.local**: Leer línea por línea, parsear `clave=valor`, quitar comillas. `createClient()` con `{ auth: { persistSession: false } }` para scripts.

### 📌 Fallos conocidos y cómo evitarlos
1. **Scraper sin normalizar acentos**: El scraper de alimentos importó productos sin normalizar. Cuando se añadió normalización, se crearon duplicados. **Solución**: Antes de insertar, `norm()` el nombre y verificar si ya existe variante.
2. **Recetas huérfanas**: La generación masiva crea registro en `recetas` pero a veces no llena `receta_ingredientes`. **Solución**: Trigger/scheduled check `SELECT r.id FROM recetas r LEFT JOIN receta_ingredientes ri ON ri.receta_id = r.id WHERE ri.id IS NULL`.
3. **Ingrediente fantasma (IA alucina)**: La IA lista ingredientes en cabecera que no aparecen en instrucciones. **Solución**: Cross-check nombre_libre vs pasos de elaboración.
4. **Mal match de ingredientes**: Alimentos con nombre de receta (ej: "Espaguetis Bolonesa") vinculados como ingredientes base. **Solución**: Blacklist de palabras recetáceas.

### 📌 Scripts de diagnóstico disponibles
| Script | Qué hace | Última ejecución |
|--------|----------|-----------------|
| [`scripts/auditar-recetario-completo.mjs`](scripts/auditar-recetario-completo.mjs) | 12 anomalías en recetas+alimentos | 23-05-2026 |
| [`scripts/fix-hallazgos-auditoria.mjs`](scripts/fix-hallazgos-auditoria.mjs) | Corrige hallazgos reales | 23-05-2026 |
| [`scripts/auditar-y-corregir-f09-f12.mjs`](scripts/auditar-y-corregir-f09-f12.mjs) | F09 corregido + F12 investigación | 23-05-2026 |
| [`scripts/diagnosticar-recetas-fallos.mjs`](scripts/diagnosticar-recetas-fallos.mjs) | 4 tipos de fallos (fase 1) | 23-05-2026 |
| [`scripts/fix-fallos-recetas.mjs`](scripts/fix-fallos-recetas.mjs) | Fase 1 fixes | 23-05-2026 |

### 📌 Outputs de diagnóstico guardados
| Archivo | Contenido |
|---------|-----------|
| [`salidas/auditoria-recetario-2026-05-23.json`](salidas/auditoria-recetario-2026-05-23.json) | Auditoría completa 12 anomalías |
| [`salidas/auditoria-f09-f12-2026-05-23.json`](salidas/auditoria-f09-f12-2026-05-23.json) | F09+F12 corregido |
| [`salidas/diagnostico-recetas-fallos.json`](salidas/diagnostico-recetas-fallos.json) | Fase 1 diagnóstico |
| [`salidas/fix-fallos-2026-05-23.json`](salidas/fix-fallos-2026-05-23.json) | Fase 1 fixes aplicados |

### 📌 Qué NO hacer
1. **NO** asumir que `kcal` en recetas es total — siempre verificar si es por ración consultando la columna `porciones`.
2. **NO** ejecutar scripts de IA/scraping sin preguntar antes.
3. **NO** re-crear sistemas que ya existen (precios, tags, etc.) — revisar CLAUDE.md y componentes existentes primero.
4. **NO** modificar BD en producción sin `--dry-run` primero.

---

## 14. ✅ 23-05-2026 — 13.385 alimentos con micronutrientes completos (100%)

### Estado final

| Métrica | Valor |
|---------|-------|
| Total alimentos | 13,385 |
| Con micronutrientes | 13,385 (**100%**) |
| Sin micronutrientes | **0** |
| Alimentos en recetas | Todos disponibles con perfil completo |

### Script clave

[`scripts/enriquecer-masivo-tanda3.ts`](scripts/enriquecer-masivo-tanda3.ts) — Procesa 5 alimentos por llamada DeepSeek, recibe respuesta en array JSON `[{index, vitamina_a_ug, ...}]`, mapea cada uno a su fila en BD.

### Estrategia

1. **Tanda 1** (prototipo): [`enriquecer-segunda-pasada.ts`](scripts/enriquecer-segunda-pasada.ts) — 25 alimentos individuales vía DeepSeek
2. **Tanda 2 — Run 1**: [`enriquecer-masivo-tanda3.ts`](scripts/enriquecer-masivo-tanda3.ts) — ~1,000 alimentos en 200 batches de 5 → cobertura 94.2%
3. **Tanda 2 — Run 2**: Mismo script — ~783 alimentos restantes en 157 batches de 5 → **100%**

### Fallback cascade

1. Batch (5 alimentos, temp 0.2)
2. Reintento batch (temp 0.5, 2º intento)
3. Procesamiento individual (1 alimento/llamada)
- **Resultado: 0 errores** en ~357 llamadas combinadas

### 24 campos poblados por alimento

| Categoría | Campos |
|-----------|--------|
| Vitaminas | `vitamina_a_ug`, `vitamina_c_mg`, `vitamina_d_ug`, `vitamina_e_mg`, `vitamina_k_ug`, `vitamina_b6_mg`, `vitamina_b12_ug`, `tiamina_mg`, `riboflavina_mg`, `niacina_mg`, `folato_ug` |
| Minerales | `calcio_mg`, `hierro_mg`, `magnesio_mg`, `fosforo_mg`, `potasio_mg`, `sodio_mg`, `zinc_mg`, `cobre_mg`, `selenio_ug` |
| Perfil lipídico | `saturados_g`, `monoinsaturados_g`, `poliinsaturados_g`, `colesterol_mg` |

### Columnas que NO existen en la tabla

NO usar nunca: `acido_folico_ug`, `acido_pantotenico_mg`, `biotina_ug`, `manganeso_mg`, `fibra_g`, `agua_g`, `azucar_g`, `azucares_anadidos_g`.

### Para alimentos nuevos

Usar [`lib/deepseek.ts`](lib/deepseek.ts:607) → `completarAlimentoConIA()` para poblar micros de un solo alimento. NO volver a ejecutar enriquecimiento masivo.

---

## 🏷️ Corrección masiva de categorías (23-05-2026)

Se ejecutó [`supabase/migrations/fix_categorias_masivo_v2.sql`](supabase/migrations/fix_categorias_masivo_v2.sql) contra producción.

### Problema raíz
[`lib/scraping/categorizador.ts`](lib/scraping/categorizador.ts:308) usa `CATEGORIAS_POR_KEYWORD` con regex `\bkeyword\b`. Cualquier alimento cuyo nombre contuviera "anchoa", "papa", "sal", "aceituna", etc. se colaba en la categoría incorrecta.

### Lo que se hizo
1. **B0**: Aceitunas de Pescados → Condimentos
2. **B1**: Categorías no alimenticias → `es_comestible = false`
3. **B2**: ~350+ alimentos re-categorizados a categorías nutricionales correctas
4. **B3**: Categorías inválidas sin mapear → `es_comestible = false`
5. **B4**: Supermercado: re-categorizar por keyword + marcar sin kcal → 0 registros restantes

### Frontend
- [`app/dietas/alimentos/page.tsx`](app/dietas/alimentos/page.tsx:160): constante `CATEGORIAS_ALFABETICO` para desplegables en orden alfabético

### Si se añaden alimentos nuevos
El categorizador automático puede colocar en categorías incorrectas si el nombre coincide con keywords de otra categoría. Revisar manualmente.

---

## 🔀 Historial de Worktrees — Ya unificados en main
