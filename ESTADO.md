# ESTADO NutriCoach — 17-05-2026 (Sesión 18 — Fase 3b completa · Próxima: Fase 4 cliente)

> Leer al inicio de CADA sesión. Documento dinámico actualizado al cerrar (17-05-2026 — sesión 18).
> **Este archivo vive en `nutricoach/` (rama main).** El trabajo de scraping está en `nutricoach-modulos/` (rama feature/modulos).

---

## 🚀 PRÓXIMA SESIÓN — Fase 4: Experiencia del cliente

### Contexto previo — qué hay construido ya

El flujo de registro está completo pero **desconectado**:

```
/registro/[token] → POST /api/registro-invitacion → router.push('/onboarding') ✅
/onboarding       → 6 pasos (segmento, objetivo, cuerpo, actividad, dieta, cocina) ✅
/onboarding/perfil → 8 pasos profundos (motivación, historial, timing, salud, deportes) ✅
lib/emails/welcome.ts → email HTML + sendWelcomeEmail() con Resend ✅ (listo, solo falta RESEND_API_KEY)
```

**Lo que FALTA — 4 tareas concretas:**

---

#### TAREA 1 — Campo `onboarding_completado` en `clientes` + redirección automática

**Problema:** Cuando un cliente entra al portal sin haber completado el onboarding, lo ve vacío. No hay redirect ni aviso.

**SQL a aplicar:**
```sql
ALTER TABLE public.clientes ADD COLUMN IF NOT EXISTS onboarding_completado bool NOT NULL DEFAULT false;
```

**Archivos a tocar:**
- `app/api/onboarding/perfil/route.ts` (línea ~75, justo antes del `return`): añadir `UPDATE clientes SET onboarding_completado = true WHERE id = cliente.id`
- `components/PortalCliente/DashboardCliente.tsx`: al montar, verificar `onboarding_completado`. Si false → mostrar banner o redirect a `/onboarding`
- `types/index.ts` — añadir `onboarding_completado?: boolean` al tipo `Cliente`

---

#### TAREA 2 — Email de bienvenida operativo

**Problema:** `sendWelcomeEmail()` ya existe en `lib/emails/welcome.ts` y ya se llama en `app/api/registro-invitacion/route.ts`, pero necesita `RESEND_API_KEY` configurada.

**Pasos:**
1. Crear cuenta en resend.com (gratuito hasta 3.000 emails/mes)
2. Añadir a `.env.local`:
   ```
   RESEND_API_KEY=re_xxxxxxxxxxxxxxxxxxxx
   RESEND_FROM_EMAIL=noreply@tudominio.com   # o usar onboarding@resend.dev en pruebas
   RESEND_FROM_NAME=NutriCoach
   NEXT_PUBLIC_APP_URL=https://nutricoach-delta.vercel.app
   ```
3. Añadir las mismas variables en Vercel → Settings → Environment Variables
4. El email ya lleva al `/login` — cambiar el botón para que lleve directamente a `/onboarding` si `onboarding_completado = false`, o a `/mi-portal` si ya lo completó

---

#### TAREA 3 — Banner "Completa tu perfil" en el portal del cliente

**Problema:** Si el cliente entra al portal con onboarding sin completar, el plan está vacío y no sabe qué hacer.

**Dónde:** `components/PortalCliente/DashboardCliente.tsx`

**Comportamiento:**
- Si `onboarding_completado === false` → mostrar card prominente encima de todo con CTA "Completa tu perfil en 5 min" → link a `/onboarding`
- Si ya hay un plan generado (`planes.length > 0`) pero onboarding incompleto → igual, mostrar el plan pero el banner persiste hasta completar

---

#### TAREA 4 — Badge "Pendiente onboarding" en la ficha del coach

**Dónde:** `app/clientes/[id]/page.tsx` — ya tiene `revisado_por_coach`. Añadir indicador visual si `onboarding_completado = false`.

**Dónde en el dashboard:** `app/dashboard/page.tsx` — ya hay sección "Estado". Añadir contador "X clientes sin onboarding".

---

### Orden de ejecución en la próxima sesión

1. **SQL** — `ALTER TABLE clientes ADD COLUMN onboarding_completado` → aplicar vía MCP
2. **API** — marcar `onboarding_completado = true` al finalizar `/api/onboarding/perfil`
3. **Tipo** — añadir campo en `types/index.ts`
4. **Portal cliente** — banner de onboarding pendiente en `DashboardCliente`
5. **Email** — Carlos configura `RESEND_API_KEY` en `.env.local` + Vercel, luego verificar que llega
6. **Ficha coach + dashboard** — indicador visual clientes sin onboarding

