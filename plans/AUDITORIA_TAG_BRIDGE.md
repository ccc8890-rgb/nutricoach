# 🧠 Auditoría TAG_BRIDGE + Estado del Sistema — 21/05/2026 (Post-Expansión)

## ✅ Lo que funciona

### Pipeline de ingesta de papers (semanal vía Vercel Cron)
- **224 papers** en `knowledge_base` (tras 6 nuevas fuentes clínicas)
- **14 fuentes PubMed** (8 originales + 6 clínicas nuevas) → DeepSeek extrae → evaluador ≥7 → inserta
- Auditoría en `ingesta_auditoria`
- Retry con backoff en DeepSeek
- Cron: lunes 08:30 UTC

### TAG_BRIDGE — Puente semántico cliente → papers [EXPANDIDO 2ª RONDA ✅]
- **~95 entradas** (de ~80 a ~95) con **~500 bridge values totales** (vs ~160 antes)
- Nuevas keys añadidas: `hidratacion`, `carbohidratos`, `proteina`, `periodizacion`, `nutricion_deportiva`, `suplementacion`, `salud_osea`
- Cada key expandida con tags reales de los 224 papers KB (cobertura funcional masiva)
- Implementado en `expandirTags()` + `expandirTagsSet()`
- Se usa en: `consultarKnowledgeDB()` → query Supabase + `scoreAndFilter()` → scoring
- También en fallback hardcoded `seleccionarProtocolos()`

**Mejora de cobertura funcional** (papers encontrados antes → después):
| Perfil | Antes (sin bridge) | Después (bridge expandido) | Mejora |
|--------|:---:|:---:|:---:|
| Carlos — perder grasa + diabetes | 12 | **50** | +317% |
| Laura — vegana + perder grasa | 2 | **35** | +1650% |
| Sofía — recomposición + crossfit | 5 | **50** | +900% |
| Javier — diabetes T2 + hipertenso | 13 | **40** | +208% |
| Marta — >65 + sarcopenia | 33 | **44** | +33% |
| Ana — ganar músculo + running | 50 | **50** | límite alcanzado |
| Pedro — hyrox + fuerza | 50 | **50** | límite alcanzado |

### Nuevas fuentes PubMed clínicas [AÑADIDAS ✅]
- `pubmed-tiroides`: hipotiroidismo + yodo/selenio
- `pubmed-pcos-sop`: SOP + resistencia insulina/pérdida peso
- `pubmed-menopausia`: menopausia + densidad ósea/calcio/vit D
- `pubmed-salud-osea`: sarcopenia + proteína/ejercicio/calcio
- `pubmed-ansiedad-alimentacion`: salud mental + microbiota/omega-3
- `pubmed-rehabilitacion`: rehabilitación + nutrición/fisioterapia
- **27 papers insertados** de 90 encontrados
- **Impacto backfill**: Marta Hipotiroidismo 1→2, Nuria SOP 2→4, Ana Menopausia 1→2 protocolos

### Generación de plan principal
- `POST /api/generar-plan-inicial` → usa `seleccionarProtocolos()` → `formatearEvidenciaParaPrompt()` → inyecta en contexto de DeepSeek ✅
- Incluye: mesociclo, distribución proteína, flags conductuales, peri-entreno
- Ahora con evidencia real de PubMed mapeada vía TAG_BRIDGE

### Dashboard KB para coach [NUEVO ✅]
- `components/dashboard/KBPanel.tsx` — integrado en Dashboard principal
- Muestra: total fichas, puentes TAG, distribución por disciplina, últimas fichas, cobertura TAG_BRIDGE
- Enlace directo a `/conocimiento` para gestión

### Backfill script [NUEVO ✅]
- `scripts/backfill-planes-evidencia.ts`
- `--dry-run` para previsualizar
- Inyecta `plan_json.evidencia_cientifica` con protocolos TAG_BRIDGE en planes existentes
- Crea placeholders para clientes sin plan
- **Real ejecutado**: 10 clientes, 57 referencias

### Auto-entrenamiento script [NUEVO ✅]
- `scripts/analizar-uso-papers.ts`
- Ranking papers más/menos usados, cobertura, tags sin puente en TAG_BRIDGE
- Sugerencias automáticas: protocolos no usados, concentración excesiva, tags perdidos
- **Resultado ejecución**: 7 planes, 12/224 (6% cobertura), 274 tags sin puente (ahora ~200 resueltos con expansión)

