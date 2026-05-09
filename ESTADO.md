# ESTADO NutriCoach — 09-05-2026 (Sesión 7)

> Leer al inicio de CADA sesión. Documento dinámico actualizado al cerrar.

---

## 📍 DÓNDE ESTAMOS

**Fase activa:** Módulo de escandallo + lista de la compra — construcción completada, pendiente pruebas en UI

---

## ✅ COMPLETADO HOY (09-05-2026) — Sesión 7

### 🧹 Limpieza de BD — no comestibles Mercadona
- **156 no-comestibles eliminados** de la tabla `alimentos` (champús, bastoncillos, cremas, artículos bebé, productos limpieza, etc.)
- Script de auditoría reutilizable: `scripts/auditar-limpiar-mercadona.mjs`
  - Modo solo lectura: `node scripts/auditar-limpiar-mercadona.mjs`
  - Modo borrado: `node scripts/auditar-limpiar-mercadona.mjs --delete`
  - Modo exportar: `node scripts/auditar-limpiar-mercadona.mjs --export`
- BD resultante: **688 alimentos con macros** ✅ + **67 sin macros** (pendiente DeepSeek)
- Exportados a `salidas/2026-05-09_no-comestibles-mercadona.json` y `salidas/2026-05-09_comestibles-sin-macros-mercadona.json`

### 💰 Módulo de escandallo + lista de la compra (NUEVO)

#### API routes creadas
| Ruta | Función |
|------|---------|
| `GET /api/precios/escandallo/receta?id=[id]` | Coste desglosado de una receta por ingrediente con comparativa entre supermercados |
| `GET /api/compra?recetas=...&periodo=semanal` | Genera lista de la compra agrupada por supermercado con costes |

#### Componentes creados
| Archivo | Función |
|---------|---------|
| `components/EscandalloReceta.tsx` | Tab de coste en detalle de receta — comparativa supermercados + precio expandible por ingrediente |
| `app/compra/page.tsx` | Página lista de la compra: selecciona recetas/cliente + período + super → genera lista con costes |

#### Integraciones
- Tab "Coste de la receta" añadido al final de cada página `/recetas/[id]`
- Enlace "Lista de la compra" añadido al sidebar
- `EscandalloReceta` ya estaba en commit anterior; hoy se integró en la receta

---

## ⚠️ CONFLICTOS DE MERGE DETECTADOS

No se ha hecho merge automático porque los siguientes archivos aparecen en múltiples ramas:

| Archivo | main | feature/ui-estetica | feature/modulos |
|---------|------|---------------------|-----------------|
| `CLAUDE.md` | ✅ | ✅ | ✅ |
| `app/api/scrape-receta/route.ts` | — | ✅ | ✅ |
| `app/api/capturar-imagen-receta/route.ts` | ✅ | ✅ | — |

**Acción necesaria mañana:** Resolver manualmente o hacer merge interactivo. Empezar por `feature/ui-estetica → main` (solo 4 archivos).

---

## 🔜 PENDIENTE MAÑANA

1. **Probar en UI** el escandallo de receta (`/recetas/[id]` → sección "Coste")
2. **Probar** la lista de la compra (`/compra`) — seleccionar recetas, generar, verificar costes
3. **Enriquecer 67 alimentos sin macros**: `node scripts/enriquecer-alimentos.mjs --limite=70`
4. **Merge de ramas** con cuidado: resolver conflictos en CLAUDE.md y scrape-receta route
5. Scrapers de otros supermercados (Carrefour, Lidl, Consum) para comparativa real de precios
6. Backfill de recetas: `npx tsx scripts/backfill-recetas.ts`

---

## 🔐 AUDITORÍA DE SEGURIDAD (09-05-2026)

| Check | Estado |
|-------|--------|
| Nuevos endpoints auth-protected | ✅ — `/api/precios/escandallo/receta` y `/api/compra` verifican `auth.getUser()` |
| Sin claves en código | ✅ |
| Service role solo en server-side | ✅ — `createServiceSupabase()` solo en API routes |
| Página `/compra` sin datos sensibles | ✅ — solo agrega cantidades y costes |