### Después de Fase 4 → Fase 5 (calidad recetas/alimentos)
- Enriquecimiento alimentos: `cd nutricoach-modulos && node scripts/enriquecer-alimentos.mjs --limite=100` (7 pases)
- 7 recetas con macros altas → Carlos revisa porciones en UI
- Imágenes recetas: `node scripts/regenerar-flux-masivo.mjs --genera` (cuando OpenAI sin bloqueo billing)

---

## 📍 DÓNDE ESTAMOS

**Fase:** Sesión 18 completada. Fase 3b (Competiciones + Detección automática de fase deportiva) implementada y commiteada (`3de884f`). El coach puede registrar competiciones para cada cliente. El sistema detecta automáticamente la fase deportiva (base → construcción → pico → tapering → race day → recuperación) según los días restantes hasta la competición. Muestra macros objetivos por fase y disciplina (14 deportes). Alerta visual anti-tapering activa cuando quedan 1-7 días.

**Migración SQL Fase 3b:** aplicada en Supabase vía MCP. No requiere acción manual.

---

## ✅ COMPLETADO (17-05-2026) — Sesión 18 — Fase 3b: Competiciones + Fase Deportiva

**Commit:** `3de884f`

**Archivos nuevos:**
- [`supabase_fase3b_competiciones.sql`](../supabase_fase3b_competiciones.sql) — migración ya aplicada en Supabase:
  - Tabla `competiciones`: cliente_id, nombre, disciplina (14 opciones), fecha, objetivo, tiempo_objetivo_min, activo
  - Vista `fase_deportiva_cliente`: calcula fase_actual (8 estados) y alerta_tapering_activa en tiempo real
  - RLS: coach gestiona todo, cliente solo ve las propias
- [`app/api/clientes/[id]/fase-deportiva/route.ts`](app/api/clientes/[id]/fase-deportiva/route.ts) — GET (fase activa + lista), POST (crear), DELETE (soft delete)
- [`lib/alto-rendimiento/macros-por-fase.ts`](lib/alto-rendimiento/macros-por-fase.ts) — macros g/kg por 14 disciplinas × 8 fases, colores por fase, protocolos intra-carrera
- [`components/CompeticionesManager.tsx`](components/CompeticionesManager.tsx) — CRUD competiciones + FaseDeportivaCard inline (fase actual coloreada, alerta tapering, macros absolutos si hay peso)

**Archivos modificados:**
- [`app/clientes/[id]/page.tsx`](app/clientes/[id]/page.tsx) — CompeticionesManager integrado sobre ProtocoloCompeticion en tab Competición

**Fases deportivas detectadas automáticamente:**
| Días hasta carrera | Fase | Color |
|-------------------|------|-------|
| >90 | Base | Azul claro |
| 60–90 | Construcción | Verde |
| 20–60 | Pico | Naranja |
| 7–20 | Pico máximo | Rojo claro |
| 3–7 | Tapering ⚠️ | Ámbar (alerta) |
| 1–3 | Carrera inminente | Rojo |
| 0 | Race Day | Dorado |
| -10–0 | Recuperación | Lila |
| <-10 | Finalizada | Gris |

---

## ✅ COMPLETADO (17-05-2026) — Sesión 17 — Fase 3: Training Load Score

**Commit:** `e5d3c42`

**Archivos nuevos:**
- [`supabase_fase3_tls.sql`](supabase_fase3_tls.sql) — **ejecutar en Supabase antes de usar**:
  - Tabla `registros_entreno`: `cliente_id`, `fecha`, `tipo_actividad`, `duracion_min`, `rpe`, `tls_diario` (columna generada), `notas`
  - `tls_diario = duracion_min × (rpe/10)²` calculado en BD
  - Campo `tls_umbral_carga_alta` en `clientes` (default 80 pts/semana)
  - Vista `tls_por_cliente`: TLS semanal por cliente
  - RPC `get_tls_dashboard(p_cliente_id)`: TLS actual, media 4 sem, semáforo, sesiones recientes
- [`app/api/cliente/[codigo]/registrar-entreno/route.ts`](app/api/cliente/[codigo]/registrar-entreno/route.ts) — POST (cliente registra sesión) + GET (obtiene TLS dashboard)
- [`app/api/clientes/[id]/tls/route.ts`](app/api/clientes/[id]/tls/route.ts) — GET (coach ve TLS de un cliente) + PATCH (actualiza umbral)
- [`components/PortalCliente/TLSGauge.tsx`](components/PortalCliente/TLSGauge.tsx) — barra de progreso con semáforo 4 estados: bajo (verde) / normal (azul) / alto (ámbar) / muy_alto (rojo)
- [`components/PortalCliente/RegistrarEntrenoModal.tsx`](components/PortalCliente/RegistrarEntrenoModal.tsx) — 9 tipos actividad, slider RPE 1-10, preview TLS calculado en tiempo real

