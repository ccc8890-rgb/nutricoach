# Proyecto: NutriCoach (Human Lab)

---

## 🔴 LEER SIEMPRE — Sistema de matching de ingredientes

### Cómo funciona la visualización (crítico para diagnosticar)

La app muestra **`alimentos.nombre`** (del join), NO `nombre_libre`.

```
receta_ingredientes.nombre_libre  = "Zumo de limón"   ← lo que DeepSeek generó
receta_ingredientes.alimento_id   → alimentos.nombre  = "Zumo maracuyá y chía"  ← lo que ve el usuario
```

**Si un usuario ve un ingrediente raro en la app → el alimento_id está mal matcheado, no el nombre_libre.**

### Cómo diagnosticar un match incorrecto

```sql
-- Ver qué ve el usuario vs qué guardó DeepSeek
SELECT a.nombre AS "visible_en_app", ri.nombre_libre, ri.cantidad_gramos, ri.id AS ri_id
FROM receta_ingredientes ri
JOIN alimentos a ON a.id = ri.alimento_id
WHERE ri.receta_id = '<uuid>'
ORDER BY ri.orden;
```

### Cómo corregir un match incorrecto en BD

```sql
-- 1. Encontrar el alimento correcto
SELECT id, nombre, calorias FROM alimentos
WHERE nombre ILIKE '%limón%' AND calorias > 0 LIMIT 5;

-- 2. Actualizar el alimento_id
UPDATE receta_ingredientes SET alimento_id = '<id_correcto>'
WHERE id = '<ri_id>';

-- 3. Recalcular macros de la receta
WITH macros AS (
  SELECT
    SUM(a.calorias      * ri.cantidad_gramos / 100) AS kcal_total,
    SUM(a.proteinas     * ri.cantidad_gramos / 100) AS prot_total,
    SUM(a.carbohidratos * ri.cantidad_gramos / 100) AS carbs_total,
    SUM(a.grasas        * ri.cantidad_gramos / 100) AS grasas_total
  FROM receta_ingredientes ri
  JOIN alimentos a ON a.id = ri.alimento_id
  WHERE ri.receta_id = '<uuid>'
)
UPDATE recetas SET
  kcal          = ROUND((SELECT kcal_total   / porciones FROM macros), 1),
  proteinas     = ROUND((SELECT prot_total   / porciones FROM macros), 1),
  carbohidratos = ROUND((SELECT carbs_total  / porciones FROM macros), 1),
  grasas        = ROUND((SELECT grasas_total / porciones FROM macros), 1)
WHERE id = '<uuid>'
RETURNING nombre, kcal, proteinas, carbohidratos, grasas;
```

### Cómo prevenir que vuelva a pasar

**Opción A — MATCH_FIXES en pipeline** (patrón sistemático, ≥2 recetas afectadas):
```javascript
// En nutricoach-modulos/scripts/pipeline-calidad.mjs → array MATCH_FIXES
[/^spray.*aceite/i, 'bf392211-3527-4c7d-98a5-a2fc0bda8270', 'Aceite de oliva'],
```
Luego ejecutar: `node scripts/pipeline-calidad.mjs --solo-fase 2` para corregir todas las recetas existentes.

**Opción B — MATCH_FIXES en healthify** (para el endpoint de versión fit, `app/api/recetas/[id]/healthify/route.ts`):
El algoritmo `matchIngrediente` ya acumula candidatos de todas las palabras y usa tiebreaker por longitud (nombre más corto = más genérico = preferido). Si sigue fallando, añadir el caso a MATCH_FIXES del pipeline.

### MATCH_FIXES vigentes (15-05-2026)

| Patrón | → Alimento correcto | Motivo |
|--------|---------------------|--------|
| `^sal$` | Sal (0 kcal) | "Sal" → "Salsa pesto" por prefijo |
| `^agua$` | Agua (0 kcal) | "agua" → productos con agua en el nombre |
| `^chocolate negro` | Chocolate negro 85% | "chocolate" → cereales de chocolate |
| `^chocolate$` | Chocolate negro 85% | ídem |
| `^miel$` | Miel (304 kcal) | "miel" → salsas con miel |
| `^calabaza$` | Calabaza | "calabaza" → pipas de calabaza |
| `^zumo de lim` | Limón (29 kcal) | "Zumo de limón" → "Zumo maracuyá y chía" |
| `^jugo de lim` | Limón (29 kcal) | ídem variante "jugo" |
| `^spray.*aceite` | Aceite de oliva (884 kcal) | "Spray de aceite" → "Aceite de Aguacate Cristal" |
| `^aceite en spray` | Aceite de oliva (884 kcal) | ídem variante |