### 18 protocolos hardcodeados como fallback
- `BASE_CONOCIMIENTO` en `lib/knowledge-base.ts`
- Se usa si Supabase no responde

## 🐛 Bugs detectados

### Bug #1 — CORREGIDO ✅: `fetchKnowledgeContext()` legacy (lib/knowledge.ts)
- **Estado**: Rewrite para usar `expandirTags()` + `formatearEvidenciaParaPrompt()`
- **Ruta**: `POST /api/generar-dieta-ia` (ruta IA legacy, distinta del plan inicial)
- **Fix**: Ya no filtra por `disciplina` (columna inexistente). Usa TAG_BRIDGE.
- Marcado como `@deprecated` — migrar a `seleccionarProtocolos()` directamente

### Bug #2 — Cerrado ✅: Papers sin resumen largo
- **Investigado**: 0 papers en `knowledge_base` con `resumen` < 50 caracteres
- **Fallback existente**: `consultarKnowledgeDB()` usa `contenido_completo` si `resumen` es corto
- **No requiere acción**

### Bug #3 — Cerrado ✅: ScoreAndFilter usa tags expandidos con espacios
- **Investigado**: Tags con espacios (20/50 papers) manejados correctamente por sintaxis `.ov.{}` de PostgreSQL
- **Confirmado**: `expandirTags()` produce tags con espacios y sin espacios; ambos funcionan

### Bug #4 — CORREGIDO ✅: Política `coach_id NULL` + coach-específico
- **Fix**: Eliminado `.is('coach_id', null)` de `consultarKnowledgeDB()` → ahora incluye ambos
- **Fix propagado** a: `seleccionarProtocolos()`, `test-tag-bridge.ts` (2 ocurrencias)

## 🗺️ Mapa de archivos

| Archivo | Rol | Estado |
|---------|-----|--------|
| `lib/knowledge-base.ts` | Bridge + protocolos + selección | ✅ TAG_BRIDGE ~95 entradas, ~500 bridge values |
| `lib/knowledge.ts` | Legacy fetchKnowledgeContext() | ✅ Fix aplicado (deprecated) |
| `lib/ingesta-papers/fuentes.ts` | 14 fuentes PubMed | ✅ 6 clínicas añadidas |
| `lib/ingesta-papers/` | Pipeline completo PubMed→KB | ✅ Funcional |
| `app/api/generar-plan-inicial/route.ts` | Generación principal | ✅ Usa bridge |
| `app/api/generar-dieta-ia/route.ts` | Ruta IA legacy | ✅ Recibe evidencia vía fix |
| `app/api/conocimiento/route.ts` | CRUD knowledge_base | ✅ API lista + UI |
| `app/api/cron/ingesta-papers/route.ts` | Cron semanal | ✅ |
| `components/dashboard/KBPanel.tsx` | Dashboard KB | ✅ Nuevo |
| `scripts/backfill-planes-evidencia.ts` | Backfill evidencia real | ✅ Ejecutado (10 clientes) |
| `scripts/analizar-uso-papers.ts` | Auto-entrenamiento | ✅ Ejecutado (7 planes) |
| `scripts/test-tag-bridge.ts` | Test bridge | ✅ Updated (fix coach_id) |
| `scripts/test-e2e-bridge.ts` | Test end-to-end | ✅ |

## 🎯 Pendientes para próxima sesión

1. **Ejecutar ingesta resto fuentes** (nutrición deportiva, composición corporal, proteína, periodización) — las 8 fuentes originales ya están, pero estas 4-5 nuevas mejorarían cobertura de deportes específicos
2. **Re-scrapear supermercados** para re-vincular ~84 productos (Lidl, Carrefour, Día)
3. **Dashboard de rentabilidad/ahorro** con vista `top_precios_escandallo`
4. **Automatización Vercel Cron Jobs** (recordatorio-checkin, ingesta semanal papers)
5. **Histórico de precios y tendencias** de supermercados

---

Commit: `26a8680` (pendiente push tras TAG_BRIDGE expansion)
