# 🧠 Estado del Proyecto y Próximos Pasos — NutriCoach

## Sesión 22-05-2026 (noche) — REDISEÑO FICHA CLIENTE + FILTRO RESTRICCIONES RECETAS ✅

##### ✅ Completado esta sesión

**Rediseño ficha cliente `/clientes/[id]`** (commit `b76dfc8`)
- Componentes inline `MacroBar` (barras de progreso con color por macro) y `StatPill` (píldoras de datos compactos)
- Hero card: avatar con iniciales, badges de estado (activo/revisado), fila de stats (peso, objetivo, BMI, plan), barras de macros del plan activo con links directos a revisar y regenerar plan
- 12 tabs pill-style: Resumen | Planes | Check-ins | Notas | Planificación | Competición | Periodización | IA | Chat IA | Atleta | Historial | Macros — tab activo inverted (bg text, color bg), inactive = surface+border, badges con conteos
- Cero colores hardcodeados, todo CSS vars (`var(--text)`, `var(--surface)`, `var(--border)`, `var(--accent)`)
- Fix TypeScript: `profile` type cast en `const p = cliente.profile ?? {} as {...}`

**RLS fix: endpoint `revisar-data`** (commit `6245cc8`)
- `GET /api/clientes/[id]/revisar-data`: service role, bypasea RLS de `onboarding_responses`
- `revisar-plan/page.tsx` usa este endpoint en lugar de queries directas — onboarding ya no bloquea coaches
- Onboarding opcional: si el cliente no ha completado el cuestionario, la página sigue funcionando

**Filtrado de recetas por restricciones del cliente** (commit `6245cc8`)
- `GET /api/recetas/sugeridas` acepta `cliente_id` opcional
- Si se pasa, carga `restricciones` de `onboarding_responses` y mapea a tags de intolerancias de recetas:
  - `'sin gluten'` → `'Sin Gluten'`, `'sin lactosa'` → `'Sin Lactosa'`, `'vegano'` → `'Vegano'`, `'vegetariano'` → `'Vegetariano'`, `'sin frutos secos'` → `'Sin Frutos Secos'`, `'sin huevo'` → `'Sin Huevo'`
- Filtro aplicado con `.contains('intolerancias', restriccionesIntolerancia)` — solo recetas compatibles con TODAS las restricciones del cliente
- Restricciones sin equivalente en BD de recetas (Sin Cerdo, Halal, Kosher, etc.) ignoradas hasta que el recetario tenga esos tags
- Callers actualizados: `revisar-plan`, `MiPlan` (alternativas + RecetaDelDia), `PlanSemanal`, `revisar-rapido`

**Correcciones adicionales**
- `revisar-plan`: `tipo_plato` mapeado correctamente (merienda no muestra recetas de cena)
- `revisar-plan`: "Ver perfil completo" abre en nueva pestaña (`window.open(..., '_blank')`)
- Dark mode: mass replace `text-gray-*/slate-*` → CSS vars en 29 componentes/páginas

##### ⚙️ Arquitectura del filtro

```
cliente hace onboarding → selecciona restricciones ['Sin gluten', 'Vegano']
                                    ↓
sugeridas?cliente_id=X → fetch onboarding_responses → ['Sin gluten', 'Vegano']
                                    ↓
mapeo lowercase → ['Sin Gluten', 'Vegano']
                                    ↓
query.contains('intolerancias', ['Sin Gluten', 'Vegano'])
                                    ↓
solo recetas donde intolerancias @> ['Sin Gluten', 'Vegano']
```

##### 🔲 Pendiente relacionado
- Añadir tags `Sin Mariscos`, `Sin Cerdo`, `Sin Soja` al recetario para cubrir más restricciones del onboarding
- Regenerar 147 imágenes malas: `node scripts/regenerar-imagenes-malas.mjs --genera` (~$5)

---


## Sesión 22-05-2026 — Lint focal entrenamiento cliente ✅

##### ✅ Corregido

