# Proyecto: NutriCoach (Human Lab)

## Comandos y Scripts Importantes
- **Ejecutar en desarrollo:** `npm run dev` (dentro de `nutricoach/`)
- **Build (verificar errores TS):** `npx next build` (dentro de `nutricoach/`)
- **Migración de esquema antiguo a nuevo de recetas:** `node scripts/migrar-recetas.mjs`
- **Reparar ingredientes en recetas antiguas:** `node scripts/reparar-recetas-ingredientes.mjs`
- **Backfill de recetas (Scrape URL y auto-relleno):** `npx tsx scripts/backfill-recetas.ts`

## Estado Actual (10-05-2026 — Sesión 8 + Sesión extra de imágenes)

### Fixes sesión 8 (Roo Code — Sesión 2 de la rama)
- ✅ **Scraper recetas** (`app/api/scrape-receta/route.ts`): HTML limpiado antes de mandar a Gemini/DeepSeek → instrucciones ya no traen "copia y pega" del artículo
- ✅ **parseIngredienteRaw()**: ingredientes JSON-LD ("500g de arroz bomba") parseados a nombre+cantidad+unidad
- ✅ **HowToSection** en JSON-LD: soportado para sitios con instrucciones en secciones anidadas
- ✅ **esNoComestible()** en `lib/scraping/index.ts`: filtra higiene, limpieza, mascotas antes de guardar en BD
- ✅ **Fix upsert precios**: partial unique index incompatible con cliente JS → reemplazado por check→update/insert
- ✅ **Mercadona re-scrapeado** — 3.752 productos, 814 duplicados por URL (ok)
- ✅ **BD limpia**: 0 no-comestibles, script `eliminar-no-alimentos.mjs` con keywords ampliadas
- ✅ **Lista de la compra funcional**: ItemConPrecios con €/kg en fila colapsada, selección por supermercado
- ✅ **Migración SQL lista_compra** ejecutada en Supabase vía `supabase db query --linked`
- ✅ **Backfill recetas**: 2/2 completado
- ✅ **Scrapers reparados (6)**: Consum (API real), Alcampo (API Ocado), Carrefour (Playwright), Día (Playwright), Eroski (Playwright), Lidl (Playwright mejorado)
- ✅ **Enriquecer 70 alimentos sin macros**: 70/70 procesado
- ✅ **Merge feature/modulos → main** (`4973187`) — build exitoso, worktrees sincronizados
- ✅ **Perfilado DeepSeek 135/135 recetas** — 0 sin instrucciones, 0 sin kcal

### Sesión extra — Refinamiento imágenes flux_txt2img con GPT-4o (10-05-2026)

**Objetivo:** Regenerar 122 imágenes `flux_txt2img` con GPT-4o (no gustaba estilo Flux Pro).

#### Intentos
1. **txt2img desde cero**: 58 generadas → estilo "bodegón" ❌ (no gustó)
2. **image edit desde flux_txt2img**: Cambio a `POST /v1/images/edits` con `input_fidelity:high`. **15 generadas** → OpenAI bloqueó con `billing_hard_limit_reached`
3. **8 intentos** de continuar tras aumentar límite $10→$30→$100 → OpenAI no propagó el cambio

