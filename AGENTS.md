<!-- BEGIN:portal-navigation-invariants -->
# 🚨 INVARIANTES DEL PORTAL CLIENTE — LEER ANTES DE TOCAR CUALQUIER PÁGINA BAJO /app/cliente/ O /components/PortalCliente/

Estos bugs ocurrieron en producción repetidamente. Cada regla tiene un bug real detrás.

## Regla 1 — window.location.replace(), NUNCA href en portales

```
❌ window.location.href = '/dashboard'   → añade al historial → bucle iOS swipe-back
✅ window.location.replace('/dashboard') → reemplaza → sin bucle
```

Aplica a TODO redirect de auth/rol dentro de `/app/cliente/` y `/app/onboarding/`.

## Regla 2 — Back buttons de páginas secundarias → siempre con replace

```
❌ <Link href="/cliente">           → acumula historial con cada uso
✅ <Link href="/cliente" replace>   → reemplaza → swipe-back limpio
```

Aplica a TODAS las páginas bajo `/app/cliente/` que no sean el portal principal (`page.tsx`):
- `/app/cliente/sesion/[id]/page.tsx` — TODOS los links/botones de vuelta
- `/app/cliente/semana/page.tsx` — botón ← de cabecera

## Regla 3 — Links de SemanaEntrenoCard a sesión → push (SIN replace)

```
❌ <Link href="/cliente/sesion/..." replace>  → reemplaza /cliente → swipe-back salta el portal
✅ <Link href="/cliente/sesion/...">          → push → swipe-back vuelve al portal
```

`SemanaEntrenoCard` vive DENTRO de `/cliente` — necesita push para que /cliente quede en historial.
`/cliente/semana/page.tsx` SÍ usa replace porque es una página intermedia que debe saltarse.

## Regla 4 — Componentes PortalCliente: NUNCA query directa a Supabase con joins

```
❌ supabase.from('sesiones_entrenamiento').select('*, ejercicios:sesion_ejercicios(...)')
   → RLS silencia joins cruzados → array vacío → UI muestra nada sin error
   
✅ fetch('/api/entrenos/sesiones-plan?plan_id=X')
   → API route con createServiceSupabase() → bypasea RLS → datos reales
```

Aplica a CUALQUIER query en `/components/PortalCliente/` o `/components/training/SemanaEntrenoCard.tsx`
que cruce ≥2 tablas con RLS activo (sesiones_entrenamiento, sesion_ejercicios, planes_entrenamiento,
planes_nutricion, registros_sets, clientes).

**Tablas que leen OK sin service role (RLS permisiva):** profiles, recetas, alimentos, ejercicios (catálogo público).

## Regla 5 — `/cliente/[codigo]` es compatibilidad pública, NO portal interno

```
❌ Cliente logueado renderiza /cliente/[codigo] → monta DashboardCliente antiguo → "app rara" al volver de Training
✅ Cliente logueado entra en /cliente/[codigo] → Server Component detecta role cliente → redirect('/cliente')
```

El portal activo para usuarios autenticados es `/cliente`.
`/cliente/[codigo]` solo existe para enlaces públicos por código, PDFs e integraciones externas.

Si vuelve a aparecer el bug de "al volver de entreno aparece otra app cliente", NO tocar solo:
- `router.back()`
- `Link replace`
- botones `Volver`
- links de `SemanaEntrenoCard`

La causa raíz es impedir que un cliente autenticado pueda renderizar `DashboardCliente`.
Fix raíz aplicado 07-06-2026 en `app/cliente/[codigo]/page.tsx`: Server Component + `createServerSupabase()` + `redirect('/cliente')` para `profiles.role === 'cliente'`.

## Regla 6 — Sesiones abiertas desde portal público deben llevar `codigo`

```
❌ /cliente/[codigo] → DashboardCliente → /cliente/sesion/[id]
   La API intenta resolver cliente por usuario autenticado. Si Carlos está logueado como coach:
   404 "Sesión no encontrada" → botón /cliente → redirect a /dashboard.

✅ /cliente/[codigo] → DashboardCliente → /cliente/sesion/[id]?codigo=CODIGO
   La API verifica que la sesión pertenece al cliente del `codigo_publico` y permite revisar/registrar.
```

Fix aplicado 07-06-2026:
- `DashboardCliente` añade `?codigo=${codigo}` al link de sesión.
- `app/api/cliente/sesion/[id]` acepta `codigo` y verifica propiedad por `planes_nutricion.codigo_publico`.
- `app/cliente/sesion/[id]` vuelve a `/cliente/[codigo]` si llegó con código, no a `/cliente`.
- `POST /api/entrenos/registrar-sesion` acepta `codigo` para el flujo público, igual que otros endpoints del portal por código.

## Regla 7 — PWA/SW: nunca cachear APIs del portal cliente

```
❌ sw.js cachea /api/cliente/sesion/[id] o cualquier /api/cliente/*
   La PWA instalada puede conservar 401/403/404 ("Sesión no encontrada") o datos de otro usuario.

✅ /api/* network-only salvo endpoints públicos explícitamente cacheables y solo con res.ok.
```

Fix aplicado 07-06-2026:
- `public/sw.js` subido a `nutricoach-v7` para limpiar caches antiguas.
- `/api/*` pasa a network-only.
- `API_CACHE_ROUTES` solo cachea respuestas `res.ok`.
- `scripts/audit-portal-patterns.mjs` falla si vuelve a haber fallback de cache para APIs.

## Regla 8 — La PWA cliente NUNCA arranca en `/cliente/[codigo]`

```
❌ manifest-cliente-carlos.json → "start_url": "/cliente/2tp7rtMS"
   Al limpiar datos o abrir desde iPhone, iOS reabre el portal público antiguo.

✅ manifest-cliente-carlos.json → "start_url": "/cliente"
   La PWA arranca siempre en el portal cliente autenticado.
```

Fix aplicado 07-06-2026:
- `public/manifest-cliente-carlos.json` usa `start_url: "/cliente"`.
- `public/limpiar-sw.html` redirige a `/login?next=%2Fcliente&limpiado=1`.
- `app/cliente/[codigo]/ClientePublicoPwaGuard.tsx` impide que una PWA instalada con start_url antiguo renderice `DashboardCliente`: si no hay sesión manda a login cliente; si hay cliente manda a `/cliente`; si hay coach manda a `/dashboard`.
- `app/login/page.tsx` y `app/auth/callback/page.tsx` resuelven el rol: cliente → `/cliente`, coach → `/dashboard` cuando no hay `next`.

No volver a poner un código público en el manifest para "arreglar" accesos rápidos. Eso reintroduce la app básica antigua en iOS.

## Verificación antes de mergear

```bash
node scripts/audit-portal-patterns.mjs
```

Este script detecta automáticamente estas reglas. Si falla → no mergear.
<!-- END:portal-navigation-invariants -->

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
- `salidas/06-06-2026_internal-page-fluidity-pass.md`

## Próxima sesión recomendada
Revisar invalidación fina tras crear/editar cliente, dieta o plan de entreno para refrescar caches concretos sin volver a cargar todo el modulo.
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
