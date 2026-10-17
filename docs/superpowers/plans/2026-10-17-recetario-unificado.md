# Recetario unificado Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Un solo espacio «Revisión» para analizar y mejorar el recetario, Control fuera del menú, y un flujo «Reportar problema» desde cada receta aprobada que la saca del circuito hasta arreglarla.

**Architecture:** «Reportar» reutiliza el flujo «Corregir» existente (etiqueta `Corregir`, nota en `notas_coach`, evento `correccion_solicitada`) y añade: pasar la receta aprobada a `en_revision`, un campo de origen (etiqueta `Reporte cliente`) y alta por lotes. La pestaña «Para corregir» de la bandeja pasa a llamarse «Reportadas». La navegación se reorganiza moviendo rutas dentro del grupo `(revision)` (las URLs no cambian) y cambiando constantes del menú. La IA sigue sin escribir sola: las reportadas esperan a «pasa las correcciones».

**Tech Stack:** Next.js (versión personalizada: leer `node_modules/next/dist/docs/` antes de tocar rutas), Supabase (`createApiSupabase`/`createServiceSupabase` de `lib/supabase-server.ts`), tests con `npx tsx scripts/<nombre>.test.ts` y `node:assert/strict`.

**Spec:** `docs/superpowers/specs/2026-10-17-recetario-unificado-design.md`

## Global Constraints

- Todo texto de interfaz en castellano; fechas `DD-MM-YYYY`.
- Nada de rutas nuevas sin `autorizarCoach`-equivalente: sesión + `profiles.role = 'coach'` + `recetas.coach_id = user.id` (patrón de `app/api/recetas/[id]/correccion/route.ts`). Errores 500 sin `err.message`.
- Toda acción de UI que escribe comprueba `res.ok` y muestra el error.
- Estado de pantalla que deba sobrevivir a abrir un detalle va en la URL con `useEstadoUrl` (`lib/useEstadoUrl.ts`), no en `useState`.
- Eliminar = `estado = 'descartada'` (reversible). Nunca `DELETE` de filas de `recetas`.
- Las URLs actuales (`/recetas/cobertura`, `/recetas/auditoria`, `/precios/escandallo`, `/precios/rentabilidad`) siguen funcionando.
- No tocar estilos del sistema visual (los lleva Codex): solo estructura, navegación y los componentes nuevos con las variables CSS existentes (`var(--surface)`, `var(--border)`, `var(--text)`…).
- Commits solo con `git add <rutas concretas>` (hay cambios ajenos sin subir en el repo). Mensaje termina con la línea `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>`. Tras cada tarea: `git push origin main` (el aviso «Changes must be made through a pull request» es bypass de admin; comprobar con `git status -sb`).
- Verificación de cada tarea: `npx tsc --noEmit --pretty false` limpio.

## Review Focus

1. Reportar una receta que ya está `en_revision`/`borrador`: no duplica etiquetas ni líneas de nota y no cambia su estado.
2. Reportar una `descartada`: se omite (no resucita a `en_revision`).
3. Lote con IDs de otro coach o inexistentes: se omiten con motivo; el resto se procesa; nunca se filtran datos ajenos.
4. Reporte sin aspectos y sin nota, o con origen no válido: 400.
5. Aprobar otra vez una receta reportada elimina `Corregir` **y** `Reporte cliente`.
6. Receta reportada que ya está en un plan activo: el plan no se modifica; el diálogo muestra cuántos planes la usan.
7. Candidatas con `quality_issues = null` o `score_calidad = null`: no rompen la lista.
8. Edición rápida: nombre vacío rechazado; campos fuera de la lista blanca (kcal, ingredientes, estado) ignorados.

## File Structure