**Archivos modificados:**
- [`components/PortalCliente/DashboardCliente.tsx`](components/PortalCliente/DashboardCliente.tsx) — nuevo tab "Carga" (icono Dumbbell) + integración TLSGauge + RegistrarEntrenoModal
- [`components/ClienteEditar.tsx`](components/ClienteEditar.tsx) — campo `tls_umbral_carga_alta` editable, guardado en BD

**Semáforo TLS:**
| Estado | Porcentaje del umbral | Color |
|--------|----------------------|-------|
| Bajo | <50% | Verde |
| Normal | 50–100% | Azul |
| Alto | 100–130% | Ámbar |
| Muy alto (sobreentrenamiento) | >130% | Rojo |

**Fórmula:** `TLS_diario = duracion_min × (rpe / 10)²`
- 60 min RPE 7 → 60 × 0.49 = **29.4 pts**
- 90 min RPE 9 → 90 × 0.81 = **72.9 pts**

---

## ✅ COMPLETADO (17-05-2026) — Sesión 16 — Fases 2a + 2b

### 🔷 Fase 2a — Motor de personalización IA ✅

**Commit:** `4d4ea72` (con auditoría bugs de sesión 15)

**Tablas SQL nuevas (migración `fase2_personalizacion_e_intercambios`):**
- `perfil_alimentario_cliente` — nivel cocina, tiempo disponible, ingredientes preferidos/rechazados, patrones aprendidos (JSONB), electrodomésticos
- `feedback_comidas_generadas` — historial accept/reject por cliente y tipo_comida
- `intercambios_historial` — qué alimentos ha swapeado cada cliente y cuántos gramos

**Archivos creados:**
- [`lib/personalizacion/generador-comidas.ts`](lib/personalizacion/generador-comidas.ts) — llama a DeepSeek V4 Pro (temp 0.6, max_tokens 1000), devuelve `ComidaGenerada` con nombre, ingredientes, instrucciones, macros estimados, tip
- [`lib/personalizacion/actualizar-perfil.ts`](lib/personalizacion/actualizar-perfil.ts) — `obtenerOCrearPerfil()` (bootstrap desde onboarding) + `procesarFeedback()` (actualiza ingredientes_preferidos/rechazados + patrones_aprendidos)
- [`app/api/personalizacion/generar/route.ts`](app/api/personalizacion/generar/route.ts) — POST: auth → restricciones onboarding → perfil → DeepSeek → `{ comida }`
- [`app/api/personalizacion/feedback/route.ts`](app/api/personalizacion/feedback/route.ts) — POST: auth → `procesarFeedback()`
- [`components/personalizacion/GenerarComidaModal.tsx`](components/personalizacion/GenerarComidaModal.tsx) — modal cliente: 2 fases (inicio / resultado), muestra receta generada, botones aceptar/rechazar/regenerar, feedback inline

### 🔷 Fase 2b — Intercambios inteligentes ✅

**Archivos creados:**
- [`app/api/intercambios/route.ts`](app/api/intercambios/route.ts) — GET: busca alternativas macroequivalentes (misma categoría, kcal ±15%, prot ±20%); fallback si <2 resultados (±22.5%/±30%, sin filtro categoría), max 3 alternativas
- [`app/api/intercambios/elegir/route.ts`](app/api/intercambios/elegir/route.ts) — POST: guarda en `intercambios_historial`
- [`components/personalizacion/AlternativasModal.tsx`](components/personalizacion/AlternativasModal.tsx) — modal cliente: muestra original + hasta 3 alternativas con gramos equivalentes calculados para mantener las mismas kcal

### 🔷 MiPlan.tsx — Integración de modales ✅

**Archivo:** [`components/PortalCliente/MiPlan.tsx`](components/PortalCliente/MiPlan.tsx)

Cambios:
- `AlimentoEnComida` interface: añadido `alimento_id?: string`
- Estado local `planLocal` que replica `plan` prop y se actualiza al elegir alternativa
- `modalAlternativas` state + `handleElegirAlternativa()` — actualiza `planLocal` con el alimento alternativo
- `modalGenerar` state + `handleAceptarComida()` — toast de confirmación
- Botón `ArrowLeftRight` (↔ Cambiar) inline en cada fila de alimento — solo visible cuando `alimento_id` existe
- Botón `Sparkles` (✨ Generar alternativa con IA) al final de cada comida expandida
- Ambos modals renderizados condicionalmente al final del JSX

