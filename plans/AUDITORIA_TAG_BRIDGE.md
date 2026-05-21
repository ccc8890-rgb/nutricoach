# Auditoría TAG_BRIDGE — Puente semántico cliente → papers KB

## Estado actual (21-05-2026)

### Pipeline de ingesta de papers (semanal vía Vercel Cron)
- **14 fuentes PubMed activas** (8 originales + 6 clínicas)
- KB: **230 papers** insertados en `knowledge_base`
- DeepSeek extrae y puntúa cada paper (score ≥7 para incluir)
- Dedup por DOI + título antes de insertar

### TAG_BRIDGE — Puente semántico cliente → papers [EXPANDIDO 2ª RONDA ✅]
- ~95 entradas, ~500 bridge values
- Cobertura funcional tras expansión:

| Cliente | Antes | Después | Δ |
|---------|-------|---------|---|
| Carlos | 12 | 50 | +317% |
| Laura | 2 | 35 | +1650% |
| Sofía | 5 | 50 | +900% |
| Javier | 13 | 40 | +208% |
| Marta | 33 | 44 | +33% |
| Ana | 50 | 50 | — (saturado) |
| Pedro | 50 | 50 | — (saturado) |

### Nuevas fuentes PubMed clínicas [AÑADIDAS ✅]
6 fuentes: tiroides, SOP/PCOS, menopausia, salud ósea, salud mental, rehabilitación

### Generación de plan principal
- `consultarKnowledgeDB()` usa tags expandidos (sin filtro `coach_id`)
- Límite: top 50 papers por score de relevancia

### Dashboard KB para coach [NUEVO ✅]
- [`components/dashboard/KBPanel.tsx`](components/dashboard/KBPanel.tsx) en dashboard principal
- Muestra stats, últimas fichas, disciplinas, puentes por categoría

### Backfill script [NUEVO ✅]
- [`scripts/backfill-planes-evidencia.ts`](scripts/backfill-planes-evidencia.ts)
- Vincula papers a planes nutricionales activos
- Ejecutado con 10 clientes, 57 referencias

### Auto-entrenamiento script [NUEVO ✅]
- [`scripts/analizar-uso-papers.ts`](scripts/analizar-uso-papers.ts)
- Analiza qué papers se usan en planes reales vs KB total
- Map por título como fallback

### 18 protocolos hardcodeados como fallback
En [`lib/knowledge-base.ts`](lib/knowledge-base.ts) — `BASE_CONOCIMIENTO`

## Bugs

### Bug #1 — CORREGIDO ✅: `fetchKnowledgeContext()` legacy (lib/knowledge.ts)
- Usaba array plano sin expandir tags
- Fix: ahora llama a `consultarKnowledgeDB()` con tags expandidos

### Bug #2 — Cerrado ✅: Papers sin resumen largo
- 0 papers con resumen <50 chars en KB
- Fallback ya existe en `scoreAndFilter()`

### Bug #3 — Cerrado ✅: ScoreAndFilter usa tags expandidos con espacios
- `.or('tags.ov.{"tag1","tag2"}')` funciona correctamente con espacios

### Bug #4 — CORREGIDO ✅: Política `coach_id NULL` + coach-específico
- Se eliminó `.is('coach_id', null)` de `consultarKnowledgeDB()`
- También corregido en `test-tag-bridge.ts`

### Bug #5 — CORREGIDO ✅: Carrefour scrap 0 comestibles
- **Causa raíz**: Scraper inline legacy usaba URLs antiguas (`/supermercado/c/alimentacion`) que Carrefour cambió. Navegar categoría por categoría activaba Cloudflare.
- **Fix**: Reemplazado por wrapper en [`scripts/ejecutar-scraping.mjs`](scripts/ejecutar-scraping.mjs) que ejecuta el scraper modular [`lib/scraping/supermercados/carrefour.ts`](lib/scraping/supermercados/carrefour.ts) vía `npx tsx`.
- **Scraper modular**: Extrae ~444 productos directamente del homepage con selectores actualizados (`.product-card__parent`, `catalog="food"`), evitando navegación a URLs individuales.
- Playwright homepage no encuentra productos comestibles
- Pendiente diagnosticar

## 🗺️ Mapa de archivos