- Create `lib/recetas/reportes.ts` — lógica pura de reporte (validar, aplicar, quitar marcas).
- Create `lib/recetas/uso-en-planes.ts` — cuántos planes de nutrición activos usan cada receta.
- Create `lib/recetas/candidatas.ts` — selección pura de candidatas a reportar.
- Create `lib/recetas/campos-editables.ts` — lista blanca y validación de la edición rápida.
- Create `app/api/recetas/reportar/route.ts` — alta por lotes.
- Create `app/api/recetas/uso-en-planes/route.ts`, `app/api/recetas/candidatas/route.ts`, `app/api/recetas/[id]/campos/route.ts`.
- Create `components/recetas/ReportarProblema.tsx` — diálogo (aspectos, nota, origen, uso en planes).
- Create `components/recetas/EdicionRapida.tsx` — edición en el sitio en el detalle.
- Create `components/recetas/CandidatasReporte.tsx` — lista de candidatas con selección por lotes.
- Modify `components/recetas/CabeceraRevision.tsx`, `app/recetas/(revision)/revisar/page.tsx`, `app/recetas/page.tsx`, `app/recetas/[id]/page.tsx`, `app/api/recetas/[id]/estado/route.ts`, `app/api/recetas/[id]/correccion/route.ts`, `components/Sidebar.tsx`, `components/CoachShell.tsx`.
- Move `app/recetas/auditoria/` → `app/recetas/(revision)/auditoria/` y `app/recetas/cobertura/` → `app/recetas/(revision)/cobertura/` (el grupo no cambia la URL).
- Tests: `scripts/recetas-reportes.test.ts`, `scripts/recetas-candidatas.test.ts`, `scripts/recetas-campos-editables.test.ts`, `scripts/recetas-solo-aprobadas.test.ts`, `scripts/menu-recetario.test.ts`.

---

### Task 1: Lógica de reporte, alta por lotes y uso en planes

**Files:**
- Create: `lib/recetas/reportes.ts`, `lib/recetas/uso-en-planes.ts`, `app/api/recetas/reportar/route.ts`, `app/api/recetas/uso-en-planes/route.ts`
- Modify: `app/api/recetas/[id]/estado/route.ts` (bloque «aprobada = ya no está para corregir»), `app/api/recetas/[id]/correccion/route.ts` (DELETE)
- Test: `scripts/recetas-reportes.test.ts`

**Interfaces:**
- Consumes: `TAG_CORREGIR`, `ASPECTOS_IDS` de `lib/recetas/correcciones.ts`.
- Produces:
  - `TAG_REPORTE_CLIENTE = 'Reporte cliente'`, `ORIGENES_REPORTE = [{ id: 'propio', label: 'Lo he visto yo' }, { id: 'cliente', label: 'Lo ha reportado un cliente' }] as const`, `type OrigenReporte = 'propio' | 'cliente'`.
  - `validarReporte(e: { aspectos: unknown; nota: unknown; origen: unknown }): { ok: true; reporte: { aspectos: string[]; nota: string; origen: OrigenReporte } } | { ok: false; error: string }` — aspectos filtrados contra `ASPECTOS_IDS`; nota recortada a 600; error si no hay aspectos ni nota o el origen no es válido.
  - `aplicarReporte(receta: { estado: string | null; tags: string[] | null; notas_coach: string | null }, r: ReporteValido, hoy: Date): { estado: string; tags: string[]; notas_coach: string; yaMarcada: boolean } | null` — `null` si la receta está `descartada`.
  - `quitarMarcasReporte(tags: string[] | null): string[]` — quita `Corregir` y `Reporte cliente`.
  - `contarPlanesActivos(db: SupabaseClient, recetaIds: string[]): Promise<Record<string, number>>` — nº de `planes_nutricion` con `activo = true` cuyas `comidas.receta_id` incluyen cada receta (cada plan cuenta una vez). Comprobar las columnas reales de `comidas` y `planes_nutricion` antes de escribirla.
  - `POST /api/recetas/reportar` body `{ ids: string[] (1-100), aspectos, nota, origen }` → `{ reportadas: string[]; omitidas: { id: string; motivo: 'no_encontrada' | 'descartada' }[] }`.
  - `POST /api/recetas/uso-en-planes` body `{ ids: string[] }` → `Record<string, number>`.

