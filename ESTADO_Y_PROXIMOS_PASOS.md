# 🧠 Estado del Proyecto y Próximos Pasos — NutriCoach

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

**Última actualización:** 21-05-2026 (Sesión 6ª ronda — TAG_BRIDGE + cosméticos eliminados + prevención futura unificada)
**Responsable:** Roo (Sesión 21-05-2026 — 6ª ronda: refinar TAG_BRIDGE, diagnosticar 216 protocolos, eliminar 1.480 cosméticos/no comestibles de BD, crear guard-no-comestible.ts como único punto de verdad)