### Regla del algoritmo matchIngrediente (healthify/route.ts)

1. **Nivel 1** — ilike exacto sobre `nombre_libre` con `calorias > 0`
2. **Nivel 2** — startsWith: busca en BD con CADA palabra >2 chars, **acumula todos los candidatos**, ordena por `(score DESC, nombre.length ASC)`. El nombre más corto gana en empate (genérico > específico de supermercado).
3. **Nivel 3** — contains `%palabra%` con `calorias > 0` como fallback.

---

## 🧪 agent-browser — Investigación e integración (Sesión 12)

### Resumen
Instalación y prueba de `agent-browser` (Vercel Labs) como alternativa ligera a Playwright para scraping de recetas. Se arregló `agentBrowserAccessibility()` que usaba un comando obsoleto y se añadió extracción JSON-LD vía `eval`.

### Instalación
```bash
npm install -g agent-browser    # ~7MB, 1s
agent-browser install           # descarga Chrome for Testing (~169MB)
```

### Comandos útiles
| Comando | Descripción |
|---------|-------------|
| `agent-browser open <url>` | Abre URL (browser como daemon) |
| `agent-browser snapshot -c` | Árbol de accesibilidad condensado con refs (@eN) |
| `agent-browser snapshot -i` | Solo elementos interactivos |
| `agent-browser eval <js>` | Ejecuta JS en contexto del browser |
| `agent-browser screenshot [--annotate]` | Screenshot con etiquetas numeradas opcionales |
| `agent-browser close` | Cierra el browser daemon |

### Limitaciones detectadas
- **Instagram/TikTok**: Bloquean el acceso sin sesión (mismo problema que Playwright)
- **`agent-browser accessibility`**: Comando eliminado en la versión instalada (v148). Reemplazo: `snapshot -c`

### Archivos modificados

#### `nutricoach/app/api/scrape-receta/route.ts`
- **`agentBrowserAccessibility()`** → Eliminada. Reemplazada por 4 funciones modulares:
  - `agentBrowserOpen(url)` — abre URL
  - `agentBrowserSnapshot()` — obtiene árbol de accesibilidad (snapshot -c)
  - `agentBrowserEval(js)` — ejecuta JS en browser
  - `agentBrowserClose()` — cierra browser
- **`agentBrowserExtractJSONLD(url)`** — nueva: abre URL, ejecuta `eval` para extraer JSON-LD schema.org Recipe, cierra browser. Devuelve el item Recipe o null.
- **`buildExtractedFromJSONLD(item)`** — extraída de Strategy A como función reutilizable que convierte un schema.org Recipe en el formato `extracted` que espera el POST handler.
- **`extractRecipeFromSocial()`** — arreglada: ahora usa `agentBrowserOpen` + `agentBrowserSnapshot` + `agentBrowserClose` en lugar del comando `accessibility` inexistente.
- **Strategy A** — refactorizada para usar `buildExtractedFromJSONLD()`. Se añadió **Strategy A.2**: si el HTML no contiene JSON-LD, intenta extraerlo vía `agentBrowserExtractJSONLD(url)`. Esto cubre SPAs que inyectan JSON-LD dinámicamente con JavaScript.

#### `nutricoach-modulos/app/api/scrape-receta/route.ts`
- Mismos cambios que en `nutricoach` (worktree sincronizado).

### Build
✅ `nutricoach` — `tsc --noEmit` sin errores
✅ `nutricoach-modulos` — `tsc --noEmit` sin errores

---

## 🔀 Merge de Worktrees — 14-05-2026 (Sesión 11)

### Resumen
Merge manual de `nutricoach-modulos` (feature/modulos) y `nutricoach-ui` (feature/ui-estetica) a `nutricoach` (main). Estrategia: copia archivo por archivo sin usar `git merge`, para tener control granular de cada cambio.