| Archivo | Propósito | Estado |
|---------|-----------|--------|
| [`lib/knowledge-base.ts`](lib/knowledge-base.ts) | TAG_BRIDGE (~95 entradas), detectarTags(), expandirTags(), consultarKnowledgeDB(), scoreAndFilter(), seleccionarProtocolos() | ✅ Expandido |
| [`lib/knowledge.ts`](lib/knowledge.ts) | Legacy `fetchKnowledgeContext()` | ✅ Bug #1 corregido |
| [`lib/ingesta-papers/fuentes.ts`](lib/ingesta-papers/fuentes.ts) | 14 fuentes PubMed | ✅ 6 nuevas añadidas |
| [`lib/ingesta-papers/ingestador.ts`](lib/ingesta-papers/ingestador.ts) | Pipeline de ingesta | ✅ |
| [`lib/ingesta-papers/pubmed-api.ts`](lib/ingesta-papers/pubmed-api.ts) | NCBI E-utilities | ✅ |
| [`lib/ingesta-papers/extractor.ts`](lib/ingesta-papers/extractor.ts) | DeepSeek extraction | ✅ |
| [`lib/ingesta-papers/evaluador.ts`](lib/ingesta-papers/evaluador.ts) | Score de calidad | ✅ |
| [`lib/ingesta-papers/tipos.ts`](lib/ingesta-papers/tipos.ts) | Tipos compartidos | ✅ |
| [`scripts/ingestar-papers.ts`](scripts/ingestar-papers.ts) | CLI de ingesta | ✅ |
| [`app/api/cron/ingesta-papers/route.ts`](app/api/cron/ingesta-papers/route.ts) | Cron semanal | ✅ |
| [`scripts/test-tag-bridge.ts`](scripts/test-tag-bridge.ts) | Test bridge | ✅ Fix coach_id |
| [`scripts/test-e2e-bridge.ts`](scripts/test-e2e-bridge.ts) | Test end-to-end | ✅ |
| [`scripts/diagnosticar-tags-kb.ts`](scripts/diagnosticar-tags-kb.ts) | Diagnóstico tags KB | ✅ |
| [`scripts/backfill-planes-evidencia.ts`](scripts/backfill-planes-evidencia.ts) | Backfill evidencia | ✅ |
| [`scripts/analizar-uso-papers.ts`](scripts/analizar-uso-papers.ts) | Auto-entrenamiento | ✅ |
| [`components/dashboard/KBPanel.tsx`](components/dashboard/KBPanel.tsx) | Dashboard KB | ✅ |
| [`components/DashboardRentabilidad.tsx`](components/DashboardRentabilidad.tsx) | Dashboard rentabilidad | ✅ Verificado |
| [`app/precios/rentabilidad/page.tsx`](app/precios/rentabilidad/page.tsx) | Página rentabilidad | ✅ Verificado |
| [`vercel.json`](vercel.json) | Cron jobs config | ✅ Verificado |

## ✅ Progreso sesiones posteriores (21-05-2026)

### Pendientes ejecutados:
1. **Ingesta resto fuentes** ✅ — KB 224→230 papers (+6 nuevos)
2. **Re-scrapear supermercados** ✅ — Mercadona, Alcampo, Eroski, Carrefour (Consum ⏳)
3. **Dashboard rentabilidad/ahorro** ✅ — Verificado implementado completo
4. **Automatización Vercel Cron Jobs** ✅ — Verificado configurado

### Nuevos bugs detectados:
- **Bug #5 — Carrefour 0 comestibles**: Playwright homepage no encuentra productos. Diagnosticar.
- **Bonpreu/Esclat**: Sin flag en script principal de scraping. Baja prioridad.

## 🎯 Pendientes para próxima sesión

1. Verificar que Consum terminó el re-scrapeo
2. **Diagnosticar Bug #5**: Carrefour 0 comestibles
3. **Re-backfill** con los 6 nuevos papers → actualizar protocolos en planes activos
4. **Re-auto-entrenamiento**: post-backfill
5. **Test tag-bridge**: Verificar cobertura con KB 230 papers
6. **Build de verificación**: `npx next build`
7. **Día**: Investigar API tras WAF Cloudflare
8. **Aldi**: Nuevo scraper
9. **Histórico de precios y tendencias**

---

Commit: `a93b87b` (pendiente push tras sesión 3ª ronda)