- [ ] **Step 1: Write the failing test** `scripts/recetas-reportes.test.ts` con estas aserciones (usar `node:assert/strict`):
  - `validarReporte({ aspectos: ['foto', 'inventado'], nota: '', origen: 'propio' })` → `ok` con `aspectos` igual a `['foto']`.
  - `validarReporte({ aspectos: [], nota: '  ', origen: 'propio' })` → `ok: false`; `validarReporte({ aspectos: ['foto'], nota: '', origen: 'otro' })` → `ok: false`.
  - `aplicarReporte` sobre `{ estado: 'aprobada', tags: ['Pollo'], notas_coach: null }` con origen `cliente` y `hoy = new Date('2026-10-17')` → `estado: 'en_revision'`, `tags` contiene `Corregir` y `Reporte cliente` y conserva `Pollo`, `notas_coach` contiene `17/10/2026` y `A corregir: foto`, `yaMarcada: false`.
  - Sobre `{ estado: 'en_revision', tags: ['Corregir'], … }` reportando otra vez: `estado` sigue `en_revision`, `tags` no duplica `Corregir`, `yaMarcada: true`.
  - Sobre `{ estado: 'descartada', … }` → `null`.
  - `quitarMarcasReporte(['Pollo', 'Corregir', 'Reporte cliente'])` → `['Pollo']`; con `null` → `[]`.
  - `contarPlanesActivos` con un cliente Supabase falso (patrón de `scripts/contenido-compra-tanda.test.ts`): dos comidas del mismo plan con la receta A cuentan 1; receta sin uso → 0.

- [ ] **Step 2: Run** `npx tsx scripts/recetas-reportes.test.ts` — Expected: FAIL (módulos no existen).

- [ ] **Step 3: Implement** `lib/recetas/reportes.ts` y `lib/recetas/uso-en-planes.ts` con las firmas anteriores. `aplicarReporte` reutiliza el formato de línea de `app/api/recetas/[id]/correccion/route.ts` (`[fecha] A corregir: <aspectos|otro> — <nota>`, fecha en `es-ES`).

- [ ] **Step 4: Run** el test — Expected: PASS sin salida.

- [ ] **Step 5: Implement `POST /api/recetas/reportar`.** Autorización como `correccion/route.ts` (coach + `coach_id`); con `createServiceSupabase` leer `id, estado, tags, notas_coach, imagen_estado` de las recetas pedidas del coach; por cada una `aplicarReporte` y `update` (si el aspecto incluye `foto`: `imagen_estado = 'revisar'`, `imagen_needs_review = true`, igual que hoy); insertar en `recetas_auditoria` un evento `correccion_solicitada` con `issues: { aspectos, nota, origen }` y `origen: 'coach_revision'` (mismo valor que hoy, para no chocar con restricciones de la tabla); si `origen === 'cliente'` añadir `TAG_REPORTE_CLIENTE`. IDs no encontrados → `omitidas: no_encontrada`; descartadas → `omitidas: descartada`. Si una receta ya estaba `aprobada`, ejecutar además `verificacion`: nada más (el planificador ya ignora lo que no es `aprobada`).

- [ ] **Step 6: Implement `POST /api/recetas/uso-en-planes`** (coach; solo cuenta recetas del coach) devolviendo `contarPlanesActivos`.

- [ ] **Step 7: Modify** `app/api/recetas/[id]/estado/route.ts` y el `DELETE` de `correccion/route.ts` para usar `quitarMarcasReporte(tags)` en lugar de filtrar solo `Corregir`.

- [ ] **Step 8: Verify** — `npx tsc --noEmit --pretty false` limpio; `npx tsx scripts/recetas-reportes.test.ts` PASS. Probar con una receta aprobada de prueba contra la BD real y revertirla (`PATCH estado aprobada` con la receta completa); anotar el resultado.

- [ ] **Step 9: Commit & push**
```bash
git add lib/recetas/reportes.ts lib/recetas/uso-en-planes.ts app/api/recetas/reportar app/api/recetas/uso-en-planes "app/api/recetas/[id]/estado/route.ts" "app/api/recetas/[id]/correccion/route.ts" scripts/recetas-reportes.test.ts
git commit -m "feat(recetas): reportar recetas aprobadas por lotes y sacarlas del circuito"
git push origin main
```

