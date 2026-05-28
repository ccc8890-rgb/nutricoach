# ESTADO NutriCoach — 29-05-2026 (Sesión 46 — Rediseño /clientes + Agente Retención ✅)

> Leer al inicio de CADA sesión. Documento dinámico actualizado al cerrar (29-05-2026).

---

## 📍 DÓNDE ESTAMOS

**Fase:** Sesión 46 completada. **Rediseño completo `/clientes` con tabla densa responsive + membresías + 9 agentes IA.** ✅ Build 0 errores. Deploy en Vercel (`ddcbf3d`). SQL migration aplicada en Supabase.

---

## ✅ COMPLETADO (29-05-2026) — Sesión 46 — Rediseño /clientes + Agente Retención

### 📋 Qué se hizo

| Archivo | Cambio |
|---------|--------|
| `supabase/migrations/20260529_membresia_clientes.sql` | +3 columnas en `clientes`: `tipo_membresia`, `fecha_inicio_membresia`, `fecha_fin_membresia` ✅ aplicado |
| `lib/clientes-utils.ts` | Nuevo — tipos `ClienteRow`, `ToolbarCounts`, funciones score adherencia, predictor baja, deuda atención, filtros, sort |
| `components/clientes/ClientesToolbar.tsx` | Nuevo — búsqueda 185px + chips estado + filtros membresía/fecha/chats + sort |
| `components/clientes/ClientesTabla.tsx` | Nuevo — tabla densa desktop con 9 columnas, membresía con barra progreso, score adherencia, predictor baja |
| `components/clientes/ClientesListaMobile.tsx` | Nuevo — lista iPhone 2 líneas + stats compactos |
| `app/clientes/page.tsx` | Reescritura completa — 8 queries paralelas, enriquecimiento cliente, filtros/sort por useMemo |
| `app/clientes/[id]/page.tsx` | Editor membresía en tab Perfil (tipo select + 2 date inputs + guardar) |
| `lib/agentes/types.ts` | `'retencion'` en `TipoAgente`, `'alerta_retencion'` en `TipoTarea` |
| `lib/agentes/agente-retencion.ts` | Nuevo agente — detecta caduca_pronto / baja_adherencia / nuevo_sin_enganche, propone acción al coach |
| `lib/agentes/orquestador.ts` | `PasoDirector` + `'retencion'`, `ejecutar.retencion: true` |
| `lib/agentes/director.ts` | Import + call `ejecutarAgenteRetencion(id)` diariamente |

### 📐 Score de adherencia (fórmula)
```
score = checkIn×0.4 + comidas×0.3 + entreno×0.2 + peso×0.1
```
- checkIn: 100 si <4d, decrece lineal hasta 0 en 14d
- comidas: % comidas completadas 7d (base 21 comidas/semana)
- entreno: % sesiones completadas 7d (base 3/semana)
- peso: 100 si hay peso en últimos 7d

### 🤖 Arquitectura de agentes (todos en `lib/agentes/`) — actualizada

| Archivo | Agente | Frecuencia | Modelo | Qué hace |
|---------|--------|-----------|--------|---------|
| `executor.ts` | Base | — | — | Routing modelos, contexto cliente, guardar tareas |
| `director.ts` | Director | Cron | — | Orquesta todos los agentes por cliente |
| `riesgo.ts` | Riesgo Nutrición | Diario | Gemini Flash | Detecta riesgo abandono >45% |
| `riesgo-entreno.ts` | Riesgo Entreno | Diario | Gemini Flash | Detecta inactividad >10 días con plan activo |
| `agente-retencion.ts` | **Retención** | **Diario** | **DeepSeek V3** | **Caduca pronto / baja adherencia / nuevo sin enganchar** |
| `revisor-semanal.ts` | Revisor Nutrición | Lunes | DeepSeek V3 | Analiza macros, adherencia, tendencia peso |
| `revisor-semanal-entreno.ts` | Revisor Entreno | Lunes | Gemini Flash | Analiza TLS, RPE, sesiones realizadas vs planificadas |
| `motivacion.ts` | Motivación | Lunes | Gemini Flash | Genera mensaje motivacional semanal personalizado |
| `memoria.ts` | Memoria | Semanal | DeepSeek V3 | Aprende de decisiones del coach |
| `aplicar.ts` | Motor decisiones | On-approve | — | Ejecuta acciones reales en BD al aprobar |