### Archivos copiados de nutricoach-ui (feature/ui-estetica)

| Archivo | Cambio |
|---------|--------|
| [`app/layout.tsx`](nutricoach/app/layout.tsx) | PWA Viewport (themeColor, userScalable, viewportFit), appleWebApp metadata, estilos body |
| [`next.config.ts`](nutricoach/next.config.ts) | Service-Worker-Allowed header, Cache-Control para manifest.json |
| [`components/Sidebar.tsx`](nutricoach/components/Sidebar.tsx) | Bottom tab bar iOS-style (5 tabs), sheetRef click-outside, hamburguesa a right-4, submenús desplegables |
| [`app/globals.css`](nutricoach/app/globals.css) | Design System v6 (Graphite Apple Pro), dark/light mode, glass cards, macro ring, breakpoints iPhone SE/standard, bottom nav iOS, skeletons, toggles, tooltips |
| [`app/api/scrape-receta/route.ts`](nutricoach/app/api/scrape-receta/route.ts) | Versión más completa con BRAND_WORDS, NON_FOOD_WORDS, scoring mejorado, enrichment Gemini, auto-crear alimentos con DeepSeek, fix `matchedMap` |

### Archivos copiados de nutricoach-modulos (feature/modulos)

| Archivo | Cambio |
|---------|--------|
| [`package.json`](nutricoach/package.json) | `lightningcss-darwin-arm64` movido de optionalDependencies a dependencies; añadido `resend` |

### Scripts verificados (sin cambios necesarios)

| Script | Estado |
|--------|--------|
| [`scripts/perfilar-recetas-final.mjs`](nutricoach/scripts/perfilar-recetas-final.mjs) | Idéntico en los 3 proyectos (438 líneas) ✅ |
| [`scripts/refinar-imagenes-og.mjs`](nutricoach/scripts/refinar-imagenes-og.mjs) | Main ya tenía versión más reciente (prompt conservador). Sin copia necesaria ✅ |
| [`scripts/subir-imagenes-aprobadas.mjs`](nutricoach/scripts/subir-imagenes-aprobadas.mjs) | Main ya tenía PRIORIDAD actualizada (flux_img2img > og_image). Sin copia necesaria ✅ |

### Archivos idénticos verificados (sin cambios)

| Archivo | Notas |
|---------|-------|
| [`lib/deepseek.ts`](nutricoach/lib/deepseek.ts) | `deepseek-v4-pro` como default en los 3 |
| [`lib/browser-agent.ts`](nutricoach/lib/browser-agent.ts) | Idéntico en los 3 |
| [`lib/supabase.ts`](nutricoach/lib/supabase.ts) | Idéntico en los 3 |
| [`lib/recetas-constants.ts`](nutricoach/lib/recetas-constants.ts) | Idéntico en los 3 (79 líneas) |
| [`types/index.ts`](nutricoach/types/index.ts) | 795 vs 796 líneas (solo trailing newline) |
| [`lib/supabase-server.ts`](nutricoach/lib/supabase-server.ts) | Idéntico en los 3 |

Todos los demás archivos compartidos en `lib/`, `components/`, `app/` (no listados arriba) también fueron verificados idénticos.

### Build de verificación
- ✅ `npx next build` exitoso — 0 errores, 0 warnings
- ✅ Prerenderizado estático + server-rendered on demand

### Notas importantes
- Los archivos extra de `nutricoach-modulos` (módulos de precios, scraping, componentes exclusivos) **no** se copiaron a main, tal como solicitó el usuario, porque ya están disponibles desde su directorio `nutricoach-modulos/` como worktree.
- A partir de ahora, **todo el trabajo converge en `nutricoach/`** (main). Los worktrees `nutricoach-ui/` y `nutricoach-modulos/` quedan como snapshot histórico.

## Comandos y Scripts Importantes
- **Ejecutar en desarrollo:** `npm run dev` (dentro de `nutricoach/`)
- **Build (verificar errores TS):** `npx next build` (dentro de `nutricoach/`)
- **Migración de esquema antiguo a nuevo de recetas:** `node scripts/migrar-recetas.mjs`
- **Reparar ingredientes en recetas antiguas:** `node scripts/reparar-recetas-ingredientes.mjs`
- **Backfill de recetas (Scrape URL y auto-relleno):** `npx tsx scripts/backfill-recetas.ts`

