<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

<!-- BEGIN:micronutrientes-completos -->
# ✅ 23-05-2026 — 13.385 alimentos con micronutrientes completos (100%)

La tabla `alimentos` tiene los **24 campos de micronutrientes** poblados para todos los registros.

## Script clave
- [`scripts/enriquecer-masivo-tanda3.ts`](scripts/enriquecer-masivo-tanda3.ts) — Batching 5 alimentos/llamada DeepSeek. 357 llamadas totales (~2 runs: 200 + 157 batches), 0 errores.
- Ver fallback cascade: batch → 2 reintentos → individual. Temperatura progresiva (0.2 → 0.5).

## Columnas disponibles (24 campos)
`vitamina_a_ug, vitamina_c_mg, vitamina_d_ug, vitamina_e_mg, vitamina_k_ug, vitamina_b6_mg, vitamina_b12_ug, tiamina_mg, riboflavina_mg, niacina_mg, folato_ug, calcio_mg, hierro_mg, magnesio_mg, fosforo_mg, potasio_mg, sodio_mg, zinc_mg, cobre_mg, selenio_ug, saturados_g, monoinsaturados_g, poliinsaturados_g, colesterol_mg`

## Qué NO hacer
- NO volver a poblar micronutrientes en masa — ya está al 100%.
- NO usar columnas que no existen (`acido_folico_ug`, `acido_pantotenico_mg`, `biotina_ug`, `manganeso_mg`, `fibra_g`, `agua_g`, `azucar_g`, `azucares_anadidos_g`).
- Si se añaden alimentos nuevos, poblar micros individualmente o en batch pequeño.
- Para alimentos nuevos ver [`lib/deepseek.ts`](lib/deepseek.ts:607) → `completarAlimentoConIA()`.
<!-- END:micronutrientes-completos -->

<!-- BEGIN:fix-categorias-masivo -->
# ✅ 23-05-2026 — Corrección masiva de categorías (~350+ alimentos re-categorizados)

Se ejecutó [`supabase/migrations/fix_categorias_masivo_v2.sql`](supabase/migrations/fix_categorias_masivo_v2.sql) contra producción.

## Problema raíz
[`lib/scraping/categorizador.ts`](lib/scraping/categorizador.ts:308) usa `CATEGORIAS_POR_KEYWORD` con regex `\bkeyword\b`. Cualquier alimento cuyo nombre contuviera "anchoa", "papa", "sal", "aceituna", etc. se colaba en la categoría incorrecta (ej: "Aceitunas rellenas de anchoa" → Pescados por "anchoa").

## Bloques ejecutados
| Bloque | Acción |
|--------|--------|
| **B0** | Aceitunas de Pescados → Condimentos |
| **B1** | ~7 categorías no alimenticias marcadas `es_comestible = false` (Aseo íntimo, Bazar, Body-lociones, Botiquín, Hogar, Puericultura, Textil) |
| **B2** | Re-categorización de ~350+ alimentos desde categorías inválidas de scraping a categorías nutricionales correctas |
| **B3** | Categorías inválidas sin mapear → `es_comestible = false` |
| **B4** | Supermercado: re-categorizar por keyword + marcar sin kcal → `es_comestible = false`. **0 registros restantes.** |

## Frontend
- [`app/dietas/alimentos/page.tsx`](app/dietas/alimentos/page.tsx:160) — constante `CATEGORIAS_ALFABETICO` para desplegables en orden alfabético
- Dos `<select>`s cambiados a `CATEGORIAS_ALFABETICO` (filtro y modal)

## Categorías remanentes (legacy BEDCA, válidas)
Cereales (1639), Verduras (997), Frutos secos (424), Grasas (205), Tubérculos (153), etc. — contienen alimentos reales con datos nutricionales. NO tocarlas.

## Si se añaden nuevos alimentos
- Para poblar micronutrientes: [`lib/deepseek.ts`](lib/deepseek.ts:607) → `completarAlimentoConIA()`
- El categorizador automático puede colocar en categorías incorrectas si el nombre coincide con keywords de otra categoría. Revisar manualmente si hay dudas.
<!-- END:fix-categorias-masivo -->
