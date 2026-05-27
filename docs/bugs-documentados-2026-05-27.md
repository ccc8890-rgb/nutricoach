# 🐛 Bugs Documentados — 2026-05-27

> Documento de bugs activos encontrados en auditoría sistemática del codebase.
> Para Claude y Codex: consultar antes de modificar archivos afectados.

## Estado tras revisión Codex — 27-05-2026

El lote DeepSeek del recetario fue revisado y reparado después de crear este documento:

- 72 recetas `ia_lote_deepseek` quedan en `en_revision`.
- 600 ingredientes vinculados; 0 ingredientes sin `alimento_id`.
- Macros restauradas desde los JSON originales de DeepSeek para evitar recálculos erróneos por matching.
- 72/72 tienen `fuente_tipo = ia_generada`, `imagen_estado = sin_imagen`, `imagen_prompt_base` y `imagen_needs_review = true`.
- El importador `scripts/importar-lote-deepseek.ts` fue corregido para no truncar lotes >20 recetas y para normalizar aliases críticos.
- El script `scripts/reparar-lote-deepseek-recetas.ts` queda como herramienta de reparación post-importación.

Los bugs globales de este documento siguen siendo útiles como backlog, pero los conteos de quality gate pueden no coincidir con el estado actual tras la reparación.

---

## BUG-1: `gap-report.ts` referencia columnas que NO existen en `alimentos`

**Archivo:** [`lib/micronutrientes/gap-report.ts`](lib/micronutrientes/gap-report.ts)

**Problema:** El archivo define [`TotalesMicronutrientes`](lib/micronutrientes/gap-report.ts:15) y [`TARGETS_MICRONUTRIENTES_BASE`](lib/micronutrientes/gap-report.ts:46) con nombres de columna que **no existen** en la tabla `alimentos`.

| Columna usada | Debería ser | Estado real en DB |
|---|---|---|
| `fibra_g` | `fibra` | ❌ No existe |
| `azucares_g` | `azucar_g` | ❌ No existe |
| `azucares_anyadidos_g` | `azucares_anadidos_g` (sin 'y') | ❌ No existe |
| `saturados_g` | `saturados_g` | ✅ Existe |

**Impacto:** El gap report de micronutrientes devuelve datos incorrectos o vacíos para fibra, azúcares y azúcares añadidos. Las queries a Supabase devuelven `null` para estos campos.

**Contexto:** Según [reglas del proyecto](AGENTS.md), las columnas que NO existen son: `acido_folico_ug`, `acido_pantotenico_mg`, `biotina_ug`, `manganeso_mg`, `fibra_g`, `agua_g`, `azucar_g`, `azucares_anadidos_g`.

**Fix propuesto:**
- `fibra_g` → `fibra`
- `azucares_g` → `azucar_g` (pero esta también NO existe, habría que ver si hay columna de azúcares totales)
- `azucares_anyadidos_g` → `azucares_anadidos_g`

---

## BUG-2: 75 recetas con issues críticos en Quality Gate

**Datos:** Quality Gate ejecutado sobre 397 recetas, 263 con issues, **75 críticas**.

| Tipo | Count | Ejemplo |
|---|---|---|
| `cantidad` | 43 | "Sal": especia con 80g (esperado <30g) |
| `instrucciones` | 35 | Pasos concatenados sin saltos de línea |
| `match` | 30 | "Dientes de ajo" → "Ajo" (sin match) |
| `intolerancias` | 12 | Valores inválidos |
| `macros` | 10 | Macros inconsistentes |
| `ingredientes` | 7 | Ingredientes mal formados |

**Detalle de issues recurrentes:**
- **Especias/Sal con 80g**: 20+ recetas tienen `"Sal": 80g` cuando debería ser `<30g`. Patrón: DeepSeek pone `80g` como placeholder para "al gusto".
- **"Dientes de ajo"**: 3+ recetas usan "dientes" como unidad de gramos (ej: 180g, 240g) en vez de especificar gramos reales de ajo.
- **Instrucciones concatenadas**: ~35 recetas nuevas de lotes IA tienen instrucciones sin saltos de línea entre pasos.

**Archivo de referencia:** [`scripts/quality-gate-recetas.mjs`](scripts/quality-gate-recetas.mjs)
**Ver output completo:** `node scripts/quality-gate-recetas.mjs --json`

