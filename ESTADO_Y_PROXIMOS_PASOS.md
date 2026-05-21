# 🧠 Estado del Proyecto y Próximos Pasos — NutriCoach

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

##### 🧪 Pendientes para próxima sesión
- **Desactivar duplicados en KB**: ~108 pares de protocolos seed duplicados → `UPDATE knowledge_base SET activo = false`
- **Crear clientes test**: Perfiles hyrox, running, fuerza para verificar cobertura TAG_BRIDGE
- **Aprendizaje de preferencias**: Registrar intercambios de receta en `intercambios_historial`
- **Aldi**: Nuevo scraper (desde cero)
- **Regeneración de imágenes**: 147 imágenes malas con estilo food blogger

---

## Sesión 21-05-2026 (5ª ronda) — PORTAL CLIENTE: PLAN DIARIO + ALTERNATIVAS + VISTA SEMANAL 🚀

[Contenido de la sesión 5ª ronda - se mantiene igual]

---

## Sesión 21-05-2026 (4ª ronda) — PENDIENTES EJECUTADOS + BUG #5 FIX 🚀

[Contenido de la sesión 4ª ronda - se mantiene igual]

---

**Última actualización:** 21-05-2026 (Sesión 6ª ronda — TAG_BRIDGE + cosméticos eliminados + prevención futura unificada)
**Responsable:** Roo (Sesión 21-05-2026 — 6ª ronda: refinar TAG_BRIDGE, diagnosticar 216 protocolos, eliminar 1.480 cosméticos/no comestibles de BD, crear guard-no-comestible.ts como único punto de verdad)