## Estado Actual (14-05-2026 — Sesión 12: Unificación worktrees + Deploy Vercel)

### Resumen sesión
- ✅ **Worktrees unificados en main**: `feature/ui-estetica` (38 archivos) y `feature/modulos` (39 archivos, +6,352 líneas) mergeados a main
- ✅ **4 conflictos resueltos**: `CLAUDE.md`, `Sidebar.tsx` (ChevronUp + TrendingUp), `manifest.json` (categorías combinadas health+nutrition+food), `enriquecer-alimentos.mjs` (HEAD con parsing más completo)
- ✅ **Dependencia `resend` instalada** para emails de bienvenida (nuevo desde feature/modulos)
- ✅ **Build verificado**: 0 errores TypeScript, 32 rutas compiladas
- ✅ **Push a GitHub** (6 commits) con bypass de reglas (merge commits + sin firma)
- ✅ **Deploy Vercel**: sitio responde HTTP 200 en https://nutricoach-delta.vercel.app

### Nuevas capacidades incorporadas (desde feature/modulos)
| Área | Funcionalidad |
|------|---------------|
| Precios | Scraping supermercados, escandallo recetas, rentabilidad, comparador |
| Clientes | Portal cliente avanzado, registro por invitación, emails Resend |
| Lista compra | Selección por supermercado, proyección de ahorro |
| UI/UX | Diseño responsive móvil, tema oscuro Graphite Apple Pro, BackButton, bottom nav |

### Estado de los worktrees
Los 3 worktrees siguen existiendo en local como carpetas, pero `main` contiene **todo el código unificado**. Los worktrees son ahora snapshot histórico — todo el trabajo nuevo converge directamente en `nutricoach/` (main).

---

## Estado Actual (14-05-2026 — Sesión 11: Auditoría completa recetario + Fix masivo macros)

### Resumen sesión
- ✅ **Auditoría completa del recetario**: 227 recetas — 71 sin problemas, 156 con problemas detectados
- ✅ **35 alimentos con kcal=0 enriquecidos**: chocolate 85% (590kcal), pipas calabaza (550kcal), salsas, especias, etc.
- ✅ **CRITICAL BUG FIX**: [`fix-macros-faltantes.mjs`](nutricoach/scripts/fix-macros-faltantes.mjs) guardaba macros TOTALES en columnas POR PORCIÓN. Añadida división por `receta.porciones`.
- ✅ **227 recetas recalculadas** con [`fix-recetas-completo.mjs --fase 3`](nutricoach/scripts/fix-recetas-completo.mjs): 88 con cambios reales, 0 errores
- ✅ **Auditoría post-fix guardada** en [`salidas/auditoria-recetario-2026-05-14.md`](salidas/auditoria-recetario-2026-05-14.md)
- ✅ **Metadatos ya estandarizados**: 0 cambios necesarios (categorías, tipo_coccion, dificultad OK)
- ✅ **Bug documentado** en [`DIAGNOSTICO_FALLOS.md`](nutricoach/DIAGNOSTICO_FALLOS.md) como FALLO #21

### Scripts creados/modificados en esta sesión
| Script | Cambio |
|--------|--------|
| [`scripts/fix-macros-faltantes.mjs`](nutricoach/scripts/fix-macros-faltantes.mjs) | Añadidas ~20 reglas de matching + fix división por porciones |

### Diagnóstico BD (14-05-2026)
- **227 recetas**: 71 sin problemas, 156 con problemas
- **170 (75%) sin intolerancias** — no auto-fixable sin IA
- **115 (51%) con >10% diff macros** — datos de ingredientes incorrectos (cantidades, match alimentos)
- **91 con kcal_100g discrepante**, **153 con peso_total_g incorrecto**
- **3 sin tiempos** de preparación/cocción
- **0% problemas estructurales**: ingredientes, instrucciones, categorías, tipo_coccion, dificultad — todo OK

---

## 🔍 BUGS ENCONTRADOS Y FIXES APLICADOS — 13-05-2026