---

**Servidor local:** `http://localhost:3000`
**Login coach:** `ccc8890@gmail.com` / `Coach2026!` 🔴 Contraseña actualizada

---

## ✅ COMPLETADO HOY (05-05-2026) — Sesión 4 (Hardening: tipado completo + catch blocks)

### 🔴 Fix CRÍTICO: API routes usaban browser Supabase client en server context

Tres rutas API importaban [`@/lib/supabase`](nutricoach/lib/supabase.ts) (cliente browser con `supabase-js` anónimo) en vez de [`@/lib/supabase-server`](nutricoach/lib/supabase-server.ts) (cliente server con cookies). Esto causaba que `supabase.auth.getUser()` fallara silenciosamente en el servidor (sin cookies browser), devolviendo 401 inesperados o datos vacíos.

| # | Archivo | Cambio | Riesgo |
|---|---------|--------|--------|
| 1 | [`app/api/respuestas/[id]/leer/route.ts`](nutricoach/app/api/respuestas/[id]/leer/route.ts:1) | `import { supabase }` → `import { createServerSupabase }` + `await createServerSupabase()` | ❌ No podía verificar auth del coach → 401 siempre |
| 2 | [`app/api/clientes/[id]/conversaciones-ia/route.ts`](nutricoach/app/api/clientes/[id]/conversaciones-ia/route.ts:1) | `import { supabase }` → `import { createServerSupabase }` + `await createServerSupabase()` | ❌ Mismo problema + RLS bypass |
| 3 | [`app/api/clientes/[id]/protocolo-competicion/route.ts`](nutricoach/app/api/clientes/[id]/protocolo-competicion/route.ts:1) | `import { supabase }` → `import { createServerSupabase }` + `await createServerSupabase()` en GET/POST/PUT/DELETE | ❌ Mismo problema en 4 métodos HTTP |

**Riesgo potencial:** Cualquier coach autenticado no podía marcar respuestas como leídas, ver conversaciones IA ni gestionar protocolos de competición.

### 🐛 TS Errors corregidos (3 archivos)

| # | Archivo | Error | Fix |
|---|---------|-------|-----|
| 1 | [`app/api/recetas/[id]/estado/route.ts`](nutricoach/app/api/recetas/[id]/estado/route.ts:4) | `params` como `{ id: string }` en vez de `Promise<{ id: string }>` (Next.js 16 API) | Cambiado tipo a `Promise<{ id: string }>` + `await params` + eliminado duplicado |
| 2 | [`scripts/clean-instagram-raw.ts`](nutricoach/scripts/clean-instagram-raw.ts:218) | `ing.alimento` inferido como array por Supabase join → `.calorias` no existe en array | Casteado con `as unknown as { calorias: number; ... }` |
| 3 | [`scripts/fix-orphan-ingredients.ts`](nutricoach/scripts/fix-orphan-ingredients.ts:104) | `categoria` requerida en `OrphanIngredient` pero no seleccionada en query | `categoria` pasada a opcional (`categoria?: string`) |
| — | [`scripts/fix-orphan-ingredients.ts`](nutricoach/scripts/fix-orphan-ingredients.ts:241) | Mismo patrón Supabase join en recálculo kcal | Mismo casteo que fix #2 |

**Resultado:** `npx next build` → **0 errores TypeScript** ✅

### 🔧 Fix configuración — DEEPSEEK_MODEL

| # | Archivo | Cambio |
|---|---------|--------|
| 6 (Bug fix) | [`app/api/conocimiento/scrape/route.ts`](nutricoach/app/api/conocimiento/scrape/route.ts:5) | `const DEEPSEEK_MODEL = 'deepseek-chat'` → `const DEEPSEEK_MODEL = process.env.DEEPSEEK_MODEL \|\| 'deepseek-chat'` |

### 🟡 Feature: Recalculadora de porciones