### 🔄 Crons Vercel (`vercel.json`)
- `0 7 * * *` → `/api/agentes/ejecutar?modo=diario` — todos los días 7am
- `0 6 * * 1` → `/api/agentes/ejecutar?modo=semanal` — lunes 6am

### 🎯 Motor de decisiones (`aplicar.ts`)
Cuando el coach aprueba una tarea en el kanban, se ejecuta:
- `ajuste_macros` / `revision_semanal` → `UPDATE planes_nutricion SET kcal_objetivo=X...`
- `alerta_riesgo` / `alerta_riesgo_entreno` / `mensaje_motivacion` / `revision_semanal_entreno` → `INSERT INTO chat_mensajes (remitente='coach'...)`
- `actualizacion_plan` → registra aprobación

### 🃏 Kanban coach (`/agentes`)
- 3 columnas: Pendiente / En revisión / Resuelto
- Cards con tipo, cliente, propuesta, razonamiento
- Botones: Aprobar / Rechazar / Modificar (con textarea inline)
- Badge con cuenta de pendientes en el sidebar
- Polling cada 60s

### 💬 Portal cliente
- `MensajeCoach.tsx`: muestra mensaje del coach (remitente='coach', no leído, últimos 7 días)
- Auto-marca leído tras 5 segundos + localStorage para no re-mostrar
- Integrado en `DashboardCliente.tsx` sobre el contenido de todos los tabs

### 📊 Routing de modelos por coste
| Modelo | Coste | Usado para |
|--------|-------|-----------|
| Gemini 2.5 Flash | $0.075/M | Riesgo diario, riesgo entreno, revisor entreno, motivación |
| DeepSeek V3 | $0.27/M | Revisor semanal nutrición, memoria |
| DeepSeek R1 | $0.55/M | Onboarding (plan inicial, 2-3×/mes) |

**Coste estimado a 100 clientes: ~$1.50/mes total.**

### 🔧 API endpoints
- `GET/POST /api/agentes/ejecutar` — cron + trigger manual (auth: CRON_SECRET)
- `GET /api/agentes/tareas` — listado kanban con join clientes+profiles
- `PATCH /api/agentes/tareas` — aprobar/rechazar/modificar + aplicar + aprendizaje
- `PATCH /api/cliente/[codigo]/chat/leer` — marcar mensaje leído (portal cliente)

### ✅ Build y TypeScript
- `npx tsc --noEmit` → 0 errores
- Commits: `e0f8b20`, `09a6151`

---

## 🎯 PRÓXIMA SESIÓN — Test E2E + Recetario

### PRIORIDAD 1 — Test end-to-end del sistema completo

**Objetivo:** verificar que todo funciona desde cero con un cliente real (Carlos mismo).

**Pasos del test:**
1. **Crear cliente de prueba** → invitar `ccc8890@gmail.com` como cliente (o usar código de portal existente)
2. **Completar onboarding** → rellenar todos los campos (objetivo, actividad, restricciones, etc.)
3. **Generar plan inicial** → verificar que DeepSeek genera dieta + entreno correctamente
4. **Aprobar plan** → flujo coach: revisar-plan → aprobar → email al cliente
5. **Acceder al portal cliente** → verificar DashboardCliente, MiPlan, MensajeCoach
6. **Hacer check-in** → registrar peso, adherencia, energía, sueño
7. **Registrar sesión de entreno** → desde portal cliente tab Entreno
8. **Trigger manual agentes** → `POST /api/agentes/ejecutar` con CRON_SECRET
9. **Verificar kanban** → `/agentes` debe mostrar tareas generadas
10. **Aprobar tarea** → verificar que el mensaje llega al portal cliente
11. **Verificar MensajeCoach** → el banner aparece en el portal y se marca leído

**Bugs esperados a encontrar:**
- Verificar que `chat_mensajes` tiene columna `cliente_id` (si no → error en aplicar.ts)
- Verificar que `registros_sets` retorna datos correctos para agente entreno
- Verificar que el cron funciona en Vercel (logs en Vercel Dashboard → Functions)

