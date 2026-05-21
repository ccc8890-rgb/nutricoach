---

#### 🏆 Sesión 21-05-2026 — TAG_BRIDGE: 5 mejoras implementadas (Expansión + PubMed clínico + Backfill + Dashboard KB + Auto-entrenamiento)

##### ✅ Completado
- **Bug #1 fix**: `fetchKnowledgeContext()` en [`lib/knowledge.ts`](lib/knowledge.ts:10) rewrite para usar `expandirTags()` + `formatearEvidenciaParaPrompt()`. Ya no filtra por columna `disciplina` inexistente ✅
- **TAG_BRIDGE expandido** [`lib/knowledge-base.ts:331`](lib/knowledge-base.ts:331): de ~50 a ~85+ entradas. Nuevas: `cardiovascular`, `suplementos`, `creatina`, `cafeina`, `proteina_suplementos`, `lesiones`, `recuperacion`, `rehabilitacion`, `deporte_equipo`, `estres`, `sueno`, `vegetales`, `natacion`. Expandidas: diabetes (+HbA1c), hipotiroidismo (+hashimoto, TSH), pcos (+testosterona, ovario poliquistico), menopausia (+estrogenos, osteoporosis), sarcopenia (+calidad muscular), ansiedad (+depresion, neurotransmisores), obesidad (+grasa visceral, cintura), ciclismo (+VO2max, potencia), triatlon (+carga, VO2max), etc. ✅
- **+6 fuentes PubMed clínicas** [`lib/ingesta-papers/fuentes.ts:87`](lib/ingesta-papers/fuentes.ts:87): tiroides, PCOS/SOP, menopausia, salud ósea/sarcopenia, salud mental/ansiedad, rehabilitación — con queries MeSH especializadas ✅
- **Backfill script** [`scripts/backfill-planes-evidencia.ts`](scripts/backfill-planes-evidencia.ts): inyecta `plan_json.evidencia_cientifica` con protocolos TAG_BRIDGE. Dry-run: `--dry-run`. Crea placeholders para clientes sin plan ✅
- **Dashboard KB** [`components/dashboard/KBPanel.tsx`](components/dashboard/KBPanel.tsx): stats fichas, puentes TAG, distribución por disciplina (mini-bars), últimas fichas, cobertura TAG_BRIDGE. Integrado en [`app/dashboard/page.tsx:322`](app/dashboard/page.tsx:322) ✅
- **Auto-entrenamiento script** [`scripts/analizar-uso-papers.ts`](scripts/analizar-uso-papers.ts): ranking papers más/menos usados, cobertura %, tags sin puente en TAG_BRIDGE, sugerencias automáticas. Flags: `--json`, `--top N`, `--bottom N` ✅
- **Compilación**: `npx tsc --noEmit` → 0 errores ✅
- **Commit + Push**: `ab54e2b` (feat: 5 mejoras, 10 files, +1032 líneas) + `f4f4c0e` (docs: AUDITORIA_TAG_BRIDGE actualizada) ✅

##### 🧪 Pendientes próxima sesión
1. **Ejecutar backfill**: `npx tsx scripts/backfill-planes-evidencia.ts --dry-run` → luego sin flag
2. **Ejecutar auto-entrenamiento**: `npx tsx scripts/analizar-uso-papers.ts` → ajustar TAG_BRIDGE según resultados
3. **Primera ingesta clínica**: las 6 fuentes nuevas necesitan ejecución (Cron lunes o `npx tsx scripts/ingestar-papers.ts`)
4. **Bug #2**: papers con resumen <50 chars — investigar si es DeepSeek o PubMed
5. **Bug #3**: tests de estrés con tags con espacios en el bridge
6. **Bug #4**: política de mezcla `coach_id IS NULL` + `coach_id` específico en consultas KB
7. **Re-scrapear supermercados** para re-vincular ~84 productos
8. **Build de verificación**: `npx next build`

---

### Pendiente para próxima sesión (histórico)

- [x] ~~Verificar Bonpreu/Esclat~~ ✅ **BREAKTHROUGH HTTP DIRECTO (v3)**: APIs funcionan con fetch() directo. Scrapers reescritos a modo híbrido (1 PW + HTTP directo)
- [x] ~~**Lidl v3**: Ejecutar scraper completo (60 términos en 4 lotes)~~ ✅ **EJECUTADO**: 429 productos únicos en 4.0 min, 0 scraping errors
- [x] ~~**Lidl v3**: Re-scrapear con pipeline BD~~ ✅ **EJECUTADO**: 16 alimentos nuevos, 147 actualizados, 263 historico
- [x] ~~**Lidl**: Filtro NO_COMESTIBLE_KEYWORDS ampliado~~ ✅ **COMPLETADO**: ~260 keywords (de ~155), 27 falsos positivos eliminados
- [ ] **Re-scrapear supermercados** para re-vincular ~84 productos que aún apuntan a duplicados (usará `match_alimento` v2 mejorado)
- [ ] **Hipercor/El Corte Inglés**: Akamai sigue bloqueando. Diagnóstico ejecutado (15-05-2026): "Access Denied" en homepage. Sin API interna descubierta.
- [ ] Dashboard de rentabilidad/ahorro con la vista `top_precios_escandallo`
- [ ] Automatización con Vercel Cron Jobs (plan Pro)
- [ ] Refinar normalizador para subir el ~24% de match exacto (más sinónimos)
- [ ] Histórico de precios y tendencias (gráficos, alertas)
- [ ] **Mercadona**: Re-scrapear (~2,895 productos, posible desactualización)
- [ ] **Lidl**: Re-ejecutar trimestralmente (75 productos, mantener precios actualizados)
- [ ] Build de verificación: `npx next build`