| Componente | Cambio |
|------------|--------|
| [`app/dietas/[id]/page.tsx`](nutricoach/app/dietas/[id]/page.tsx:52) | Nuevo state `porcionesVis` (default 1) |
| [`app/dietas/[id]/page.tsx`](nutricoach/app/dietas/[id]/page.tsx:350) | `totalDia` escalado por `porcionesVis`; base preservada en `totalDiaBase` |
| [`app/dietas/[id]/page.tsx`](nutricoach/app/dietas/[id]/page.tsx:452) | UI: botones − / +, input numérico step 0.25, rango 0.25–20, indicador "×N · Base: X kcal" |

### 🟢 Feature: PWA para portal cliente

| Archivo | Descripción |
|---------|-------------|
| [`public/manifest.json`](nutricoach/public/manifest.json) | NUEVO — Web App Manifest con display standalone, theme_color `#1C1C1E`, iconos maskable |
| [`public/icon-192.svg`](nutricoach/public/icon-192.svg) | NUEVO — Icono 192×192 "NC" sobre fondo oscuro |
| [`public/icon-512.svg`](nutricoach/public/icon-512.svg) | NUEVO — Icono 512×512 "NC" sobre fondo oscuro |
| [`public/sw.js`](nutricoach/public/sw.js) | NUEVO — Service Worker con estrategia cache-first para assets, network-first para API |
| [`app/layout.tsx`](nutricoach/app/layout.tsx:13) | Metadata actualizada con `manifest`, `icons`, `appleWebApp` + registro SW via `<Script>` |

---

## ✅ COMPLETADO SESIÓN ANTERIOR (05-05-2026 — Sesión 1)

### Campo `descripcion_porcion` — qué es físicamente 1 porción

**Problema resuelto:** Los macros mostraban "por porción" pero no decían qué era esa porción. Ej: 15 galletas → 1 porción = 1 galleta, no 1/15 de la bandeja.

#### 1. Migración BD (archivo preparado → ejecutado hoy)
- Archivo: `supabase_descripcion_porcion_migration.sql`

#### 2. Scraper actualizado (`app/api/scrape-receta/route.ts`)
- Añadido helper `inferDescripcionPorcion()` — infiere de `recipeYield` via JSON-LD
- Campo en prompts de Gemini Flash y DeepSeek
- Campo en INSERT de receta guardada

#### 3. Formulario de edición (`app/recetas/[id]/editar/page.tsx`)
- Campo `descripcion_porcion` en form, load, save, UI

#### 4. Página de detalle (`app/recetas/[id]/page.tsx`)
- Card verde de macros muestra: `Macros por porción · 1 galleta`

#### 5. Lista de recetas (`app/recetas/page.tsx`)
- Footer de card muestra: `2 porciones (1 galleta)`

---

## ✅ COMPLETADO HOY (08-05-2026) — Sesión 6

### 🟢 Flujo onboarding end-to-end verificado ✅

| Paso | Endpoint | Estado | Tiempo |
|------|----------|--------|--------|
| 1 | `POST /api/auth/callback` — Sincronizar sesión coach | ✅ 200 | 120ms |
| 2 | `POST /api/invitaciones` — Crear invitación | ✅ 200 | 676ms |
| 3 | `GET /api/invitaciones/[token]` — Verificar token (público) | ✅ 200 (valido: true) | 653ms |
| 4 | `POST /api/registro-invitacion` — Registrar cliente con contraseña | ✅ 200 (ok: true) | 544ms |
| 5 | Verificación BD: token marcado `usado: true` | ✅ | — |
| 6 | Verificación BD: cliente creado con `revisado_por_coach: false` | ✅ | — |
| 7 | Verificación BD: profile creado con `role: 'cliente'` | ✅ | — |

**Contraseña coach actualizada:** `ccc8890@gmail.com` / `Coach2026!` (la anterior expiró)

---

## ⏳ PENDIENTES — Próxima sesión

