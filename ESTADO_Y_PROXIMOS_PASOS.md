# 🧠 Estado del Proyecto y Próximos Pasos — NutriCoach

## Sesión 21-05-2026 (5ª ronda) — PORTAL CLIENTE: PLAN DIARIO + ALTERNATIVAS + VISTA SEMANAL 🚀

##### ✅ Completado esta ronda

**Arquitectura ciencia-first + feedback loop cerrado**
- `generar-plan-inicial`: Fix 4 bugs críticos (IDs receta falsos, filtro estado, evidencia no guardada, metodología vacía). El plan ahora cita papers específicos (ISSN 2017, Helms 2014, Morton 2018) en `notas_coach`.
- `checkin/route.ts`: Fix crítico — `from('dietas')` (tabla inexistente) → `planes_nutricion` + columna `carbohidratos_objetivo` (era `carbos_objetivo`). El feedback loop ahora **cierra de verdad**: check-in → periodización → ajuste automático de macros en `planes_nutricion`.
- `periodizacion/refeed/aprobar`: Importa `aplicarAjusteAlPlan()` compartida — aprobación del coach aplica efectivamente los macros al plan activo.

**Portal cliente — Alternativas por comida (Vista Hoy)**
- `GET /api/recetas/sugeridas`: Añadido filtro `tipo_plato` (Desayuno/Comida/Cena/Merienda) + fallback sin filtro si hay pocas recetas. Límite subido a 7. Distancia euclidiana preservada.
- `GET /api/recetas/[id]/ingredientes`: Nuevo endpoint — devuelve ingredientes de una receta formateados como `AlimentoEnComida[]`. Sin auth (datos públicos del recetario).
- `MiPlan.tsx`: Botón "Ver alternativas" por comida → 4 recetas del recetario filtradas por `tipo_plato`. Cada card tiene botón **"Usar"** que sustituye los alimentos de la comida con los ingredientes de la receta. Toast de confirmación. Caché invalidada al usar.

**Portal cliente — Vista semanal (nueva)**
- `PlanSemanal.tsx` (nuevo componente): Genera 7 días Mon-Dom con recetas del recetario. Para cada franja (Desayuno, Comida, Merienda, Cena) carga pool de 7 sugerencias y las distribuye por día (rotación circular). Botón ↻ por slot para ciclar alternativas. Resumen macros por día.
- Toggle **Hoy / Semana** en la parte superior de MiPlan — cambia entre vista diaria detallada y planificación semanal.

**Bugs corregidos (auditoría post-implementación)**

| # | Tipo | Archivo | Bug | Fix |
|---|------|---------|-----|-----|
| 1 | 🔴 CRÍTICO | `sugeridas/route.ts` | `NOT IN ()` SQL inválido cuando pool vacío con `tipo_plato` | Solo excluye IDs si `pool.length > 0` |
| 2 | 🔴 CRÍTICO | `MiPlan.tsx` | `PlanSemanal` re-ejecutaba `useEffect` al hacer swap en vista Hoy (`planLocal` crea nueva referencia) | `useMemo` con `plan.comidas` original — referencia estable |
| 3 | 🟠 MENOR | `sugeridas/route.ts` | Límite máximo 6, PlanSemanal pedía 7 → días 1 y 7 siempre repetían receta | Límite subido a 7 |
| 4 | 🟡 MENOR | `lib/knowledge-base.ts` | Clave `sop` duplicada (líneas 385 y 550) → error TS1117 | Merge de valores únicos, eliminado duplicado |

##### 🧪 Pendientes para próxima sesión
- **Aprendizaje de preferencias**: Registrar intercambios de receta en `intercambios_historial` y pasar historial al siguiente plan (comidas más usadas = likes, base = baseline)
- **Aldi**: Nuevo scraper
- **Regeneración de imágenes**: 147 imágenes malas con estilo food blogger
- **TAG_BRIDGE**: ~195 tags de papers sin entrada en bridge

---

## Sesión 21-05-2026 (4ª ronda) — PENDIENTES EJECUTADOS + BUG #5 FIX 🚀

##### ✅ Completado
- **Ingesta resto fuentes**: [`npx tsx scripts/ingestar-papers.ts`](scripts/ingestar-papers.ts) — KB: **224 → 230 papers** (+6 nuevos). DeepSeek extrajo y evaluó todas las fuentes activas (14 fuentes). ✅
- **Re-scrapear supermercados**: Mercadona (2.895 prod) ✅, Alcampo (44 prod) ✅, Eroski ✅, Consum (4.765 prod) ✅ — terminó en background (~60 min). Carrefour (0 prod → **BUG #5 FIXED** ✅). 
- **Dashboard rentabilidad/ahorro**: Verificado que ya está implementado → [`components/DashboardRentabilidad.tsx`](components/DashboardRentabilidad.tsx) + [`app/precios/rentabilidad/page.tsx`](app/precios/rentabilidad/page.tsx) + [`top_precios_escandallo`](supabase/migrations/20260521014731_fix_escandallo_precios_validos.sql:133) ✅
- **Automatización Vercel Cron Jobs**: Verificado que ya está configurado → [`vercel.json`](vercel.json) (recordatorio-checkin L8:00 + ingesta-papers L8:30) + [`app/api/cron/ingesta-papers/route.ts`](app/api/cron/ingesta-papers/route.ts) (protegido con CRON_SECRET) ✅
- **Re-backfill con nuevos papers**: [`scripts/backfill-planes-evidencia.ts`](scripts/backfill-planes-evidencia.ts) — 11 clientes, 62 referencias en evidencia ✅
- **Auto-entrenamiento post-backfill**: [`scripts/analizar-uso-papers.ts`](scripts/analizar-uso-papers.ts) ✅ — 216 protocolos no usados, 195 tags sin puente
- **Test tag-bridge**: [`scripts/test-tag-bridge.ts`](scripts/test-tag-bridge.ts) — Expansión masiva: Laura +1700%, Sofía +900%, Carlos +285% 🚀 ✅
- **Bug #5 FIX**: Carrefour migrado al scraper modular [`carrefour.ts`](lib/scraping/supermercados/carrefour.ts) — extrae ~444 productos del homepage con selectores actualizados, evitando Cloudflare ✅
- **Build**: `npx next build` — **sin errores** ✅
- **Día**: Investigado — ya resuelto con scraper SSR directo vía HTTP ([`dia.ts`](lib/scraping/supermercados/dia.ts) v2) ✅

##### 🧪 Pendientes para próxima sesión
- **Aldi**: Nuevo scraper (desde cero)
- **Histórico de precios**: Verificar que las vistas SQL funcionan correctamente
- **Refinar TAG_BRIDGE**: ~195 tags de papers sin entrada en bridge
- **216 protocolos nunca usados**: Revisar si desactivarlos o mejorar matching
- **Regeneración de imágenes**: Pendiente de 147 imágenes malas con estilo food blogger
- **Productos mal mapeados**: Labiales (Deliplus) aparecen como alimentos — mejorar filtro `es_comestible`

---

**Última actualización:** 21-05-2026 (Sesión 5ª ronda — Portal cliente: plan diario + alternativas + vista semanal)
**Responsable:** Roo (Sesión 21-05-2026 — TAG_BRIDGE expansion + pendientes ejecución)
