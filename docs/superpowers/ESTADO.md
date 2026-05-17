# ESTADO — NutriCoach Training Pro

**Última actualización:** 17-05-2026 (sesión 25)

---

## Plan 1 — Foundation ✅ COMPLETADO

| Task | Estado | Commit |
|------|--------|--------|
| SQL Migration (`supabase_training_pro_v2.sql`) | ✅ Aplicado en Supabase | `ce6e91c`, `fa9f0e7` |
| TypeScript types (`SportModality`, `TrainingTier`, `PerfilEntrenoCliente`, `AjusteSesionCliente`) | ✅ | `24a560c` |
| Seed 8 plantillas élite por modalidad | ✅ | `a5b5b0f` |
| UI filtros modalidad/tier en `PlantillaEntrenoSelector` | ✅ | `0607c3b` |

### Plantillas en BD (29 total)
| Modalidad | Nombre | Tier | Nivel |
|-----------|--------|------|-------|
| calistenia | Calistenia — Muscle-Up Estricto (Elite) | elite | avanzado |
| ciclismo | Ciclismo Potencia — Intermedio (FTP base) | elite | intermedio |
| funcional | Funcional — Pérdida de Peso Intermedio | general | intermedio |
| gym_estetica | Gym Estética — Upper/Lower Intermedio | general | intermedio |
| gym_fuerza | Gym Fuerza — Press Banca + Fuerza General | general | intermedio |
| hibrido | Híbrido Elite — Hyrox + Muscle-Up (Carlos) | elite | avanzado |
| hyrox | Hyrox Open — Preparación Intermedio | elite | intermedio |
| running | Running — Fondo Intermedio (VDOT 40-50) | elite | intermedio |
| null (legacy) | 21 plantillas antiguas sin sport_modality | general | varios |

---

## 🐛 Bugs conocidos — pendientes de Fix

### BUG-T01 — `app/entrenos/plantillas/page.tsx` filtros obsoletos [CRÍTICO]
- **Problema:** La página de gestión de plantillas filtra por `p.tipo` (gimnasio/cardio/mixto), no por `sport_modality`. Las nuevas 8 plantillas aparecen mezcladas bajo 'gimnasio', 'cardio' o 'mixto' sin diferenciación. `MODALIDADES` array solo tiene 3 entradas — no expone Ciclismo, Running, Calistenia, Híbrido, Gym Estética, Gym Fuerza, Funcional como filtros.
- **Archivos:** `app/entrenos/plantillas/page.tsx:25-29, 66, 93, 106-110`
- **Fix:** Reemplazar `MODALIDADES` + filtro `tipo` por `MODALITY_CONFIG` + filtro `sport_modality`. Agrupar por `sport_modality` igual que en `PlantillaEntrenoSelector`.

### BUG-T02 — Búsqueda en `/entrenos/plantillas` no incluye `sport_modality`/`tier` [MENOR]
- **Problema:** Buscar "elite" o "running" no encuentra plantillas por sus campos nuevos. La búsqueda solo cubre nombre, descripción, objetivo, nivel, subcategoría detectada por nombre.
- **Archivos:** `app/entrenos/plantillas/page.tsx:94-101`
- **Fix:** Añadir `p.sport_modality?.includes(q)` y `p.tier?.includes(q)` a los checks de búsqueda.

### BUG-T03 — `detectarSubcategoria()` duplicada [MENOR]
- **Problema:** La función existe en `PlantillaEntrenoSelector.tsx:33-41` y en `plantillas/page.tsx:46-60`. Con `sport_modality` en BD ya no es la fuente de verdad.
- **Fix Plan 2:** Extraer a `lib/entrenos/utils.ts` como fallback legacy y eliminar duplicados.

### BUG-T04 — Ordering `tier` incorrecto en `PlantillaEntrenoSelector` [MENOR]
- **Problema:** `.order('tier', { ascending: true })` pone 'elite' ANTES que 'general' (orden alfabético: e < g). Visualmente confuso — lo natural es general primero, elite después.
- **Archivos:** `components/training/PlantillaEntrenoSelector.tsx:63`
- **Fix:** `.order('tier', { ascending: false })` o usar `.order('sport_modality')` sin ordenar por tier.

---

## Plan 2 — Perfil Atleta + Fix UI [PRÓXIMA SESIÓN]

**Prioridad:** Alta. Depende de Plan 1 (completado).

### Tareas estimadas

1. **Fix BUG-T01 + BUG-T02 + BUG-T04** — refactor `plantillas/page.tsx` para usar `sport_modality`
2. **`PerfilEntrenoCliente` form** — componente de edición del perfil de entreno (FTP, VDOT, 1RM, días disponibles, equipo disponible, capacidad recuperación)
3. **API `/api/perfil-entreno/[clienteId]`** — GET/PUT para leer y actualizar `perfil_entreno_cliente`
4. **Tab "Perfil Atleta"** en ficha de cliente (`/clientes/[id]`) — integrar el form del perfil junto al perfil nutricional
5. **`lib/entrenos/motor-entreno.ts`** — árbol de 9 decisiones según spec sección 3 (HRV, energía check-in, TLS, molestias, fase, adherencia, plateau, días competición)
6. **Fix BUG-T03** — extraer `detectarSubcategoria` a utils y eliminar duplicados

### Plan 3 (futuro) — Vista semanal cliente + Ajustes IA

- Vista semanal mejorada en portal cliente (semana visual por día con sesiones detalladas)
- Badge de ajuste IA cuando algo cambió
- `RegistrarEntrenoModal` ampliado con feedback post-sesión (RPE real, molestia nueva, nota libre)
- Dashboard coach: panel de ajustes propuestos pendientes de aprobar

---

## Estado de la BD (17-05-2026)

| Tabla | Filas | Notas |
|-------|-------|-------|
| `plantillas_entrenamiento` | 29 | 8 con sport_modality, 21 legacy |
| `plantilla_sesiones` | ~120 | — |
| `plantilla_sesion_ejercicios` | ~500 | Nuevas cols: unidad, carga_tipo, carga_valor, notas_tecnicas, sustituciones |
| `perfil_entreno_cliente` | 0 | Tabla creada, sin datos aún |
| `ajustes_sesion_cliente` | 0 | Tabla creada, sin datos aún |
| `ejercicios` | ~270 | ~50 nuevos creados por seed Plan 1 |