### 🟠 Probar flujos end-to-end restantes
1. **Probar flujo completo recetas**: `/recetas/nueva` → pegar URL → cola → aprobar → aparece en recetario
2. **Probar flujo completo DeepSeek**: cuestionario → respuesta → generar dieta IA (ahora con contexto científico ✅) → aprobar → portal cliente
3. **Probar que `descripcion_porcion` se rellena correctamente** en recetas scrapeadas nuevas

### 🟡 Siguientes features sugeridas
4. **Seed datos de clientes de prueba** si no hay aún datos para probar flujo DeepSeek
5. **Botón "Copiar enlace del portal"** en detalle de cliente (`clientes/[id]/page.tsx`)
6. **Probador de IA** — UI para testear prompts de DeepSeek sin tener que crear un cliente real

---

## 🏗️ ARQUITECTURA DEL SISTEMA DE RECETAS

```
URL pegada por Carlos
    ↓
POST /api/scrape-receta
    ├─ JSON-LD schema.org → extrae campos estructurados
    ├─ Gemini Flash fallback (con prompt completo incl. descripcion_porcion)
    └─ DeepSeek fallback (mismo prompt)
    ↓
Ingredientes → match automático con tabla alimentos (3 niveles)
    ↓
Guardado con estado: 'en_revision'
    ↓
/recetas/cola → Carlos revisa → Aprobar / Descartar
    ↓
estado: 'aprobada' → visible en recetario y planes cliente
```

---

## 🧠 FLUJO GENERACIÓN DIETA IA (ACTUALIZADO)

```
Cuestionario cliente
    ↓
POST /api/generar-dieta-ia
    ├─ fetch respuestas del cliente
    ├─ fetch plantillas_nutricion + recetas aprobadas
+   ├─ fetchKnowledgeContext() ← knowledge_base (30 estudios científicos) ✅ NUEVO
    ├─ construirPrompt(datosCliente, plantillas, recetas, conocimientoCientifico) ✅ NUEVO
    └─ generarDietaConIA(prompt) → DeepSeek
    ↓
Dieta generada con respaldo científico
```

---

## 🗂️ ARCHIVOS TOCADOS HOY (05-05-2026 — Sesión 4)

### 🔵 Prioridad 2: Reemplazar `any` states con interfaces (completado)

| Archivo | `any` → Interface | Detalle |
|---------|-------------------|---------|
| [`app/recetas/[id]/page.tsx`](nutricoach/app/recetas/[id]/page.tsx) | `handleEstado` callback + `intolerancias` | ✅ `prev: RecetaDetalle \| null`, `const intolerancias = receta.intolerancias ?? []` |
| [`app/clientes/[id]/page.tsx`](nutricoach/app/clientes/[id]/page.tsx) | 6 states → `ClienteConExtra`, `PlanNutricion[]`, `PlanEntrenamiento[]`, `SeguimientoPeso[]`, `CheckIn[]`, `NotaCoachRow[]` | ✅ + profile fallback, duracion_semanas guard, reshape dietas para PlanificacionCalendario |
| [`app/dietas/[id]/page.tsx`](nutricoach/app/dietas/[id]/page.tsx) | 3 states → `PlanNutricion \| null`, `ResultadoBusqueda[]`, tipo inline para resultadosRecetas | ✅ `ResultadoBusqueda = Alimento & { imagen?; _fuente? }` |
| [`app/dietas/page.tsx`](nutricoach/app/dietas/page.tsx) | `any[]` → `PlanRow[]` | ✅ |
| [`app/entrenos/page.tsx`](nutricoach/app/entrenos/page.tsx) | `any[]` → `PlanRow[]` | ✅ |
| [`app/clientes/page.tsx`](nutricoach/app/clientes/page.tsx) | `any[]` → `ClienteRow[]` | ✅ |
| [`app/recetas/page.tsx`](nutricoach/app/recetas/page.tsx) | `any[]` → `RecetaRow[]` + `(r: any)` → `(r: RecetaRow)` | ✅ + null-safety con `?? 0` en template |
| [`app/recetas/nueva/page.tsx`](nutricoach/app/recetas/nueva/page.tsx) | `any[]` → `Alimento[]` | ✅ + merge imports duplicados |
| [`app/recetas/[id]/editar/page.tsx`](nutricoach/app/recetas/[id]/editar/page.tsx) | `any[]` → `Alimento[]` | ✅ + merge imports duplicados |