**⚠️ Nota para el coach:** `alimento_id` solo aparece en el portal si la API de planes lo devuelve en el select de Supabase. Verificar que la query incluye `alimento_id` en `comida_alimentos`.

---

## 🔜 PRÓXIMA SESIÓN — Fase 3b: Protocolos atletas + competiciones

**Plan:** `docs/superpowers/plans/2026-05-16-nutricoach-pro-master-plan.md` → Fase 3b

**Qué hace Fase 3b:**
- Tabla `competiciones` — el coach añade las competiciones del cliente con fecha y disciplina
- Vista `fase_deportiva_cliente` — detecta automáticamente: base/construcción/pico/pico_maximo/tapering/carrera_inminente/race_day/recuperación/finalizada
- Biblioteca `lib/alto-rendimiento/macros-por-fase.ts` — macros por fase y disciplina (Hyrox, maratón, Ironman, etc.)
- API `GET /api/clientes/[id]/fase-deportiva`
- Alerta automática anti-reducción CHO en tapering
- UI para añadir/editar competiciones en ficha de cliente
- PDF "Plan de carrera" con semana de tapering, cena previa, desayuno race day, nutrición intra-carrera

**⚠️ Antes de arrancar Fase 3b:** ejecutar la SQL de Fase 3 en Supabase si no se ha hecho.

---

## ✅ COMPLETADO (16-05-2026) — Sesión 15

### 🔷 Dashboard NutriCoach — Rediseño completo ✅

**Archivo:** `app/dashboard/page.tsx` (commit `7422a5d` en main)

Widgets ELIMINADOS (obsoletos, Carlos no los usa):
- Tendencia de check-ins (LineChart)
- Clientes con/sin dieta asignada (progress bar)
- Dietas por cliente (StackedBar)
- Top clientes más activos
- Clientes sin actividad reciente
- Clientes recientes

Widgets AÑADIDOS:
- **Quick Actions**: 4 chips (Nuevo cliente, Nueva dieta, Consultas, Recetario) — links directos
- **Estado reactivo**: N sin dieta (rojo si >0) + N consultas pendientes (ámbar si >0) + "Todo al día" (verde cuando ambos 0)
- **Próximas revisiones**: sección existente mejorada

Cambios técnicos:
- Iconos: `@phosphor-icons/react` con weight `fill`. `TrendUp` (NO `TrendingUp`). `React.ElementType` para el tipo del icono en StatCardConfig.
- Limpieza de imports: eliminados todos los Lucide, `LineChart` dynamic, `FadeIn`/`StaggerList`, `StatCardPremium`

### 🔷 Lidl scraper v4 — Híbrido Playwright + gridboxes API ✅

**Archivo:** `nutricoach-modulos/lib/scraping/supermercados/lidl.ts` (commit `2b1fa57` en feature/modulos)

**Arquitectura v4:**
1. Playwright (4 lotes × 15 términos, browser nuevo por lote): busca por términos → extrae URLs → `extraerErpNumber()` → `erpMap`
2. HTTP gridboxes API (`/p/api/gridboxes/ES/es?erpNumbers=...`) en lotes de 25: `price.price`, `category`, `brand.name`, `price.packaging.text`, `canonicalPath`
3. Filtro: `category === "Food"` → alimento; `"Categorías/Hogar/..."` → descartado

**Resultados reales (ejecutado 16-05-2026):**
- 306 erpNumbers descubiertos → 126 alimentos (Food) / 180 descartados (59%)
- 4 min total, 0 errores de scraping
- Pipeline: 2 alimentos nuevos creados, 99 productos actualizados

**Bug conocido (no bloqueante):** `duplicate key value violates unique constraint "productos_supermercado_supermercado_id_alimento_id_key"` — la migración que eliminó este constraint puede no estar aplicada en Supabase. Ver sección bugs más abajo.

---

## 🐛 BUGS CONOCIDOS — Auditoría 16-05-2026

### BUG #1 — Constraint `(supermercado_id, alimento_id)` puede estar activo todavía

**Archivo:** `nutricoach-modulos/lib/scraping/index.ts`
**Síntoma:** `duplicate key value violates unique constraint "productos_supermercado_supermercado_id_alimento_id_key"` en batch insert de Lidl
**Causa probable:** La SQL migration `supabase_productos_vs_alimentos.sql` que elimina el UNIQUE constraint puede no haberse aplicado correctamente en Supabase.
**Verificación:**
```sql
SELECT constraint_name FROM information_schema.table_constraints
WHERE table_name = 'productos_supermercado' AND constraint_type = 'UNIQUE';
```
Si aparece `productos_supermercado_supermercado_id_alimento_id_key` → re-aplicar la migración (sección DROP CONSTRAINT).
**Impacto:** Algunos productos Lidl no se insertan cuando dos búsquedas distintas matchean el mismo alimento_id. No crítico pero reduce cobertura.