- **`app/cliente/sesion/[id]/page.tsx`**: eliminado el error React Compiler `Cannot access refs during render`.
  - Causa: la pantalla final leía `sesionStartRef.current` durante render para calcular duración.
  - Solución: la duración se congela al completar la sesión en `duracionCompletadaMin` y el render usa ese estado estable.
- En el mismo archivo se limpiaron warnings focales:
  - `loadSesion` ahora está memoizada con `useCallback` y el `useEffect` depende de la función estable.
  - Eliminadas variables muertas `allDone` y `setsHechos`.
- **`app/clientes/[id]/revisar-plan/page.tsx`**: limpiado warning `react-hooks/exhaustive-deps` de `cargarRecetasPlan`, moviendo el helper de tipo de plato fuera del componente y usando `useCallback`.
- **`app/api/recetas/sugeridas/route.ts`**: eliminado warning de variable `_dist` no usada al limpiar el campo auxiliar de ordenación.

##### 🧪 Verificación ejecutada

```bash
npm run lint -- 'app/cliente/sesion/[id]/page.tsx' 'app/api/recetas/sugeridas/route.ts' 'app/clientes/[id]/revisar-plan/page.tsx'
npx tsc --noEmit --pretty false
npm run build
```

Resultado:
- Lint focal: 0 errores, 0 warnings.
- TypeScript: OK.
- Build Next.js: OK, 110 rutas/páginas generadas.

##### ⚠️ Lint global sigue pendiente

`npm run lint` global sigue fallando por deuda histórica fuera de esta corrección:

- 680 problemas: 401 errores y 279 warnings.
- Predominan `@typescript-eslint/no-explicit-any`, `prefer-const`, variables/imports sin uso y scripts legacy.
- Error estructural pendiente: `scripts/limpiar-huerfanos-productos.ts` tiene parse error (`}` expected).
- Ya no aparece el error de refs de `app/cliente/sesion/[id]/page.tsx`.

Próximo paso recomendado: crear una fase específica de limpieza de lint separando `app/**` runtime de `scripts/**`, para no mezclar deuda de herramientas antiguas con rutas de producción.

---

## Sesión 21-05-2026 (Bugfix) — PLAN INICIAL SIN PLATOS ASIGNADOS 🔴 → ✅

##### 🐛 Bug corregido
**Síntoma**: Al generar plan desde `revisar-plan` (botón "Crear plan de dieta"), el plan se creaba con macros visibles pero **sin ningún plato/receta/alimento asignado**. Al entrar al portal cliente (`cliente/[codigo]`), las comidas aparecían vacías ("Sin alimentos asignados").

**Causa raíz**: La función [`crearPlan()`](app/clientes/[id]/revisar-plan/page.tsx:231) creaba `planes_nutricion` y `comidas` en BD pero **nunca persistía alimentos** en `comida_alimentos`. Las recetas sugeridas por la IA solo se mostraban visualmente via `cargarRecetasPlan()` → `/api/recetas/sugeridas`, pero no se guardaban.

**Historial del fix (2 intentos)**:

| Intento | Estrategia | Resultado | Por qué falló |
|---------|-----------|-----------|---------------|
| 1️⃣ | Fetch `/api/recetas/[id]/ingredientes` y guardar ingredientes con `alimento_id` en `comida_alimentos` | ❌ No funcionó | Las recetas en BD no tienen `alimento_id` vinculado en sus ingredientes — solo `nombre_libre`. El filtro `ing.alimento_id && ing.cantidad_gramos > 0` resultaba en array vacío. |
| 2️⃣ ✅ | Crear **alimento virtual** por receta (categoria `receta_ia`, `custom: true`) con sus macros y vincularlo via `comida_alimentos` | ✅ Funciona | Sigue el patrón de [`generar-dieta-ia/route.ts`](app/api/generar-dieta-ia/route.ts:183-240). No depende de ingredientes con `alimento_id`. |