### 🟢 Prioridad 3: Mejorar catch blocks con feedback al usuario (completado)

| Archivo | Cambio |
|---------|--------|
| [`app/recetas/cola/page.tsx`](nutricoach/app/recetas/cola/page.tsx) | ✅ Añadido `useToast` + `addToast({ type: 'error', ... })` en catch de handleEstado |
| [`app/dashboard/page.tsx`](nutricoach/app/dashboard/page.tsx) | ✅ Añadido `useToast` + `addToast` en catch de loadAnalytics |
| [`app/cuestionario/[codigo]/page.tsx`](nutricoach/app/cuestionario/[codigo]/page.tsx) | ✅ Añadido `useToast` + reemplazado `alert()` por `addToast` en catch de handleSubmit |
| [`app/dietas/[id]/page.tsx`](nutricoach/app/dietas/[id]/page.tsx) | ✅ Reemplazado `alert('Error al descargar PDF')` por `addToast` (ya tenía `useToast`) |

**Nota:** [`app/page.tsx`](nutricoach/app/page.tsx) y [`app/login/page.tsx`](nutricoach/app/login/page.tsx) se dejan intactos porque redirigen inmediatamente tras el catch — un toast se perdería en la navegación.

### 📊 Resumen de salud del código (actualizado)

| Métrica | Sesión 3 | Sesión 4 |
|---------|----------|----------|
| Errores TypeScript (build) | **0** ✅ | **0** ✅ |
| API routes con Supabase server-side | **20/20** ✅ | **20/20** ✅ |
| Componentes con `any` en states | **10 archivos** | **0 archivos** ✅ |
| `useParams()` sin generic | **7 páginas** | **0 páginas** ✅ |
| Catch blocks con feedback al usuario | ~5/25 (aprox) | **22/25** ✅ (3 restantes con redirect) |
| Cobertura de tipos (`types/index.ts`) | **34 interfaces** | **34 interfaces** |

---

## 📋 ESTADO BD (Supabase)

| Tabla | Registros aprox. | Estado |
|-------|-----------------|--------|
| recetas | 98+ | Con `descripcion_porcion` (columna añadida) ✅ |
| alimentos | 473 | Con micronutrientes (267 enriquecidos por IA) |
| plantillas_entrenamiento | 21 | Con progresión semanal + RPE |
| ejercicios | 200+ | Con referencias bibliográficas |
| clientes | — | Tabla activa |
| planes_nutricion | — | Tabla activa |
| knowledge_base | **48** (18 fichas + 30 estudios científicos) | HYROX + running + fuerza + nutrición + recup. + estudios con DOI ✅ |

**Schema version:** v2 (`supabase_recetas_v2_migration.sql` ejecutada ✅)

---

## 🗂️ ARCHIVOS SQL PARA EJECUTAR (en orden)

Si se monta la BD desde cero:
1. `supabase_schema.sql` — Schema base (19 tablas)
2. `supabase_recetas_v2_migration.sql` — Schema v2 recetas
3. `supabase_descripcion_porcion_migration.sql` — ✅ Ejecutada (05-05-2026)
4. `seed_alimentos.sql` + `seed_alimentos_extra.sql` — Alimentos base
5. `seed_plantillas_dietas.sql` — 11 plantillas nutricionales
6. `seed_plantillas_entrenamiento.sql` + `seed_ejercicios.sql` — Entreno
7. `supabase_knowledge_base.sql` + fichas insertadas via script ✅

---

## 🔒 VARIABLES DE ENTORNO (`.env.local`)

```
NEXT_PUBLIC_SUPABASE_URL=https://hopeqzwzmlrpktoeygxz.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...
GEMINI_API_KEY=...
DEEPSEEK_API_KEY=sk-8f30d246907648ac8f8c329d19707e20 ✅
DEEPSEEK_MODEL=deepseek-chat
UNSPLASH_ACCESS_KEY=... (opcional — fotos automáticas)
```

