# Auditoria Fase 2 — Pipeline de Ingesta de Papers

**Fecha:** 2026-05-21
**Estado:** Todos los bugs corregidos | Compilacion 0 errores | Produccion OK

---

## Resumen

Pipeline: **PubMed E-utilities → DeepSeek reader → Evaluador → knowledge_base**

```
8 fuentes | 118 papers encontrados (dry-run) | 0 errores | 16.3s
```

---

## Bugs detectados y corregidos (21-05-2026)

### Bug #1 — CORREGIDO: `cleanXML()` orden incorrecto

**Archivo:** [`lib/ingesta-papers/pubmed-api.ts`](lib/ingesta-papers/pubmed-api.ts)

**Problema:** `&` se reemplazaba PRIMERO, rompiendo la deteccion de `<` y `>`.

**Fix:** Mover `&` → `&` al FINAL de la cadena, despues de las entidades compuestas.

```typescript
.replace(/</g, '<')        // PRIMERO entidades compuestas
.replace(/>/g, '>')
...
.replace(/&/g, '&')        // & AL FINAL
```

---

### Bug #2 — CORREGIDO: `poblacion` mapeaba keywords

**Archivo:** [`lib/ingesta-papers/ingestador.ts`](lib/ingesta-papers/ingestador.ts)

**Problema:** `poblacion: paper.keywords` en vez de `poblacion: paper.poblacion`.

**Fix:**

```typescript
poblacion: paper.poblacion ? [paper.poblacion] : [],
```

---

### Bug #3 — CORREGIDO: `.select('count')` incorrecto

**Archivo:** [`lib/ingesta-papers/ingestador.ts`](lib/ingesta-papers/ingestador.ts)

**Problema:** `.select('count')` tras INSERT en Supabase no devuelve el numero real de filas.

**Fix:** Eliminar `.select('count')`, usar `rows.length`:

```typescript
const { error } = await supabase.from('knowledge_base').insert(rows).select()
return rows.length
```

---

### Bug #4 — CORREGIDO: Fecha siempre YYYY-01-01

**Archivo:** [`lib/ingesta-papers/pubmed-api.ts`](lib/ingesta-papers/pubmed-api.ts)

**Problema:** Solo extraia el year de PubDate.

**Fix:** Nueva funcion `extractPubDate()` que extrae Year + Month + Day cuando estan disponibles.

---

### Bug #5 — CORREGIDO: Sin fallback de dedup por titulo

**Archivo:** [`lib/ingesta-papers/ingestador.ts`](lib/ingesta-papers/ingestador.ts)

**Problema:** Solo filtraba por DOI. Sin DOIs no filtraba nada.

**Fix:** Dos pasadas:
1. Filtrar por DOI (elimina duplicados con DOI conocido)
2. Filtrar por titulo contra toda la knowledge_base (fallback universal)

Ademas detecta duplicados dentro del mismo batch (mismo titulo repetido).

---

## Mejoras adicionales aplicadas

### `papers_duplicados` en `ResultadoIngesta`

**Archivos:** [`tipos.ts`](lib/ingesta-papers/tipos.ts), [`ingestador.ts`](lib/ingesta-papers/ingestador.ts), [`scripts/ingestar-papers.ts`](scripts/ingestar-papers.ts)

Ahora se reporta `papers_duplicados` en la respuesta y se muestra en el CLI.

---

## Mejoras recomendadas (no implementadas)

### Mejora #1 — Retry en extractor DeepSeek

**Archivo:** [`lib/ingesta-papers/extractor.ts`](lib/ingesta-papers/extractor.ts)

Si DeepSeek falla para un paper (timeout, rate limit), se pierde sin reintentar. Anadir retry con backoff:

```typescript
async function extractWithDeepSeek(paper: PaperRaw, attempt = 1): Promise<...> {
  try { ... } catch (error) {
    if (attempt < 3 && esRecuperable(error)) {
      await sleep(attempt * 1000)
      return extractWithDeepSeek(paper, attempt + 1)
    }
    throw error
  }
}
```

---

### Mejora #2 — Logging persistente (tabla de auditoria)

No hay registro de ejecuciones anteriores. Propuesta:

```sql
CREATE TABLE public.ingesta_auditoria (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tipo text NOT NULL,
  resultado jsonb NOT NULL,
  created_at timestamptz DEFAULT now()
);
```

---

### Mejora #3 — DeepSeek temperature 0.1 → 0.2

**Archivo:** [`lib/ingesta-papers/extractor.ts`](lib/ingesta-papers/extractor.ts)