---

### Task 2: Garantizar que lo no aprobado no llega a clientes ni al planificador

**Files:**
- Create: `scripts/recetas-solo-aprobadas.test.ts`
- Modify (solo si el test lo exige): los archivos listados abajo.

**Interfaces:**
- Consumes: nada de otras tareas.
- Produces: test estático que falla si un camino de lectura de recetas orientado al cliente o al planificador no filtra por `aprobada`.

- [ ] **Step 1: Write the failing test.** El test lee el texto de cada archivo y exige que contenga el literal `aprobada` en una consulta sobre `recetas`. Archivos que deben cumplirlo: `app/api/cliente/[codigo]/recetario/route.ts`, `app/api/cliente/[codigo]/recetas/[recetaId]/route.ts`, `app/api/cliente/[codigo]/comidas/[comidaId]/alternativas/route.ts`, `app/api/cliente/[codigo]/mis-platos/route.ts`, `app/api/comidas/[comidaId]/alternativas/route.ts`, `app/api/recetas/alternativas/route.ts`, `app/api/recetas/sugeridas/route.ts`, `app/api/clientes/[id]/semana-dieta/route.ts`, `app/api/contenido/recetas/route.ts`, `lib/plan-recetas.ts`, `lib/nutricion/complementos.ts`, `lib/nutricion/completar-comidas.ts`, `lib/nutricion/plantilla-semana.ts`, `lib/nutricion/semanas-futuras.ts`, `app/api/generar-dieta-ia/route.ts`, `app/cliente/receta/[id]/page.tsx` (este último por la API que consume, comprobar su ruta de datos). **Lista de excepciones documentadas en el propio test** (leen planes ya montados, que por decisión no se tocan solos): `app/api/compra/route.ts`, `lib/nutricion/detalle-dia.ts`, `lib/agentes/perfil-gusto.ts`.

- [ ] **Step 2: Run** `npx tsx scripts/recetas-solo-aprobadas.test.ts` — Expected: FAIL listando los archivos sin filtro (hoy: `mis-platos`, `generar-dieta-ia` y los que el rastreo de la pantalla de receta del cliente revele).

- [ ] **Step 3: Fix** cada archivo señalado añadiendo `.eq('estado', 'aprobada')` (o `.in('estado', ['aprobada'])`) a su consulta sobre `recetas`. Para `mis-platos`, comprobar antes si lista recetas generadas por IA para el cliente con otro estado legítimo; si es así, moverlo a la lista de excepciones con la razón escrita en el test. Para el detalle `/cliente/receta/[id]`, si la receta pedida no es `aprobada` y no pertenece a un plan del cliente, la API debe devolver 404.

- [ ] **Step 4: Run** el test — Expected: PASS. `npx tsc --noEmit --pretty false` limpio.

- [ ] **Step 5: Commit & push**
```bash
git add scripts/recetas-solo-aprobadas.test.ts <archivos modificados>
git commit -m "fix(recetas): solo recetas aprobadas llegan al cliente y al planificador"
git push origin main
```

---

### Task 3: «Reportar problema» y edición rápida en el recetario

**Files:**
- Create: `components/recetas/ReportarProblema.tsx`, `components/recetas/EdicionRapida.tsx`, `lib/recetas/campos-editables.ts`, `app/api/recetas/[id]/campos/route.ts`
- Modify: `app/recetas/page.tsx` (selección múltiple + botón), `app/recetas/[id]/page.tsx` (botón y edición rápida)
- Test: `scripts/recetas-campos-editables.test.ts`