---

## BUG-3: `catch {}` silencioso — 26 instancias

**Patrón encontrado en 26 archivos de `scripts/`:**

```typescript
try {
  // operación que puede fallar
} catch { }
// o
} catch(e) {}
```

**Archivos afectados (scripts de diagnóstico):**
- [`scripts/diagnosticar-carrefour-categorias.ts`](scripts/diagnosticar-carrefour-categorias.ts)
- [`scripts/diagnosticar-lidl-api.ts`](scripts/diagnosticar-lidl-api.ts)
- [`scripts/diagnosticar-ids-por-categoria.ts`](scripts/diagnosticar-ids-por-categoria.ts)
- [`scripts/diagnosticar-paginacion-bonpreu.ts`](scripts/diagnosticar-paginacion-bonpreu.ts)
- [`scripts/diagnosticar-api-explorer.ts`](scripts/diagnosticar-api-explorer.ts)
- [`scripts/diagnosticar-initial-state.ts`](scripts/diagnosticar-initial-state.ts)
- [`scripts/diagnosticar-bonpreu-api2.ts`](scripts/diagnosticar-bonpreu-api2.ts)
- [`scripts/diagnosticar-categorias-uuids.ts`](scripts/diagnosticar-categorias-uuids.ts)
- [`scripts/diagnosticar-bonpreu-api.ts`](scripts/diagnosticar-bonpreu-api.ts)
- [`scripts/diagnosticar-suggestions-api.ts`](scripts/diagnosticar-suggestions-api.ts)
- [`scripts/revisar-recetas-cola-ia.ts`](scripts/revisar-recetas-cola-ia.ts)
- [`scripts/diagnosticar-lidl.ts`](scripts/diagnosticar-lidl.ts)
- [`scripts/diagnosticar-bonpreu-esclat.ts`](scripts/diagnosticar-bonpreu-esclat.ts)
- [`scripts/check-recetas.ts`](scripts/check-recetas.ts)
- [`scripts/diagnosticar-dom-scrapers.ts`](scripts/diagnosticar-dom-scrapers.ts)
- [`scripts/diagnosticar-hipercor-eci.ts`](scripts/diagnosticar-hipercor-eci.ts)
- [`scripts/diagnosticar-lidl2.ts`](scripts/diagnosticar-lidl2.ts)
- [`app/api/cliente/[codigo]/plan-pdf/route.ts`](app/api/cliente/[codigo]/plan-pdf/route.ts)
- [`lib/auditoria-recetas-diaria.ts`](scripts/auditoria-recetas-diaria.ts)

**Impacto:** Errores silenciosos durante scraping/diagnóstico dificultan debugging. En producción (`plan-pdf/route.ts`) puede ocultar fallos de generación de PDF.

---

## BUG-4: `as any` generalizado — 105+ instancias

**Patrón:** TypeScript `as any` usado extensivamente en:
- [`app/api/`](app/api/) — rutas API (40+ instancias)
- [`scripts/`](scripts/) — scripts de diagnóstico (50+ instancias)
- [`lib/`](lib/) — lógica de negocio (15+ instancias)

**Ejemplos representativos:**
- [`app/api/generar-plan-inicial/route.ts:1052`](app/api/generar-plan-inicial/route.ts:1052) — `(planJson.macros as any)?.proteinas_g`
- [`app/api/dashboard/analytics/route.ts:178`](app/api/dashboard/analytics/route.ts:178) — `(cliente as any)?.profile?.nombre`
- [`app/api/clientes/[id]/conversaciones-ia/route.ts:44`](app/api/clientes/[id]/conversaciones-ia/route.ts:44) — `resp as any`
- [`lib/recetas/auditoria.ts`](lib/recetas/auditoria.ts) — updates tipados como `as any`

**Impacto:** Pérdida de type safety. Si cambia la estructura de datos (ej: perfil de cliente), los `as any` ocultan errores de compilación que explotan en runtime.

---

## BUG-5: `.single()` sin null-check

**Patrón en 200+ llamadas a Supabase:**

```typescript
const { data } = await supabase.from('tabla').select('*').eq('id', id).single()
// data podría ser null si no existe el registro
// pero se usa directamente sin check
```