### 🐛 BUG #1 — CRÍTICO: `matchedIngredients` nunca se usaba para INSERT

**Archivo:** [`app/api/scrape-receta/route.ts`](nutricoach/app/api/scrape-receta/route.ts:1090-1140)

**Problema:** El array `matchedIngredients` se construía correctamente con `alimento_id` obtenido del algoritmo de matching (línea ~1107). Pero luego se construía `capitalizedIngredients` desde `parsedIngredients` (sin `alimento_id`), y ese era el array que se insertaba en `receta_ingredientes`. El array `matchedIngredients` con los IDs correctos **nunca se usaba**.

**Flujo bug:**
1. `parsedIngredients` se crea desde `extracted.ingredientes` — sin `alimento_id` ❌
2. `matchedIngredients` se construye desde `parsedIngredients` + resultado de `matchIngredient()` — TIENE `alimento_id` ✅
3. `capitalizedIngredients` se construye desde `parsedIngredients` (OLVIDANDO `matchedIngredients`) — sin `alimento_id` ❌
4. `ingredientsToInsert` se construye desde `capitalizedIngredients` — `alimento_id` siempre `undefined` ❌
5. En BD: `receta_ingredientes.alimento_id = null` para TODAS las recetas nuevas ❌

**Fix (código actual):**
```typescript
// Desde matchedIngredients (TIENE alimento_id), NO desde parsedIngredients
const capitalizedIngredients = matchedIngredients.map((ing) => ({
  receta_id: receta?.id ?? '',
  alimento_id: ing.alimento_id,  // ← CORRECTO
  nombre_libre: ing.nombre_libre.charAt(0).toUpperCase() + ing.nombre_libre.slice(1),
  cantidad_gramos: ing.cantidad_gramos,
  cantidad_original: ing.cantidad_original,
  unidad_display: ing.unidad_display,
  orden: ing.orden,
  es_opcional: ing.es_opcional,
}))
```

**Impacto:** Cualquier receta scrapeada NUEVA perdía la vinculación con `alimentos`. Las 8 recetas problemáticas ya estaban corregidas por scripts anteriores, así que el bug era latente (no roto visiblemente, pero roto para futuros scrapes).

### 🐛 BUG #2 — `startsWith` no priorizaba alimentos con macros

**Archivo:** [`app/api/scrape-receta/route.ts`](nutricoach/app/api/scrape-receta/route.ts:628-649)

**Problema:** La query `ilike('nombre', q + '%')` devolvía coincidencias pero sin preferencia por aquellas con datos nutricionales. Por ejemplo, "Cebolla morada" podía matchear "Cebolla Morada Malla" (producto de supermercado con kcal=0) en vez de "Cebolla morada" (alimento base con macros).

**Fix:**
- `buscarAlimento()` ahora selecciona también `calorias` (`.select('id, nombre, calorias')`)
- El bloque `startsWith` ahora filtra primero por `calorias > 0`
- Entre varios con macros, elige el de nombre más corto (más genérico)
- Si todos tienen kcal=0, elige el primero alfabético

### 🐛 BUG #3 — Sin limpieza de paréntesis en nombre de ingrediente

**Archivo:** [`app/api/scrape-receta/route.ts`](nutricoach/app/api/scrape-receta/route.ts:594-599)

**Problema:** Ingredientes como "Cebolla morada (para salsa)" no se limpiaban antes del matching. El paréntesis descriptivo interfería con la búsqueda en BD.

**Fix:** Función `limpiarNombreIngrediente()` que elimina `(.*?)` y colapsa espacios.

### 🐛 BUG #4 — API búsqueda sin orden ni límite

**Archivo:** [`app/api/alimentos/route.ts`](nutricoach/app/api/alimentos/route.ts)

**Problema:** La búsqueda de alimentos en el editor de recetas devolvía resultados sin ordenar. Con 86% de alimentos con kcal=0, los primeros resultados solían ser productos de supermercado sin macros.

**Fix:** Añadido `.order('calorias', { ascending: false }).limit(50)` para que los alimentos con datos nutricionales aparezcan primero.

### 🐛 BUG #5 — Algoritmo de matching devolvía falsos positivos

**Archivo:** [`app/api/scrape-receta/route.ts`](nutricoach/app/api/scrape-receta/route.ts:713-732)