**Interfaces:**
- Consumes: Task 1 (`POST /api/recetas/reportar`, `POST /api/recetas/uso-en-planes`, `ASPECTOS_CORRECCION`, `ORIGENES_REPORTE`).
- Produces:
  - `limpiarCamposEditables(body: unknown): { ok: true; cambios: Partial<{ nombre: string; descripcion: string; tiempo_prep_min: number; categoria: string; tags: string[] }> } | { ok: false; error: string }` — lista blanca; `nombre` 1-120 caracteres sin vacío; `tiempo_prep_min` entero 0-1440; `tags` máx. 20 de máx. 40 caracteres; ignora cualquier otra clave; error si no queda ningún cambio.
  - `PATCH /api/recetas/[id]/campos` (coach propietario) → `{ ok: true }`; registra evento `editada_manual` en `recetas_auditoria` solo si la tabla lo admite (si hay restricción de eventos, omitir el evento).
  - `<ReportarProblema ids={string[]} nombres?={string[]} abierto={boolean} onCerrar={() => void} onHecho={(r: { reportadas: string[]; omitidas: unknown[] }) => void} />`: chips de aspectos, nota, selector de origen (`propio` por defecto), línea «Esta receta está en N planes activos» (suma sin duplicar por receta; texto «N recetas están en planes activos» en lote) y botón «Sacar del recetario y reportar». Comprueba `res.ok`.
  - `<EdicionRapida receta={...} onGuardado={() => void} />` con nombre, descripción, tiempo, categoría y etiquetas; texto fijo «Para cambiar ingredientes o gramos usa el editor completo» con enlace a `/recetas/[id]/editar`.

- [ ] **Step 1: Write the failing test** `scripts/recetas-campos-editables.test.ts`: nombre vacío → `ok: false`; `{ nombre: 'Tortitas', kcal: 9999, estado: 'aprobada' }` → `cambios` es exactamente `{ nombre: 'Tortitas' }`; `tiempo_prep_min: -5` → `ok: false`; cuerpo `{}` → `ok: false`; 25 etiquetas → `ok: false`.

- [ ] **Step 2: Run** `npx tsx scripts/recetas-campos-editables.test.ts` — Expected: FAIL.

- [ ] **Step 3: Implement** `lib/recetas/campos-editables.ts` y la ruta `PATCH /api/recetas/[id]/campos` (autorización como `correccion/route.ts`; `update` con `cambios`).

- [ ] **Step 4: Run** el test — Expected: PASS.

- [ ] **Step 5: Implement** `ReportarProblema` y `EdicionRapida` (componentes cliente, variables CSS existentes, sin inventar estilos nuevos).

- [ ] **Step 6: Integrar en `app/recetas/page.tsx`:** modo selección (botón «Seleccionar» junto a «Nueva receta»; casillas en las tarjetas; barra fija con «Reportar N» que abre `ReportarProblema`). Tras `onHecho`, quitar de la lista local las reportadas y avisar con el toast existente («N recetas enviadas a Revisión → Reportadas»). Selección y modo no necesitan vivir en la URL. En la cabecera: **quitar** los enlaces «Auditoría» y «Cobertura» y el `BotonCola` si solo apunta a revisión duplicada (dejar un único acceso «Revisión» con el contador de pendientes que ya tiene).

- [ ] **Step 7: Integrar en `app/recetas/[id]/page.tsx`:** botón «Reportar problema» (solo `!isClientView` y estado `aprobada`) que abre `ReportarProblema` con ese `id`; al terminar, `router.push` a `returnTo` o `/recetas`. Bloque `EdicionRapida` plegable «Editar rápido» bajo el título (solo `!isClientView`).

- [ ] **Step 8: Verify** — `npx tsc --noEmit --pretty false`; ESLint de los archivos tocados (`npx eslint <rutas>`) sin errores nuevos. Probar en local con la sesión de Carlos (`browse --headed` + handoff): reportar una receta de prueba desde la ficha, comprobar que desaparece del recetario y aparece en Revisión → Reportadas con su nota; aprobarla de nuevo y comprobar que vuelve. Revertir la receta de prueba.

- [ ] **Step 9: Commit & push**
```bash
git add components/recetas/ReportarProblema.tsx components/recetas/EdicionRapida.tsx lib/recetas/campos-editables.ts "app/api/recetas/[id]/campos" app/recetas/page.tsx "app/recetas/[id]/page.tsx" scripts/recetas-campos-editables.test.ts
git commit -m "feat(recetas): reportar problema y edición rápida desde el recetario"
git push origin main
```