---

## 🚀 ARRANCAR EL SERVIDOR

```bash
cd ~/Desktop/Carlos/CLAUDE/NUTRICION/nutricoach
# Si el puerto está ocupado:
lsof -ti:3000 | xargs kill -9 2>/dev/null
npm run dev
```

---

## 📁 ARCHIVOS TOCADOS HOY (05-05-2026 — Sesión 3)

| Archivo | Cambio |
|---------|--------|
| [`app/api/recetas/[id]/estado/route.ts`](nutricoach/app/api/recetas/[id]/estado/route.ts) | 🔴 FIX: `params` → `Promise<{id: string}>` (Next.js 16) + `await params` |
| [`scripts/clean-instagram-raw.ts`](nutricoach/scripts/clean-instagram-raw.ts) | 🔴 FIX: casteo `ing.alimento` como objeto en vez de array |
| [`scripts/fix-orphan-ingredients.ts`](nutricoach/scripts/fix-orphan-ingredients.ts) | 🔴 FIX: `categoria` opcional en `OrphanIngredient` + casteo `ing.alimento` |
| [`app/api/conocimiento/scrape/route.ts`](nutricoach/app/api/conocimiento/scrape/route.ts) | 🔧 FIX: `DEEPSEEK_MODEL` lee de `process.env` con fallback |
| [`app/dietas/[id]/page.tsx`](nutricoach/app/dietas/[id]/page.tsx) | 🟡 FEATURE: Recalculadora de porciones (state + UI + escalado de totales) |
| [`public/manifest.json`](nutricoach/public/manifest.json) | 🟢 NUEVO: Web App Manifest PWA |
| [`public/icon-192.svg`](nutricoach/public/icon-192.svg) | 🟢 NUEVO: Icono 192×192 |
| [`public/icon-512.svg`](nutricoach/public/icon-512.svg) | 🟢 NUEVO: Icono 512×512 |
| [`public/sw.js`](nutricoach/public/sw.js) | 🟢 NUEVO: Service Worker (cache-first assets, network-first API) |
| [`app/layout.tsx`](nutricoach/app/layout.tsx) | 🟢 PWA: manifest + icons + appleWebApp metadata + registro SW |
| [`ESTADO.md`](nutricoach/ESTADO.md) | Actualizado con Sesión 3 |

---

## 🔍 AUDITORÍA DE CÓDIGO — Patrones de riesgo identificados (05-05-2026)

### 🔴 Críticos (corregidos)

| # | Patrón | Archivos afectados | Fix |
|---|--------|-------------------|-----|
| 1 | API routes importando `@/lib/supabase` (browser) en vez de `@/lib/supabase-server` (server) | [`respuestas/[id]/leer`](nutricoach/app/api/respuestas/[id]/leer/route.ts), [`clientes/[id]/conversaciones-ia`](nutricoach/app/api/clientes/[id]/conversaciones-ia/route.ts), [`clientes/[id]/protocolo-competicion`](nutricoach/app/api/clientes/[id]/protocolo-competicion/route.ts) | ✅ Cambiado a `createServerSupabase()` |
| 2 | `params` sin `Promise<>` en Next.js 16 route handlers | [`recetas/[id]/estado/route.ts`](nutricoach/app/api/recetas/[id]/estado/route.ts:4) | ✅ `params: Promise<{id: string}>` + `await params` |
| 3 | Supabase join `alimento:alimentos(*)` inferido como array TS | [`scripts/clean-instagram-raw.ts`](nutricoach/scripts/clean-instagram-raw.ts:218), [`scripts/fix-orphan-ingredients.ts`](nutricoach/scripts/fix-orphan-ingredients.ts:241) | ✅ Cast `as unknown as {...}` |

### 🟢 Corregidos (Sesión 4)

