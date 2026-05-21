---

#### 🏆 Sesión 21-05-2026 (2ª ronda) — TAG_BRIDGE EXPANDIDO 🚀

##### ✅ Completado (2ª ronda)
- **TAG_BRIDGE expandido masivamente** [`lib/knowledge-base.ts`](lib/knowledge-base.ts:331): de ~80 entradas a ~95 entradas. Nuevas keys añadidas: `hidratacion`, `carbohidratos`, `proteina`, `periodizacion`, `nutricion_deportiva`, `suplementacion`, `salud_osea`. Cada entrada multiplica sus bridge values con los tags reales de los 224 papers KB ✅
- **Mejora de cobertura funcional** (test-tag-bridge.ts): 
  - Carlos (perder grasa + diabetes): 12→**50** papers (+317%)
  - Laura (vegana + perder grasa): 2→**35** papers (+1650%)
  - Sofía (recomposición + crossfit): 5→**50** papers (+900%)
  - Javier (diabetes T2 + hipertenso): 13→**40** papers (+208%)
  - Marta (>65 + sarcopenia): 33→**44** papers (+33%)
  - Ana, Pedro ya tenían saturación parcial (50 límite) ✅
- **Tags clínicos expandidos**: tiroides (8→16 bridge values), SOP (6→10), menopausia (6→15) con términos de las nuevas fuentes clínicas PubMed (funcion_tiroidea, sindrome_ovario_poliquistico, densidad_osea, fracturas_osteoporoticas, etc.) ✅
- **Nuevos bridges conceptuales**: `periodizacion` → tags entrenamiento (ACWR, deload, autorregulacion, mesociclo), `proteina` → tags síntesis (MPS, mTOR, leucina, aminoacidos_ramificados), `nutricion_deportiva` → tags suplementación (timing, ergogenico) ✅
- **Bug #4 — Fix también en scripts test**: eliminado `.is('coach_id', null)` de [`scripts/test-tag-bridge.ts`](scripts/test-tag-bridge.ts:75) (2 ocurrencias) ✅
- **Build**: `npx next build` → 0 errores ✅

##### 🧪 Pendientes para próxima sesión
1. Ejecutar **ingesta resto fuentes** (nutrición deportiva, composición corporal, proteína, periodización)
2. **Re-scrapear supermercados** para re-vincular ~84 productos
3. **Dashboard de rentabilidad/ahorro** con vista `top_precios_escandallo`
4. **Automatización Vercel Cron Jobs** (recordatorio-checkin, ingesta semanal)
5. **Histórico de precios y tendencias** de supermercados

---

#### 🏆 Sesión 21-05-2026 — EJECUCIÓN: Backfill real + Ingesta clínica + Auto-entrenamiento + Bugs (#2,#3,#4) + Build

##### ✅ Completado
- **Añadida columna `plan_json`** a `planes_nutricion` vía `supabase db execute` ✅
- **Backfill REAL ejecutado** [`scripts/backfill-planes-evidencia.ts`](scripts/backfill-planes-evidencia.ts): 10 clientes procesados, 57 referencias totales en `evidencia_cientifica`. Fix: safe null en `plan_json` para registros existentes. Incluye `id` + `tags` del KB ✅
- **Auto-entrenamiento ejecutado** [`scripts/analizar-uso-papers.ts`](scripts/analizar-uso-papers.ts): 7 planes analizados, 12/224 protocolos usados (6% cobertura). Fix: lookup por título normalizado como fallback ✅
- **Primera ingesta 6 fuentes clínicas PubMed**: 90 papers encontrados, 27 insertados tras extracción DeepSeek (tiroides, PCOS/SOP, menopausia, salud ósea, salud mental, rehabilitación) ✅
- **Re-backfill post-ingesta**: Marta Hipotiroidismo 1→2, Nuria SOP 2→4, Ana Menopausia 1→2 protocolos ✅
- **Bug #2**: Investigado — **cerrado**. 0 papers con resumen <50 chars en BD. Fallback `contenido_completo` ya existe en código ✅
- **Bug #3**: Investigado — **cerrado**. Tags con espacios (20/50 papers) son manejados correctamente por sintaxis `.ov.{}` de PostgreSQL ✅
- **Bug #4**: **FIX** — Eliminado `.is('coach_id', null)` en [`consultarKnowledgeDB()`](lib/knowledge-base.ts:609) para incluir tanto papers globales como coach-específicos ✅
- **Build**: `npx next build` → 107 páginas, 0 errores TypeScript, 0 errores de compilación ✅
- **Commit**: `26a8680` (9 files, +248 líneas) ✅

##### 🧪 Pendientes (completados en 2ª ronda)
- ~~Ajustar TAG_BRIDGE según resultados auto-entrenamiento~~ ✅ **EXPANDIDO** — ver arriba
- ~~Mejorar matching entre papers clínicos nuevos y TAG_BRIDGE~~ ✅

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

**Última actualización:** 21-05-2026 (Sesión EJECUCIÓN — TAG_BRIDGE expandido: 80→95 entradas, cobertura funcional +300-1650%)
**Responsable:** Roo (Sesión 21-05-2026 — TAG_BRIDGE expansion, backfill, ingesta clínica, bugs, build)