---

### Task 4: Revisión como espacio único (Reportadas, Auditoría, Cobertura, candidatas)

**Files:**
- Create: `lib/recetas/candidatas.ts`, `app/api/recetas/candidatas/route.ts`, `components/recetas/CandidatasReporte.tsx`
- Move: `app/recetas/auditoria/` → `app/recetas/(revision)/auditoria/`; `app/recetas/cobertura/` → `app/recetas/(revision)/cobertura/`
- Modify: `components/recetas/CabeceraRevision.tsx`, `app/recetas/(revision)/revisar/page.tsx`, `app/recetas/(revision)/imagenes/page.tsx` (enlace a cobertura, línea ~416), `app/recetas/cobertura/page.tsx` y `app/recetas/auditoria/page.tsx` (tras moverlos: quitar su propia cabecera/«Volver» si duplica la de Revisión)
- Test: `scripts/recetas-candidatas.test.ts`

**Interfaces:**
- Consumes: Task 1 (`POST /api/recetas/reportar`), Task 3 (`ReportarProblema`), `etiquetaCalidad` de `lib/recetas/etiquetas-calidad.ts`, `QualityIssues` de `lib/recetas/revision.ts`.
- Produces:
  - `seleccionarCandidatas(recetas: { id: string; nombre: string; estado: string | null; score_calidad: number | null; quality_issues: { bloqueantes?: unknown[]; avisos?: unknown[] } | null }[], limite = 60): { id: string; nombre: string; motivos: string[] }[]` — solo `aprobada`; entra si `bloqueantes` no vacío o `score_calidad` < 70; ordena por nº de bloqueantes desc y luego score asc; `quality_issues`/`score_calidad` nulos no rompen. (El umbral 70 es decisión mía; ajustar viendo cuántas salen con datos reales: objetivo ≲ 60.)
  - `GET /api/recetas/candidatas` (coach) → la lista anterior calculada sobre las aprobadas del coach.
  - `CabeceraRevision` con dos grupos de pestañas: **Mejorar lo que hay** = Por aprobar (`/recetas/revisar`), Reportadas (`/recetas/revisar?tarea=corregir` — usar el nombre de parámetro que ya use `useEstadoUrl` en la bandeja), Imágenes (`/recetas/imagenes`), Auditoría (`/recetas/auditoria`); **Completar lo que falta** = Cobertura (`/recetas/cobertura`). Contadores: Por aprobar = pendientes, Reportadas = `corregir`, Imágenes = pendientes (como hoy).

- [ ] **Step 1: Write the failing test** `scripts/recetas-candidatas.test.ts`: una receta `aprobada` con un bloqueante entra; una `en_revision` no; `quality_issues: null` y `score_calidad: 90` no entra y no lanza; `score_calidad: 50` con `quality_issues: null` entra; con 100 candidatas y `limite` 60 devuelve 60 ordenadas (más bloqueantes primero); `motivos` usa los códigos de `bloqueantes` tal cual.

- [ ] **Step 2: Run** `npx tsx scripts/recetas-candidatas.test.ts` — Expected: FAIL.

- [ ] **Step 3: Implement** `lib/recetas/candidatas.ts` y `GET /api/recetas/candidatas`.

- [ ] **Step 4: Move** las dos carpetas con `git mv` y comprobar que `/recetas/cobertura` y `/recetas/auditoria` siguen resolviendo (grupo de rutas: la URL no cambia). Ajustar sus cabeceras para que no repitan «Volver» ni título (la cabecera de Revisión ya los da). Actualizar `components/CoachShell.tsx`: `pathname.startsWith('/recetas/cobertura')` pasa a `area: 'Recetario'`, título «Cobertura de recetas».