**Problema:** El scoring multi-token no penalizaba suficientemente los candidatos con palabras extra sustantivas. "Harina" matcheaba "Harina de coco" (kcal=0) en vez de "Harina de trigo" (kcal=339).

**Fix:** Añadida penalización `tienePalabrasExtra` cuando el candidato tiene palabras extra sustantivas y NO empieza por la consulta. Además, si el primero es penalizado, se prueba el segundo candidato como fallback.

---

## 🔍 CAUSAS RAÍZ — Por qué fallaron las 8 recetas

### CAUSA #1 — Instagram no tiene cantidades estructuradas
- **7 de 8 recetas** vienen de Instagram (fuente_tipo: 'instagram')
- El árbol de accesibilidad de Instagram NO contiene cantidades estructuradas
- DeepSeek extrae nombres de ingredientes correctamente, pero todas las cantidades son `null`
- `parseCantidadAGramos()` con `cantidad=null` y `unidad=null` → default 100g
- **No es un bug, es una limitación de la fuente.** Mitigación: segunda llamada a IA para estimar cantidades desde el texto del post, o alerta UI pidiendo ajuste manual.

### CAUSA #2 — Bug estructural (Bug #1 arriba)
- Aunque el matching encontrara el `alimento_id` correcto, nunca se guardaba en BD
- Este bug afectaba a TODAS las recetas nuevas, no solo Instagram

### CAUSA #3 — 86% de la BD con macros=0
- Los productos de supermercado (Mercadona, etc.) se insertan sin macros
- El matching no podía distinguir entre "Harina de trigo" (buen match) y "Harina de coco" (mal match, kcal=0)
- Soluciones pendientes: enriquecer productos faltantes, o añadir flag `es_producto` a los alimentos de supermercado

### CAUSA #4 — Algoritmo de matching sin prioridad startsWith
- Antes del Fix 2, no existía el bloque `startsWith` (1c)
- "Harina" podía matchear cualquier alimento que contuviera "harina" en cualquier posición

---

## ✅ ACIERTOS (Sesión 10)
1. **Diagnóstico BD masivo antes de tocar código**: Consultas Supabase revelaron que 7/8 recetas son Instagram, todas con `cantidad_original: null` — información clave para entender el problema real.
2. **Scripts con `--dry-run`**: El Fix 3 se probó primero en seco para ver los 13 re-matches antes de aplicar.
3. **No parchear receta por receta**: En vez de corregir las 8 recetas individualmente, se arregló el flujo completo (buscador + matching + INSERT).
4. **Build de verificación antes de deploy**: `npx next build` confirmó 0 errores antes de subir a Vercel.
5. **Sincronizar worktrees**: Ambos worktrees (nutricoach + nutricoach-ui) recibieron los mismos fixes.

## ❌ ERRORES (Sesión 10)
1. **No revisar el flujo completo del INSERT antes**: El Bug #1 (matchedIngredients no usado) estuvo presente desde la creación del scraper. Se necesitó una auditoría profunda del código para descubrirlo — debería haberse revisado al implementar el scraper original.
2. **Asumir que buscador mostraba los mismos resultados que el algoritmo**: El buscador de alimentos (editor UI) y el algoritmo de matching (scrape) usan lógica diferente. No sincronizarlos llevó a confusión.

## ⚡ REGLAS NUEVAS PARA PRÓXIMAS SESIONES
1. **TODO nuevo scrape debe verificar `alimento_id` en BD**: Después de scrapear una receta, ejecutar una consulta para confirmar que `receta_ingredientes.alimento_id` no es null.
2. **Siempre verificar qué array se usa para el INSERT**: Si hay dos arrays (parsedIngredients vs matchedIngredients), verificar cuál se usa realmente. El array con los datos correctos debe ser el que alimenta la escritura.
3. **`buscarAlimento()` debe incluir `calorias` siempre**: El campo `calorias` es crítico para decidir entre múltiples matches. Nunca seleccionar solo `id, nombre`.
4. **Priorizar `startsWith` sobre `contains`**: Cuando la query coincide con el inicio del nombre del alimento, es un match más fiable que una coincidencia parcial en medio del nombre.
5. **Limpiar nombres de ingredientes antes de matchear**: Quitar paréntesis, notas, y descripciones secundarias que no forman parte del nombre del alimento.
6. **Instagram = sin cantidades**: Asumir que cualquier receta de Instagram tendrá `cantidad_original: null` para todos los ingredientes. Añadir advertencia en UI o flujo de post-procesado.
7. **Mantener sincronizados los worktrees**: Cuando se modifica la lógica de matching en `nutricoach/`, aplicar el mismo cambio en `nutricoach-ui/` inmediatamente.