### BUG #2 — `app/dashboard/page.tsx` divergente en feature/modulos y feature/ui-estetica

**Contexto:** El dashboard fue rediseñado en `main` directamente (commit `7422a5d`). Sin embargo, `feature/modulos` y `feature/ui-estetica` tienen su propia versión antigua del dashboard. Al intentar mergear estas ramas a main, habrá conflicto en `app/dashboard/page.tsx`.
**Solución para DeepSeek:** Al mergear `feature/modulos` → main, en el conflicto de `app/dashboard/page.tsx` conservar siempre la versión de `main` (la nueva, con Quick Actions). NO conservar la versión de feature/modulos ni feature/ui-estetica.
**Comando:** `git checkout main -- app/dashboard/page.tsx` en el worktree durante el merge.

---

## 🔜 PRÓXIMA SESIÓN — Prioridades para DeepSeek

### Prioridad 1 — Fix constraint Lidl (15 min)
```sql
-- Verificar:
SELECT constraint_name FROM information_schema.table_constraints
WHERE table_name = 'productos_supermercado' AND constraint_type = 'UNIQUE';

-- Si existe el constraint antiguo, eliminarlo:
ALTER TABLE productos_supermercado DROP CONSTRAINT IF EXISTS productos_supermercado_supermercado_id_alimento_id_key;
```
Después re-ejecutar: `env $(cat .env.local | grep -v '^#' | xargs) npx tsx scripts/scrapear-supermercados.ts lidl`

### Prioridad 2 — Merge de worktrees a main (auditoría de conflictos)

Los worktrees `feature/modulos` y `feature/ui-estetica` tienen 38+ archivos divergentes de main. Hay que mergearlos con cuidado:

```bash
# Desde nutricoach/ (main):
git merge feature/modulos --no-ff
# En conflictos:
#   - app/dashboard/page.tsx → conservar MAIN
#   - CLAUDE.md → combinar manualmente
#   - Resto → evaluar caso por caso

git merge feature/ui-estetica --no-ff
# Misma estrategia
```

**Archivos que feature/modulos aporta que main NO tiene (no hay conflicto):**
- `lib/scraping/supermercados/lidl.ts` (v4 híbrido)
- `scripts/test-lidl-v4.ts`, `scripts/test-lidl-gridboxes.ts`
- Todo el sistema de scraping y precios

### Prioridad 3 — Fase 0: Limpieza de datos (`nutricoach-modulos/`)
```bash
cd nutricoach-modulos
node scripts/eliminar-no-alimentos.mjs     # Eliminar no-comestibles de BD
for i in 1 2 3 4 5; do node scripts/enriquecer-alimentos.mjs --limite=100; done
```

### Prioridad 4 — Fase 1: Onboarding automático
Ver plan en `docs/superpowers/plans/2026-05-16-nutricoach-pro-master-plan.md`

---

## ⚠️ INSTRUCCIONES CRÍTICAS PARA DEEPSEEK

> DeepSeek: Lee esto ANTES de tocar cualquier código.

### 1. Sistema de worktrees — qué es qué

```
nutricoach/          → rama main          → App Next.js principal, UI, API routes
nutricoach-ui/       → rama feature/ui-estetica → Backup de diseño (no tocar sin instrucciones)
nutricoach-modulos/  → rama feature/modulos → Scripts de scraping, BD, módulos
```

Los 3 son el MISMO repositorio git. Trabaja SIEMPRE en el worktree que corresponde a la tarea. No toques archivos del worktree equivocado.

### 2. Reglas de código obligatorias

- **`page.evaluate()` en Playwright**: SIEMPRE usar string IIFE, NUNCA arrow functions. `tsx` añade `__name()` que no existe en el browser context.
  ```typescript
  // ❌ INCORRECTO (da ReferenceError: __name is not defined)
  await page.evaluate(() => { ... })
  // ✅ CORRECTO
  await page.evaluate('(function() { ... })()')
  ```
- **Supabase RLS**: Catálogo público (alimentos, recetas) → `createServiceSupabase()`. Operaciones con auth → `createApiSupabase(request)`. Nunca mezclar.
- **Next.js 16**: `params` en rutas dinámicas es `Promise<{ id: string }>`. Siempre `await params`.
- **`URL` no es un nombre de variable válido**: Sombrea el constructor global. Usar `SB`, `API_URL`, `ENDPOINT`.

### 3. Scraping — arquitectura vigente