**Ejemplos críticos:**
- [`app/api/precios/ahorro/route.ts:44`](app/api/precios/ahorro/route.ts:44) — `plan` se usa sin verificar null
- [`app/api/recetas/[id]/estado/route.ts:33`](app/api/recetas/[id]/estado/route.ts:33) — verifica `data` pero no tipa correctamente
- [`app/api/alimentos/[id]/route.ts:27`](app/api/alimentos/[id]/route.ts:27) — no verifica si alimento existe
- [`app/recetas/[id]/page.tsx:177`](app/recetas/[id]/page.tsx:177) — `recetaRes.data` usado sin null-check

**Riesgo:** TypeError en runtime cuando un registro no existe o la query falla silenciosamente.

---

## BUG-6: `.select('*')` en APIs públicas — 42 instancias

**Patrón:** APIs que devuelven TODAS las columnas con `.select('*')` en vez de seleccionar campos específicos.

**Ejemplos críticos en producción:**
- [`app/api/alimentos/route.ts:22`](app/api/alimentos/route.ts:22) — API pública de alimentos devuelve columnas internas (`coach_id`, `fuente_nutricional`, etc.)
- [`app/entrenos/[id]/page.tsx:78`](app/entrenos/[id]/page.tsx:78) — Búsqueda de ejercicios devuelve todas las columnas
- [`app/clientes/[id]/page.tsx:476`](app/clientes/[id]/page.tsx:476) — Planes nutrición con `*` expone columnas internas
- [`app/recetas/nueva/page.tsx:73`](app/recetas/nueva/page.tsx:73) — Alimentos devueltos completos al frontend
- [`app/dietas/[id]/page.tsx:372`](app/dietas/[id]/page.tsx:372) — Búsqueda de alimentos expone todo

**Riesgo:** Exposición de datos internos (coach_id, metadatos, flags de sistema) al frontend. Las RLS mitigan acceso no autorizado pero igual exponen columnas innecesarias.

---

## BUG-7: Instrucciones de recetas siguen sin fix (35 recetas)

**Archivo:** [`scripts/quality-gate-recetas.mjs`](scripts/quality-gate-recetas.mjs)

**Problema:** El fix de [`Punto 1`](AGENTS.md) solo corrigió 42 recetas con `fuente = 'ia_lote_deepseek'`. Quedan **35 recetas** con instrucciones concatenadas sin saltos de línea, provenientes de otras fuentes (`scraping`, `manual`, otras).

**Recetas afectadas (muestra):**
- "Salteado de pimiento, huevo y setas enoki"
- "Ensalada de pollo especiado, arroz crujiente y salsa rosa"
- "Burrata con aceitunas y tomate"
- "Wraps de pollo con cúrcuma y hoja de lima"
- "Café Mont Blanc"
- "Tortitas proteicas de plátano y avena"
- "Porridge de avena con proteína y frutos del bosque"

**Fix:** Ejecutar el mismo regex `replace(/(\d+)\. /g, '\n$1. ')` sobre TODAS las recetas, no solo `ia_lote_deepseek`.

---

## BUG-8: DeepSeek genera "dientes de ajo" como ingrediente con gramos incorrectos

**Problema:** DeepSeek usa "dientes" como unidad de medida para el ajo, pero el sistema espera gramos. El normalizador interpreta "1 diente" como ~80g (en lugar de ~3-5g reales).

**Ejemplos del quality gate:**
- "Dientes de ajo": 180g → debería ser ~12g (3 dientes × 4g)
- "Dientes de ajo": 240g → debería ser ~16g (4 dientes × 4g)

**Archivo afectado:** [`lib/recetas/importar-lote.ts`](lib/recetas/importar-lote.ts) — el normalizador no tiene regla especial para "dientes".

**Fix:** Añadir normalización en [`lib/recetas/importar-lote.ts`](lib/recetas/importar-lote.ts:94) que detecte el patrón `/diente/` y estime `gramos = cantidad * 4`.

---

## BUG-9: Especias con 80g placeholder

**Problema:** DeepSeek usa `80g` como valor por defecto para especias/sal cuando la intención es "al gusto" o "una pizca". Quality gate reporta 20+ casos.

**Ejemplos:**
- "Sal: 80g" (x15 apariciones)
- "Esencia de vainilla: 80g"
- "Vainilla: 80g"
- "Chile rojo: 60g"
- "Sirope de vainilla: 80g"
- "Chile picante: 80g"