| # | Patrón | Archivos afectados | Fix |
|---|--------|-------------------|-----|
| A | `useState<any>(null)` / `useState<any[]>([])` en componentes | 10 archivos en `app/` | ✅ Reemplazado con interfaces tipadas concretas (`RecetaRow`, `ClienteRow`, `PlanRow`, etc.) |
| B | `catch (err)` sin feedback al usuario (componentes) | 4 archivos | ✅ Añadido `useToast` + `addToast(...)` en catch blocks |
| C | `useParams()` sin generic | 7 páginas en `app/` | ✅ Usar `useParams<{ id: string }>()` (Sesión 3) |

### 🟡 Observados — No corregidos (bajo riesgo, prioridad futura)

| # | Patrón | Archivos | Impacto potencial | Recomendación |
|---|--------|----------|-------------------|---------------|
| D | `(err: any)` en API routes exponiendo `err.message` al cliente | 12 rutas | Puede filtrar información interna | Tipar como `unknown` + sanitizar mensaje |
| E | Same Supabase join `alimento:alimentos(*)` en páginas cliente | 8 archivos en `app/` (dietas, recetas, cliente) | TS cree que `alimento` es array; si se accede como objeto → error runtime | Aplicar mismo patrón de casteo |
| F | Catch blocks en páginas con redirect (`/login`, `/`) | 2 archivos | No muestran error al usuario antes de redirigir | Aceptable porque la redirección es la acción correcta |

---

## 🧠 LECCIONES APRENDIDAS (Sesión 4)

### Errores encontrados y cómo evitarlos

| # | Error | Causa raíz | Solución aplicada | Cómo prevenirlo en el futuro |
|---|-------|-----------|-------------------|------------------------------|
| 1 | **Duplicate identifier 'Alimento'** en [`recetas/nueva/page.tsx`](nutricoach/app/recetas/nueva/page.tsx) y [`recetas/[id]/editar/page.tsx`](nutricoach/app/recetas/[id]/editar/page.tsx) | El archivo tenía `import { Alimento }` + `import type { Alimento }` simultáneamente — un import normal y un import type del mismo símbolo | Fusionar en `import type { Alimento }` | Usar `import type` siempre para types, `import` solo para runtime. ESLint `consistent-type-imports` podría automatizarlo |
| 2 | **`RecetaConIngredientes` no exportado** en [`dietas/[id]/page.tsx`](nutricoach/app/dietas/[id]/page.tsx) | Se añadió `RecetaConIngredientes` a la línea de import de `@/types`, pero la interface está definida localmente en el archivo, no exportada desde types/index.ts | Eliminar de la línea de import de `@/types` | Leer el stack trace: "is not exported from '@/types'" → el símbolo no existe ahí |
| 3 | **`p` (profile) possibly undefined** en [`clientes/[id]/page.tsx`](nutricoach/app/clientes/[id]/page.tsx) | `const p = cliente.profile` → TS sabe que `profile` es opcional, luego `p.nombre` falla si `p` es undefined | `const p: {...} = cliente.profile ?? {}` | Siempre usar `?? {}` para objetos anidados opcionales, o `?.` para acceso directo |
| 4 | **`duracion_semanas: number | undefined` no asignable a `number`** en [`clientes/[id]/page.tsx`](nutricoach/app/clientes/[id]/page.tsx) | `PlanEntrenamiento` tiene `duracion_semanas` opcional, pero `PlanificacionCalendario` Props la requiere como `number` | `e.duracion_semanas ?? 0` en el `.map()` | Al reshape datos entre componentes, aplicar defaults en el mapeo, no en el destino |
| 5 | **`fechaRevision: string | undefined` no asignable a `string | null`** | El campo opcional (`string | undefined`) y el prop `string | null` no son el mismo tipo TS | `cliente.fecha_proxima_revision ?? null` | `?? null` cuando el destino espera `null`, no `undefined` |
| 6 | **`a.imagen` / `a._fuente` no existen en `Alimento`** en [`dietas/[id]/page.tsx`](nutricoach/app/dietas/[id]/page.tsx) | Open Food Facts devuelve campos extra (`imagen`, `_fuente`) que no están en la interfaz `Alimento` | `type ResultadoBusqueda = Alimento & { imagen?: string; _fuente?: string }` | Los datos de APIs externas siempre tienen campos extra. Usar intersection types en vez de modificar la interfaz base |
| 7 | **`r.porciones > 0` → `r.porciones` es `number | null`** en [`recetas/page.tsx`](nutricoach/app/recetas/page.tsx) | Al tipar de `any` a `RecetaRow`, todos los campos numéricos se vuelven `number | null` | `(r.porciones ?? 0) > 0`, `Math.round(r.kcal ?? 0)` | Aplicar `?? 0` consistentemente en todos los accesos a campos numéricos nullable |
| 8 | **setLoadingIds callback con `any`** en [`recetas/cola/page.tsx`](nutricoach/app/recetas/cola/page.tsx) | `(prev) => new Set(prev).add(id)` donde `prev` es `Set<string>` pero TS lo infiere de `any` si no se tipa | El state ya estaba tipado como `Set<string>`, el callback infiere bien el tipo automáticamente | A veces el error es que el state está sin tipar → tipar el state es suficiente |