**Scrapers que funcionan:**
| Supermercado | Método | Estado |
|---|---|---|
| Mercadona | API HTTP | ✅ |
| Consum | API HTTP | ✅ |
| Bonpreu/Esclat | Híbrido (PW sesión + HTTP datos) | ✅ |
| Alcampo | API Ocado HTTP | ✅ |
| Carrefour | Playwright homepage | ✅ |
| Eroski | Playwright | ✅ |
| **Lidl** | **Playwright erpNumbers + gridboxes API** | **✅ v4** |

**Scrapers bloqueados (no trabajar en estos sin investigación previa):**
- Día → WAF Cloudflare impenetrable
- Hipercor/El Corte Inglés → Akamai bloqueado
- Aldi → sin estrategia

**Comando para ejecutar scraper:**
```bash
cd nutricoach-modulos
env $(cat .env.local | grep -v '^#' | xargs) npx tsx scripts/scrapear-supermercados.ts [slug]
```

### 4. Recetario — pipeline de calidad

```bash
cd nutricoach-modulos
node scripts/pipeline-calidad.mjs --horas 24    # tras importar recetas nuevas
node scripts/pipeline-calidad.mjs --id <uuid>   # receta específica
```

**Nunca** modificar `receta_ingredientes` directamente sin pasar por `pipeline-calidad.mjs` — rompe los macros calculados.

### 5. Variables de entorno

Todas las operaciones necesitan el `.env.local` de `nutricoach-modulos/`. Cargar con:
```bash
env $(cat .env.local | grep -v '^#' | xargs) <comando>
```

---

## 📊 Estado de la BD (16-05-2026)

| Entidad | Cantidad | Estado |
|---------|----------|--------|
| Alimentos | ~12.174 | ✅ 100% enriquecidos con macros |
| Recetas | 229 | ✅ 0 sin foto, 0 sin macros, 0 sin intolerancias |
| Productos supermercado | ~7.920 | ✅ 8 supermercados activos |
| Precios histórico | ~78.235 | ✅ Actualizados |

**Distribución de productos por supermercado:**
| Supermercado | Productos |
|---|---|
| Consum | ~4.765 |
| Mercadona | ~2.895 |
| Lidl | ~149 |
| Alcampo | ~38 |
| Carrefour | ~20 |
| Bonpreu | ~21 |
| Esclat | ~21 |
| Eroski | ~11 |

---

# ESTADO NutriCoach — 15-05-2026 (Sesión 13 — Pipeline de calidad operativo)

> Leer al inicio de CADA sesión. Documento dinámico actualizado al cerrar (15-05-2026).

---

## 📍 DÓNDE ESTAMOS

**Fase:** Sesión 13 completada. Pipeline de calidad `pipeline-calidad.mjs` ejecutado en producción sin errores. 229 recetas con macros recalculados, 59 intolerancias etiquetadas, 41 matches corregidos. Deploy a Vercel lanzado. Recetario 100% limpio.

---

## ✅ COMPLETADO (15-05-2026) — Sesión 13 — Pipeline automático

### 🔷 Pipeline-calidad.mjs ✅

Ejecutado en producción contra las 229 recetas del recetario:

| Fase | Resultado |
|------|-----------|
| Fix matches | 41 corregidos (chocolate negro 85%, miel) |
| Recalcular macros | 229 recetas actualizadas desde ingredientes |
| Intolerancias | 59 recetas etiquetadas |
| Errores | 0 |

Scripts committeados: `pipeline-calidad.mjs`, `healthify-receta.mjs`, `completar-fotos-faltantes.mjs`

### 🔷 Fix: Replicate→OpenAI en capturar-imagen ✅

`app/api/capturar-imagen-receta/route.ts`: `applyFluxImgToImg` → `applyOpenAIImageEdit` (sin crédito en Replicate)

### 🔷 Versión Fit de recetas ✅ (sesión anterior)

- API: `app/api/recetas/[id]/healthify/route.ts`
- UI: botón "Generar versión fit" en detalle de receta
- FK `receta_original_id` enlaza fit con original

---

## 🔜 PRÓXIMA SESIÓN (prioridades)

1. **Verificar Vercel** — `nutricoach-delta.vercel.app`: versión fit, macros/porción, intolerancias
2. **Revisar fotos** — algunas tienen placeholder "ya", Carlos quiere regenerarlas con mejor estilo
3. **Conectar bridge al pipeline** — `bridge_nutricoach.py` → llamar `node pipeline-calidad.mjs --id <uuid>` al finalizar cada inserción
4. **7 recetas macros altas** — Carlos revisa porciones desde UI

---

## 📐 Comandos de mantenimiento del recetario

