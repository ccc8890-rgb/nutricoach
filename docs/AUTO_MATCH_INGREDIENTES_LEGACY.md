# Auto-Match de Ingredientes: Arquitectura, Bugs y Lecciones Aprendidas

> **Propósito:** Documentar para futuros modelos Claude/Codex cómo funciona el sistema de auto-match de ingredientes, qué bugs se encontraron, cómo se corrigieron, y qué NO hacer.
>
> **Fecha:** 2026-05-23 | **Sistema:** NutriCoach

---

## Índice

1. [Arquitectura General](#1-arquitectura-general)
2. [Pipeline de 3 Fases](#2-pipeline-de-3-fases)
3. [Bug #1: Contains Bidireccional (CRÍTICO)](#3-bug-1-contains-bidireccional-crítico)
4. [Bug #2: Modelo DeepSeek Inválido](#4-bug-2-modelo-deepseek-inválido)
5. [Bug #3: macros_100g Inconsistente](#5-bug-3-macros_100g-inconsistente)
6. [Bug #4: Sin Error Handling en FASE 2](#6-bug-4-sin-error-handling-en-fase-2)
7. [Bug #5: sort() Mutante](#7-bug-5-sort-mutante)
8. [Bug #6: SQL Trigger Peligroso](#8-bug-6-sql-trigger-peligroso)
9. [Reglas de Oro para Futuros Cambios](#9-reglas-de-oro-para-futuros-cambios)

---

## 1. Arquitectura General

### Flujo de datos

```
Receta nueva (INSERT en receta_ingredientes)
  │
  ▼
[BEFORE INSERT TRIGGER] → match_ingrediente_por_nombre() → match SQL rápido
  │                                                        (solo exacto + palabra clave)
  ▼
[TypeScript Pipeline] → autoMatchIngrediente() → 3 fases
  │
  ├─ FASE 1: match contra alimentos existentes (ratioSolapamiento ≥ 0.6)
  ├─ FASE 2: match contra productos_supermercado (ratioSolapamiento ≥ 0.7)
  └─ FASE 3: crear nuevo alimento vía DeepSeek con BEDCA/USDA
  │
  ▼
[Actualización] → UPDATE receta_ingredientes SET alimento_id = ...
  │                (NUNCA sobrescribir nombre_libre)
  ▼
[Recálculo] → calcular_macros_receta() via RPC con ROUND()
```

### Archivos clave

| Archivo | Propósito |
|---------|-----------|
| [`lib/recetas/auto-match-ingrediente.ts`](lib/recetas/auto-match-ingrediente.ts) | Pipeline completo de 3 fases (TypeScript) |
| [`supabase/migrations/20260524000000_auto_match_ingredientes.sql`](supabase/migrations/20260524000000_auto_match_ingredientes.sql) | Trigger SQL + match básico + calcular_macros_receta |
| [`scripts/rematch-ingredientes-auto.ts`](scripts/rematch-ingredientes-auto.ts) | Script de rematch masivo |
| [`lib/scraping/normalizador.ts`](lib/scraping/normalizador.ts) | Normalizador legacy con `buscarAlimento()` |
| [`lib/enriquecimiento-nutricional.ts`](lib/enriquecimiento-nutricional.ts) | Enriquecimiento de micronutrientes (OpenFoodFacts + DeepSeek) |

### Funciones SQL en Supabase

```sql
-- Match básico para trigger (solo exacto + palabra clave > 3 chars)
match_ingrediente_por_nombre(p_nombre_libre text) → (alimento_id uuid, confianza text)

-- Trigger BEFORE INSERT
trg_try_match_ingrediente → try_match_ingrediente()

-- Recálculo de macros con ROUND
calcular_macros_receta(p_receta_id uuid) → void
```

---

## 2. Pipeline de 3 Fases

### FASE 1: Match contra alimentos existentes

**Umbral:** `ratioSolapamiento ≥ 0.6`

**Validación extra:** Si ambos nombres tienen ≥2 tokens, se requieren al menos 2 tokens en común.

**Orden:**
1a. Match exacto (normalizado, con stop words removidas)
1b. Match exacto sin acentos
1c. Solapamiento léxico (cache en memoria ~13.000 alimentos)
1d. ILIKE query directa (solo si ≥3 tokens, ratio ≥ 0.5)

```typescript
function ratioSolapamiento(a: string, b: string): number {
  const tokensA = a.split(/\s+/).filter(t => t.length > 1)
  const tokensB = b.split(/\s+/).filter(t => t.length > 1)
  if (tokensA.length === 0 || tokensB.length === 0) return 0
  const comunes = tokensA.map(quitarAcentos).filter(t => tokensB.map(quitarAcentos).includes(t)).length
  return comunes / Math.max(tokensA.length, tokensB.length)
}
```

### FASE 2: Match contra productos_supermercado

**Umbral:** `ratioSolapamiento ≥ 0.7`

**Validación extra:** Si ambos tienen ≥2 tokens, mínimo 2 en común.

**Proceso:**
1. Buscar en `productos_supermercado` por ILIKE de los 2 tokens más largos
2. Filtrar solo productos con `alimento_id NOT NULL`
3. Verificar ratio contra `nombre_original`
4. Consultar `alimentos` para obtener macros

### FASE 3: Crear nuevo alimento vía IA

- Usa DeepSeek con prompt BEDCA/USDA
- Temperatura: 0.1 (mínima creatividad)
- Antes de insertar, verifica si ya existe (race condition)
- Inserta con `fuente: 'coach'`, `fuente_nutricional: 'bedca' | 'deepseek'`
- `es_generico: true`, `custom: false`

---

## 3. Bug #1: Contains Bidireccional (CRÍTICO)

### Síntoma

La primera implementación de matching usaba esta lógica:

```typescript
if (key.includes(n) || n.includes(key)) { ... } // ❌ PELIGROSO
```

### Qué causó

42 falsos positivos en el primer rematch masivo:

| nombre_libre | matched a (INCORRECTO) | Por qué |
|---|---|---|
| `"patatas"` | `"Patatas fritas sabor chili lima"` | "patatas" contenido en el target |
| `"papa"` | `"Papada Cerdo Origen Espan"` | "papa" contenido en "Papada" |
| `"Ají molido"` | `"Café molido Cafés Valiente"` | "molido" contenido en target |
| `"Vino tinto"` | `"Tinto Verano Limon 0,ata"` | "tinto" contenido en target |
| `"galletas"` | `"Helado choco cookies Hacendado sirope galletas chocolate"` | "galletas" contenido en target |

### Cómo se corrigió

Reemplazar con `ratioSolapamiento()`:

```typescript
function ratioSolapamiento(a: string, b: string): number {
  // Solo tokens significativos (>1 char)
  // Comparación sin acentos
  // Ratio = comunes / max(tokensA, tokensB)
  // Sin contains bidireccional
}
```

Más validación: si ambos tienen ≥2 tokens, mínimo 2 comunes.

### ⚠️ LECCIÓN: El mismo bug existía en SQL

```sql
-- ❌ NO USAR: contains bidireccional en SQL
WHERE lower(trim(a.nombre)) LIKE '%' || v_norm || '%'
   OR v_norm LIKE '%' || lower(trim(a.nombre)) || '%'
```

La función `match_ingrediente_por_nombre()` en Supabase tenía EXACTAMENTE el mismo problema. Se corrigió eliminando esa sección.

### 🛡️ CÓMO DETECTARLO EN EL FUTURO

Buscar estos patrones en el código:
- `key.includes(n) || n.includes(key)` en TypeScript
- `LIKE '%' || x || '%' OR x LIKE '%' || y || '%'` en SQL
- Cualquier comparación donde una cadena corta (1-3 tokens) se busque dentro de cadenas largas (5+ tokens)

---

## 4. Bug #2: Modelo DeepSeek Inválido

### Síntoma

```typescript
const MODELO = process.env.DEEPSEEK_MODEL || 'deepseek-chat' // ❌
```

### Problemas

1. **`'deepseek-chat'` no es un modelo válido** para `@ai-sdk/deepseek`. El formato correcto depende del provider.
2. **Evaluado a nivel de módulo**: `const MODELO` se evalúa una vez al importar, no al llamar la función. En serverless, si la env var cambia entre cold starts, no se refleja.

### Cómo se corrigió

```typescript
function getModeloDeepSeek(): string {
  return process.env.DEEPSEEK_MODEL || 'deepseek-deepseek-chat'
}
```

---

## 5. Bug #3: macros_100g Inconsistente

### Síntoma

Los matches exactos (secciones 1a y 1b) retornaban SIN `macros_100g`:

```typescript
// ❌ Incompleto
return { estado: 'match_existente', alimento_id: a.id, ... }
```

Pero los matches por solapamiento (1c) SÍ lo incluían:

```typescript
// ✅ Completo
return { ..., macros_100g: { calorias: ..., proteinas: ..., ... } }
```

Cualquier consumidor de `ResultadoMatch.macros_100g` recibía datos inconsistentes.

### Cómo se corrigió

Añadir `macros_100g` en los returns de match exacto con los valores del alimento en caché.

---

## 6. Bug #4: Sin Error Handling en FASE 2

### Síntoma

```typescript
// ❌ Sin manejo de errores
const { data: alimento } = await supabase
  .from('alimentos')
  .select(...)
  .eq('id', alimentoId)
  .single()

if (alimento) { ... } // Si .single() falla, se traga el error
```

### Cómo se corrigió

```typescript
try {
  const { data: alimento, error: alimErr } = await supabase...
  if (alimErr) {
    console.error(`[FASE2] Error: ${alimErr.message}`)
    continue
  }
  if (alimento) { ... }
} catch (err) {
  console.error(`[FASE2] Excepción:`, err)
  continue
}
```

---

## 7. Bug #5: sort() Mutante

### Síntoma

```typescript
// ❌ Muta tokensN in-place
const palabraClave = tokensN.sort((a, b) => b.length - a.length).slice(0, 2)
```

Mientras que en FASE 2 se hacía bien:

```typescript
// ✅ Spread para no mutar
const terminos = [...tokensN].sort(...)
```

### Cómo se corrigió

```typescript
const palabraClave = [...tokensN].sort((a, b) => b.length - a.length).slice(0, 2)
```

---

## 8. Bug #6: SQL Trigger Peligroso

### El trigger `trg_try_match_ingrediente`

```sql
CREATE TRIGGER trg_try_match_ingrediente
  BEFORE INSERT ON public.receta_ingredientes
  FOR EACH ROW
  EXECUTE FUNCTION public.try_match_ingrediente();
```

### Por qué podría ser peligroso

Si la función `match_ingrediente_por_nombre()` tiene un falso positivo, el trigger asigna `alimento_id` AUTOMÁTICAMENTE en el INSERT sin que nadie pueda revisarlo. El dato parece correcto (`alimento_id IS NOT NULL`) pero el match es incorrecto.

### Estado actual (post-fix)

La función SQL ahora solo hace:
1. Match exacto (con variantes sin acentos)
2. Palabra clave más larga (>3 chars) → LIKE

Ya NO tiene contains bidireccional. Pero sigue siendo menos preciso que el TypeScript pipeline.

### ⚠️ Recomendación

Si el trigger causa falsos positivos en el futuro, considerar:
- Deshabilitar el trigger y hacer todo el matching desde la app
- Añadir un campo `matched_by: 'trigger' | 'pipeline'` para trazabilidad

---

## 9. Reglas de Oro para Futuros Cambios

### 🔴 NUNCA HACER

1. **NO usar `includes()` bidireccional** para matching de nombres de alimentos. Siempre usar `ratioSolapamiento()` con umbral ≥0.6.
2. **NO evaluar `process.env.*` a nivel de módulo** en funciones que se usan en serverless. Usar funciones getter.
3. **NO mutar arrays con `.sort()`** sin hacer spread primero (`[...arr].sort()`).
4. **NO sobrescribir `nombre_libre`** al hacer update de `alimento_id`. Preservar siempre el nombre original.
5. **NO usar `ILINE` contiene bidireccional en SQL** — es el mismo bug que el #1 pero en base de datos.

### 🟢 SIEMPRE HACER

1. **Validación extra en solapamiento:** si ambos nombres tienen ≥2 tokens, mínimo 2 tokens en común.
2. **Cache de alimentos** para evitar N+1 queries. Los ~13.000 alimentos caben en memoria.
3. **Agrupar por nombre_libre** para no repetir matches de ingredientes duplicados.
4. **try/catch** en cada query a Supabase con `console.error` para trazabilidad.
5. **`macros_100g` consistente** en todos los returns de `ResultadoMatch`.
6. **Verificar datos en Supabase** después de desplegar migraciones SQL con `supabase db query --linked`.

### 🔍 Cómo debuggear falsos positivos

```typescript
// Script de diagnóstico para encontrar matches incorrectos
const sospechosos = ingredientes.filter(ing => {
  const tokensIng = tokenizar(ing.nombre_libre)
  const tokensAlim = tokenizar(ing.alimento_nombre)
  const comunes = tokensIng.filter(t => tokensAlim.includes(t))
  // Si el ingrediente tiene 1-2 tokens y el alimento tiene 5+, sospechoso
  return tokensIng.length <= 2 && tokensAlim.length >= 4 && comunes.length <= 1
})
```

### 📊 Consultas SQL útiles para verificación

```sql
-- Contar huérfanos
SELECT COUNT(*) FROM receta_ingredientes WHERE alimento_id IS NULL;

-- Ver matches con pocos tokens en común (potenciales falsos positivos)
SELECT ri.nombre_libre, a.nombre AS alimento_nombre
FROM receta_ingredientes ri
JOIN alimentos a ON a.id = ri.alimento_id
WHERE ri.alimento_id IS NOT NULL
  AND length(ri.nombre_libre) < 10
  AND length(a.nombre) > 30;

-- Scores < 100
SELECT r.nombre, rc.score_total
FROM recetas r
JOIN receta_score_calidad rc ON rc.receta_id = r.id
WHERE rc.score_total < 100
ORDER BY rc.score_total;
```

### 🔄 Batch de enriquecimiento de micronutrientes

El archivo [`scripts/enriquecer-micronutrientes-batch.ts`](scripts/enriquecer-micronutrientes-batch.ts) procesa alimentos sin micronutrientes:

1. **OpenFoodFacts API** (primero): busca por nombre en la API pública
2. **DeepSeek IA** (fallback): estima valores basados en BEDCA/USDA
3. **Jerarquía de fuentes**: `openfoodfacts` > `deepseek`

Estado actual (~mayo 2026): ~6.179 alimentos totales, ~4.844 enriquecidos, ~1.335 pendientes.

---

## Historial de Cambios

| Fecha | Cambio | Autor |
|-------|--------|-------|
| 2026-05-23 | Fix #1: Eliminar contains bidireccional en SQL trigger | Claude Codex |
| 2026-05-23 | Fix #2: Modelo DeepSeek como función getter | Claude Codex |
| 2026-05-23 | Fix #3: Añadir macros_100g a matches exactos | Claude Codex |
| 2026-05-23 | Fix #4: Error handling en FASE 2 | Claude Codex |
| 2026-05-23 | Fix #5: [...tokensN].sort() en vez de mutación | Claude Codex |
| 2026-05-23 | Creación del documento legacy | Claude Codex |