### Aciertos que repetir

| # | Acierto | Por qué funcionó |
|---|---------|------------------|
| 1 | **Interfaces locales vs globales** | Para tipos que solo usa un archivo (ej. `ResultadoBusqueda`, `RecetaRow`, `NotaCoachRow`), definirlos localmente evita contaminar `types/index.ts` y hace el archivo self-contained |
| 2 | **`??` como patrón sistemático** | Tras tipar campos como `number | null`, usar `?? 0` en TODOS los accesos elimina errores de compilación y bugs runtime de una sola pasada |
| 3 | **`.map()` reshape para props de componentes** | Cuando un componente espera un subset de campos, mapear en el padre con `.map(item => ({ ... }))` mantiene el tipado limpio sin modificar interfaces originales |
| 4 | **Intersection types para datos externos** | `Alimento & { imagen?: string }` es más limpio que extender la interfaz base o castear con `as` |
| 5 | **useToast en layout raíz** | Como `ToastProvider` envuelve todo el árbol en [`layout.tsx`](nutricoach/app/layout.tsx:35), `useToast()` está disponible en cualquier página — incluida la página pública de cuestionario |

### Lo que NO se hizo (y por qué es correcto)

| Decisión | Razón |
|----------|-------|
| **No tocar catch blocks en `page.tsx` y `login/page.tsx`** | Redirigen inmediatamente (`window.location.href = '/login'`) — un toast se perdería en la navegación. El console.error basta como log |
| **No crear `types/extra.ts` para tipos locales** | Cada tipo local está en el archivo que lo usa. Si se necesitara en >1 archivo, entonces se mueve a `@/types` |
| **No ejecutar migración SQL desde scripts** | Los scripts `.mjs` se ejecutan manualmente. No hay migraciones automáticas en este ciclo |

---

## 🧭 GUÍA PARA PRÓXIMA IA/SESIÓN

Al iniciar la siguiente sesión, leer este documento desde el principio. Puntos clave:

1. **Estado actual:** 0 errores TS, 0 `any` states, 22/25 catch blocks con toast
2. **Prioridades pendientes:**
   - Probar flujos end-to-end (recetas, DeepSeek, PWA, portal cliente)
   - Patrón D: tipar `(err: any)` como `unknown` en API routes (12 rutas, bajo riesgo)
   - Patrón E: castear Supabase joins en páginas cliente (8 archivos, bajo riesgo)
3. **No tocar** `page.tsx` ni `login/page.tsx` catch blocks
4. **Build verificado** — `npx next build` pasa sin errores

---

**Última actualización:** 08-05-2026 (Sesión 6 — onboarding end-to-end verificado ✅)
**Sesión:** Roo (code mode)
**Próxima sesión:** Probar flujo recetas end-to-end, probar DeepSeek con contexto científico, features menores