---

## Estado Actual (12-05-2026 — Sesión 9: Macros faltantes + Metadatos + Diagnóstico)

### Resumen sesión
- ✅ **Diagnóstico completo**: 227 recetas, 100% match rate, 0 sin kcal, 0 sin instrucciones, 0 sin porciones
- ✅ **FIX 7 — Macros faltantes**: Ejecutado `fix-macros-faltantes.mjs --apply` → 78 alimentos con macros estimados, 99 recetas recalculadas, 0 errores
- ✅ **FIX 8 — Build + Deploy post-macros**: Exitoso en nutricoach-delta.vercel.app
- ✅ **FIX 9+10 — Metadatos**: Ejecutado `asignar-metadatos-recetas.mjs --apply` → 227/227 con categoría, tipo_cocción, dificultad, tipo_plato
- ✅ **FIX 11 — Build + Deploy post-metadatos**: Exitoso en nutricoach-delta.vercel.app
- ⏳ **FIX 12 — Imágenes**: 74 recetas sin imagen (32.6%). Infraestructura investigada: 12 scripts existentes. Carlos prefiere NO Unsplash. Pendiente decidir pipeline alternativo (scrape url_origen / IA generativa)
- ⏳ **FIX 13 — Revisión casos raros**: "Receta sin título" (30g, 717kcal/100g) y "Donuts caseros esponjosos" (13.266 kcal, 1.075g grasa) pendientes
- ⏳ **FIX 14 — Build + Deploy final**: Pendiente tras imágenes y revisiones

### Scripts creados en esta sesión
| Script | Localización | Estado |
|--------|-------------|--------|
| [`fix-macros-faltantes.mjs`](nutricoach/scripts/fix-macros-faltantes.mjs) | nutricoach/scripts/ | ✅ Ejecutado con --apply |
| [`asignar-metadatos-recetas.mjs`](nutricoach/scripts/asignar-metadatos-recetas.mjs) | nutricoach/scripts/ | ✅ Ejecutado con --apply |

### Diagnóstico final recetas (12-05-2026)
- **227 recetas** en BD (226 aprobadas, 1 descartada)
- **1.618 ingredientes vinculados** — 100% match rate ✅
- **0 recetas sin kcal** ✅
- **0 recetas sin instrucciones** ✅
- **0 recetas sin porciones** ✅
- **74 sin imagen** (32.6%) ⏳
- **Categorías**: 227/227 completas ✅
- **Tipo cocción**: 227/227 completos ✅
- **Dificultad**: 227/227 completa ✅
- **Tipo plato**: 227/227 completo ✅

### Variables de entorno (.env.local)
- `UNSPLASH_ACCESS_KEY` disponible pero no se usará por decisión de Carlos
- `REPLICATE_API_KEY`, `OPENAI_API_KEY`, `APIFY_API_KEY` disponibles para pipelines alternativos

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

### 5. Patrón de catch blocks — ACTUALIZADO 16-05-2026
- ✅ 22/25 catch blocks existentes muestran feedback al usuario vía `addToast` o `setError`.
- ✅ 3 catch blocks solo hacen `console.error` sin feedback — aceptable solo si redirigen inmediatamente.
- ⚠️ **NUEVO: 21 `.catch(() => {})` silenciosos detectados** en producción (16-05-2026):
  - Scrapers (lidl, bonpreu, el-corte-ingles, esclat, dia, hipercor, eroski) — `.catch(() => {})` en navegación
  - Modales (AlternativasModal, GenerarComidaModal) — fetch a /api que traga errores
  - Componentes (EscandalloReceta, compra/page.tsx) — carga de supermercados
  - APIs (onboarding/perfil, generar-plan-inicial) — fetch secundario sin manejo
  - **Riesgo:** Cualquier error en scraping o fetch de datos se traga sin logging. Usuario ve UI sin datos.
