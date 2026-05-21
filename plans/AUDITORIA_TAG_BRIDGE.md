# 🧠 Auditoría TAG_BRIDGE + Estado del Sistema — 21/05/2026

## ✅ Lo que funciona

### Pipeline de ingesta de papers (semanal vía Vercel Cron)
- 197 papers en `knowledge_base`
- 8 fuentes PubMed → DeepSeek extrae → evaluador ≥7 → inserta
- Auditoría en `ingesta_auditoria`
- Retry con backoff en DeepSeek
- Cron: lunes 08:30 UTC

### TAG_BRIDGE — Puente semántico cliente → papers [NUEVO]
- 50+ entradas que expanden tags cliente a tags KB
- Implementado en `expandirTags()` + `expandirTagsSet()`
- Se usa en: `consultarKnowledgeDB()` → query Supabase + `scoreAndFilter()` → scoring
- También en fallback hardcoded `seleccionarProtocolos()`
- **Resultado**: de 0-11 papers encontrados por perfil → 25-50 papers

### Generación de plan principal
- `POST /api/generar-plan-inicial` → usa `seleccionarProtocolos()` → `formatearEvidenciaParaPrompt()` → inyecta en contexto de DeepSeek ✅
- Incluye: mesociclo, distribución proteína, flags conductuales, peri-entreno

### 18 protocolos hardcodeados como fallback
- `BASE_CONOCIMIENTO` en `lib/knowledge-base.ts`
- Se usa si Supabase no responde

## 🐛 Bugs detectados

### Bug #1 — CRÍTICO: `fetchKnowledgeContext()` legacy (lib/knowledge.ts)
- **Ruta**: `POST /api/generar-dieta-ia` (ruta IA legacy, distinta del plan inicial)
- **Problema**: filtra por `disciplina` (columna inexistente → query devuelve 0 resultados)
- Además **NO usa TAG_BRIDGE**
- **Impacto**: la IA legacy nunca recibe evidencia científica
- **Fix**: actualizar para usar `seleccionarProtocolos()` con TAG_BRIDGE

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

## 📈 Mejoras prioritarias para próxima sesión

### Mejora #1 — Backfill: regenerar planes existentes con TAG_BRIDGE
- Los 3 planes generados ANTES del bridge no tienen evidencia real de PubMed
- Propuesta: script que regenera planes de test clients con TAG_BRIDGE activo

### Mejora #2 — Más papers para condiciones clínicas
- `diabetes`: solo 5 papers (etiqueta exacta), ~15 con bridge
- `hipotiroidismo`: 0 papers en KB (no existe en fuentes PubMed configuradas)
- `pcos/sop`: 0 papers
- `menopausia`: 0 papers
- **Fix**: añadir fuentes PubMed especializadas en: tiroides, SOP, menopausia, salud ósea

### Mejora #3 — Expandir TAG_BRIDGE con más sinónimos
- Revisar manualmente papers sin match y añadir entradas al bridge
- Ej: "tension_alta" (en condiciones de papers) → mapeado a "hipertension" (cliente)

### Mejora #4 — Dashboard de knowledge_base
- UI para coach: ver qué papers existen, filtrar, desactivar, añadir manualmente
- Ya existe `GET /api/conocimiento` endpoint (falta UI)

### Mejora #5 — Auto-entrenamiento del algoritmo
- Sistema que analice qué papers se usaron en cada plan y sugiera refinamientos
- Si un paper se usa mucho → priorizarlo en scoring
- Si un paper nunca se usa → revisar etiquetado o desactivar

## 🗺️ Mapa de archivos

| Archivo | Rol | Estado |
|---------|-----|--------|
| `lib/knowledge-base.ts` | Bridge + protocolos + selección | ✅ Con TAG_BRIDGE |
| `lib/knowledge.ts` | Legacy fetchKnowledgeContext() | 🐛 No usa bridge (Bug #1) |
| `lib/ingesta-papers/` | Pipeline completo PubMed→KB | ✅ Funcional |
| `app/api/generar-plan-inicial/route.ts` | Generación principal | ✅ Usa bridge |
| `app/api/generar-dieta-ia/route.ts` | Ruta IA legacy | 🐛 Bug #1 |
| `app/api/conocimiento/route.ts` | CRUD knowledge_base (sin UI) | ✅ API lista |
| `app/api/cron/ingesta-papers/route.ts` | Cron semanal | ✅ |
| `scripts/test-tag-bridge.ts` | Test bridge | ✅ |
| `scripts/test-e2e-bridge.ts` | Test end-to-end | ✅ |

## 📊 Tags en KB vs Tags cliente

```
Tags disponibles en KB (top 15):
  proteina(25), hipertrofia(24), rendimiento(24), fuerza(20),
  recuperacion(16), running(14), intensidad(14), periodizacion(14),
  hyrox(13), volumen(13), obesidad(11), zona2(10),
  autorregulacion(10), leucina(9), sodio(9)

Tags cliente SIN cobertura en KB:
  ❌ hipotiroidismo   ❌ tiroides   ❌ pcos   ❌ sop
  ❌ menopausia       ❌ climaterio ❌ dislipemia
  ❌ ansiedad          ❌ salud_mental
  ❌ ciclismo         ❌ triatlon   ❌ bici    ❌ ironman
```

## 🎯 Resumen para próxima sesión

1. **Fix Bug #1**: Actualizar `fetchKnowledgeContext()` para usar `seleccionarProtocolos()` con TAG_BRIDGE
2. **Añadir fuentes clínicas**: tiroides, SOP, menopausia en PubMed
3. **Backfill**: regenerar planes de test con evidencia real
4. **Dashboard KB**: UI para coach sobre papers disponibles
5. **Expandir TAG_BRIDGE**: más sinónimos para tags sin cobertura

Commit: `85d1a63` — TAG_BRIDGE implementado