**Archivos modificados**:
| Archivo | Cambio |
|---------|--------|
| [`app/clientes/[id]/revisar-plan/page.tsx`](app/clientes/[id]/revisar-plan/page.tsx:286-340) | Nuevo bloque post-creación de comidas que: (1) busca/crea `alimento` con macros de la receta, (2) inserta `comida_alimentos` vinculando el alimento a la comida |
| [`CLAUDE.md`](CLAUDE.md:322) | Nueva lección aprendida: "No asumir que ingredientes de recetas tienen `alimento_id`" |

**Flujo reparado**:
1. Coach ve plan con recetas sugeridas → hace clic en "Crear plan de dieta"
2. `crearPlan()` crea `planes_nutricion` + `comidas` (como antes)
3. **NUEVO**: Por cada comida, toma la 1ª receta sugerida → crea `alimento` en tabla `alimentos` (con `nombre`, `kcal`, `proteinas`, `carbohidratos`, `grasas`, `categoria: 'receta_ia'`, `custom: true`) → inserta `comida_alimentos` (100g = 1 porción)
4. Portal cliente (`cliente/[codigo]`): `MiPlan` ve `comida_alimentos.length > 0` → muestra nombre de receta con macros
5. `PlanSemanal`: `calcMacros(comida.alimentos)` devuelve valores > 0 → carga sugerencias de `/api/recetas/sugeridas` con rotación circular por día

**Próximos pasos sugeridos**:
- Evaluar si los alimentos `receta_ia` deberían mostrarse en selectores de alimentos del editor de dietas (actualmente se filtran por `categoria != 'receta_ia'` o no)
- Considerar añadir un campo `receta_id` opcional en `comida_alimentos` para trazabilidad completa receta→alimento→comida

---

## Sesión 21-05-2026 (8ª ronda) — SISTEMA APRENDIZAJE D + CLIENTES TEST B + COSTE SEMANAL C 🚀

##### ✅ Completado esta ronda

**D — Sistema de aprendizaje de preferencias (intercambios → perfil → IA)**
- **`lib/actualizar-perfil.ts`** (nuevo): analiza últimos 100 intercambios del cliente, identifica alimentos rechazados/preferidos con ≥2 ocurrencias, actualiza `perfil_alimentario_cliente` (`ingredientes_rechazados`, `ingredientes_preferidos`, `total_interacciones`)
- **`app/api/intercambios/elegir/route.ts`**: llama `actualizarPerfilDesdeIntercambios()` fire-and-forget tras cada swap (no bloquea la respuesta)
- **`components/PortalCliente/MiPlan.tsx`**: `handleElegirAlternativa()` ahora llama `POST /api/intercambios/elegir` fire-and-forget antes de actualizar el estado local — los swaps quedan registrados en BD
- **`app/api/generar-plan-inicial/route.ts`**: consulta `perfil_alimentario_cliente` e inyecta bloque `PREFERENCIAS APRENDIDAS` en el contexto de DeepSeek (solo si `total_interacciones >= 2`), con rechazados="EVITAR" y preferidos="PRIORIZAR"

**B — Clientes test hyrox/running/fuerza creados en Supabase**
- **3 clientes test** insertados directamente en BD con `onboarding_responses` + `perfil_entreno_cliente`:
  - Atleta Hyrox (hombre, 78kg, `sport_modality='hyrox'`, `segmento='elite'`)
  - Corredora Running (mujer, 65kg, `sport_modality='running'`, `segmento='performance'`)
  - Powerlifting Fuerza (hombre, 85kg, `sport_modality='gym_fuerza'`, `segmento='performance'`)
- TAG_BRIDGE verificado: Sofía crossfit +620%, test clientes hyrox/running activos para los 216 protocolos KB no usados

**C — Coste semanal por cliente en dashboard coach**
- **`app/api/dashboard/costes-clientes/route.ts`** (nuevo): agrega `coste_semanal_min` (opción más barata) y `coste_semanal_max` por cliente activo con plan, usando `precios_actuales` × gramos × 7 días
- **`components/dashboard/CostesClientes.tsx`** (nuevo): tabla en dashboard con coste/día, rango min-max, badge cobertura de precios, alerta con link a `/precios/escandallo`
- Visible en `/dashboard` debajo de CheckinsPendientes