### PRIORIDAD 2 — Recetario: más recetas y calidad

- **147 imágenes malas** → ejecutar `node scripts/regenerar-imagenes-malas.mjs --genera` (~$5)
- **Recetas nuevas via Content Radar** → testear bridge_nutricoach.py con 1 reel real
- **10 recetas Serie Chef** → Carlos aprueba en `/recetas` estado `en_revision`

### PRIORIDAD 3 — Mejoras detectadas en E2E

*(Se rellenarán tras el test)*

---

## 🗂️ BACKLOG PENDIENTE

### 🔴 Alta prioridad
| Tarea | Contexto |
|-------|---------|
| Test E2E completo (ver arriba) | Sin test real no sabemos qué falla |
| Verificar SQL `chat_mensajes` tiene `cliente_id` | `aplicar.ts` hace INSERT con `cliente_id` |
| Crons Vercel: verificar que se disparan | Vercel Dashboard → Functions → Cron Jobs |

### 🟠 Media prioridad
| Tarea | Contexto |
|-------|---------|
| Bug `prs_por_ejercicio` usa `sets_ejecutados -> 0` | Siempre lee el primer set, no el más pesado |
| 147 imágenes malas regenerar con gpt-image-1 | `node scripts/regenerar-imagenes-malas.mjs --genera` |
| Registro comidas (S3) pendiente | DEEPSEEK_S3_registro_comidas.md en salidas/ |
| Estética portal S4 | DEEPSEEK_S4_estetica_portal.md en salidas/ |

### 🟡 Baja prioridad
| Tarea | Contexto |
|-------|---------|
| Revisar 5 avisos quality gate no bloqueantes | Recetas simples con 2 ingredientes |
| 7 recetas con macros altas | Carlos revisa porciones desde `/recetas/[id]` |
| Página bienvenida onboarding | Banner "Tu coach ha preparado tu plan" |

---

## 🏗️ ARQUITECTURA ACTUAL

```
Coach (web) ──→ /agentes (kanban) ──→ PATCH tareas → aplicarTarea() → BD
                                                     ↓
                                             chat_mensajes OR
                                             planes_nutricion UPDATE

Cron (Vercel) ──→ ejecutarDirector()
                    ├─ actualizarPerfilAprendizaje() → cliente_perfil_aprendizaje
                    ├─ ejecutarAgenteRiesgo() → agente_tareas (nutrición)
                    ├─ ejecutarAgenteRiesgoEntreno() → agente_tareas (entreno)
                    └─ [lunes] ejecutarRevisorSemanal()
                              ejecutarAgenteMotivacion()
                              ejecutarRevisorSemanalEntreno()

Portal cliente ──→ DashboardCliente
                    ├─ MensajeCoach → chat/leer PATCH
                    ├─ MiPlan (dieta)
                    ├─ TLSGauge (entreno)
                    ├─ CheckInForm
                    └─ HistorialCheckins
```

---

## 📋 TABLAS SUPABASE CLAVE (sistema agentes)

| Tabla | Uso |
|-------|-----|
| `agente_tareas` | Cola de tareas kanban |
| `cliente_perfil_aprendizaje` | Perfil de aprendizaje por cliente (riesgo, adherencia, tendencias) |
| `agente_aprendizaje` | Señales de aprendizaje (decisiones del coach) |
| `coach_memoria` | Reglas extraídas de las decisiones del coach |
| `chat_mensajes` | Mensajes coach ↔ cliente (remitente: 'coach' o 'cliente') |

---

## 🔐 VARIABLES DE ENTORNO REQUERIDAS (Vercel)

```
GEMINI_API_KEY        → Google AI Studio
DEEPSEEK_API_KEY      → platform.deepseek.com
CRON_SECRET           → string secreto para autenticar crons
SUPABASE_URL          → proyecto Supabase
SUPABASE_SERVICE_ROLE_KEY → para bypass RLS en agentes
CLOUDINARY_*          → imágenes recetas
RESEND_API_KEY        → emails
OPENAI_API_KEY        → gpt-image-1 para imágenes
```
