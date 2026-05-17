# 🔄 ESTADO ACTUAL + PRÓXIMOS PASOS — NutriCoach

**Documento dinámico que se actualiza cada sesión. Leer al iniciar.**

---

## 📍 DÓNDE ESTAMOS AHORA

### Fase: **Scraping Multi-Supermercado — Lidl optimizado ✅, Scraping cerrado**

**Última sesión:** 16-05-2026 (Noche — cierre)
**Responsable:** Carlos Casanova
**Estado de tokens:** ✅ OK
**Servidor local:** No necesario (scraping)

### Estado de cada scraper

| Supermercado | Productos | Técnica | Estado |
|---|---|---|---|
| **Mercadona** | ~2,895 ✅ | API HTTP (pública) | ✅ Operativo |
| **Consum** | ~4,765 ✅ | API interna (árbol categorías) | ✅ Operativo |
| **Alcampo** | ~38 ✅ | API Ocado HTTP | ✅ Operativo |
| **Carrefour** | ~20 ✅ | Playwright homepage (evita Cloudflare) | ✅ Operativo |
| **Eroski** | ~11 ✅ | Playwright homepage (slick-slider) | ✅ Operativo |
| **Bonpreu** | ~21 ✅ | Playwright + interceptación API | ✅ Operativo |
| **Esclat** | ~21 ✅ | Playwright + interceptación API | ✅ Operativo |
| **Lidl** | **75 ✅** | **Playwright search v3 — batch (4×15, browser refresh)** | **✅ v3 pipeline ejecutado (4.0 min, 429 prod, 0 errores)** |
| **Día** | 0 ❌ | Playwright | ❌ WAF bloquea headless |
| **Hipercor** | 0 ❌ | Playwright | ❌ Akamai |
| **El Corte Inglés** | 0 ❌ | Playwright | ❌ Akamai |

---

### ✅ COMPLETADO (hasta ahora)

#### Fase 0 — Setup

#### Fase 0 — Setup
- [x] Decisión arquitectónica (Supabase + DeepSeek V3)
- [x] Roadmap definido
- [x] Schema Supabase diseñado (SQL listo en [`supabase_schema.sql`](nutricoach/supabase_schema.sql))
- [x] Plantillas base generadas (7 plantillas)
- [x] Script seed de plantillas ([`scripts/seed-plantillas.ts`](nutricoach/scripts/seed-plantillas.ts))
- [x] API endpoint `/api/plantillas/seed` para seed desde navegador
- [x] SQL seed listo ([`seed_plantillas_dietas.sql`](nutricoach/seed_plantillas_dietas.sql))

#### Fase 1 — Cuestionarios
- [x] **Tipos TypeScript** en [`types/index.ts`](nutricoach/types/index.ts): `Pregunta`, `Cuestionario`, `RespuestaCliente`, `PlantillaDieta`, `TipoPregunta`, `OpcionPregunta`
- [x] **Componente [`CuestionarioCreador.tsx`](nutricoach/components/CuestionarioCreador.tsx)** — Editor de preguntas
- [x] **Componente [`FormularioCliente.tsx`](nutricoach/components/FormularioCliente.tsx)** — Formulario público anónimo
- [x] **Componente [`RespuestasClientes.tsx`](nutricoach/components/RespuestasClientes.tsx)** — Tabla con filtros por estado
- [x] **Página `/cuestionarios`** — Lista y crea cuestionarios
- [x] **Página `/cuestionario/[codigo]`** — Página pública (sin auth)
- [x] **Página `/respuestas`** — Lista respuestas recibidas
- [x] **Página `/dashboard`** — Dashboard con stats reales
- [x] **Sidebar** — Navegación completa con iconos
- [x] **API REST** completa para cuestionarios y respuestas

#### Fase 2A — Integración DeepSeek V3
- [x] **`lib/deepseek.ts`** — Cliente DeepSeek V3 completo:
  - `construirPrompt(datosCliente, plantillas, recetas)` — Prompt estructurado
  - `generarDietaConIA(prompt)` — Llamada a API DeepSeek, parseo de JSON
  - `DietaGenerada` interface: plantilla elegida, comidas, macros, notas
  - Validación de campos mínimos requeridos, temperatura 0.3
- [x] **`/api/generar-dieta-ia/route.ts`** — Endpoint POST completo:
  - Auth → fetch respuesta → fetch plantillas → fetch recetas → build prompt → call DeepSeek
  - Validación macros ±10% contra objetivo
  - Creación de `plan_nutricion`, `comidas`, `comida_alimentos` en Supabase
  - Creación temporal de alimentos para recetas que no existen aún

#### Fase 2B — Revisión y aprobación de dieta
- [x] **5 estados**: `nueva`, `procesando`, `dieta_lista`, `dieta_aprobada`, `dieta_rechazada`
- [x] Botón "Generar dieta" + loader + enlace a plan + Toast + Modal
- [x] Auto-generación de `codigo_publico` (12 chars alfanuméricos) al aprobar

#### Fase 2C — Control manual
- [x] **Página `/dietas`** — Lista de dietas del coach
- [x] **Página `/dietas/nueva`** — Crear dieta manual con cálculo TMB/TDEE
- [x] **Página `/dietas/[id]`** — Editor completo de dieta
- [x] **Buscador de alimentos** — Open Food Facts + BEDCA + alimentos guardados
- [x] **PDF generation** — PDF descargable del plan

#### 🆕 Fase 3+ — Portal Cliente AVANZADO (NUEVO)
- [x] **Portal cliente completo** con 3 tabs: [`DashboardCliente.tsx`](nutricoach/components/PortalCliente/DashboardCliente.tsx)
  - **Mi Plan** ([`MiPlan.tsx`](nutricoach/components/PortalCliente/MiPlan.tsx)): comidas expandibles, macros totales, plan de entreno, descarga PDF
  - **Check-in semanal** ([`CheckInForm.tsx`](nutricoach/components/PortalCliente/CheckInForm.tsx)): formulario con sliders de adherencia/energía/sueño + peso
  - **Progreso** ([`ProgresoCharts.tsx`](nutricoach/components/PortalCliente/ProgresoCharts.tsx)): gráficos SVG de evolución de peso, barras de adherencia, resumen
- [x] **API `/api/cliente/[codigo]/dashboard`** — Dashboard data (plan+comidas+alimentos, entreno, checkins, peso, notas)
- [x] **API `/api/cliente/[codigo]/checkin`** — POST check-in + registro automático en `seguimiento_peso`
- [x] **API `/api/cliente/[codigo]/notas`** — GET notas del coach visibles para el cliente
- [x] **Auto-detección**: si tiene entreno activo, lo muestra en el portal

#### 🆕 Fase 4 — Funcionalidades Avanzadas (NUEVO)
- [x] **Informe Semanal Automático** ([`InformeSemanal.tsx`](nutricoach/components/InformeSemanal.tsx)):
  - Botón "Generar informe" que llama a DeepSeek
  - Analiza peso history + check-ins de la última semana
  - Muestra resumen, evolución peso, adherencia, energía, recomendaciones
  - Estado general: positivo/neutro/atencion con badges de colores
  - Botón "Copiar resumen" al portapapeles
- [x] **API `/api/clientes/[id]/informe-semanal`** — Endpoint POST que construye prompt y llama a DeepSeek
- [x] **`construirPromptInformeSemanal()`** en [`deepseek.ts`](nutricoach/lib/deepseek.ts:203) — Prompt para informe semanal
- [x] **`generarInformeSemanalIA()`** en [`deepseek.ts`](nutricoach/lib/deepseek.ts:254) — Llamada a DeepSeek para informe
- [x] **Ajuste de Macros por IA** ([`AjusteMacrosIA.tsx`](nutricoach/components/AjusteMacrosIA.tsx)):
  - Botón "Recalcular con IA" que analiza evolución del cliente
  - Muestra comparativa actual vs sugerido con diff visual
  - Razonamiento de IA explicado
  - Botones "Aplicar nuevos macros" / "Descartar"
  - Actualiza directamente el plan activo en Supabase
