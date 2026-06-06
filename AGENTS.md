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

<!-- BEGIN:ui-navigation-fluidity-20260606 -->
# ✅ 06-06-2026 — Fluidez navegación coach + bug audit auth

## Commits recientes
- `915b374` — `fix: mejorar fluidez de navegacion coach`

## Cambios clave
- `components/CoachShell.tsx` cachea acceso coach durante la sesión para evitar spinner global al saltar entre módulos.
- `components/Sidebar.tsx` precarga rutas principales y submódulos con `router.prefetch()`.
- `lib/useNotificaciones.ts` cachea usuario/notificaciones durante 10s para reducir queries al remontar sidebar.
- Bug audit posterior: el shell debe conceder acceso coach solo con `profiles.role === 'coach'`; no asumir coach si falla `profiles`.

## Documentación
- `salidas/06-06-2026_navigation-fluidity-report.md`
- `salidas/06-06-2026_bug-audit-navigation-auth.md`

## Próxima sesión recomendada
Revisar lentitud interna de páginas con datos propios (`/dietas`, `/clientes`, `/entrenos`) para que la navegación sea inmediata y cada módulo cargue contenido sin sensación de recarga completa.
<!-- END:ui-navigation-fluidity-20260606 -->

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

<!-- BEGIN:agente-retencion -->
# ✅ 29-05-2026 — Agente Retención (`lib/agentes/agente-retencion.ts`)

Nuevo agente diario que detecta clientes en riesgo de baja o no renovar membresía.

## Señales que detecta
| Señal | Condición |
|-------|-----------|
| `caduca_pronto` | `fecha_fin_membresia` entre hoy y hoy+30d |
| `baja_adherencia` | `dias_sin_checkin > 10` |
| `nuevo_sin_enganche` | Alta ≤7 días + ningún check-in desde que se dio de alta |

## Comportamiento
- Si 0 señales → no genera tarea
- Deduplicación: si ya existe `tipo='alerta_retencion'` + `estado='pendiente'` para ese cliente → no genera otro
- Llama DeepSeek V3 con contexto del cliente → propone UNA acción al coach
- Tarea aparece en kanban `/agentes` con `requiere_aprobacion: true`

## Tipos en `lib/agentes/types.ts`
- `TipoAgente` incluye `'retencion'`
- `TipoTarea` incluye `'alerta_retencion'`

## Qué NO hacer
- NO añadir señales sin actualizar el system prompt del agente
- Los campos `fecha_fin_membresia` y `created_at` NO están en `ContextoCliente` — el agente hace una query separada
<!-- END:agente-retencion -->

<!-- BEGIN:clientes-redesign -->
# ✅ 29-05-2026 — Rediseño /clientes (tabla densa + membresías)

## Archivos nuevos
- `lib/clientes-utils.ts` — tipos y funciones puras (score, predictor, deuda, filtros, sort)
- `components/clientes/ClientesToolbar.tsx` — búsqueda + chips + sort
- `components/clientes/ClientesTabla.tsx` — tabla desktop (`hidden lg:block`)
- `components/clientes/ClientesListaMobile.tsx` — lista iPhone (`lg:hidden`)

## BD — columnas nuevas en `clientes`
```sql
tipo_membresia TEXT CHECK (IN 'trimestral','semestral','anual')
fecha_inicio_membresia DATE
fecha_fin_membresia DATE
```
Ya aplicadas en producción. El coach las edita desde `app/clientes/[id]` → tab Perfil.

## Score de adherencia
Calculado en frontend al enriquecer cada `ClienteRow`:
```
score = checkIn×0.4 + comidas×0.3 + entreno×0.2 + peso×0.1
```

## Predictor de baja (`esPredictorBaja`)
Se activa si ≥2 de estas señales:
1. `score_adherencia < 40`
2. `diasHastaCaducidad ≤ 30`
3. `chats_sin_leer > 0 && interacciones_coach_7d === 0`
4. `dias_sin_checkin > 10`

## Filtro "Caduca pronto"
Solo incluye membresías con 0-30 días restantes (NO las ya expiradas con d < 0).
<!-- END:clientes-redesign -->