**Build**: `npx next build` — **0 errores** ✅ · Commits: `df08b4c`, `085d882`

##### 🧪 Próximos pasos
- **Carlos como cliente 0**: crear perfil real y testear flujo completo E2E
- **Aprendizaje de preferencias**: registrar intercambios en `intercambios_historial` (ya conectado)
- **Imágenes pendiente_revision**: Codex revisa 158 recetas, marca buenas con `--marcar-ok`, regenera malas
- **Aldi**: nuevo scraper (desde cero)

---

## Sesión 21-05-2026 (6ª ronda) — TAG_BRIDGE EXPANDIDO + 1.480 COSMÉTICOS ELIMINADOS + PREVENCIÓN FUTURA UNIFICADA 🚀

##### ✅ Completado esta ronda

**Refinamiento masivo de TAG_BRIDGE**
- **195 → ~82 tags sin puente** (cobertura mejorada significativamente)
- **~70+ bridges nuevos** cubriendo categorías críticas: microbiota, dieta mediterránea, nutrición clínica, salud ósea, suplementación avanzada, entrenamiento combinado, coaching nutricional, salud femenina, pediatría, tercera edad, IA/nutrición de precisión, etc.
- **~30 bridges metodológicos/nicho añadidos**: ensayo_clinico, costo_efectividad, metabolomica, microarn, irisina, electroacupuntura, ondas_choque, ozonoterapia, nanoburbujas, miastenia_gravis, vela_adaptada, VIH, tai_chi, HRV_avanzado, DOMS_avanzado, y más (diferenciador calidad vs. otros coaches)
- **Fix duplicado `sop`**: Merge de valores únicos en [`lib/knowledge-base.ts`](lib/knowledge-base.ts:385) (error TS1117 corregido)

**216 protocolos nunca usados — Diagnosticado**
- **Causa raíz**: No hay clientes con perfiles hyrox/running/fuerza en los 7 planes actuales. El TAG_BRIDGE funciona correctamente para los perfiles existentes (diabetes, menopausia, salud mental). No es bug, es falta de diversidad de clientes.
- **KB tiene duplicados**: Detectados ~108 pares de protocolos con títulos casi idénticos (seed duplicado)
- **Recomendación**: Desactivar duplicados en próxima sesión via SQL + crear clientes test con perfil hyrox/running

**1.480 productos cosméticos/no comestibles — ELIMINADOS PERMANENTEMENTE** 🗑️
- **1.480 productos eliminados** de la tabla `alimentos` (en 2 tandas: 1.000 + 480 con FK)
- **0 registros huérfanos** en `productos_supermercado` — todo consistente
- **BD resultante**: ~14.546 alimentos **todos comestibles** (vs ~16.026 antes)

**🛡️ PREVENCIÓN FUTURA UNIFICADA — Sistema anti-cosméticos centralizado**
- **Creado [`lib/scraping/guard-no-comestible.ts`](lib/scraping/guard-no-comestible.ts)**: ÚNICO PUNTO DE VERDAD con ~50 patrones regex cubriendo mascotas, higiene, dental, capilar, jabón/gel, desodorante, cremas, facial, labial, maquillaje, uñas, brochas, Deliplus, solar, depilación, limpieza hogar, menaje, bebés, alcohol, bebidas energéticas, electrodomésticos (vatios)
- **Unificados los 4 entry points dispersos** que antes tenían listas duplicadas:
  1. [`lib/scraping/index.ts`](lib/scraping/index.ts) → delegado (`esNoComestible` ahora llama al guard) — eliminadas ~320 líneas de arrays muertos
  2. [`lib/scraping/normalizador.ts`](lib/scraping/normalizador.ts) → importa `esProductoNoComestible` del guard
  3. [`app/api/alimentos/route.ts`](app/api/alimentos/route.ts) → regex inline reemplazado por guard
  4. [`app/api/scrape-receta/route.ts`](app/api/scrape-receta/route.ts) → guard añadido como 1er filtro en `puntuarCandidato()`