- [x] **API `/api/clientes/[id]/recalcular-macros`** — Endpoint POST con prompt de ajuste de macros
- [x] **`construirPromptAjusteMacros()`** en [`deepseek.ts`](nutricoach/lib/deepseek.ts:321) — Prompt para recalcular macros
- [x] **`recalcularMacrosIA()`** en [`deepseek.ts`](nutricoach/lib/deepseek.ts:389) — Llamada a DeepSeek para macros
- [x] **Historial de Dietas IA** ([`HistorialDietasIA.tsx`](nutricoach/components/HistorialDietasIA.tsx)):
  - Timeline visual con todos los planes generados por IA
  - Muestra macros, estado, fecha, número de comidas
  - Indicador de plan activo/inactivo
  - Badge "IA" en planes generados por DeepSeek
- [x] **API `/api/clientes/[id]/historial-ia`** — GET historial combinado (plan + respuesta + comidas)

#### 🆕 Fase 4B — Planificación y UX (NUEVO)
- [x] **Planificación con Calendario** ([`PlanificacionCalendario.tsx`](nutricoach/components/PlanificacionCalendario.tsx)):
  - Calendario visual con navegación de meses
  - Resalta hoy y fecha de próxima revisión
  - Panel lateral con: dieta activa, rutina activa, próxima revisión
  - Programar/cambiar/eliminar fecha de revisión
- [x] **Lista de la Compra** ([`ListaCompra.tsx`](nutricoach/components/ListaCompra.tsx)):
  - Agrupa alimentos por categoría con emojis
  - Checkboxes para tachar productos
  - Botón "Copiar lista al portapapeles"
- [x] **`generarListaCompra()`** en [`utils.ts`](nutricoach/lib/utils.ts:151) — Función que agrupa alimentos por categoría

#### 🆕 Página Detalle Cliente (NUEVO — [`app/clientes/[id]/page.tsx`](nutricoach/app/clientes/[id]/page.tsx))
- [x] **4 Tabs**: Información, Planificación, Historial IA, Ajuste Macros
- [x] **Info**: cards con objetivo/nivel/peso/edad, planes nutrición, planes entreno
- [x] **Seguimiento peso**: tabla con fecha/peso/notas
- [x] **Check-ins recibidos**: cards con detalles de cada check-in
- [x] **Notas del coach**: formulario para enviar notas + historial
- [x] **Botón "Portal"**: copia enlace del portal cliente al portapapeles
- [x] **Componente [`ClienteEditar.tsx`](nutricoach/components/ClienteEditar.tsx)** — Editor de datos del cliente

#### Tablas nuevas en Schema SQL ([`supabase_schema.sql`](nutricoach/supabase_schema.sql))
- [x] `checkins` — Check-ins semanales (peso, adherencia, energia, sueno, notas)
- [x] `notas_coach` — Notas del coach visibles para el cliente
- [x] `plantillas_entrenamiento` — Plantillas de entrenamiento predefinidas
- [x] `plantilla_sesiones` — Sesiones dentro de plantillas de entreno
- [x] `plantilla_sesion_ejercicios` — Ejercicios dentro de sesiones de plantilla
- [x] Campo `fecha_proxima_revision` en tabla `clientes`

#### Notificaciones
- [x] Badge en sidebar con contador de no leídas
- [x] Polling cada 30s + recarga al recuperar foco
- [x] Al entrar en respuestas, marca como leídas