**Impacto:** Macros incorrectos (sal añade sodio, especias añaden volumen calórico falso).

---

## BUG-10: `gap-report.ts` no usa columnas reales de la BD

**Ver BUG-1** para el detalle de columnas. Adicionalmente:

**Archivo:** [`lib/micronutrientes/gap-report.ts`](lib/micronutrientes/gap-report.ts:46)

El `TARGETS_MICRONUTRIENTES_BASE` incluye targets para `fibra_g`, `azucares_g`, `azucares_anyadidos_g` pero estas columnas no existen en `alimentos`. Las queries correspondientes en [`app/api/cliente/[codigo]/micronutrientes/route.ts`](app/api/cliente/[codigo]/micronutrientes/route.ts:113) también referencian estas columnas inexistentes.

---

## BUG-11: Scripts de enriquecimiento usan columnas obsoletas

**Archivos:**
- [`scripts/enriquecer-micronutrientes-batch.ts`](scripts/enriquecer-micronutrientes-batch.ts:73) — `azucares_anyadidos`
- [`scripts/_add-cho-columns.ts`](scripts/_add-cho-columns.ts:12) — `azucares_anyadidos`

**Problema:** El script intenta enriquecer la columna `azucares_anyadidos` (con 'y') pero la columna real en Supabase es `azucares_anadidos` (sin 'y').

---

## BUG-12: Importación de recetas solo procesa 20 por tanda

**Archivo:** [`scripts/importar-lote-deepseek.ts`](scripts/importar-lote-deepseek.ts:76)

**Problema:** El script divide en tandas de 20, pero [`normalizarRecetasGeneradas`](lib/recetas/importar-lote.ts:112) procesa **todas** las recetas de una sola vez. Si el archivo tiene >20 recetas, el normalizador trunca a 20 y las siguientes se pierden.

En la tanda 2 de este proyecto, tuve que crear manualmente un JSON con solo las 10 restantes porque el script original solo toma las primeras 20.

---

## Resumen de severidad

| Bug | Severidad | Archivos afectados | Requiere acción |
|---|---|---|---|
| BUG-1: gap-report columnas | 🔴 Alta | 2 | Sí |
| BUG-2: Quality Gate críticos | 🔴 Alta | 75+ recetas | Sí |
| BUG-3: catch silencioso | 🟡 Media | 26 | Recomendado |
| BUG-4: as any generalizado | 🟡 Media | 105+ | Bajo |
| BUG-5: single() sin null-check | 🟡 Media | 200+ | Medio |
| BUG-6: select(*) en APIs | 🟡 Media | 42 | Medio |
| BUG-7: instrucciones sin fix | 🔴 Alta | 35 recetas | Sí |
| BUG-8: dientes de ajo | 🟡 Media | N/A | Sí (en normalizador) |
| BUG-9: especias 80g | 🟡 Media | 20+ recetas | Sí (en normalizador) |
| BUG-10: gap-report columnas (duplicado) | 🔴 Alta | 2 | Sí |
| BUG-11: enriquecimiento columna errónea | 🔴 Alta | 2 scripts | Sí |
| BUG-12: importación trunca en 20 | 🟡 Media | 1 script | Sí |

---

## Acciones prioritarias

1. **BUG-1 / BUG-10**: Corregir nombres de columna en [`lib/micronutrientes/gap-report.ts`](lib/micronutrientes/gap-report.ts) y [`app/api/cliente/[codigo]/micronutrientes/route.ts`](app/api/cliente/[codigo]/micronutrientes/route.ts)
2. **BUG-7**: Ejecutar `regexp_replace` sobre TODAS las recetas con instrucciones concatenadas
3. **BUG-8**: Añadir regla "diente de ajo → gramos × 4" en [`lib/recetas/importar-lote.ts`](lib/recetas/importar-lote.ts)
4. **BUG-9**: Añadir regla "especia/sal 80g → ajustar a gramos reales" en el normalizador
5. **BUG-11**: Corregir nombre de columna en scripts de enriquecimiento
6. **BUG-12**: Arreglar [`scripts/importar-lote-deepseek.ts`](scripts/importar-lote-deepseek.ts) para que procese >20 recetas correctamente

---

*Generado por auditoría automatizada el 2026-05-27*
*Para Claude/Codex: este documento debe actualizarse cuando se corrijan los bugs*