- [ ] **Step 5: Rewrite `CabeceraRevision`** con los dos grupos y los enlaces anteriores (marcar activa por `pathname` y, para Reportadas, por el parámetro de tarea). El «Volver» sigue yendo a `/recetas`. Reutilizar el efecto de contadores existente; añadir `corregir` desde `j.counts.corregir`.

- [ ] **Step 6: En `revisar/page.tsx`:** renombrar la etiqueta de la tarea `corregir` a «Reportadas»; mostrar en cada fila de Reportadas el origen (chip «Cliente» si el tag `Reporte cliente`) y las tres acciones: «Arreglar a mano» (enlace a `/recetas/[id]/editar?returnTo=…`), «Descartar» (existente) y «Quitar marca»; encima de la lista, aviso fijo «Las marcadas esperan a la IA: dime “pasa las correcciones”». Ordenar las de origen cliente primero (en memoria si el total cabe en una página; si no, en el servidor).

- [ ] **Step 7: Implement `CandidatasReporte`** (sección plegable al final de la tarea Reportadas): lista de candidatas con casillas, motivos con `etiquetaCalidad`, y botón «Reportar seleccionadas» que abre `ReportarProblema`. No envía nada sin acción explícita.

- [ ] **Step 8: Verify** — `npx tsc --noEmit --pretty false`; ESLint de lo tocado; abrir `/recetas/revisar`, `/recetas/imagenes`, `/recetas/auditoria`, `/recetas/cobertura` con la sesión de Carlos (`browse --headed` + handoff) a 390 px y escritorio: cabecera con los dos grupos, pestaña activa correcta, sin scroll horizontal, «atrás» del navegador vuelve a la pestaña anterior. Anotar cuántas candidatas salen con datos reales.

- [ ] **Step 9: Commit & push**
```bash
git add lib/recetas/candidatas.ts app/api/recetas/candidatas components/recetas/CandidatasReporte.tsx components/recetas/CabeceraRevision.tsx "app/recetas/(revision)" components/CoachShell.tsx scripts/recetas-candidatas.test.ts
git commit -m "feat(recetas): Revisión como espacio único con Reportadas, Auditoría y Cobertura"
git push origin main
```
(`git add "app/recetas/(revision)"` incluye los movimientos; confirmar con `git status` que las rutas antiguas figuran como renombradas.)

---

### Task 5: Menú: fuera Control, costes a Compra y costes

**Files:**
- Modify: `components/Sidebar.tsx` (constantes `COMPRA_ITEMS`, `CONTROL_ITEMS`, lista `sections`, líneas ~76-91 y ~464-470), `components/CoachShell.tsx` (áreas «Control» de `/precios/escandallo` y `/precios/rentabilidad`)
- Test: `scripts/menu-recetario.test.ts`

**Interfaces:**
- Consumes: nada.
- Produces: menú con `RECETARIO_ITEMS` = Recetas, Alimentos, Revisión (sin cambios; la etiqueta de «Revisión» no cambia y su contador sigue siendo `recetasPendientes`, que ya cuenta `en_revision`, o sea también las reportadas); `COMPRA_ITEMS` = Lista compra (`/compra`), Precios (`/precios`, `exact`), Coste de recetas (`/precios/escandallo`), Rentabilidad por cliente (`/precios/rentabilidad`); sin sección «Control».

- [ ] **Step 1: Write the failing test** `scripts/menu-recetario.test.ts`: lee `components/Sidebar.tsx` como texto y comprueba que **no** contiene `CONTROL_ITEMS` ni `key: 'control'`, que `COMPRA_ITEMS` incluye los href `/precios/escandallo` y `/precios/rentabilidad`, y que `RECETARIO_ITEMS` sigue incluyendo `/recetas/revisar`. Lee `components/CoachShell.tsx` y comprueba que no queda `area: 'Control'`.

- [ ] **Step 2: Run** `npx tsx scripts/menu-recetario.test.ts` — Expected: FAIL.