```bash
# Pipeline tras importar nuevas recetas
cd NUTRICION/nutricoach-modulos
node scripts/pipeline-calidad.mjs --horas 24

# Versión fit desde CLI (script)
node scripts/healthify-receta.mjs --id <uuid-receta-original> --link-to <uuid-original>

# Quality gate completo
node scripts/quality-gate-recetas.mjs --todas
```

---

## 📊 Estado del recetario (15-05-2026)

| Métrica | Valor |
|---------|-------|
| Recetas aprobadas | 229 |
| Sin foto | 0 ✅ |
| Sin macros | 0 ✅ |
| Sin intolerancias | 0 ✅ |
| Matches sospechosos | 0 ✅ |
| Macros altas (revisar) | 7 🟡 |

---

# ESTADO NutriCoach — 13-05-2026 (Sesión 11 — PWA/Offline + Bugs + Precios básicos COMPLETADO)

> Leer al inicio de CADA sesión. Documento dinámico actualizado al cerrar (13-05-2026).

---

## 📍 DÓNDE ESTAMOS

**Fase:** Sesión 11 completada. SelectorComparativa integrado. PWA/offline activado (SW v2 + manifest standalone). Seed de precios + reconciliación de vinculación creado. **Bug crítico corregido:** `comidas_alimentos` → `comida_alimentos` (10 referencias en 4 API routes). Build verificado ✅.

---

## ✅ COMPLETADO (13-05-2026) — Sesión 11 — PWA/Offline + Bug Fix + Precios

### 🔷 SelectorComparativa ✅
- **`SelectorComparativa.tsx`** creado e integrado en `ListaCompra.tsx`
  - Ranking visual 🥇 más barato → más caro con badges, ahorro potencial
  - Botón "Seleccionar [Supermercado] para todos los alimentos" con aplicación masiva
  - Detección de supermercado más usado como referencia

### 🔷 PWA / Offline ✅
| Componente | Antes | Después |
|-----------|-------|---------|
| `sw.js` | v1 (nunca registrado) | v2 con caching estratégico: static assets, API routes, pages |
| `manifest.json` | `display: "browser"` | `display: "standalone"`, nombre "Casanova Nutrition", iconos maskable |
| `layout.tsx` | Sin registro SW | Script `afterInteractive` registrando `/sw.js` |

Estrategia de caché SW v2:
- **Cache first:** `/recetas`, `/login`, assets estáticos, `/api/recetas`, `/api/alimentos`
- **Network first (fallback cache):** resto de API routes
- **Fallback:** navegación → `/`

### 🔷 Seed Precios + Reconciliación ✅
| Archivo | Propósito |
|---------|-----------|
| `seed_precios_supermercado.sql` | 20+ alimentos básicos (carnes, pescados, huevos, lácteos) con precios realistas en Mercadona, Carrefour, Consum, Lidl, Día, Alcampo, Eroski |
| `supabase_reconciliacion_vinculacion.sql` | Detecta duplicados genéricos creados por scraping, los re-vincula a alimentos semilla con 5-level matching, y elimina huérfanos |

### 🔷 Bug crítico corregido: `comidas_alimentos` → `comida_alimentos` ✅
**Problema:** 4 API routes usaban `comidas_alimentos` (plural) pero la tabla real en Supabase es `comida_alimentos` (singular). Causaba 500 en todas las rutas de precios.

| Archivo | Referencias corregidas |
|---------|----------------------|
| `app/api/precios/ahorro/route.ts` | 2 (`.select()` + property access) |
| `app/api/precios/ahorro/proyeccion/route.ts` | 2 (`.select()` + property access) |
| `app/api/precios/escandallo/route.ts` | 4 (2× `.select()` + 2× property access) |
| `app/api/precios/escandallo/detalle/route.ts` | 2 (`.select()` + property access) |
| **Total** | **10 referencias corregidas en 4 archivos** |

#### Build
- `npx tsc --noEmit` → ✅ exit 0 sin errores
- `grep -r comidas_alimentos --include="*.ts"` → 0 resultados (ninguna referencia residual)

---

## 🔜 PRÓXIMA SESIÓN (prioridades)

1. **Probar el Dashboard de Rentabilidad en vivo** — seleccionar cliente con precios y verificar que los datos se renderizan
2. **Validar que las proyecciones de ahorro funcionan** — probar con Mercadona vs Lidl
3. **Histórico y Tendencias** — Mostrar evolución de precios en el tiempo (si hay datos históricos)
4. **Relanzar lote restante Content Radar** (los ~50 items que quedaron por SSL timeout)
5. **Despliegue en Vercel**

---


# ESTADO NutriCoach — 10-05-2026 (Sesión 8 — Clausurada)

> Estado anterior. Mantenido como referencia histórica.

---

## 📍 DÓNDE ESTAMOS