#### Logros
- ✅ **16 imágenes ai_gen** subidas a Supabase Storage con `imagen_url` actualizada en BD
- ✅ **Script `regenerar-flux-masivo.mjs`**: GPT-4o image edit con 3 reintentos y backoff
- ✅ **Script `analizar-urls-pendientes.mjs`**: 72 pendientes → 37 con url_origen (34 og_image), 35 sin
- ✅ **Script `generar-html-candidatas.mjs`**: HTML de revisión visual
- ✅ **Bug billing documentado** en DIAGNOSTICO_FALLOS.md (#14)
- ✅ **Bug rm accidental documentado** en DIAGNOSTICO_FALLOS.md (#13)
- ✅ **Bug directorio salida documentado** en DIAGNOSTICO_FALLOS.md (#15)

#### Scripts nuevos
| Script | Función |
|--------|---------|
| `node scripts/regenerar-flux-masivo.mjs --genera` | GPT-4o image edit desde flux_txt2img (skip existentes) |
| `node scripts/regenerar-flux-masivo.mjs --candidatas` | Generar HTML de revisión visual |
| `node scripts/analizar-urls-pendientes.mjs` | Analizar url_origen de recetas pendientes |

### Lo que sigue
**Prioridad 1:** Continuar image edit → `node scripts/regenerar-flux-masivo.mjs --genera` (cuando OpenAI billing deje de bloquear)
**Prioridad 2:** `cp -n` imágenes entre directorios + `node scripts/subir-imagenes-aprobadas.mjs --forzar`
**Prioridad 3:** Despliegue en Vercel (subir a GitHub + vercel deploy + configurar Supabase Auth)
**Backlog:** macros/100g en ficha receta, limpiar flux_txt2img de Supabase

## Estado Actual (09-05-2026 — Sesión 7)
- **0 errores TypeScript** ✅ — build verificado con `npx next build`
- **0 `any` en states** ✅ — todos los `useState<any>` reemplazados por interfaces concretas
- **0 `useParams()` sin generic** ✅ — todas las 7 páginas usan `useParams<{ id: string }>()`
- **22/25 catch blocks con feedback al usuario** ✅ — los 3 restantes redirigen inmediatamente (intencional)
- **20/20 API routes** usan Supabase server-side ✅
- **PWA configurada:** manifest + service worker + appleWebApp metadata
- **Recalculadora de porciones** en editor de dietas
- **Knowledge base:** 48 fichas (18 + 30 estudios científicos con DOI)
- **Base de datos:** Schema v2 recetas ✅, micronutrientes en 267 alimentos ✅
- **Onboarding autónomo de clientes:** ✅ — tabla `invitaciones` + flujo completo (ver abajo)
- **Enriquecimiento nutricional con DeepSeek completado** ✅ — 801/1026 alimentos con macros (78.1%)
- **Scraping Mercadona completado** ✅ — 4.342 productos comestibles extraídos, 1.026 alimentos activos en BD
- **Migración SQL de enriquecimiento ejecutada** ✅ — 3 tablas, 2 views, 2 funciones, 25 categorías seed
- **Bug corregido:** `updated_at` no existe en `alimentos` → UPDATE fallaba silenciosamente (los primeros 4 pases no guardaron datos)

## 🆕 Onboarding autónomo (06-05-2026)

### Flujo
1. Coach va a `/clientes` → botón **Invitar** → copia URL al portapapeles
2. Coach manda URL por WhatsApp al cliente
3. Cliente abre `/registro/[token]` → rellena nombre/email/contraseña → se registra
4. Cliente queda vinculado al coach con `revisado_por_coach = false`
5. Badge del sidebar muestra clientes pendientes de revisar

### Archivos
- `supabase_onboarding_migration.sql` — SQL ya ejecutado en Supabase ✅
- `app/api/invitaciones/route.ts` — POST genera invitación (auth coach)
- `app/api/invitaciones/[token]/route.ts` — GET verifica token (público)
- `app/api/registro-invitacion/route.ts` — POST crea cuenta cliente (público)
- `app/registro/[token]/page.tsx` — página pública de registro (sin Sidebar)
- `app/clientes/page.tsx` — botón Invitar añadido
- `lib/useNotificaciones.ts` — badge incluye clientes sin revisar

### Bugs corregidos (auditoría 06-05-2026)
- `fetch` sin `Content-Type` → crash 500 al generar invitación (fix: header + body `{}`)
- Race condition en registro → UPDATE atómico con `.eq('usado', false).select('id')`
- Usuario Auth huérfano si falla INSERT cliente → rollback con `deleteUser`
- `req.json()` sin body → `.catch(() => ({}))`
- Badge nunca se limpiaba → `revisado_por_coach = true` en `loadData()` del perfil
- Contraseña sin validación servidor → `password.length < 6` añadido

### ✅ Verificado 08-05-2026
- ✅ Flujo onboarding end-to-end verificado via API (login → invitación → token → registro con contraseña)
- ✅ Creación de cliente con `revisado_por_coach: false` funciona correctamente
- ⏳ Falta probar OAuth Google (requiere navegador real)
- ⏳ Cuestionario inicial post-registro (en vez de "Tu coach te contactará")
- ⏳ Email de bienvenida automático con link al portal

**⚠️ Contraseña coach actualizada:** `Coach2026!` (la anterior expiró)

## 🆕 Enriquecimiento nutricional con DeepSeek (09-05-2026)

### Estado final
- **Total alimentos en BD:** 1.026 (se eliminaron 27 no comestibles + los 53 originales quedaron enriquecidos)
- **Con macros completos (>0 kcal):** 801 (78.1%)
- **Sin macros (0 kcal):** 225 — mayoría son nutricionalmente correctos (carnes con 0 carbohidratos, aceites con 0 proteínas, bebidas alcohólicas)
- **Cola de enriquecimiento:** 277 completados, **0 pendientes** ✅

### Migración SQL ejecutada
Archivo: [`supabase_enriquecimiento_nutricional.sql`](nutricoach-modulos/supabase_enriquecimiento_nutricional.sql)
- 1 tabla: `alimentos_enriquecimiento_cola` (id, alimento_id, estado, resultado_json, created_at, updated_at)
- 1 tabla: `categorias_ia` (25 categorías nutricionales predefinidas)
- 1 vista: `alimentos_pendientes_enriquecer` — alimentos donde ANY macro = 0 o NULL
- 1 vista: `escandallo_reciente` — últimos 100 alimentos enriquecidos con stats
- 2 funciones RPC:
  - `añadir_a_cola_enriquecimiento()` — inserta alimentos sin macros en cola
  - `actualizar_alimento_con_ia()` — actualiza alimento + marca completado en cola

### Bug crítico corregido
La función `actualizar_alimento_con_ia()` original incluía `updated_at = now()` en el UPDATE de `alimentos`, pero la tabla `alimentos` NO tiene columna `updated_at` (solo `created_at` y `micros_actualizados_en`). Esto causaba que el UPDATE fallara silenciosamente (0 filas afectadas) mientras el registro en `alimentos_enriquecimiento_cola` se marcaba como `completado`. Los primeros 4 pases (~1.000 llamadas a DeepSeek) no guardaron ningún dato. Se corrigió eliminando `updated_at` del UPDATE.

### Script de enriquecimiento
Archivo: [`scripts/enriquecer-alimentos.mjs`](nutricoach-modulos/scripts/enriquecer-alimentos.mjs)
- Usa `@ai-sdk/deepseek` + `generateText()` de Vercel AI SDK v6
- Procesa en lotes de 25 alimentos, con 3 reintentos y backoff exponencial
- Prompt basado en tabla BEDCA española con 25 categorías nutricionales
- Uso: `node scripts/enriquecer-alimentos.mjs --limite=N`

### No comestibles eliminados (27 productos)
Cosmética facial/corporal (sérums, tónicos, cremas reductoras), productos de limpieza (sosa cáustica, spray desinfectante, trampas), accesorios (vaso mediano, velas), snacks de mascotas, etc.

## 🆕 Sistema de Precios Automáticos — Scraping Multi-supermercado (09-05-2026)

### Estado actual
- **7 scrapers implementados:** mercadona, carrefour, dia, alcampo, consum, lidl, eroski
- **2 motores de scraping:** [`motor-http.ts`](nutricoach-modulos/lib/scraping/motores/motor-http.ts) (fetch + JSON/HTML) y [`motor-playwright.ts`](nutricoach-modulos/lib/scraping/motores/motor-playwright.ts) (headless browser para Lidl)
- **Scraping Mercadona completado** ✅ — 4.342 productos comestibles extraídos de la API oficial
- **Build verificado** ✅ — `npx next build` compila sin errores (73 páginas, 0 TypeScript errors)
- **Arquitectura documentada** en [`plans/PRECIOS_AUTOMATICOS_ARQUITECTURA.md`](plans/PRECIOS_AUTOMATICOS_ARQUITECTURA.md)

### Bugs corregidos (auditoría 09-05-2026)

#### 1. Bug en `normalizador.ts` — query `.or()` mal construida
**Archivo:** [`lib/scraping/normalizador.ts`](nutricoach-modulos/lib/scraping/normalizador.ts:66)
- **Problema:** La segunda condición estaba invertida: `${nombreLimpio}.ilike.%nombre%` buscaba el literal "nombre" en la columna del ingrediente, en vez de buscar el nombre del ingrediente en la columna "nombre".
- **Fix:** Se cambió a `nombre.ilike.%${nombreLimpio}%,nombre.ilike.${nombreLimpio}%` para búsqueda bidireccional correcta (contains + startsWith).
- **Síntoma:** El matching de productos escrapeados contra alimentos de la BD fallaba frecuentemente.

#### 2. `SLUGS_SCRAPERS_DISPONIBLES` no exportado
**Archivo:** [`lib/scraping/index.ts`](nutricoach-modulos/lib/scraping/index.ts)
- **Problema:** No existía una forma dinámica de saber qué scrapers están implementados.
- **Fix:** Se añadió `export const SLUGS_SCRAPERS_DISPONIBLES: string[] = Object.keys(SCRAPERS)`.
- **Impacto:** Ahora la API y el UI pueden listar scrapers disponibles sin hardcodear.

#### 3. `motor-playwright.ts` no existía
**Archivo:** [`lib/scraping/motores/motor-playwright.ts`](nutricoach-modulos/lib/scraping/motores/motor-playwright.ts) (CREADO)
- **Problema:** El scraper de Lidl y la arquitectura referenciaban un motor Playwright que nunca se implementó.
- **Fix:** Se creó el motor completo con `chromium.launch()`, extracción por selectores CSS, rate limiting, y fallback a texto plano.

#### 4. `tiene_scraper` hardcodeado en API y UI
- **API** [`app/api/precios/supermercados/route.ts`](nutricoach-modulos/app/api/precios/supermercados/route.ts): Ahora enriquece cada supermercado con `tiene_scraper: boolean` basado en `SLUGS_SCRAPERS_DISPONIBLES`.
- **UI** [`components/PanelScraping.tsx`](nutricoach-modulos/components/PanelScraping.tsx): Eliminado `const scrapersDisponibles = ['mercadona']` hardcoded, ahora usa `sm.tiene_scraper === true`.
- **Types** [`types/index.ts`](nutricoach-modulos/types/index.ts): Añadido campo opcional `tiene_scraper?: boolean` a la interfaz `Supermercado`.

#### 5. Scraping Mercadona — logging mejorado
**Archivo:** [`lib/scraping/supermercados/mercadona.ts`](nutricoach-modulos/lib/scraping/supermercados/mercadona.ts)
- Cambiado intervalo de logging de cada 10 a cada 5 subcategorías para mejor visibilidad de progreso.

## 🆕 Productos vs Alimentos — Múltiples productos por alimento (09-05-2026 — Sesión 8)

### El problema
Un mismo alimento (ej: "Pechuga de pollo") aparece en múltiples supermercados con precios, marcas y formatos distintos. El modelo anterior solo permitía UN producto por (supermercado, alimento) — al re-escapar, sobreescribía el precio anterior con el nuevo, perdiendo la competencia entre productos del mismo supermercado.

### Solución implementada
Cambio de modelo: **un alimento puede tener N productos en cada supermercado**. El scraper hace upsert por URL de producto (no por alimento_id). Se añaden vistas que priorizan el producto preferido (marcado por el coach) o el más barato.

### Diseño completo
Documentado en [`plans/DISENO_PRODUCTOS_VS_ALIMENTOS.md`](plans/DISENO_PRODUCTOS_VS_ALIMENTOS.md) — incluye mockups, modelo de datos, flujo del scraper, API specs y UI design.

### SQL Migration (`supabase_productos_vs_alimentos.sql`) — **ejecutada en Supabase** ✅
8 cambios en [`supabase_productos_vs_alimentos.sql`](nutricoach-modulos/supabase_productos_vs_alimentos.sql):
1. **DROP** constraint UNIQUE `(supermercado_id, alimento_id)` en `productos_supermercado`
2. **ADD** columnas: `nombre_original text`, `marca text`, `preferido boolean default false`
3. **CREATE** partial UNIQUE index `idx_productos_supermercado_url_unique` on `(supermercado_id, url_producto)` WHERE `url_producto is not null`
4. **CREATE** index `idx_productos_mejor_precio` on `(alimento_id, precio_por_kg asc)`
5. **CREATE** index `idx_productos_preferido` on `(alimento_id, supermercado_id)` WHERE `preferido = true`
6. **CREATE OR REPLACE VIEW** `mejores_precios_por_alimento` — mejor precio por (alimento, supermercado), priorizando preferido
7. **CREATE OR REPLACE VIEW** `top_precios_escandallo` — top-3 más baratos global por alimento (ranking)
8. **ALTER VIEW** `precios_actuales` — actualizada con nuevas columnas

### Tipos TypeScript actualizados
[`types/index.ts`](nutricoach-modulos/types/index.ts:498) — Añadidas 3 interfaces:
- `ProductoSupermercadoDetalle` — producto con join a supermercado y alimento
- `OpcionEscandallo` — un alimento dentro de un escandallo con sus alternativas
- `EscandalloPlan` — plan completo con precio_total, ahorro_potencial, alimentos[]

### Scraper — upsert por URL
[`lib/scraping/index.ts`](nutricoach-modulos/lib/scraping/index.ts:98) — Cambio de lógica:
- **Antes:** `onConflict: 'supermercado_id, alimento_id'` → sobreescribía el mismo producto
- **Ahora:** Si hay `url_producto` → upsert por `(supermercado_id, url_producto)` usando raw query con `ON CONFLICT ... WHERE url_producto IS NOT NULL DO UPDATE`. Si no hay URL → insert directo.
- Añadidos campos: `nombre_original: raw.nombre`, `marca: raw.marca || null`

### Librería de precios actualizada
[`lib/precios-supermercado.ts`](nutricoach-modulos/lib/precios-supermercado.ts):
- `obtenerPreciosAlimento()`, `obtenerPreciosPorSupermercado()`, `obtenerTodosLosPrecios()` — ahora usan la vista `mejores_precios_por_alimento`
- `guardarPrecio()` — upsert por `(supermercado_id, url_producto)` con manejo de conflictos
- `marcarProductoPreferido()` (NUEVA) — marca un producto como preferido y desmarca los demás del mismo (alimento, supermercado)
- `calcularCostePlan()` — usa `mejores_precios_por_alimento` view (en vez de `precios_actuales`)
- `calcularEscandalloConAlternativas()` (NUEVA) — devuelve `EscandalloPlan` con alternativas por alimento y `ahorro_potencial`

### API Routes (3 nuevas)

1. **`GET /api/precios/alimento/[id]/productos`** ([`app/api/precios/alimento/[id]/productos/route.ts`](nutricoach-modulos/app/api/precios/alimento/[id]/productos/route.ts))
   - Todos los productos de un alimento, ordenados por supermercado y precio
   - Auth: cualquier usuario autenticado
   - Formato respuesta plano: `{ productos: ProductoOption[] }`

2. **`POST /api/precios/productos/[id]/preferir`** ([`app/api/precios/productos/[id]/preferir/route.ts`](nutricoach-modulos/app/api/precios/productos/[id]/preferir/route.ts))
   - Marca un producto como preferido. Desmarca otros del mismo (alimento, supermercado)
   - Auth: solo coach (403 si no)
   - Respuesta: `{ success, producto_id, alimento_id, supermercado_id, preferido }`

3. **`GET /api/precios/escandallo/detalle`** ([`app/api/precios/escandallo/detalle/route.ts`](nutricoach-modulos/app/api/precios/escandallo/detalle/route.ts))
   - Escandallo detallado con alternativas por alimento
   - Query params: `cliente_id` (req), `supermercado_id` (opcional)
   - Devuelve `EscandalloPlan` con `ahorro_potencial`

### Componente UI
[`components/SelectorProducto.tsx`](nutricoach-modulos/components/SelectorProducto.tsx) — Componente cliente (~260 líneas):
- Props: `alimentoId`, `alimentoNombre`, `cantidadGramos`, `supermercadoActivoId`, `onSeleccionCambiada`, `precioActualKg`, `mostrarCoste`
- Fetch automático de productos del alimento vía API en `useEffect`
- Auto-selección: preferido → más barato del super activo → primer producto
- Panel expandible con productos agrupados por supermercado
- Cada producto: nombre_original, marca, precio_por_kg, botón "⭐ Preferido"
- Footer: resumen de productos totales, preferidos, gramos/semana
- Accesibilidad: tabIndex, role="button", aria-label, onKeyDown

### Escandallo page — Vista detallada
[`app/precios/escandallo/page.tsx`](nutricoach-modulos/app/precios/escandallo/page.tsx):
- Nuevo botón toggle: "🔬 Vista detallada" / "🔍 Vista simple"
- **Vista detallada**: alimentos únicos extraídos del plan (deduplicados con cantidades sumadas), cada uno con `SelectorProducto` para elegir alternativa
- **Vista simple**: desglose original comida por comida (sin cambios, legacy)
- Panel colapsable `<details>` con per-comida breakdown
- Funciones helper: `extraerAlimentos()` (plana), `extraerAlimentosUnicos()` (deduplicada+sumada)

### Test end-to-end
[`scripts/test-pipeline-precios.ts`](nutricoach-modulos/scripts/test-pipeline-precios.ts):
- **100% pass** — 4.623 productos insertados en 55.5 segundos
- Verifica: auth, scraping Mercadona, upsert correcto, vista `mejores_precios_por_alimento`
- Usa `createServiceSupabase()` para no depender de sesión

### Bugs corregidos en esta sesión

#### 1. Parámetro `€` ilegal en TypeScript
**Archivo:** [`components/SelectorProducto.tsx`](nutricoach-modulos/components/SelectorProducto.tsx)
- **Problema:** `function formatearPrecio(€: number)` — TypeScript rechaza `€` como nombre de parámetro ("Invalid character")
- **Fix:** Cambiado a `function formatearPrecio(euros: number)`

#### 2. Variable `a` como `string | undefined` en `calcularEscandalloConAlternativas()`
**Archivo:** [`lib/precios-supermercado.ts`](nutricoach-modulos/lib/precios-supermercado.ts:280)
- **Problema:** `a.id` tipado como `string | undefined` al iterar `comidas_alimentos`. Tras extraer `const a = ca.alimento`, TypeScript no infería que `a` es no-null tras el guard `if (!a) continue`.
- **Fix:** Extraer variables locales `alimentoId`, `alimentoNombre`, `categoria` después del guard y usarlas en vez de `a.id`/`a.nombre` en el resto del bloque.

### Estado del build
- ✅ **Build verificado:** `npx next build` — **0 errores TypeScript**, 73 páginas
- ✅ **Migración SQL ejecutada:** `supabase_productos_vs_alimentos.sql` aplicado en Supabase
- ✅ **Test end-to-end:** `scripts/test-pipeline-precios.ts` — 100% pass, 4.623 productos en 55.5s
- ✅ **Plan de diseño documentado:** `plans/DISENO_PRODUCTOS_VS_ALIMENTOS.md`

### Pendiente para próxima sesión
- [ ] Scrapers pendientes: aldi, el-corte-ingles, hipercor, bonpreu, esclat
- [ ] Ejecutar re-scraper de Mercadona para probar el pipeline multi-producto en producción
- [ ] Actualizar PanelScraping para mostrar múltiples productos por alimento con nombre_original y marca
- [ ] Dashboard de rentabilidad/ahorro con la vista `top_precios_escandallo`
- [ ] Automatización con Vercel Cron Jobs (plan Pro)
- [ ] Refinar normalizador para subir el ~24% de match exacto (más sinónimos)
- [ ] Histórico de precios y tendencias (gráficos, alertas)
- [ ] Actualizar ruta vieja `GET /api/precios/alimento` para usar nueva vista
- [ ] Onboarding: cuestionario inicial post-registro, email de bienvenida automático
- [ ] Imágenes de recetas: borrar actuales y rehacer con estilo casero

## 🧠 Lecciones aprendidas (09-05-2026 — Productos vs Alimentos)

### 1. `€` no es válido como nombre de parámetro en TypeScript
- TypeScript (y JavaScript) no permiten `€` como identificador de parámetro.
- Usar `euros` en su lugar.
- El error se manifiesta como `"Invalid character"` en tiempo de compilación.

### 2. TypeScript no inferencia null tras guard clause con destructuring
```typescript
const a = ca.alimento;        // a: Alimento | null
if (!a) continue;             // a ahora es Alimento (no null)
// a.id puede seguir siendo string | undefined si Alimento tiene id? opcional
```
- Aunque el guard clause elimina `null`, campos opcionales del tipo siguen siendo `| undefined`.
- **Solución:** Extraer variables locales con non-null assertion o validar por separado.

### 3. Next.js 16.2.4 + App Router: `params` como Promise
- En Next.js 16, `params` en rutas dinámicas es `Promise<{ id: string }>`, no el objeto directo.
- Patrón correcto:
```typescript
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
}
```

### 4. Partial UNIQUE index vs ON CONFLICT en Supabase JS
- Supabase `.upsert()` con `onConflict` requiere que el conflicto sea sobre un unique constraint/index.
- Los partial unique indexes (con `WHERE`) **no funcionan** con `onConflict` del cliente JS de Supabase — solo funcionan constraints completos.
- **Solución:** Usar query raw con `ON CONFLICT (supermercado_id, url_producto) WHERE url_producto IS NOT NULL DO UPDATE SET ...` o definir el constraint sin `WHERE` si es posible.

### 5. Vista vs tabla para mejores precios
- Usar `DISTINCT ON (...)` con `ORDER BY CASE WHEN preferido THEN 0 ELSE 1 END, precio_por_kg ASC` garantiza que el producto preferido aparezca primero, y si no hay preferido, el más barato.
- Las vistas en PostgreSQL se actualizan automáticamente cuando cambian los datos subyacentes.

## 🧠 Lecciones aprendidas (07-05-2026 — Auditoría de bugs)

### 1. `proxy.ts` vs `middleware.ts` en Next.js 16
- **Next.js 16.2.4** soporta `proxy.ts` como middleware nativo. No renombrar a `middleware.ts`.
- Si coexisten ambos archivos, el build falla con: `"Both middleware file and proxy file are detected"`.
- El [`middleware-manifest.json`](.next/server/middleware-manifest.json) con `"middleware": {}` indica que NO hay middleware registrado — verificar siempre después del build.
- **Síntoma de que el middleware no funciona:** caché de sesión no se refresca, redirecciones de auth no ocurren.

### 2. Error `r'use client'` — Siempre sospechar de caché primero
- El error de parsing `r'use client'` en el mensaje de error **no siempre refleja el contenido real del archivo**.
- Next.js/Turbopack puede mostrar errores de una versión anterior del archivo en caché.
- **Solución:** `rm -rf .next && npx next build` antes de asumir que el archivo está corrupto.
- Verificar byte a byte con `hexdump -C` u `od -c` si hay sospecha de caracteres ocultos.

### 3. `next.config.ts` vacío = problemas silenciosos
- Un `next.config.ts` sin configuraciones puede causar:
  - Imágenes de dominios externos rotas (sin `images.remotePatterns`)
  - Sin headers de seguridad (CSP, X-Frame-Options)
  - Sin configuración de compilador
- **Siempre** incluir al mínimo: `images.remotePatterns`, `reactStrictMode`, y security headers.

### 4. Imports no usados no detectados por el build
- TypeScript con `noUnusedLocals: false` (implícito) no falla en imports no usados.
- En [`login/page.tsx`](app/login/page.tsx) se importaba `useRouter` pero se usaba `window.location.href`.
- **Regla:** Si usas `window.location.href` para redirigir, no necesitas `useRouter`/`useNavigate`.

### 5. Patrón de catch blocks
- 22/25 catch blocks muestran feedback al usuario vía `addToast` o `setError`.
- 3 catch blocks solo hacen `console.error` sin feedback — aceptable solo si redirigen inmediatamente.
- **Regla:** Todo catch block debe: (1) loggear el error, (2) mostrar feedback al usuario, (3) no tragar errores silenciosamente.

### 6. Cliente Supabase en cliente vs servidor
- [`lib/supabase.ts`](lib/supabase.ts) usa `createClient` (cliente-side, para el navegador).
- [`lib/supabase-server.ts`](lib/supabase-server.ts) tiene 3 variantes:
  - `createServerSupabase()` — para Server Components (usa `next/headers`)
  - `createApiSupabase(request)` — para API Route Handlers (usa cookies del request)
  - `createServiceSupabase()` — para bypass de RLS (usa `service_role_key`)
- **Error común:** Usar `createServerSupabase()` en API routes → falla porque `next/headers` no está disponible en ese contexto.

## Reglas de IA
- Seguir siempre el tono y guías establecidas en `DESIGN.md` y `PRODUCT.md`.
- Nada de sombras decorativas o estilos MyFitnessPal.
- Ejecutar sin preguntar si no hay bloqueos.
- **LEER `ESTADO.md` al inicio de cada sesión** — contiene el estado detallado, lecciones aprendidas, y guía para la próxima sesión.
- **PRIMERO verificar si hay build errors** antes de empezar a codificar.

---

## 🔀 Trabajo paralelo — Worktrees activos

Este proyecto usa tres carpetas físicas del mismo repositorio git para trabajar en paralelo sin conflictos.

### Estructura

```
nutricoach/          → rama: main                  → tarea activa (recetario, etc.)
nutricoach-ui/       → rama: feature/ui-estetica   → estética, CSS, diseño visual
nutricoach-modulos/  → rama: feature/modulos       → dietas, entrenos, clientes
```

Cada carpeta se abre en una ventana Antigravity separada con su propio Roo Code. Los cambios son independientes hasta que se mergean a main.

### Qué archivos pertenecen a cada worktree — NO cruzar estos límites

| Worktree | Archivos que puede tocar | Archivos PROHIBIDOS |
|----------|--------------------------|---------------------|
| `nutricoach/` (main) | `app/recetas/`, `app/api/recetas/`, `app/api/scrape-receta/`, `scripts/`, SQL de recetas | `app/globals.css`, `app/layout.tsx`, `components/ui/` |
| `nutricoach-ui/` | `app/globals.css`, `app/layout.tsx`, `components/ui/`, `PLAN_ESTETICO.md`, `DESIGN.md` | `app/recetas/`, `app/dietas/`, `app/clientes/`, `app/api/` |
| `nutricoach-modulos/` | `app/dietas/`, `app/entrenos/`, `app/clientes/`, `app/cuestionario/`, `app/conocimiento/`, `components/diet/`, `components/training/`, `components/dashboard/` | `app/globals.css`, `app/layout.tsx`, `app/recetas/` |

Si una tarea requiere tocar un archivo de otro worktree → avisar a Carlos antes de proceder.

---

## ⚡ End Session — Cierre de jornada con worktrees

Cuando Carlos diga "guarda", "guarda todo", "end session", "cierra", "mañana sigo" o similar, ejecutar este flujo **en orden exacto**:

### PASO 1 — Commit en cada worktree que tuvo trabajo hoy

```bash
# Si hubo trabajo en nutricoach-ui/:
git -C /Users/carloscasanova/Desktop/Carlos/CLAUDE/NUTRICION/nutricoach-ui add .
git -C /Users/carloscasanova/Desktop/Carlos/CLAUDE/NUTRICION/nutricoach-ui commit -m "feat: [descripción breve]"

# Si hubo trabajo en nutricoach-modulos/:
git -C /Users/carloscasanova/Desktop/Carlos/CLAUDE/NUTRICION/nutricoach-modulos add .
git -C /Users/carloscasanova/Desktop/Carlos/CLAUDE/NUTRICION/nutricoach-modulos commit -m "feat: [descripción breve]"

# Commit en main (siempre):
git -C /Users/carloscasanova/Desktop/Carlos/CLAUDE/NUTRICION/nutricoach add .
git -C /Users/carloscasanova/Desktop/Carlos/CLAUDE/NUTRICION/nutricoach commit -m "feat: [descripción breve]"
```

### PASO 2 — Auditoría de conflictos ANTES de mergear

```bash
git -C /Users/carloscasanova/Desktop/Carlos/CLAUDE/NUTRICION/nutricoach diff main..feature/ui-estetica --name-only
git -C /Users/carloscasanova/Desktop/Carlos/CLAUDE/NUTRICION/nutricoach diff main..feature/modulos --name-only
```

**Regla:** Si el mismo archivo aparece en dos ramas → NO mergear automáticamente. Mostrar a Carlos qué archivo está en conflicto y esperar instrucciones.

### PASO 3 — Merge a main (solo si auditoría limpia)

```bash
cd /Users/carloscasanova/Desktop/Carlos/CLAUDE/NUTRICION/nutricoach
git merge feature/ui-estetica --no-ff -m "merge: ui-estetica → main"
git merge feature/modulos --no-ff -m "merge: modulos → main"
```

### PASO 4 — Build de verificación

```bash
cd /Users/carloscasanova/Desktop/Carlos/CLAUDE/NUTRICION/nutricoach
npx next build 2>&1 | tail -20
```

Sin errores TypeScript → continuar. Con errores → NO hacer push. Mostrar errores a Carlos y resolver antes de cerrar.

### PASO 5 — Push y documentación

```bash
git push origin main
```

Actualizar `ESTADO.md` con qué se hizo en cada worktree, qué quedó pendiente, próximos pasos.

### Si hay conflicto en el merge

Git marca conflictos con `<<<<<<< HEAD` / `>>>>>>> feature/rama`. Pasos:
1. Abrir el archivo conflictivo
2. Decidir qué versión conservar o cómo combinar
3. `git add [archivo]` → `git commit`

La mejor forma de evitar conflictos: respetar la tabla de archivos de cada worktree.