`temperature: 0.1` es muy baja. Para extraccion estructurada funciona, pero puede dar categorias siempre iguales. Subir a `0.2-0.3`.

---

### Mejora #4 — `rss-parser.ts` es codigo muerto

**Archivo:** [`lib/ingesta-papers/rss-parser.ts`](lib/ingesta-papers/rss-parser.ts)

Ya no se importa desde que migramos a PubMed E-utilities. Eliminar o mantener como respaldo.

---

### Mejora #5 — Score de revistas limitado

**Archivo:** [`lib/ingesta-papers/evaluador.ts`](lib/ingesta-papers/evaluador.ts)

Faltan revistas importantes:
- British Journal of Sports Medicine (BJSM)
- International Journal of Obesity
- Journal of Nutrition Education and Behavior
- Appetite
- European Journal of Sport Science
- Journal of the Academy of Nutrition and Dietetics
- Sports Medicine - Open
- Current Sports Medicine Reports

---

### Mejora #6 — `PUBMED_API_KEY` no configurada

**Archivo:** [`lib/ingesta-papers/pubmed-api.ts`](lib/ingesta-papers/pubmed-api.ts)

El codigo soporta la variable pero no esta en Vercel. Sin API key el limite es 10 req/s (suficiente para 8 fuentes secuenciales, pero opcional para escalar).

---

## Implementaciones futuras

### Futuro #1 — Vercel Cron Job semanal

```json
{
  "crons": [{
    "path": "/api/ingesta-papers",
    "schedule": "0 8 * * 1"
  }]
}
```

O cron local:
```
0 8 * * 1 cd /ruta && npx tsx scripts/ingestar-papers.ts >> logs/ingesta.log 2>&1
```

---

### Futuro #2 — Dashboard de revision de papers "revisar"

Papers con score 5-6 se clasifican como 'revisar' pero no hay UI. Propuesta:
- Endpoint GET `/api/ingesta-papers/revisar`
- Componente UI con aprobar/descartar
- Al aprobar: `UPDATE activo = true`
- Al descartar: `UPDATE activo = false`

---

### Futuro #3 — Integracion con Auto-Coach

Los papers deberian alimentar las recomendaciones de [`auto-coach.ts`](lib/auto-coach.ts). Actualmente [`seleccionarProtocolos()`](lib/knowledge-base.ts:576) prioriza `BASE_CONOCIMIENTO` (hardcoded) sobre DB. Modificar para que papers con `fuente_tipo='scrapeado'` tengan peso.

---

### Futuro #4 — Google Scholar + arXiv

El tipo `FuenteTipo` ya contempla `'arxiv'` y `'google_scholar'`. Implementar:
- **arXiv API**: `http://export.arxiv.org/api/query?search_query=...`
- **Google Scholar**: No tiene API oficial (scraping complejo)

---

### Futuro #5 — Notificaciones en papers nuevos

Webhook Slack/email cuando lleguen papers de alto impacto (score >= 9).

---

### Futuro #6 — Indice UNIQUE sobre DOI

Proteccion a nivel BD:

```sql
CREATE UNIQUE INDEX IF NOT EXISTS kb_doi_unique ON public.knowledge_base(doi) WHERE doi IS NOT NULL;
```

---

## Estado del codigo (post-fixes)

| Archivo | Lineas | Bugs | Estado |
|---------|--------|------|--------|
| `tipos.ts` | 83 | 0 | OK |
| `fuentes.ts` | 105 | 0 | OK |
| `pubmed-api.ts` | ~250 | 0 | OK (fixes #1, #4) |
| `extractor.ts` | 169 | 0 | OK |
| `evaluador.ts` | 170 | 0 | OK |
| `ingestador.ts` | ~295 | 0 | OK (fixes #2, #3, #5) |
| `index.ts` | 17 | 0 | OK |
| `rss-parser.ts` | 138 | 0 | Codigo muerto |
| `scripts/ingestar-papers.ts` | 120 | 0 | OK |
| `app/api/ingesta-papers/route.ts` | 109 | 0 | OK |

---

## Lo que funciona bien

- PubMed E-utilities API en produccion (118 papers en 16s)
- Retry con backoff para 429
- Secuencial para respetar rate limits de NCBI
- Auth con Bearer token
- Mapeo `fuente_tipo` correcto (`scrapeado` es valor valido en CHECK)
- CLI runner con flags (`--dry-run`, `--skip-extraction`, `--fuente`)
- DeepSeek reader en espanol con temperature baja
- Score multiaxial (revista + diseno + muestra + relevancia)
- Arquitectura modular (cada etapa separada)
- Todos los bugs corregidos | Compilacion 0 errores