**Fase activa:** Tareas técnicas completadas. Pendiente despliegue en Vercel + producto.

---

## ✅ COMPLETADO (10-05-2026) — Sesión 8 (Roo Code)

### 🔷 Tarea 1 — Migración SQL en Supabase ✅
- **Archivo:** [`supabase_lista_compra_migration.sql`](supabase_lista_compra_migration.sql)
- **Ejecución:** `supabase link --project-ref hopeqzwzmlrpktoeygxz` → `supabase db query --linked` ✅
- Tablas creadas: `selecciones_lista_compra`, `dedup_revision`
- Columna añadida: `es_generico` en `alimentos`

### 🔷 Tarea 2 — Backfill de recetas ✅
- **Comando:** `npx tsx scripts/backfill-recetas.ts`
- **Resultado:** 2/2 recetas completadas

### 🔷 Tarea 3 — Scrapers reparados (6 supermercados) ✅
| Scraper | Estrategia | Detalle |
|---------|-----------|---------|
| **Consum** | API REST (Angular SPA) | API real descubierta: `tienda.consum.es/api/rest/V1.0/` — 683 cat. hojas, 8000+ productos |
| **Alcampo** | API REST (Ocado Technology) | API en `compraonline.alcampo.es/api/` — categorías predefinidas + regionId |
| **Carrefour** | Playwright (DOM) | Cloudflare bloquea todo HTTP — navegador headless |
| **Día** | Playwright (DOM) | Access Denied en HTTP — navegador headless |
| **Eroski** | Playwright (DOM) | Apache Tapestry sin REST API — navegador headless |
| **Lidl** | Playwright (DOM) | Ya usaba Playwright — selectores mejorados |

**Fix crítico Consum:** precio en `priceData.prices[0].value.centAmount` (no en `productData.price`). Dividir entre 100.

### 🔷 Tarea 4 — Aldi ⏭️ Saltado
- **Motivo:** aldi.es no tiene e-commerce — solo catálogos semanales (Adobe Experience Manager)

### 🔷 Tarea 5 — Enriquecer 70 alimentos sin macros ✅
- **Comando:** `node scripts/enriquecer-alimentos.mjs --limite=70`
- **Resultado:** 70/70 procesados

### 🔷 Tarea 6 — Merge feature/modulos → main + build ✅
- **Merge:** commit `4973187` — 17 archivos, conflicto CLAUDE.md resuelto con `--theirs`
- **Build:** `npx next build` → **exit 0** ✅
- **Worktrees sincronizados:** nutricoach-modulos + nutricoach-ui fast-forward

### 🔷 Extra — Perfilado DeepSeek 135/135 recetas ✅
- **Comando:** `node scripts/perfilar-recetas-final.mjs --todas`
- **Resultado:** 135/135 con instrucciones ✅ — 0 sin instrucciones, 0 sin kcal
- Problemas corregidos: `🔀orden` ingredientes, `¶párrafo→pasos`, `⚖️cantidades`

---

## 🛠️ Scripts disponibles (resumen)

| Script | Uso |
|--------|-----|
| `node scripts/perfilar-recetas-final.mjs --todas` | Perfilar todas las recetas |
| `node scripts/perfilar-recetas-final.mjs --slug "nombre"` | Perfilar una sola |
| `node scripts/refinar-imagenes-og.mjs --todas` | Refinar fotos reales con GPT-4o (og_image → flux_img2img) |
| `node scripts/refinar-imagenes-og.mjs --slug "nombre"` | Refinar una sola |
| `node scripts/scrapear-imagenes-recetas.mjs --todas` | Scraping fotos reales |
| `node scripts/subir-imagenes-aprobadas.mjs` | Subir mejores fotos a Supabase |
| `node scripts/subir-imagenes-aprobadas.mjs --forzar` | Sobreescribir imágenes existentes |
| `node scripts/regenerar-flux-masivo.mjs --genera` | **NUEVO** — GPT-4o image edit desde flux_txt2img |
| `node scripts/regenerar-flux-masivo.mjs --candidatas` | **NUEVO** — Generar HTML de revisión |
| `node scripts/analizar-urls-pendientes.mjs` | **NUEVO** — Analizar url_origen de recetas pendientes |

---

## 📊 Estado de la BD (imágenes)

- **135 recetas** en Supabase (todas perfiladas ✅)
- **16 imágenes ai_gen** generadas con GPT-4o image edit y subidas a Storage ✅
- **~59 recetas pendientes** de generar (bloqueado por OpenAI billing)
- **37 con url_origen** (34 con og_image en disco) para posible Plan B
- **35 sin url_origen** → seguirán con flux_txt2img como base