- [ ] **Step 3: Modify** `Sidebar.tsx` (mover los dos ítems a `COMPRA_ITEMS`, borrar `CONTROL_ITEMS` y la sección `control`, limpiar iconos importados que queden sin uso: `ChartPie`, `Activity` si ya no se usan) y `CoachShell.tsx` (`area: 'Compra y costes'` para escandallo y rentabilidad). Comprobar el rail compacto (`RailSection`) y el menú móvil con la sección eliminada.

- [ ] **Step 4: Run** el test — Expected: PASS. `npx tsc --noEmit --pretty false` limpio; ESLint de los dos archivos.

- [ ] **Step 5: Verify** en navegador (sesión de Carlos, escritorio y 390 px): el menú ya no tiene Control; Compra y costes muestra los cuatro ítems; los enlaces antiguos siguen cargando.

- [ ] **Step 6: Commit & push**
```bash
git add components/Sidebar.tsx components/CoachShell.tsx scripts/menu-recetario.test.ts
git commit -m "refactor(menu): quitar Control y llevar costes a Compra y costes"
git push origin main
```

---

### Task 6: Cierre, documentación y prueba de extremo a extremo

**Files:**
- Modify: `../CLAUDE.md` (fila de pendientes de NUTRICION), `CLAUDE.md` de nutricoach (sección de sesión con reglas nuevas)

**Interfaces:** consume todas las tareas anteriores.

- [ ] **Step 1: Prueba de extremo a extremo en producción con la sesión de Carlos** (`browse --headed` + handoff; seguir la memoria `feedback-browse-handoff-pierde-sesion`): reportar una receta aprobada desde el recetario → no aparece en `/recetas` ni en `/cliente?tab=recetas` de un cliente de prueba → aparece en Revisión → Reportadas con origen y nota → «Arreglar a mano» abre su editor → aprobarla de nuevo → vuelve al recetario y desaparecen `Corregir` y `Reporte cliente`. Reportar una por lotes desde la lista y desde Candidatas. Restaurar los datos de prueba.

- [ ] **Step 2: Run** `npx tsx scripts/recetas-reportes.test.ts scripts/recetas-candidatas.test.ts scripts/recetas-campos-editables.test.ts scripts/recetas-solo-aprobadas.test.ts scripts/menu-recetario.test.ts` (uno a uno) y `npx tsc --noEmit --pretty false` — todo en verde. `node scripts/audit-portal-patterns.mjs` sin hallazgos nuevos.

- [ ] **Step 3: Documentar** en `nutricoach/CLAUDE.md` y en la tabla de pendientes de `NUTRICION/CLAUDE.md`: qué hay, cómo se usa, la regla «una receta reportada sale del circuito y solo vuelve aprobándola», que las reportadas esperan a «pasa las correcciones», y el estado «sin ver en iPhone» si no se probó. Sin secretos.

- [ ] **Step 4: Commit & push**
```bash
git add CLAUDE.md ../CLAUDE.md
git commit -m "docs: cierre recetario unificado"
git push origin main
```

---

## Self-Review

- **Spec coverage:** Control fuera y costes a Compra (T5); Revisión única con «Mejorar / Completar» (T4); Recetas sin botones sueltos (T3 paso 6); reportar desde la receta con origen, por lotes y uso en planes (T1, T3); sacar del circuito y auditar caminos (T1, T2); Reportadas con salidas arreglar/descartar y espera de IA (T4 paso 6); candidatas sugeridas sin envío automático (T4); edición rápida con lista blanca (T3); contador del menú (T5, ya cubierto por `en_revision`); URLs antiguas vivas (T4 paso 4, T5). Planes ya montados no se tocan (T1 `contarPlanesActivos`, T2 excepciones).
- **Gap abierto asumido:** el orden «clientes primero» se hace en memoria; si Reportadas supera una página, el constructor lo sube al servidor (T4 paso 6).
- **Consistencia de nombres:** `TAG_REPORTE_CLIENTE`, `validarReporte`, `aplicarReporte`, `quitarMarcasReporte`, `contarPlanesActivos`, `seleccionarCandidatas`, `limpiarCamposEditables`, `ReportarProblema`, `EdicionRapida`, `CandidatasReporte` coinciden entre tareas.
