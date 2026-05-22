# CLAUDE.md — NutriCoach (Human Lab)

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

### ⚡ REGLAS PARA PRÓXIMAS SESIONES
1. Preguntar siempre antes de consumir APIs externas.
2. Probar scripts con `node --check` primero.
3. Usar `--limit N` pequeño primero.
4. NUNCA usar `URL` como nombre de variable.
5. Manejar 416 en toda paginación.
6. Siempre tener plan B.
7. Documentar en CALIENTE.

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