#### Design System v2 (Teal)
- [x] Paleta teal profesional (#0D9488), Inter font
- [x] CSS unificado con variables, sombras, animaciones, skeletons
- [x] Botones, cards, inputs, badges, macro pills, tablas rediseñados

#### Scripts
- [x] **`scripts/importar-recetas-csv.ts`** — Importación CSV con auto-detección

### ✅ COMPLETADO EN SESIÓN 28-04-2026 (noche)

#### 🔧 Migraciones SQL + Enriquecimiento
- [x] Migraciones SQL ejecutadas en Supabase ([`supabase_micronutrientes.sql`](nutricoach/supabase_micronutrientes.sql) + [`seed_alimentos_extra.sql`](nutricoach/seed_alimentos_extra.sql))
- [x] Enriquecimiento de **267 alimentos** con micronutrientes vía DeepSeek V4 Flash (267/267 ✅ 0 errores)
- [x] Script de enriquecimiento [`poblar-micronutrientes.mjs`](nutricoach/scripts/poblar-micronutrientes.mjs) — secuencial con 2 retries, 300ms pause, assistant priming JSON

#### 🐛 Corrección de Bugs (de [`salidas/28-04-2026_AUDITORIA_MICRONUTRIENTES.md`](nutricoach/salidas/28-04-2026_AUDITORIA_MICRONUTRIENTES.md))
- [x] **BUG 1**: API GET `/api/alimentos` devolvía `[]` por RLS. Creado `createServiceSupabase()` con `service_role_key` para lecturas públicas
- [x] **BUG 2**: Middleware [`proxy.ts`](nutricoach/proxy.ts) interceptaba rutas API. Añadido `api/` al negative lookahead
- [x] **BUG 3**: API de alimentos usaba `createServerSupabase()`. Migrado a `createApiSupabase(request)` para POST y `createServiceSupabase()` para GET
- [x] **BUG 4**: `tieneMicros()` mejorado para detectar perfil lipídico
- [x] **BUG 5**: Alimentos `curada` actualizados vía enriquecimiento masivo
- [x] **BUG 6**: Reemplazado spinner loading por 9 [`SkeletonCard`](nutricoach/components/ui/Skeleton.tsx) en grid
- [x] **BUG 7**: `NUTRI_LABELS` tipado con `satisfies readonly { key: keyof Alimento; ... }[]`
- [x] **BUG 8**: OFF endpoint mapea `fuente: 'openfoodfacts'` en el body de importación

#### 🐛 Corrección de Bugs (de [`salidas/28-04-2026_AUDITORIA_COMPLETA.md`](nutricoach/salidas/28-04-2026_AUDITORIA_COMPLETA.md))
- [x] **Bug 1 (auditoría)**: Migradas 6 API routes de `import { supabase }` a `createServerSupabase()` — [`informe-semanal/route.ts`](nutricoach/app/api/clientes/[id]/informe-semanal/route.ts), [`recalcular-macros/route.ts`](nutricoach/app/api/clientes/[id]/recalcular-macros/route.ts), [`historial-ia/route.ts`](nutricoach/app/api/clientes/[id]/historial-ia/route.ts), [`clientes/[id]/route.ts`](nutricoach/app/api/clientes/[id]/route.ts), [`checkins/route.ts`](nutricoach/app/api/cliente/[codigo]/checkins/route.ts), [`ia-logger.ts`](nutricoach/lib/ia-logger.ts)
- [x] **Bug 3 (auditoría)**: Botón "Copiar resumen" en [`InformeSemanal.tsx`](nutricoach/components/InformeSemanal.tsx) — eliminado `fetch()` POST innecesario que regeneraba informe
- [x] **Bug 4 (auditoría)**: Validación de macros con `kcal_objetivo` — añadida guarda contra NaN
- [x] **Bug 5 (auditoría)**: Modelo DeepSeek movido a variable de entorno `DEEPSEEK_MODEL`
- [x] **Bug 6 (auditoría)**: Campo `generado_por_ia` boolean directo en `planes_nutricion`
- [x] **Bug 7 (auditoría)**: Coach ID verificado antes de loguear — devuelve 401 si no hay sesión
- [x] **Bug 8 (auditoría)**: Tipo `CheckIn` sincronizado — `hambre` → `adherencia`
- [x] **Bug 9 (auditoría)**: Fecha check-in corregida a zona local (`.toLocaleDateString('en-CA')`)
- [x] **Bug 10 (auditoría)**: Verificadas todas las rutas del sidebar existen
- [x] **Sugerencia 11**: Memoización `useMemo` en [`PlanificacionCalendario.tsx`](nutricoach/components/PlanificacionCalendario.tsx)
- [x] **Sugerencia 12**: Creado [`ErrorBoundary`](nutricoach/components/ui/ErrorBoundary.tsx) y envueltos componentes críticos
- [x] **Sugerencia 13**: Captura de `usage.total_tokens` de DeepSeek en los 3 endpoints IA

#### 🔐 Gestión de acceso
- [x] Contraseña regenerada para coach `ccc8890@gmail.com` — `Coach0jXQbzIp3M!2026`

### ✅ COMPLETADO EN SESIÓN 29-04-2026 (madrugada)

#### 🆕 Sistema Automático de Recetas — scrape + backfill + UI

##### Decisión estratégica
- **Opción elegida**: Backfill UNA VEZ (script para rellenar recetas existentes con `url_origen`) + scraper para nuevas recetas añadidas manualmente
- **UX elegida**: Input minimalista que auto-crea al pegar URL (sin botón de guardar)

##### [`/api/scrape-receta/route.ts`](nutricoach/app/api/scrape-receta/route.ts) — REPARADO
- [x] Auth corregido: ahora usa `createApiSupabase(req)` para autenticación (cookies) + `createServiceSupabase()` para operaciones DB (service_role, bypass RLS)
- [x] Añadida tabla `NORMALIZACIONES` con ~50 mapeos plural→singular (stemming nivel 3)
- [x] Añadida función `normalizarNombre()` para stemming de ingredientes
- [x] Añadido auth guard: devuelve 401 si no hay usuario autenticado
- [x] **3 niveles de matching**: (1) ilike exacto → (2) palabra por palabra (>2 chars) → (3) normalizar plural→singular + word search
- [x] Añadido `AbortSignal.timeout(15000)` a fetch (bug fix en esta sesión)

##### [`scripts/backfill-recetas.ts`](nutricoach/scripts/backfill-recetas.ts) — CREADO
- [x] Script CLI ejecutable con `npx tsx scripts/backfill-recetas.ts`
- [x] Carga `.env.local` automáticamente
- [x] Query: recetas con `url_origen` NOT NULL y `instrucciones` IS NULL o vacío
- [x] Por cada receta: scrape URL → update receta (instrucciones, descripción, imagen) → delete old ingredientes → insert new → recalcular macros
- [x] Funciones duplicadas: `NORMALIZACIONES`, `parsearIngrediente()`, `scrapeURL()` con 15s timeout, `autoMatchIngredientes()` (3 niveles), `calcularMacros()`
- [x] Stats finales: completadas/saltadas/fallos
- [x] Skip si ya tiene ingredientes + instrucciones (bug fix: `head: true` eliminado — ver auditoría)

##### [`/recetas/nueva/page.tsx`](nutricoach/app/recetas/nueva/page.tsx) — REEMPLAZADO
- [x] **Modo quick import (default)**: Apple-style minimalista centrado, icono Link2, input único con `onBlur` + `onKeyDown(Enter)` → auto-llamada a `/api/scrape-receta`
- [x] Spinner + "Creando…" animation mientras procesa
- [x] Auto-redirect a `/recetas/[id]` en éxito
- [x] Error message inline en fallo
- [x] Botón "O crea una receta desde cero" → modo formulario completo
- [x] **Bug fix**: `saltarBlurRef` para evitar que `onBlur` dispare scrape al hacer clic en "desde cero"
- [x] **Modo formulario completo** (`FormularioCompleto`): todos los campos (ingredientes con buscador, imagen, categoría, intolerancias, instrucciones, macros calculator)
- [x] CSS variables en toda la UI, sin hardcoded text colors

##### Plan final
- [x] [`plans/SISTEMA_RECETAS.md`](plans/SISTEMA_RECETAS.md) — Actualizado con Mermaid diagrams, 3 implementation tasks, decisiones tomadas

##### 🐛 Auditoría de código (29-04-2026)
| # | Bug | Archivo | Fix |
|---|-----|---------|-----|
| 14 | **scrapeURL sin timeout** — API route podía colgarse en serverless | [`scrape-receta/route.ts:87`](nutricoach/app/api/scrape-receta/route.ts:87) | ✅ Añadido `AbortSignal.timeout(15000)` |
| 15 | **`head: true` en backfill** — `existingIngs` siempre `null` porque `head:true` devuelve `data: null` | [`backfill-recetas.ts:341`](nutricoach/scripts/backfill-recetas.ts:341) | ✅ Eliminado `{ count: 'exact', head: true }`, ahora es `.select('id')` |
| 16 | **`onBlur` + botón "desde cero"** — blur dispara scrape antes de cambiar a formulario | [`recetas/nueva/page.tsx:367`](nutricoach/app/recetas/nueva/page.tsx:367) | ✅ Añadido `saltarBlurRef` que se setea `true` en onClick del botón |

### ✅ COMPLETADO EN SESIÓN 06-05-2026

#### 🆕 Knowledge Base Científica para DeepSeek
- [x] **`lib/knowledge.ts`** — `fetchKnowledgeContext()` función que consulta `knowledge_base` por disciplinas y condiciones
- [x] **`supabase_knowledge_base.sql`** — Schema: tabla `knowledge_base` con `id, titulo, contenido, categoria, disciplinas[], tags[], fuente, doi, created_at`
- [x] **`scripts/seed-knowledge.mjs`** — 18 fichas de conocimiento insertadas ✅ (0 errores): protocolo nutrición, entrenamiento, periodización, hidratación, suplementación, biomecánica carrera, etc.
- [x] **`scripts/seed-estudios-cientificos.mjs`** — 30 estudios científicos REALES con DOI insertados ✅ (0 errores): 16 nutrición, 6 fuerza, 2 híbrido, 3 recuperación, 3 running
- [x] **`/api/conocimiento/scrape/route.ts`** — Endpoint POST para scrapear URLs/DOIs y extraer conocimiento estructurado vía DeepSeek
- [x] **3 endpoints IA ahora inyectan contexto científico**: [`generar-dieta-ia/route.ts`](nutricoach/app/api/generar-dieta-ia/route.ts), informe-semanal, recalcular-macros

#### 🆕 Sistema de Onboarding Autónomo de Clientes (registro sin coach)
- [x] **`supabase_onboarding_migration.sql`** — Tabla `invitaciones` (token, coach_id, email, expires_at, usado) + RLS + columna `revisado_por_coach` en `clientes`
- [x] **`/api/invitaciones/route.ts`** — POST: crea invitación con token, devuelve URL pública `/registro/{token}`
- [x] **`/api/invitaciones/[token]/route.ts`** — GET: valida token (no usado, no expirado), devuelve email asociado
- [x] **`/api/registro-invitacion/route.ts`** — POST: 2 modos:
  - `vincular`: para OAuth/magic link — marca token usado, upsert profile con role='cliente', inserta cliente con `revisado_por_coach: false`
  - `contraseña`: crea usuario Auth → inserta cliente → rollback en fallo (borra usuario Auth)
- [x] **`/registro/[token]/page.tsx`** — Página de registro con 3 opciones:
  1. Google OAuth (`signInWithOAuth` con `redirectTo: /auth/callback?invtoken={token}`)
  2. Magic Link (passwordless email)
  3. Contraseña (formulario colapsable, POST a `/api/registro-invitacion`)
- [x] **`/auth/callback/page.tsx`** — Callback OAuth con dos **bugs corregidos**:
  - **🛠️ Bug fix**: Redirigía a `/portal` (no existe) → cambiado a `/cliente`
  - **🛠️ Bug fix**: Faltaba sincronización de sesión con cookies del servidor → añadido POST a `/api/auth/callback` con `access_token` + `refresh_token`
- [x] **`/api/auth/callback/route.ts`** — POST: `setSession()` para sincronizar cookies SSR
- [x] **Badge "Nuevo"** en [`clientes/page.tsx:153`](nutricoach/app/clientes/page.tsx:153) — se muestra cuando `revisado_por_coach === false`
- [x] **Auto-marcar como revisado** en [`clientes/[id]/page.tsx:75`](nutricoach/app/clientes/%5Bid%5D/page.tsx:75) — al abrir detalle: `UPDATE clientes SET revisado_por_coach=true`
- [x] **Trigger `on_auth_user_created`** — verificado existente en Supabase, crea `profiles` automáticamente al registrar usuario Auth
- [x] **RLS policies** verificadas: `profiles` (coach ve todos, cliente ve propio), `clientes` (coach gestiona, cliente ve propio), `invitaciones` (coach ve propias)

#### 🆕 Nuevas APIs de utilidad
- [x] **`/api/clientes/[id]/conversaciones-ia/route.ts`** — GET: historial combinado de interacciones IA desde `registros_ia`, enriquecido con `planes_nutricion`
- [x] **`/api/clientes/[id]/protocolo-competicion/route.ts`** — CRUD completo (GET/POST/PUT/DELETE) para protocolos de competición (carga de carbos, suplementación carrera)
- [x] **`/api/recetas/[id]/estado/route.ts`** — PATCH: actualiza estado de receta (aprobada/descartada/en_revision/borrador)

#### 🔧 Migraciones SQL ejecutadas
- [x] SQL: `ALTER TABLE recetas ADD COLUMN descripcion_porcion text` ✅
- [x] SQL: `UPDATE recetas SET estado = 'aprobada' WHERE estado IS NULL` ✅
- [x] SQL: `ALTER TABLE clientes ADD COLUMN revisado_por_coach boolean DEFAULT true` ✅
- [x] SQL Onboarding migration (invitaciones + RLS) ✅ (policy ya existía)
- [x] Seed knowledge base: 18 fichas + 30 estudios científicos ✅

#### 🐛 Bug corregido
| # | Bug | Archivo | Fix |
|---|-----|---------|-----|
| 17 | **OAuth callback redirige a `/portal` (no existe)** | [`auth/callback/page.tsx:61`](nutricoach/app/auth/callback/page.tsx:61) | ✅ Cambiado a `/cliente` |
| 18 | **OAuth callback no sincroniza sesión con cookies SSR** | [`auth/callback/page.tsx:33-46`](nutricoach/app/auth/callback/page.tsx:33) | ✅ Añadido POST a `/api/auth/callback` con tokens |

### ✅ COMPLETADO EN SESIÓN 08-05-2026

#### 🟢 Flujo Onboarding End-to-End verificado via API ✅

| Paso | Endpoint | Resultado |
|------|----------|-----------|
| 1. Login coach | `POST /auth/v1/token` con `ccc8890@gmail.com` / `Coach2026!` | ✅ Sesión obtenida |
| 2. Sync sesión | `POST /api/auth/callback` con access_token + refresh_token | ✅ 200 |
| 3. Crear invitación | `POST /api/invitaciones` (autenticado) | ✅ 200 → URL generada |
| 4. Verificar token | `GET /api/invitaciones/[token]` (público) | ✅ 200, `valido: true` |
| 5. Registrar cliente | `POST /api/registro-invitacion` con contraseña | ✅ 200, `ok: true` |
| 6. Verificar BD | Invitación `usado: true` | ✅ |
| 7. Verificar BD | Cliente con `revisado_por_coach: false` | ✅ |
| 8. Verificar BD | Profile con `role: 'cliente'` | ✅ |

**Nota:** No se pudo probar OAuth Google desde CLI (requiere navegador), pero el código está correcto y el modo `vincular` en `registro-invitacion/route.ts` está implementado.

**Contraseña coach actualizada:** `Coach2026!` (la anterior expiró entre sesiones)

### ✅ COMPLETADO EN SESIÓN 08-05-2026 (tarde) — FASE 9 + Migración Graphite

#### 🆕 FASE 9 — Dashboard Premium
- [x] **MiniSparkline.tsx** — Componente SVG inline para sparklines en stat cards (sin dependencias)
- [x] **Stat cards con sparklines** — Cada STAT_CARD tiene `trend: number[]` renderizado como sparkline
- [x] **Sparkles animado** — Icono `<Sparkles />` en header con `animate-spin-slow`
- [x] **Hover lift + glow** — Clase `card-hoverable` en chart cards con `translateY(-2px)` + glow

#### 🆕 FASE 9 — Sidebar Refinada
- [x] **Active state**: Barra vertical graphite (`w-1 h-5 rounded-full`) con `box-shadow: 0 0 6px var(--accent-glow)`
- [x] **Logo CN**: Gradiente + `animate-breathe` (glow pulse 0→40→60px)
- [x] **Mobile compact**: Hamburguesa + overlay + slide con `translate-x` + cierre al navegar
- [x] **Hydration fix**: Patrón `mounted + useEffect` para evitar hydration mismatch

#### 🎨 Migración Ámbar → Graphite Apple Pro
- [x] **CSS variables**: `--accent: #A1A1A6` (antes #F59E0B), dark + light themes actualizados
- [x] **17 referencias hex** (#F59E0B, #D97706) en 11 archivos → graphite equivalents
- [x] **~40 clases Tailwind amber** en 10 archivos → graphite colors
- [x] **6 comentarios** con "ámbar" → "graphite"
- [x] **1 residuo** `.macro-pill-carbs border-color: rgba(245,158,11,0.3)` → `var(--border-accent)`
- [x] **Verificación**: `grep -r "F59E0B\|D97706\|text-amber\|bg-amber\|border-amber\|rgba(245,158,11"` → ✅ 0 resultados

#### 🐛 Bugs corregidos
| # | Bug | Fix |
|---|-----|-----|
| 19 | **Hydration mismatch** en Sidebar (hamburguesa mobile) | Patrón `mounted + useEffect` |
| 20 | **Caché chunks obsoletos** — `Check` icon de lucide-react | `rm -rf .next` + hard reload |
| 21 | **Caché chunks obsoletos** — `Menu` icon de lucide-react | Mismo fix que #20 |

#### 📄 Documentación
- [x] [`salidas/08-05-2026_AUDITORIA_FASE9_GRAPHITE.md`](./salidas/08-05-2026_AUDITORIA_FASE9_GRAPHITE.md) — Auditoría completa de la sesión

### ✅ COMPLETADO EN SESIÓN 14-05-2026 — Auditoría y corrección masiva del recetario

#### 🔍 Diagnóstico inicial
- [x] Auditoría completa ejecutada: 227 recetas, 71 sin problemas, 156 con problemas
- [x] Detección de **35 alimentos con kcal=0** que afectaban recetas (26 sin regla de matching)
- [x] Detectado CRITICAL BUG: [`fix-macros-faltantes.mjs`](nutricoach/scripts/fix-macros-faltantes.mjs) guardaba macros TOTALES en columnas POR PORCIÓN

#### 🍎 Enriquecimiento de 35 alimentos con macros=0
- [x] Añadidas ~20 reglas de matching en [`fix-macros-faltantes.mjs`](nutricoach/scripts/fix-macros-faltantes.mjs) cubriendo:
  - Chocolate 85% (590kcal), Chocolate 72% con almendras (550kcal)
  - Pipas de calabaza (550kcal), Pepinillos (15kcal)
  - Salsas: Thai Chili (200kcal), César (450kcal), Miel Mostaza (120kcal), Worcestershire (70kcal)
  - Cebolla frita crujiente (500kcal), Snack maíz Stars (500kcal)
  - Helado vegetal chocolate (200kcal), Café con leche light (35kcal)
  - Cacahuete proteínas desgrasado (400kcal, 70g proteína), Pimentón dulce (280kcal)
  - Zero-calorie items: sal, bicarbonato, agua, edulcorante, especias, hojas laurel
- [x] Dry-run: 35/35 alimentos OK, 0 sin regla ✅
- [x] `--apply`: 35 alimentos actualizados, 114 recetas recalculadas, 0 errores

#### 🐛 Fix CRITICAL BUG — División por porciones
- [x] Añadida división por `receta.porciones || 1` en línea 296 de [`fix-macros-faltantes.mjs`](nutricoach/scripts/fix-macros-faltantes.mjs)
- [x] Documentado en [`DIAGNOSTICO_FALLOS.md`](nutricoach/DIAGNOSTICO_FALLOS.md) como FALLO #21

#### 🔄 Recalculo masivo de todas las recetas
- [x] Ejecutado [`fix-recetas-completo.mjs --fase 3`](nutricoach/scripts/fix-recetas-completo.mjs): 227 recetas recalculadas, 88 con cambios reales, 0 errores en 23 batches

#### 🏁 Auditoría final post-fixes
- [x] [`salidas/auditoria-recetario-2026-05-14.md`](salidas/auditoria-recetario-2026-05-14.md) generada con resultados definitivos
- [x] Metadatos (categorías, tipo_coccion, dificultad) ya estaban estandarizados — 0 cambios necesarios

### ⏳ PENDIENTE — Próxima sesión

#### Paso 0 — Arrancar
```bash
cd ~/Desktop/Carlos/CLAUDE/NUTRICION/nutricoach-ui
lsof -ti:3000 | xargs kill -9 2>/dev/null; npm run dev
```

#### Paso 1 — Probar flujo recetas end-to-end ⬅️ SIGUIENTE
1. Ir a `/recetas/nueva` → pegar URL de receta → verificar scraper
2. Ir a `/recetas/cola` → aprobar/descartar
3. Verificar que aparece en recetario aprobado

#### Paso 2 — Probar flujo DeepSeek con contexto científico
1. Generar dieta con IA → verificar logs de `fetchKnowledgeContext()` en consola
2. Verificar que los artículos científicos relevantes aparecen en el prompt de DeepSeek

#### Paso 3 — Tareas técnicas pendientes
- [ ] Verificar build completo: `npx next build`
- [ ] Verificar que el script `fix-orphan-ingredients-v2.ts` corrige ingredientes huérfanos (si los hay)
- [ ] Actualizar `supabase_schema.sql` con las nuevas tablas: `invitaciones`, `knowledge_base`, `protocolos_competicion`, `registros_ia`
- [ ] Documentar API `/api/conocimiento/scrape` en el README

---

## 📋 ESTRUCTURA COMPLETA DEL PROYECTO

```
nutricoach/
├── app/
│   ├── api/
│   │   ├── cliente/[codigo]/              ← 🆕 Portal público
│   │   │   ├── dashboard/                 ← GET datos completos
│   │   │   ├── checkin/                   ← POST check-in semanal
│   │   │   └── notas/                     ← GET notas del coach
│   │   ├── clientes/[id]/
│   │   │   ├── route.ts                   ← PUT cliente
│   │   │   ├── informe-semanal/           ← 🆕 POST informe DeepSeek
│   │   │   ├── recalcular-macros/         ← 🆕 POST ajuste macros IA
│   │   │   └── historial-ia/             ← 🆕 GET historial dietas IA
│   │   ├── cuestionarios/                 ← API REST cuestionarios
│   │   ├── respuestas/                    ← API respuestas + estado + leer
│   │   ├── generar-dieta-ia/              ← POST generación DeepSeek
│   │   ├── dietas/[id]/pdf/               ← PDF download
│   │   ├── plantillas/                    ← API plantillas + seed
│   │   ├── plantillas-entreno/            ← 🆕 API plantillas entreno
│   │   ├── crear-cliente/                 ← Crear cliente
│   │   ├── guardar-alimento/              ← Guardar alimento custom
│   │   ├── importar-bedca/                ← Importar BEDCA
│   │   ├── importar-receta/               ← Importar receta
│   │   └── off/                           ← Open Food Facts
│   ├── cliente/[codigo]/                  ← 🆕 Portal cliente (DashboardCliente)
│   ├── clientes/[id]/                     ← 🆕 Detalle cliente completo
│   ├── cuestionarios/                     ← Coach: listar/crear cuestionarios
│   ├── cuestionario/[codigo]/             ← PÚBLICO: formulario cliente
│   ├── respuestas/                        ← Coach: ver respuestas
│   ├── dashboard/                         ← Dashboard coach con stats
│   ├── dietas/                            ← Gestión dietas
│   ├── entrenos/                          ← Gestión entrenos
│   ├── recetas/                           ← Gestión recetas
│   └── login/                             ← Login coach
├── components/
│   ├── PortalCliente/
│   │   ├── DashboardCliente.tsx           ← 🆕 Dashboard con tabs
│   │   ├── MiPlan.tsx                     ← 🆕 Plan con comidas + macros
│   │   ├── CheckInForm.tsx                ← 🆕 Formulario check-in
│   │   ├── ProgresoCharts.tsx             ← 🆕 Gráficos SVG
│   │   └── NotasCoach.tsx                 ← 🆕 Notas del coach
│   ├── AjusteMacrosIA.tsx                 ← 🆕 Ajuste macros con IA
│   ├── InformeSemanal.tsx                 ← 🆕 Informe semanal auto
│   ├── HistorialDietasIA.tsx              ← 🆕 Timeline dietas IA
│   ├── PlanificacionCalendario.tsx        ← 🆕 Calendario planificación
│   ├── ListaCompra.tsx                    ← 🆕 Lista de la compra
│   ├── CuestionarioCreador.tsx            ← Editor de preguntas
│   ├── FormularioCliente.tsx              ← Formulario público
│   ├── RespuestasClientes.tsx             ← Estados extendidos
│   ├── ClienteEditar.tsx                  ← Editor datos cliente
│   ├── Sidebar.tsx                        ← Navegación
│   ├── training/PlantillaEntrenoSelector.tsx ← Selector plantillas entreno
│   └── ui/ (Modal.tsx, Toast.tsx)         ← Componentes reutilizables
├── lib/
│   ├── deepseek.ts                        ← 🆕 3 funciones IA (dieta, informe, macros)
│   ├── supabase.ts                        ← Cliente Supabase
│   ├── utils.ts                           ← 🆕 +generarListaCompra()
│   ├── foods-data.ts                      ← Datos alimentos
│   └── useNotificaciones.ts               ← Hook polling notificaciones
├── types/index.ts                         ← Tipos completos
├── scripts/
│   ├── seed-plantillas.ts                 ← Seed plantillas
│   └── importar-recetas-csv.ts            ← Importación CSV
└── (archivos SQL)
    ├── supabase_schema.sql                ← Schema completo (19 tablas)
    ├── seed_plantillas_dietas.sql          ← SQL seed plantillas
    └── seed_alimentos.sql                 ← Seed alimentos
```

---

## 🧠 FLUJO COMPLETO (cómo encaja todo)

```
Coach crea cuestionario → Copia link público
       ↓
Cliente rellena formulario (sin auth) → Respuesta guardada como "nueva"
       ↓
Coach ve respuesta en /respuestas → Click "Generar dieta"
       ↓
DeepSeek V3 procesa (datos cliente + plantillas + recetas) → Plan creado
       ↓
Estado → "dieta_lista" → Coach revisa en /dietas/[id] → Ajusta si necesita
       ↓
Coach aprueba → codigo_publico auto-generado → Estado "dieta_aprobada"
       ↓
Cliente accede en /cliente/[codigo] → Portal completo:
  ├── 📋 Mi Plan (comidas, macros, entreno, PDF)
  ├── 📝 Check-in semanal (sliders adherencia/energía/sueño)
  └── 📊 Progreso (gráficos peso + adherencia)
       ↓
Coach en /clientes/[id]:
  ├── 📋 Información (datos, planes, seguimiento, notas)
  ├── 📅 Planificación (calendario, fecha revisión)
  ├── 🧠 Historial IA (timeline de dietas generadas)
  ├── ⚡ Ajuste Macros (recalcular con IA)
  └── 📋 Informe Semanal (DeepSeek analiza última semana)
```

---

## 📝 CAMBIOS DE ESTA SESIÓN (26-04-2026)

### 🆕 Funcionalidades implementadas (no documentadas antes)

#### Portal Cliente Avanzado
- [`DashboardCliente.tsx`](nutricoach/components/PortalCliente/DashboardCliente.tsx) — Dashboard con 3 tabs (plan/checkin/progreso)
- [`MiPlan.tsx`](nutricoach/components/PortalCliente/MiPlan.tsx) — Plan nutricional + entreno + PDF
- [`CheckInForm.tsx`](nutricoach/components/PortalCliente/CheckInForm.tsx) — Check-in semanal con sliders
- [`ProgresoCharts.tsx`](nutricoach/components/PortalCliente/ProgresoCharts.tsx) — Gráficos SVG peso + adherencia
- [`NotasCoach.tsx`](nutricoach/components/PortalCliente/NotasCoach.tsx) — Notas visibles para cliente
- [`app/cliente/[codigo]/page.tsx`](nutricoach/app/cliente/[codigo]/page.tsx) — Punto de entrada al portal

#### APIs Públicas del Portal
- [`/api/cliente/[codigo]/dashboard/route.ts`](nutricoach/app/api/cliente/%5Bcodigo%5D/dashboard/route.ts) — GET datos completos
- [`/api/cliente/[codigo]/checkin/route.ts`](nutricoach/app/api/cliente/%5Bcodigo%5D/checkin/route.ts) — POST check-in
- [`/api/cliente/[codigo]/notas/route.ts`](nutricoach/app/api/cliente/%5Bcodigo%5D/notas/route.ts) — GET notas coach

#### Inteligencia Artificial (DeepSeek)
- [`deepseek.ts`](nutricoach/lib/deepseek.ts:191) — `InformeSemanal` interface
- [`deepseek.ts`](nutricoach/lib/deepseek.ts:203) — `construirPromptInformeSemanal()` — Prompt para informe
- [`deepseek.ts`](nutricoach/lib/deepseek.ts:254) — `generarInformeSemanalIA()` — Llamada DeepSeek
- [`deepseek.ts`](nutricoach/lib/deepseek.ts:309) — `SugerenciaMacros` interface
- [`deepseek.ts`](nutricoach/lib/deepseek.ts:321) — `construirPromptAjusteMacros()` — Prompt ajuste
- [`deepseek.ts`](nutricoach/lib/deepseek.ts:389) — `recalcularMacrosIA()` — Llamada DeepSeek
- [`/api/clientes/[id]/informe-semanal/route.ts`](nutricoach/app/api/clientes/%5Bid%5D/informe-semanal/route.ts) — Endpoint informe
- [`/api/clientes/[id]/recalcular-macros/route.ts`](nutricoach/app/api/clientes/%5Bid%5D/recalcular-macros/route.ts) — Endpoint macros
- [`/api/clientes/[id]/historial-ia/route.ts`](nutricoach/app/api/clientes/%5Bid%5D/historial-ia/route.ts) — Historial dietas IA

#### Componentes IA
- [`InformeSemanal.tsx`](nutricoach/components/InformeSemanal.tsx) — UI informe semanal
- [`AjusteMacrosIA.tsx`](nutricoach/components/AjusteMacrosIA.tsx) — UI ajuste macros
- [`HistorialDietasIA.tsx`](nutricoach/components/HistorialDietasIA.tsx) — Timeline historial

#### Planificación y UX
- [`PlanificacionCalendario.tsx`](nutricoach/components/PlanificacionCalendario.tsx) — Calendario visual + fecha revisión
- [`ListaCompra.tsx`](nutricoach/components/ListaCompra.tsx) — Lista de la compra agrupada
- [`lib/utils.ts`](nutricoach/lib/utils.ts:151) — `generarListaCompra()` función

#### Página Detalle Cliente
- [`app/clientes/[id]/page.tsx`](nutricoach/app/clientes/[id]/page.tsx) — Página completa con 4 tabs

#### Tablas SQL añadidas al schema
- `checkins` — Check-ins semanales
- `notas_coach` — Notas del coach
- `plantillas_entrenamiento` — Plantillas de entreno
- `plantilla_sesiones` — Sesiones de plantilla
- `plantilla_sesion_ejercicios` — Ejercicios de sesión
- `fecha_proxima_revision` en `clientes`

---

## 📞 PRÓXIMA SESIÓN

Cuando vuelvas, dile a Claude: **"seguir con el plan"**

Claude leerá este documento automáticamente para retomar el contexto.

**Si el servidor local no responde:**
```bash
cd ~/Desktop/Carlos/CLAUDE/NUTRICION/nutricoach
lsof -ti:3000 | xargs kill -9 2>/dev/null; npm run dev
```

**Checklist rápida para la próxima sesión:**
1. ✅ Sistema automático de recetas (scrape + backfill + UI) implementado
2. ✅ Backfill ejecutado (no había recetas incompletas)
3. ✅ DEEPSEEK_API_KEY configurada en `.env.local`
4. ✅ Knowledge Base seed: 18 fichas + 30 estudios científicos
5. ✅ Migraciones SQL ejecutadas (descripcion_porcion, onboarding, revisado_por_coach)
6. ✅ Sistema de onboarding autónomo completo (invitaciones + registro + callback)
7. ✅ Bug fix OAuth callback: redirect `/portal` → `/cliente`, session sync añadida
8. ✅ Build compila sin errores
9. ⏳ **Probar flujo onboarding end-to-end**: invitación → registro → portal
10. ⏳ **Probar generación dieta IA con contexto científico**
11. ⏳ Actualizar `supabase_schema.sql` con nuevas tablas

---

## 🐛 AUDITORÍA DE CÓDIGO (28-04-2026)

Se ha realizado una auditoría completa del código fuente. Los hallazgos están documentados en:
- [`salidas/28-04-2026_AUDITORIA_COMPLETA.md`](nutricoach/salidas/28-04-2026_AUDITORIA_COMPLETA.md)

### 🔴 Bugs Críticos Detectados

| # | Bug | Archivos | Estado |
|---|-----|----------|--------|
| 1 | **Uso incorrecto de cliente Supabase browser en API routes** — 9 rutas importaban `@/lib/supabase` en vez de `createServerSupabase()` | `alimentos/route.ts`, `alimentos/[id]/route.ts`, `guardar-alimento/route.ts`, `informe-semanal/route.ts`, `recalcular-macros/route.ts`, `historial-ia/route.ts`, `clientes/[id]/route.ts`, `checkins/route.ts`, `ia-logger.ts` | ✅ **Corregido** — se cambió a `createServerSupabase()` o `supabaseAdmin` según el caso |
| 2 | **Endpoints públicos sin autenticación** — `/api/cliente/[codigo]/**` accesibles sin sesión | `dashboard/route.ts`, `checkin/route.ts`, `checkins/route.ts` | ⚠️ Diseño intencional (portal público por código) |
| 3 | **Botón "Copiar resumen" dispara POST duplicado** — Cada clic regeneraba un informe en DeepSeek | `InformeSemanal.tsx` | ✅ **Corregido** — eliminado el `fetch()` innecesario |
| 4 | **Validación de macros salta con NaN** — Si `kcal_objetivo` es `null/undefined`, la validación fallaba silenciosamente | `generar-dieta-ia/route.ts` | ✅ **Corregido** — añadida guarda de validación |

### 🟡 Bugs Medios

| # | Bug | Archivos | Estado |
|---|-----|----------|--------|
| 5 | Modelo DeepSeek hardcodeado (`deepseek-chat`) — ahora configurable vía `DEEPSEEK_MODEL` en `.env` | `deepseek.ts` | ✅ **Corregido** — 3 ocurrencias reemplazadas por `DEEPSEEK_MODEL` |
| 6 | Lógica `es_generado_ia` no fiable (depende de asociación indirecta con respuesta) | `historial-ia/route.ts`, `supabase_schema.sql`, `types/index.ts`, `generar-dieta-ia/route.ts`, `dietas/nueva/page.tsx` | ✅ **Corregido** — Añadido campo `generado_por_ia` boolean a `planes_nutricion`. Poblado como `true` al crear dieta vía IA y `false` al crear manualmente. El historial ahora usa el campo directo de BD en vez de `!!respuesta` |
| 7 | Coach ID vacío (`''`) en logs IA si falla autenticación | `informe-semanal/route.ts`, `recalcular-macros/route.ts` | ✅ **Corregido** — ahora devuelve 401 si no hay usuario |

### 🔵 Bugs Leves

| # | Bug | Archivos | Estado |
|---|-----|----------|--------|
| 8 | Tipo `CheckIn` tenía `hambre` (no usado), faltaba `adherencia` | `types/index.ts` | ✅ **Corregido** — reemplazado `hambre` por `adherencia` |
| 9 | Fecha check-in en UTC podía diferir de zona local (España UTC+2) | `checkin/route.ts` | ✅ **Corregido** — ahora usa `toLocaleDateString('en-CA')` |
| 10 | Enlaces en Sidebar a rutas que pueden no existir (`/dietas/plantillas`, etc.) | `Sidebar.tsx` | ✅ **Verificado** — todas las rutas existen en el sistema de archivos (`/dietas/`, `/dietas/plantillas`, `/dietas/alimentos`, `/recetas`, `/entrenos/plantillas`) |

### ⚪ Sugerencias de mejora

| # | Mejora | Archivos | Estado |
|---|--------|----------|--------|
| 11 | Memoizar `getDietaActiva()` / `getEntrenoActivo()` con `useMemo` | `PlanificacionCalendario.tsx` | ✅ **Corregido** — reemplazadas funciones por `useMemo` con dependencias |
| 12 | Falta ErrorBoundary en componentes críticos | `ListaCompra.tsx`, `PlanificacionCalendario.tsx`, `ProtocoloCompeticion.tsx` | ✅ **Corregido** — creado `ErrorBoundary` en `components/ui/ErrorBoundary.tsx` y envueltos los componentes críticos en `clientes/[id]/page.tsx` y `dietas/[id]/page.tsx` |
| 13 | Capturar `usage.total_tokens` de DeepSeek en el logger | `deepseek.ts` + `ia-logger.ts` | ✅ **Corregido** — `generarDietaConIA`, `generarInformeSemanalIA`, `recalcularMacrosIA` ahora devuelven `{ data, total_tokens }`. Los 3 endpoints lo pasan al logger como `tokensUsados` |

### 🐛 AUDITORÍA DE CÓDIGO (29-04-2026) — Sistema Automático de Recetas

#### 🔴 Bugs Críticos Detectados

| # | Bug | Archivos | Estado |
|---|-----|----------|--------|
| 14 | **`scrapeURL()` sin timeout en API route** — La función `scrapeURL()` en la API route no tenía `AbortSignal.timeout()`, lo que podía colgar el request hasta el timeout del serverless (60s Vercel). El backfill script sí lo tenía (15s) pero la API route no | [`scrape-receta/route.ts:87`](nutricoach/app/api/scrape-receta/route.ts:87) | ✅ **Corregido** — añadido `AbortSignal.timeout(15000)` |
| 15 | **`head: true` en backfill rompe detección de ingredientes** — `supabase.from('receta_ingredientes').select('id', { count: 'exact', head: true })` con `head: true` devuelve `data: null` siempre, por lo que `existingIngs.length > 0` era siempre `false`. El script re-scrapeaba recetas aunque ya tuvieran ingredientes | [`backfill-recetas.ts:341`](nutricoach/scripts/backfill-recetas.ts:341) | ✅ **Corregido** — cambiado a `.select('id')` sin `head`. |

#### 🔵 Bugs Leves

| # | Bug | Archivos | Estado |
|---|-----|----------|--------|
| 16 | **`onBlur` dispara scrape al hacer clic en "O crea una receta desde cero"** — El orden de eventos JS (`blur` → `click`) causaba que al hacer clic en el botón para ir al formulario completo, el `onBlur` del input disparaba un scrape no deseado. Esto ocurría porque el botón no es foco del input, así que blur se dispara antes que el click del botón | [`recetas/nueva/page.tsx:367`](nutricoach/app/recetas/nueva/page.tsx:367) | ✅ **Corregido** — añadido `saltarBlurRef` que se setea `true` en el `onClick` del botón. `handleBlur()` comprueba el flag antes de disparar el scrape. |

---

## 🆕 Scraping Multi-Supermercado — Diagnóstico y Fix (14-15/05/2026)

### Problema: `ReferenceError: __name is not defined`

**Causa raíz:** El compilador `tsx` añade un helper `__name()` a funciones flecha/nombradas compiladas. Cuando Playwright serializa estas funciones vía `page.evaluate(() => { ... })`, el código serializado referencia `__name`, que no existe en el contexto del navegador.

**Fix:** Convertir `page.evaluate(() => { ... })` → `page.evaluate(\`(() => { ... })()\`)` en los 6 scrapers Playwright pendientes.

### Scrapers diagnosticados y reparados

| Supermercado | Estado | Detalle |
|---|---|---|
| **Eroski** | ✅ Reescrito | Homepage-only con slick-slider carousels. Selectores: `.product-container.product-item`, `.product-name`, `.product-price-value`. 12 productos extraídos en test. Categorías redirigen a 404 (Apache Tapestry). |
| **Bonpreu** | ⚠️ Fix __name aplicado | SPA Next.js con AWS WAF. Categorías con UUID. 78 `.product-card-container` skeletons — la SPA no hidrata en headless. Pendiente investigar API interna o login-gated. |
| **Esclat** | ⚠️ Fix __name aplicado | Misma plataforma que Bonpreu. Mismo problema de skeletons. |
| **Hipercor** | ❌ Bloqueado | Akamai WAF — "Access Denied" en Playwright headless. Mismo grupo que El Corte Inglés. |
| **El Corte Inglés** | ❌ Bloqueado | Akamai WAF — "Access Denied" en Playwright headless. |
| **Carrefour** | ⏳ Diagnóstico en curso (script atascado) | Ya funciona con homepage + selectores actualizados (54 productos). El diagnóstico de categorías no terminó — posiblemente atascado en Cloudflare. |

### Diagnósticos creados (15-05-2026)

- [`scripts/diagnosticar-eroski.ts`](nutricoach-modulos/scripts/diagnosticar-eroski.ts) — Selectores reales descubiertos + test funcional
- [`scripts/diagnosticar-bonpreu-esclat.ts`](nutricoach-modulos/scripts/diagnosticar-bonpreu-esclat.ts) — Primer pase: `product-card-container`, categorías UUID
- [`scripts/diagnosticar-bonpreu-profundo.ts`](nutricoach-modulos/scripts/diagnosticar-bonpreu-profundo.ts) — Análisis DOM profundo: `data-test="products-page"`, `data-test="fop-body"`
- [`scripts/diagnosticar-bonpreu-final.ts`](nutricoach-modulos/scripts/diagnosticar-bonpreu-final.ts) — Confirmación: 78 skeletons, SPA no hidrata
- [`scripts/diagnosticar-bonpreu-api.ts`](nutricoach-modulos/scripts/diagnosticar-bonpreu-api.ts) — Multi-estrategia: descubrió `__INITIAL_STATE__` (718KB), JSON-LD (126 productos), `__URQL_DATA__`
- [`scripts/diagnosticar-bonpreu-api2.ts`](nutricoach-modulos/scripts/diagnosticar-bonpreu-api2.ts) — Captura de respuestas API (solo graphql capturado)
- [`scripts/diagnosticar-bonpreu-api3.ts`](nutricoach-modulos/scripts/diagnosticar-bonpreu-api3.ts) — **BREAKTHROUGH**: Capturó 10 llamadas API completas con headers y bodies. API `PUT /api/webproductpagews/v6/products` devuelve productos completos (nombre, marca, precio, imagen, promociones)
- [`scripts/diagnosticar-hipercor-eci.ts`](nutricoach-modulos/scripts/diagnosticar-hipercor-eci.ts) — Ambos bloqueados por Akamai
- [`scripts/diagnosticar-carrefour-categorias.ts`](nutricoach-modulos/scripts/diagnosticar-carrefour-categorias.ts) — Diagnóstico de categorías (atascado, proceso kill)

### API Bonpreu descubierta

La SPA de Bonpreu/Esclat usa dos APIs REST que devuelven productos completos en JSON (no solo DOM skeletons):

1. **`GET /api/webproductpagews/v5/product-pages?decoratedOnly=true&limit=27&tag=web&tag=lohp`**
   - Devuelve `{ productGroups: [{ type, products: [{ productId, product: { name, brand, price, ... } }] }] }`
   - Productos destacados con datos COMPLETOS (303KB gzipped)
   
2. **`PUT /api/webproductpagews/v6/products`**
   - Body: JSON array de 24 UUIDs → `{ products: [{ productId, name, brand, packSizeDescription, price: { amount, currency }, unitPrice, image, promotions, promoPrice }] }`
   - Headers requeridos: `x-csrf-token`, `client-route-id`, `page-view-id`, `ecom-request-source`, `ecom-request-source-version`
   - Respuesta: ~280-300KB gzipped con 24 productos completos
   - Pasa por CloudFront (`x-cache: Miss from cloudfront`, `x-amz-cf-id`)

### Archivos modificados

- [`bonpreu.ts`](nutricoach-modulos/lib/scraping/supermercados/bonpreu.ts) — **REESCRITO**: ahora usa interceptación de red (`page.on('response')`) para capturar APIs `v5/product-pages` y `v6/products` en lugar de DOM scraping
- [`esclat.ts`](nutricoach-modulos/lib/scraping/supermercados/esclat.ts) — **REESCRITO**: mismo enfoque que bonpreu (misma plataforma)
- [`hipercor.ts`](nutricoach-modulos/lib/scraping/supermercados/hipercor.ts) — Fix __name + header "BLOQUEADO Akamai"
- [`el-corte-ingles.ts`](nutricoach-modulos/lib/scraping/supermercados/el-corte-ingles.ts) — Fix __name + header "BLOQUEADO Akamai"
- [`eroski.ts`](nutricoach-modulos/lib/scraping/supermercados/eroski.ts) — Reescrito desde cero (sesión anterior)

### ✅ COMPLETADO EN SESIÓN SIGUIENTE (16-05-2026) — Sesión 15 — Migraciones BD y reconciliación

#### 🔧 Auditoría y migraciones SQL completadas
- [x] **Auditoría de 29 SQL files** contra BD real columna a columna — verificado que 24 ya estaban aplicados
- [x] **Ejecutado** [`supabase_productos_vs_alimentos.sql`](nutricoach-modulos/supabase_productos_vs_alimentos.sql) (pendiente: columna `preferido`, índices URL únicos, vistas)
- [x] **Ejecutado** [`seed_precios_supermercado.sql`](nutricoach-modulos/seed_precios_supermercado.sql) (precios básicos 20+ alimentos en 7 supermercados)
- [x] **Ejecutado** [`supabase_fix_rls_alimentos.sql`](nutricoach-modulos/supabase_fix_rls_alimentos.sql) (políticas RLS públicas)
- [x] **Instalada extensión** `unaccent` para matching sin acentos
- [x] **Creada función** `reconciliar_alimento()` — matching progresivo 5 niveles

#### 🔗 Reconciliación de vinculación (Scraping → Alimentos)
- [x] **Ejecutado** [`supabase_reconciliacion_vinculacion.sql`](nutricoach-modulos/supabase_reconciliacion_vinculacion.sql) completo
- [x] **Re-apuntados** productos_supermercado → alimentos seed correctos
- [x] **Eliminados 1.206 duplicados huérfanos** sin referencias
- [x] **`match_alimento` mejorada**: de 3 pasos → 6 pasos con priorización de seed

#### 📊 Estado final vinculación
| Métrica | Valor |
|---------|-------|
| Productos totales | 7.528 (100% vinculados) |
| → Alimentos con macros | 3.259 (43.3%) |
| → Alimentos sin macros (legítimos: sal, especias, agua, etc.) | 4.185 (55.6%) |
| → Alimentos duplicados scraping (es_generico=true) | 84 (1.1%) — requieren re-scrape |
| Alimentos duplicados restantes | 1.625 (pendientes de re-scrape para re-vincular) |

### Pendiente para próxima sesión

- [x] ~~Verificar Bonpreu/Esclat~~ ✅ **BREAKTHROUGH HTTP DIRECTO (v3)**: APIs funcionan con fetch() directo. Scrapers reescritos a modo híbrido (1 PW + HTTP directo)
- [x] ~~**Lidl v3**: Ejecutar scraper completo (60 términos en 4 lotes)~~ ✅ **EJECUTADO**: 429 productos únicos en 4.0 min, 0 scraping errors
- [x] ~~**Lidl v3**: Re-scrapear con pipeline BD~~ ✅ **EJECUTADO**: 16 alimentos nuevos, 147 actualizados, 263 historico
- [x] ~~**Lidl**: Filtro NO_COMESTIBLE_KEYWORDS ampliado~~ ✅ **COMPLETADO**: ~260 keywords (de ~155), 27 falsos positivos eliminados
- [ ] **Re-scrapear supermercados** para re-vincular ~84 productos que aún apuntan a duplicados (usará `match_alimento` v2 mejorado)
- [ ] **Hipercor/El Corte Inglés**: Akamai sigue bloqueando. Diagnóstico ejecutado (15-05-2026): "Access Denied" en homepage. Sin API interna descubierta.
- [ ] Dashboard de rentabilidad/ahorro con la vista `top_precios_escandallo`
- [ ] Automatización con Vercel Cron Jobs (plan Pro)
- [ ] Refinar normalizador para subir el ~24% de match exacto (más sinónimos)
- [ ] Histórico de precios y tendencias (gráficos, alertas)
- [ ] **Mercadona**: Re-scrapear (~2,895 productos, posible desactualización)
- [ ] **Lidl**: Re-ejecutar trimestralmente (75 productos, mantener precios actualizados)
- [ ] Build de verificación: `npx next build`

---

**Última actualización:** 16-05-2026 (cierre sesión)
**Responsable:** Roo (Sesión 15 — Migraciones BD completas + Reconciliación ✅)