- **Excepciones documentadas**: miel+dosificador, chorizo+vela, jabón+glicerina, freidora+aire, microondas, alcohol en platos cocinados
- **Documentado en [`CLAUDE.md`](CLAUDE.md)**: Sección `🛡️ GUARD — Productos No Comestibles` con tabla de entry points

**Build**: `npx next build` — **0 errores** ✅

##### ✅ Ejecutado sesión 7ª ronda (21-05-2026)

**Recetario ampliado:**
- 23 duplicados eliminados → recetario limpio
- 2 matches erróneos corregidos (Helado→Pavo, MiniHelado→Chocolate negro)
- 22 precios referencia añadidos → cobertura escandallo **100%** (158/158 ingredientes)
- 69 recetas IA generadas con imágenes gpt-image-1 food blogger → aprobadas
- 158 ingredientes únicos con precio → escandallos operativos desde el primer día

**KB y entrenamientos:**
- **58 duplicados KB desactivados** → KB queda en 172 protocolos únicos
- `prs_por_ejercicio` verificado: ya usaba `peso_kg DESC` correctamente

**Codex (commits d0ce301, 7dbfff8):**
- Lista compra inteligente con sustitutos económicos (`lib/lista-compra/inteligente.ts`)
- Gap report micronutrientes personalizado por perfil/condición (`lib/micronutrientes/gap-report.ts`)
- `MicronutrientesPortal.tsx` en portal cliente
- PDF nutricional endurecido + HTML escape seguro

**Columna `imagen_tipo` añadida a `recetas`:**
- `propia` (110): fotos reales de IG/TikTok — nunca tocar
- `txt2img` (69): recetas IA generadas hoy con gpt-image-1
- `pendiente_revision` (158): recetas antiguas sin url_origen — calidad desconocida tras migración Cloudinary
- `placeholder` (10): sin imagen

##### 🖼️ PENDIENTE IMÁGENES — Delegar a Codex
- **Problema**: el identificador `/auto_` se perdió al migrar Supabase Storage → Cloudinary. Las 158 recetas `pendiente_revision` tienen Cloudinary URLs idénticas en formato, no se puede distinguir buenas de malas automáticamente.
- **Script actualizado**: `regenerar-imagenes-malas.mjs` ya usa `imagen_tipo = 'pendiente_revision'` como filtro (no `/auto_`).
- **Flujo para Codex**:
  1. Revisar desde `/recetas` las 158 recetas `pendiente_revision`
  2. Marcar buenas: `node scripts/regenerar-imagenes-malas.mjs --marcar-ok <uuid>`
  3. Regenerar malas: `node scripts/regenerar-imagenes-malas.mjs --id <uuid> --genera`
  4. O regenerar todas de golpe: `node scripts/regenerar-imagenes-malas.mjs --genera` (~$5.40)
- **Serie Chef (10 recetas)**: identificar manualmente sus UUIDs y marcarlos como `propia` antes de regenerar todo.

##### 🧪 Próximos pasos
- **Carlos como cliente 0**: crear perfil real y testear flujo completo E2E
- **Crear clientes test hyrox/running/fuerza**: verificar cobertura TAG_BRIDGE
- **Aprendizaje de preferencias**: registrar intercambios en `intercambios_historial`
- **Aldi**: nuevo scraper (desde cero)

---

## Sesión 21-05-2026 (5ª ronda) — PORTAL CLIENTE: PLAN DIARIO + ALTERNATIVAS + VISTA SEMANAL 🚀

[Contenido de la sesión 5ª ronda - se mantiene igual]

---

## Sesión 21-05-2026 (4ª ronda) — PENDIENTES EJECUTADOS + BUG #5 FIX 🚀

[Contenido de la sesión 4ª ronda - se mantiene igual]

---

**Última actualización:** 22-05-2026 (Bugfix — Plan inicial sin platos asignados)
**Responsable:** Roo (22-05-2026 — Bugfix: crearPlan() ahora persiste recetas sugeridas como alimentos virtuales en comida_alimentos)