---

#### 🏆 Sesión 20-05-2026 — Implementación "Top Coach" (Gaps de inteligencia nutricional)

##### ✅ Completado
- **Auditoría profunda**: [`docs/auditoria-2026-05-20-investigacion-top-coach.md`](docs/auditoria-2026-05-20-investigacion-top-coach.md) — 9 gaps identificados vs coach top-ed
- **Bug fix**: `tipo: 'dieta'` → `'plan_inicial'` en [`app/api/generar-plan-inicial/route.ts:324`](app/api/generar-plan-inicial/route.ts:324) ✅
- **+3 protocolos** en [`lib/knowledge-base.ts`](lib/knowledge-base.ts): HTA, dislipemia, hígado graso (15→18) + detección tags para 5 condiciones ✅
- **Gap #1** — Recetas reales: endpoint ahora llama a [`construirPrompt()`](lib/deepseek.ts:66) con recetas reales y contexto completo ✅
- **Gap #3** — Distribución proteína estratégica: [`lib/distribucion-proteinas.ts`](lib/distribucion-proteinas.ts) — MPS threshold, post-entreno, sarcopenia ✅
- **Gap #2** — Mesociclos: [`lib/periodizacion/mesociclo.ts`](lib/periodizacion/mesociclo.ts) — 5 modos de planificación (déficit, bulk, rendimiento, recomp, mantenimiento) ✅
- **Gap #6** — Feedback loop auto-coach → periodización integrado en [`lib/auto-coach.ts`](lib/auto-coach.ts) ✅
- **Documentación**: [`docs/REFERENCIAS_CIENTIFICAS_Y_CAMBIOS.md`](docs/REFERENCIAS_CIENTIFICAS_Y_CAMBIOS.md) — cambios + 30+ referencias científicas + 15 libros recomendados ✅
- **Compilación TypeScript**: `npx tsc --noEmit` → 0 errores ✅

##### ✅ Completado en 2ª ronda (20-05-2026 — Gaps #4, #7, #8, #9)
- **Gap #9** — Motor de entreno integrado en plan inicial: [`lib/motor-entreno.ts`](lib/motor-entreno.ts) evaluado y recomendación almacenada en `planJson.recomendacion_entreno` ✅
- **Gap #4** — Nutrición peri-entreno: [`lib/nutricion-peri-entreno.ts`](lib/nutricion-peri-entreno.ts) — recomendaciones pre/intra/post entreno sincronizadas con modalidad y segmento. Inyectado en prompt de DeepSeek ✅
- **Gap #7** — Validación de micronutrientes: [`lib/validacion-micronutrientes.ts`](lib/validacion-micronutrientes.ts) — verifica sodio/azúcares/fibra contra umbrales por condición (HTA, diabetes, dislipemia, renal). Tests unitarios funcionando. Integrado en respuesta del endpoint ✅
- **Gap #8** — Micro-learning automático: [`lib/micro-learning.ts`](lib/micro-learning.ts) — 18 píldoras educativas seleccionadas por perfil, flags psicológicos y condiciones de salud. Incluidas en inicio del plan ✅

##### 🧪 Pendientes futuros (para próxima sesión)
- **Test end-to-end** con los 5 clientes de prueba via API (Vercel) — verificar que `POST /api/generar-plan-inicial` devuelve `modo: "ia_con_recetas"` con todos los nuevos campos
- **Verificar** que `validacion_micronutrientes`, `pildoras_educativas_inicio`, `recomendacion_entreno` y `nutricion_peri_entreno` aparecen en la respuesta
- **Re-scrapear supermercados** para re-vincular ~84 productos
- **Build de verificación**: `npx next build`
- **Revisar** los 18 protocolos de conocimiento científico y añadir más si es necesario
- **Mejorar** la calidad de las píldoras educativas según feedback de clientes reales

---

**Última actualización:** 21-05-2026 (Sesión TAG_BRIDGE — 5 mejoras implementadas)
**Responsable:** Roo (Sesión 21-05-2026 — Expansión TAG_BRIDGE + PubMed clínico + Backfill + Dashboard KB + Auto-entrenamiento)
