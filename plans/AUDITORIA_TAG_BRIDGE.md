# 🧠 Auditoría TAG_BRIDGE + Estado del Sistema — 21/05/2026

## ✅ Lo que funciona

### Pipeline de ingesta de papers (semanal vía Vercel Cron)
- 197+ papers en `knowledge_base`
- **14 fuentes PubMed** (8 originales + 6 clínicas nuevas) → DeepSeek extrae → evaluador ≥7 → inserta
- Auditoría en `ingesta_auditoria`
- Retry con backoff en DeepSeek
- Cron: lunes 08:30 UTC

### TAG_BRIDGE — Puente semántico cliente → papers [EXPANDIDO ✅]
- **80+ entradas** (de ~50 a ~85) — cubre objetivos, deportes, salud metabólica, hormonas, suplementación, lesiones, sueño
- Implementado en `expandirTags()` + `expandirTagsSet()`
- Se usa en: `consultarKnowledgeDB()` → query Supabase + `scoreAndFilter()` → scoring
- También en fallback hardcoded `seleccionarProtocolos()`
- **Resultado**: de 0-11 papers encontrados por perfil → 25-50 papers

### Nuevas fuentes PubMed clínicas [AÑADIDAS ✅]
- `pubmed-tiroides`: hipotiroidismo + yodo/selenio
- `pubmed-pcos-sop`: SOP + resistencia insulina/pérdida peso
- `pubmed-menopausia`: menopausia + densidad ósea/calcio/vit D
- `pubmed-salud-osea`: sarcopenia + proteína/ejercicio/calcio
- `pubmed-ansiedad-alimentacion`: salud mental + microbiota/omega-3
- `pubmed-rehabilitacion`: rehabilitación + nutrición/fisioterapia

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

### Auto-entrenamiento script [NUEVO ✅]
- `scripts/analizar-uso-papers.ts`
- Ranking papers más/menos usados, cobertura, tags sin puente en TAG_BRIDGE
- Sugerencias automáticas: protocolos no usados, concentración excesiva, tags perdidos

### 18 protocolos hardcodeados como fallback
- `BASE_CONOCIMIENTO` en `lib/knowledge-base.ts`
- Se usa si Supabase no responde

## 🐛 Bugs detectados

### Bug #1 — CORREGIDO ✅: `fetchKnowledgeContext()` legacy (lib/knowledge.ts)
- **Estado**: Rewrite para usar `expandirTags()` + `formatearEvidenciaParaPrompt()`
- **Ruta**: `POST /api/generar-dieta-ia` (ruta IA legacy, distinta del plan inicial)
- **Fix**: Ya no filtra por `disciplina` (columna inexistente). Usa TAG_BRIDGE.
- Marcado como `@deprecated` — migrar a `seleccionarProtocolos()` directamente

### Bug #2 — Papers sin resumen largo
- Algunos papers extraídos por DeepSeek tienen `<50 chars` en resumen
- `consultarKnowledgeDB()` usa `contenido_completo` como fallback, pero a veces está vacío
- **Impacto**: papers aparecen sin contenido útil en la evidencia

### Bug #3 — ScoreAndFilter usa tags expandidos pero los papers tienen tags con espacios
- Los papers tienen tags como `"perdida grasa"` (con espacio)
- El TAG_BRIDGE mapea correctamente, pero la query `.or(tags.ov.{...})` de Supabase requiere cuidado con espacios
- Tests actuales pasan ✅, pero ampliar el bridge puede romper la sintaxis

### Bug #4 — Método `coach_id` no poblado en ingesta automática
- Los papers insertados vía pipeline tienen `coach_id IS NULL`
- `consultarKnowledgeDB()` filtra con `.is('coach_id', null)` ✅ — funciona
- Pero si un coach añade papers manuales con su `coach_id`, no se mezclan

## 🗺️ Mapa de archivos

| Archivo | Rol | Estado |
|---------|-----|--------|
| `lib/knowledge-base.ts` | Bridge + protocolos + selección | ✅ TAG_BRIDGE 80+ entradas |
| `lib/knowledge.ts` | Legacy fetchKnowledgeContext() | ✅ Fix aplicado (deprecated) |
| `lib/ingesta-papers/fuentes.ts` | 14 fuentes PubMed | ✅ 6 clínicas añadidas |
| `lib/ingesta-papers/` | Pipeline completo PubMed→KB | ✅ Funcional |
| `app/api/generar-plan-inicial/route.ts` | Generación principal | ✅ Usa bridge |
| `app/api/generar-dieta-ia/route.ts` | Ruta IA legacy | ✅ Recibe evidencia vía fix |
| `app/api/conocimiento/route.ts` | CRUD knowledge_base | ✅ API lista + UI |
| `app/api/cron/ingesta-papers/route.ts` | Cron semanal | ✅ |
| `components/dashboard/KBPanel.tsx` | Dashboard KB | ✅ Nuevo |
| `scripts/backfill-planes-evidencia.ts` | Backfill evidencia real | ✅ Nuevo |
| `scripts/analizar-uso-papers.ts` | Auto-entrenamiento | ✅ Nuevo |
| `scripts/test-tag-bridge.ts` | Test bridge | ✅ |
| `scripts/test-e2e-bridge.ts` | Test end-to-end | ✅ |

## 🎯 Pendientes para próxima sesión

1. **Ejecutar backfill**: `npx tsx scripts/backfill-planes-evidencia.ts --dry-run` → luego sin flag
2. **Ejecutar auto-entrenamiento**: `npx tsx scripts/analizar-uso-papers.ts` → ajustar TAG_BRIDGE según resultados
3. **Bug #2**: Investigar papers con resumen <50 chars — ¿DeepSeek o PubMed?
4. **Bug #3**: Tests de estrés con espacios en tags del bridge
5. **Bug #4**: Política de mezcla coach_id NULL + coach_id específico
6. **Ejecutar ingesta**: las nuevas 6 fuentes clínicas necesitan primera ejecución (Vercel Cron o manual)

---

Commit: `ab54e2b` — 5 mejoras implementadas: TAG_BRIDGE expandido, PubMed clínico, backfill, KB dashboard, auto-entrenamiento
