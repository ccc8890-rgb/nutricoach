# 🧠 Estado del Proyecto y Próximos Pasos — NutriCoach

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

**Última actualización:** 21-05-2026 (Sesión 4ª ronda — Pendientes ejecutados + Bug #5 fixed)
**Responsable:** Roo (Sesión 21-05-2026 — TAG_BRIDGE expansion + pendientes ejecución)