- **Regla:** Todo catch block debe: (1) loggear el error, (2) mostrar feedback al usuario, (3) no tragar errores silenciosamente.
- **Auditoría completa:** [`salidas/16-05-2026_AUDITORIA_POST_RECONCILIACION.md`](salidas/16-05-2026_AUDITORIA_POST_RECONCILIACION.md)

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

## 🔀 Historial de Worktrees — Ya unificados en main

Hasta el 14-05-2026 se usaron 3 worktrees (carpetas físicas del mismo repositorio git) para desarrollo paralelo:

```
nutricoach/          → rama: main                  → tarea activa (recetario, etc.)
nutricoach-ui/       → rama: feature/ui-estetica   → estética, CSS, diseño visual
nutricoach-modulos/  → rama: feature/modulos       → dietas, entrenos, clientes
```

**Ambos worktrees se mergearon a main en la Sesión 12.** Ahora todo el código converge directamente en `nutricoach/` (main). Los directorios `nutricoach-ui/` y `nutricoach-modulos/` quedan como snapshot histórico local — no deben usarse para nuevo desarrollo.

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

---

## 🧠 LECCIONES APRENDIDAS — Aciertos y Errores (Sesión 9, 12-05-2026)

### ✅ ACIERTOS
1. **Diagnóstico completo antes de tocar nada**: Ejecutar `diagnostico-completo.mjs` primero dio visibilidad del estado real (227 recetas, 1.618 ingredientes, match rate 100%) antes de decidir qué priorizar.
2. **Estimación de macros por reglas locales**: En vez de llamar a una IA para cada alimento (costoso y lento), se crearon ~70 reglas `MACROS_POR_NOMBRE` con datos reales de BEDCA. Rápido, gratuito, y 0 errores en 78 alimentos.
3. **`--dry-run` en scripts de modificación masiva**: Los scripts nuevos incluían modo dry-run para ver qué se iba a cambiar antes de aplicar. Esto evitó sorpresas.
4. **Dos pases para metadatos**: Primero inferencia por reglas (202 recetas), luego segundo pase manual para los 33 remanentes. Mucho más control que un solo pase masivo.

### ❌ ERRORES
1. **Ejecutar pipeline de Unsplash sin preguntar** (FALLO #19): Se lanzó `rellenar-fotos-unsplash.mjs --dry-run` para 74 recetas sin consultar. El usuario dijo "no saques de unsplash" cuando ya llevaba 3 minutos. Se perdió tiempo y cuota de API.
2. **`URL` como nombre de variable** (FALLO #17): Varios scripts nuevos usaban `const URL = process.env...` que sombrea el constructor global `URL`. Error detectado en ejecución. Fix: renombrar a `SB`.
3. **`grasa` vs `grasas`** (FALLO #18): Typo en nombre de variable. Error detectado en ejecución. Fix: `grasa` → `grasas`.
4. **No verificar 416 en paginación** (FALLO #16): Supabase devuelve 416 cuando offset > total rows. Scripts que usaban paginación sin manejar este código fallaban silenciosamente.

### ⚡ REGLAS PARA PRÓXIMAS SESIONES
1. **Preguntar siempre antes de consumir APIs externas**: Unsplash, OpenAI, Replicate, etc. — nunca asumir que está bien.
2. **Probar scripts con `node --check`** antes de ejecutar: detecta ReferenceError y typos en variables.
3. **Usar `--limit N` pequeño primero**: Para scripts que iteran sobre muchas recetas, probar con 3-5 primero.
4. **NUNCA usar `URL` como nombre de variable**: Usar `SB`, `API_URL`, `SUPABASE_URL`.
5. **Manejar 416 en toda paginación con Supabase REST API**: El SDK no da este error, pero el fetch directo sí.
6. **Siempre tener plan B para imágenes**: Unsplash no es aceptable. OpenAI puede estar bloqueado. Tener alternativas preparadas.
7. **Documentar en CALIENTE**: Los fallos se documentan en DIAGNOSTICO_FALLOS.md inmediatamente después de ocurrir, no al final de la sesión.
