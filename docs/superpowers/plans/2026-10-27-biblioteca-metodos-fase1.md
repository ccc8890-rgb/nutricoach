# Biblioteca de métodos — Fase 1 (base y revisión) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Que Carlos pueda crear, ver, filtrar, editar, aprobar y descartar fichas de métodos de entreno (sesión · principio · técnica) con miniatura, enlace de origen y marca «disponible para la IA», en una biblioteca nueva del coach.

**Architecture:** Tabla `metodos` (+ `metodos_eventos`) solo accesible con service role, como `recetas_revision_eventos`. Lógica pura y testeada en `lib/metodos/` (vocabularios, validación, huella anti-duplicados, reglas de estado, filtrado). Rutas `app/api/metodos/**` con `autorizarCoach` y siempre filtradas por `coach_id`. UI cliente en `app/entrenos/metodos/**` con `useEstadoUrl`.

**Tech Stack:** Next.js (App Router, versión personalizada: leer `node_modules/next/dist/docs/` si algo difiere), Supabase (service role), TypeScript, tests con `npx tsx scripts/<x>.test.ts` y `node:assert/strict`, Cloudinary para miniaturas.

**Spec:** `docs/superpowers/specs/2026-10-27-biblioteca-metodos-design.md`

**Alcance de este plan:** solo Fase 1 del spec. Quedan para planes posteriores (no hacer aquí): extractor de Content Radar (F2), «Usar como base» y `metodos_usos` (F3), integración con `generar-plan-ia.ts`, claves `[M#]` e interruptor general en Ajustes (F4), motor de lectura PDF/Excel (F5), enlazar `ejercicio_id` con `matchEjercicio` (F3), agente revisor de fichas.

## Global Constraints

- `tipo` ∈ `sesion | principio | tecnica` (solo estos tres).
- `modalidad` obligatoria ∈ `fuerza | running | hyrox | funcional | bici | natacion | movilidad | pliometria`.
- `confianza` ∈ `anecdotico | experto | respaldado`. `estado` ∈ `en_revision | con_agente | aprobada | descartada` (`con_agente` queda reservado; en esta fase nada transiciona a él).
- `disponible_ia` boolean, **por defecto `false`**; solo puede ser `true` en fichas `aprobada`; al salir de `aprobada` vuelve a `false`.
- Bloques de una sesión: los de `BLOQUES_SESION` (`lib/training/session-blocks.ts`).
- Procedencia obligatoria al aprobar: `autor` o `url_origen`. No se guarda el archivo de vídeo: solo `video_url` y `miniatura_url` (Cloudinary, carpeta `nutricoach/metodos`).
- Seguridad (CLAUDE.md): toda ruta usa `autorizarCoach` (`lib/contenido/auth.ts`), toda consulta lleva `.eq('coach_id', auth.userId)`, nunca se devuelve `err.message`, tablas con RLS activado y sin políticas.
- UI en español de España; estilo editorial existente (rótulos mono, sin cajas ni píldoras de color); filtros en la URL con `useEstadoUrl`. El acabado visual lo lleva Codex: aquí solo funcionalidad limpia.
- Migraciones: nombre `YYYYMMDDHHMMSS_*.sql`, aditivas, con bloque «Revertir» al final. **No aplicar en producción sin avisar a Carlos** (el clasificador bloquea `supabase db query --linked`; lo aplica él o añade la regla).

## Review Focus

1. Misma URL de Instagram en distinta forma (`?igsh=`, `utm_*`, barra final, `http`) → misma huella → 409 con `existente_id`, no una segunda ficha. (Task 1)
2. Aprobar una `sesion` sin ningún ejercicio (o sin procedencia) debe rechazarse con motivo legible. (Task 1, Task 4)
3. `disponible_ia = true` pedido sobre una ficha no aprobada, o ficha que sale de `aprobada`: queda en `false`. (Task 1, Task 4)
4. Búsqueda «sentadilla bulgara» sin tildes y palabras sueltas en cualquier orden encuentra «Sentadilla búlgara»; sin resultados no rompe la pantalla. (Task 1, Task 6)
5. Un coach no puede leer ni tocar fichas de otro coach (id válido de otra cuenta → 404). (Task 3, smoke en Task 8)
6. El body de POST/PATCH con `estado`, `coach_id`, `huella` o `disponible_ia` inyectados no los cambia (solo las rutas de estado y de IA los tocan). (Task 1)

## Estructura de archivos

| Archivo | Responsabilidad |
|---|---|
| `supabase/migrations/20261027120000_biblioteca_metodos.sql` | tablas `metodos`, `metodos_eventos` |
| `lib/metodos/constantes.ts` | vocabularios, etiquetas en español, tipos TS |
| `lib/metodos/esquema.ts` | validación, huella, reglas de estado/IA, filtrado (todo puro) |
| `lib/metodos/db.ts` | `cargarMetodo`, `registrarEvento` (único sitio que habla con Supabase) |
| `scripts/metodos.test.ts` | tests de lo puro |
| `scripts/probar-metodos.ts` | humo contra la BD real (tras aplicar la migración) |
| `app/api/metodos/route.ts` | GET lista + conteos, POST crear |
| `app/api/metodos/[id]/route.ts` | GET detalle + eventos, PATCH campos y `disponible_ia` |
| `app/api/metodos/[id]/estado/route.ts` | PATCH cambio de estado |
| `app/api/metodos/[id]/miniatura/route.ts` | POST subida de miniatura |
| `components/metodos/FichaMetodo.tsx`, `EstructuraSesionEditor.tsx` | formulario crear/editar |
| `app/entrenos/metodos/page.tsx`, `nueva/page.tsx`, `[id]/page.tsx` | lista, alta, ficha |
| `components/Sidebar.tsx` | entrada de menú (último paso) |

---

### Task 1: Vocabularios y lógica pura

**Files:**
- Create: `lib/metodos/constantes.ts`, `lib/metodos/esquema.ts`
- Test: `scripts/metodos.test.ts`

**Interfaces:**
- Produces (`constantes.ts`): `TIPOS_METODO`, `MODALIDADES`, `NIVELES` (`principiante|intermedio|avanzado`), `OBJETIVOS` (`fuerza|hipertrofia|resistencia|potencia|movilidad|perdida_grasa|rendimiento`), `MATERIALES` (`barra|mancuernas|kettlebell|maquinas|poleas|banco|trx|gomas|cinta|pista|bici|remo|skierg|trineo|sin_material`), `CONFIANZAS`, `ESTADOS_METODO` (todos `as const`); `ETIQUETA: Record<string,string>` con el texto en español de cada valor; tipos `TipoMetodo`, `Modalidad`, `EstadoMetodo`, `Confianza`, `EjercicioMetodo = { texto_original: string; ejercicio_id: string | null; series: number | null; reps: string | null; duracion_seg: number | null; pausa_seg: number | null; intensidad: string | null; nota: string | null }`, `BloqueMetodo = { tipo: TipoBloqueSesion; ejercicios: EjercicioMetodo[] }`, `CamposMetodo`, `Metodo` (fila completa: `CamposMetodo` + `id, coach_id, estado, disponible_ia, huella, created_at, updated_at`), `TipoEventoMetodo = 'creada'|'editada'|'aprobada'|'descartada'|'reabierta'|'ia_activada'|'ia_desactivada'`.
- Produces (`esquema.ts`):
  - `validarMetodo(entrada: unknown, modo: 'crear' | 'editar'): { ok: true; valor: Partial<CamposMetodo> } | { ok: false; error: string }`
  - `normalizarUrl(url: string | null | undefined): string | null`
  - `huellaMetodo(c: { autor: string | null; url_origen: string | null; titulo: string }): string`
  - `puedeAprobar(m: Pick<Metodo, 'tipo' | 'titulo' | 'modalidad' | 'autor' | 'url_origen' | 'estructura'>): { ok: true } | { ok: false; motivo: string }`
  - `transicionMetodo(desde: EstadoMetodo, hacia: EstadoMetodo): { ok: boolean; evento?: TipoEventoMetodo }`
  - `disponibleIaPermitido(estado: EstadoMetodo, pedido: boolean): boolean`
  - `filtrarMetodos<T extends FilaFiltrable>(lista: T[], f: FiltrosMetodos): T[]` con `FiltrosMetodos = { q?: string; tipo?: string; modalidad?: string; nivel?: string; confianza?: string; autor?: string; soloIa?: boolean }` y `FilaFiltrable` con los campos de texto/array que usa (`titulo, resumen, autor, tags, tipo, modalidad, nivel, confianza, disponible_ia`). Reutiliza `palabrasDeBusqueda` y `coincidePalabras` de `lib/recetas/busqueda.ts`.

- [ ] **Step 1: Escribir `scripts/metodos.test.ts` (debe fallar)** con estos casos, como código:
  - `normalizarUrl('https://www.instagram.com/reel/ABC123/?igsh=xyz&utm_source=ig')` === `normalizarUrl('http://instagram.com/reel/ABC123')`; `normalizarUrl('')` y `normalizarUrl('no es url')` → `null`; se conserva el parámetro `v` de YouTube (`youtube.com/watch?v=Q` ≠ `youtube.com/watch?v=R`).
  - `huellaMetodo` igual para las dos URLs anteriores con mismo autor; distinta si cambia la URL; sin URL usa autor+título normalizado (sin tildes, minúsculas).
  - `validarMetodo({tipo:'sesion', titulo:'x', modalidad:'running', estado:'aprobada', coach_id:'z', huella:'h', disponible_ia:true}, 'crear')` → `ok` y `valor` NO contiene `estado`, `coach_id`, `huella`, `disponible_ia`.
  - `validarMetodo` rechaza: título vacío o de >160 chars en crear; `tipo` fuera de vocabulario; `modalidad` inválida; `duracion_min` negativa o >600; `tags` con más de 12 elementos o elementos de >40 chars; `material` con valor fuera de vocabulario; `video_url`/`url_origen` que no sean http(s); ejercicio sin `texto_original`; `series` fuera de 1–20; bloque con `tipo` fuera de `BLOQUES_SESION`; `estructura` con >12 bloques o >40 ejercicios por bloque. En modo `'editar'` acepta un cuerpo parcial (solo `{resumen:'...'}`) y rechaza uno vacío.
  - `puedeAprobar`: `sesion` con `estructura` vacía o sin ejercicios → `ok:false` con motivo; `principio` sin estructura → ok; sin `autor` ni `url_origen` → `ok:false`; sin `modalidad` → `ok:false`.
  - `transicionMetodo`: `en_revision→aprobada` (evento `aprobada`), `en_revision→descartada`, `aprobada→en_revision` (`reabierta`), `aprobada→descartada`, `descartada→en_revision` (`reabierta`) permitidas; cualquier cosa hacia `con_agente`, y `x→x`, no.
  - `disponibleIaPermitido('aprobada', true)` true; `('en_revision', true)` false; `('aprobada', false)` false.
  - `filtrarMetodos`: «sentadilla bulgara» encuentra título «Sentadilla búlgara con mancuernas»; `{q:'bulgara sentadilla'}` también; `{soloIa:true}` deja solo `disponible_ia`; filtros combinados con «y»; lista vacía y `q` vacía no fallan.
- [ ] **Step 2: Ejecutar** `npx tsx scripts/metodos.test.ts` → falla por módulos inexistentes.
- [ ] **Step 3: Implementar** `constantes.ts` y `esquema.ts` con las firmas de arriba. `normalizarUrl`: quita esquema/`www`, `utm_*`, `igsh`, `fbclid`, `si`, barra final y fragmento; conserva `v` de YouTube; usa `URL`. `huellaMetodo`: texto normalizado sin tildes; `url` normalizada + `|` + autor en minúsculas, o `autor|titulo` si no hay URL; hash corto con `crypto.createHash('sha1')` hex.
- [ ] **Step 4: Ejecutar** `npx tsx scripts/metodos.test.ts` → sin salida de error (los tests de este repo no imprimen nada al pasar; si el patrón de otro test imprime `OK`, imitarlo).
- [ ] **Step 5: Commit** `git add lib/metodos scripts/metodos.test.ts && git commit -m "feat(metodos): vocabularios y reglas puras de la biblioteca de métodos"`

---

### Task 2: Migración

**Files:**
- Create: `supabase/migrations/20261027120000_biblioteca_metodos.sql`

**Interfaces:**
- Produces: tabla `public.metodos` con columnas: `id uuid pk default gen_random_uuid()`, `coach_id uuid not null references auth.users(id) on delete cascade`, `tipo text not null` (check 3 valores), `titulo text not null`, `resumen text`, `modalidad text not null` (check 8 valores), `objetivo text`, `nivel text`, `material text[] not null default '{}'`, `duracion_min integer`, `estructura jsonb not null default '[]'`, `autor text`, `plataforma text`, `url_origen text`, `video_url text`, `miniatura_url text`, `confianza text not null default 'anecdotico'`, `estado text not null default 'en_revision'` (check 4 valores), `disponible_ia boolean not null default false`, `notas_coach text`, `tags text[] not null default '{}'`, `huella text not null`, `created_at/updated_at timestamptz not null default now()`. Índices: `unique (coach_id, huella)`, `(coach_id, estado, created_at desc)`. Check `disponible_ia = false or estado = 'aprobada'`. Tabla `public.metodos_eventos (id, metodo_id references metodos on delete cascade, tipo text check (7 valores), nota text, created_at)` con índice `(metodo_id, created_at)`. `alter table … enable row level security` en ambas, sin políticas. Bloque «Revertir» con los `drop table`.

- [ ] **Step 1: Escribir el SQL** siguiendo el estilo de `20261026300000_revisor_recetario.sql` (comentario de cabecera, `if not exists`).
- [ ] **Step 2: Validar la sintaxis** sin aplicarla: `grep -c "create table" supabase/migrations/20261027120000_biblioteca_metodos.sql` → `2`, y revisar a ojo los checks contra `constantes.ts`.
- [ ] **Step 3: Pedir a Carlos que la aplique** (o que añada la regla de permisos) con `supabase db query --linked -f supabase/migrations/20261027120000_biblioteca_metodos.sql`. Hasta entonces, las Tasks 3–7 se pueden escribir pero NO subir a `main` junto al menú (Task 8).
- [ ] **Step 4: Commit** `git add supabase/migrations/20261027120000_biblioteca_metodos.sql && git commit -m "feat(metodos): migración de la biblioteca de métodos"`

---

### Task 3: Acceso a datos y rutas de lista/alta

**Files:**
- Create: `lib/metodos/db.ts`, `app/api/metodos/route.ts`

**Interfaces:**
- Consumes: Task 1 (`validarMetodo`, `huellaMetodo`, `filtrarMetodos`, tipos), `autorizarCoach` (`{ admin, userId }`).
- Produces (`db.ts`): `cargarMetodo(admin: SupabaseClient, id: string, coachId: string): Promise<Metodo | null>` (consulta con `.eq('id', id).eq('coach_id', coachId).maybeSingle()`); `registrarEvento(admin, metodoId: string, tipo: TipoEventoMetodo, nota?: string): Promise<void>`.
- Produces (rutas): `GET /api/metodos?estado&tipo&modalidad&nivel&confianza&autor&ia=1&q` → `200 { metodos: Omit<Metodo,'estructura'|'huella'|'coach_id'>[]; conteos: Record<EstadoMetodo, number> }` (la BD filtra por `coach_id` y `estado`; el resto con `filtrarMetodos`; hasta 1.000 filas; `conteos` se calcula sobre todas las del coach). `POST /api/metodos` → `201 { metodo }`; `400 { error }` si no valida; `409 { error: 'Ya existe…', existente_id }` si choca `unique (coach_id, huella)`; crea con `estado='en_revision'`, `disponible_ia=false`, la `huella` calculada y registra evento `creada`.

- [ ] **Step 1: Implementar `db.ts` y la ruta.** `id` se valida con la expresión UUID que ya usan las demás rutas. Errores de BD → mensaje genérico, sin `err.message`.
- [ ] **Step 2: Verificar tipos** `npx tsc --noEmit` → sin errores nuevos.
- [ ] **Step 3: Commit** `git add lib/metodos/db.ts app/api/metodos/route.ts && git commit -m "feat(metodos): API de lista y alta"`

---

### Task 4: Detalle, edición, estado y marca de IA

**Files:**
- Create: `app/api/metodos/[id]/route.ts`, `app/api/metodos/[id]/estado/route.ts`

**Interfaces:**
- Consumes: Task 1 y Task 3.
- Produces: `GET /api/metodos/[id]` → `{ metodo, eventos: { tipo, nota, created_at }[] }` (404 si no es de este coach). `PATCH /api/metodos/[id]` body parcial de campos editables (`validarMetodo(...,'editar')`) y opcional `disponible_ia: boolean`; recalcula `huella` si cambian `autor`, `url_origen` o `titulo`; 409 si la nueva huella ya existe en otra ficha; `disponible_ia` pasa por `disponibleIaPermitido` (si se pide `true` en una ficha no aprobada → `409 { error: 'Solo las fichas aprobadas pueden estar disponibles para la IA' }`); registra `editada`, `ia_activada` o `ia_desactivada` según proceda; actualiza `updated_at`. `PATCH /api/metodos/[id]/estado` body `{ estado: EstadoMetodo; nota?: string }`: valida con `transicionMetodo` (409 si no), con `puedeAprobar` al aprobar (409 con `motivo`), pone `disponible_ia=false` al salir de `aprobada`, registra el evento de la transición y devuelve `{ metodo }`.

- [ ] **Step 1: Implementar ambas rutas.** Todas las lecturas y escrituras llevan `coach_id` (usar `cargarMetodo`; `update` con `.eq('coach_id', auth.userId)`).
- [ ] **Step 2: Verificar** `npx tsc --noEmit` y `npx eslint app/api/metodos lib/metodos` → limpios.
- [ ] **Step 3: Commit** `git add "app/api/metodos/[id]" && git commit -m "feat(metodos): API de detalle, edición, estado y marca de IA"`

---

### Task 5: Subida de miniatura

**Files:**
- Create: `app/api/metodos/[id]/miniatura/route.ts`

**Interfaces:**
- Consumes: `cargarMetodo`, `uploadToCloudinary(buffer, { folder: 'nutricoach/metodos', public_id: id })` de `lib/cloudinary.ts`, `calentarVariantes`.
- Produces: `POST /api/metodos/[id]/miniatura` con `multipart/form-data` campo `archivo` (imagen ≤ 5 MB; tipos jpeg/png/webp; si no, 400) → `200 { miniatura_url }` y guarda `miniatura_url` en la ficha.

- [ ] **Step 1: Implementar la ruta** (`await request.formData()`, comprobar `File`, tamaño y `type`, `Buffer.from(await archivo.arrayBuffer())`).
- [ ] **Step 2: Verificar** `npx tsc --noEmit` limpio.
- [ ] **Step 3: Commit** `git add "app/api/metodos/[id]/miniatura" && git commit -m "feat(metodos): subida de miniatura"`

---

### Task 6: Lista de la biblioteca

**Files:**
- Create: `app/entrenos/metodos/page.tsx`

**Interfaces:**
- Consumes: `GET /api/metodos`, `useEstadoUrl` (claves `estado` ∈ `en_revision|aprobada|descartada`, defecto `en_revision`; `tipo`, `modalidad`, `nivel`, `confianza`, `ia` (`1`), `q`), `ETIQUETA`, `useDebounce`.
- Produces: pantalla con pestañas de estado y contadores («Por revisar n · Aprobadas n · Descartadas n»), buscador, selectores de tipo/modalidad/nivel/confianza, interruptor «Disponible para la IA» y «Limpiar filtros»; rejilla de tarjetas (miniatura cuadrada con marcador de posición si no hay, título, autor · plataforma, modalidad · nivel · duración, indicador de IA), cada una enlaza a `/entrenos/metodos/[id]`; botón «Añadir» → `/entrenos/metodos/nueva`; estados de carga (esqueleto, `components/ui/Skeleton.tsx`), vacío («Aún no hay fichas…» / «Nada con estos filtros») y error visibles.

- [ ] **Step 1: Implementar la página** (cliente, `'use client'`; envuelta con el layout de `app/entrenos/layout.tsx` que ya pone `CoachShell`).
- [ ] **Step 2: Verificar** `npx tsc --noEmit` y `npx eslint app/entrenos/metodos` limpios.
- [ ] **Step 3: Commit** `git add app/entrenos/metodos/page.tsx && git commit -m "feat(metodos): lista de la biblioteca"`

---

### Task 7: Alta, ficha y edición

**Files:**
- Create: `components/metodos/FichaMetodo.tsx`, `components/metodos/EstructuraSesionEditor.tsx`, `app/entrenos/metodos/nueva/page.tsx`, `app/entrenos/metodos/[id]/page.tsx`

**Interfaces:**
- Consumes: todas las rutas de las Tasks 3–5, `TagInput` (`components/ui/TagInput.tsx`), `BLOQUES_SESION` y `etiquetaBloqueSesion`.
- Produces: `FichaMetodo({ inicial?: Metodo; onGuardado?: (m: Metodo) => void })` — formulario con tipo, título, resumen, modalidad, objetivo, nivel, material (selección múltiple), duración, autor, plataforma, `url_origen`, `video_url`, confianza, notas del coach, tags y miniatura (botón «Subir» + pegar con ⌘V reutilizando la idea de `SubirFotoReceta`); `EstructuraSesionEditor({ valor: BloqueMetodo[]; onCambio })` solo visible si `tipo='sesion'` (bloques con ejercicios: texto, series, reps, pausa, intensidad, nota; añadir/quitar/reordenar). Páginas: `nueva` crea (si la API devuelve 409 muestra «Ya existe: abrir» con enlace a `existente_id`); `[id]` muestra la ficha editable, historial de eventos, y acciones **Aprobar · Descartar · Reabrir** y el interruptor «Disponible para la IA» (desactivado e informativo si la ficha no está aprobada; si aprobar devuelve `motivo`, mostrarlo). Botón «Guardar y aprobar» en `nueva` = POST + PATCH estado. Enlace «Ver original» a `url_origen`/`video_url` en pestaña nueva con `rel="noopener noreferrer"`.

- [ ] **Step 1: Implementar los dos componentes y las dos páginas.** Todo `fetch` comprueba `res.ok` y muestra el `error` de la API (regla del repo: nunca dar por hecho un guardado).
- [ ] **Step 2: Verificar** `npx tsc --noEmit` y `npx eslint components/metodos app/entrenos/metodos` limpios.
- [ ] **Step 3: Commit** `git add components/metodos app/entrenos/metodos && git commit -m "feat(metodos): alta, ficha y edición"`

---

### Task 8: Menú, humo contra la BD y verificación final

**Files:**
- Modify: `components/Sidebar.tsx` (añadir a `PLANES_ITEMS`: `{ href: '/entrenos/metodos', label: 'Biblioteca de métodos', icon: IconoCatalogo }`)
- Create: `scripts/probar-metodos.ts`
- Modify: `NUTRICION/CLAUDE.md` (fila de pendientes de la biblioteca → «Fase 1 hecha» con lo verificado)

**Interfaces:**
- Consumes: migración aplicada (Task 2), `lib/metodos/db.ts`, `createServiceSupabase`.
- Produces: `scripts/probar-metodos.ts` (cargar `.env.local` como hacen otros scripts): con el cliente de servicio crea una ficha de prueba con `coach_id` de Carlos, comprueba (1) `cargarMetodo(admin, id, <otro uuid>)` → `null`; (2) insertar una segunda con la misma huella falla por el índice único; (3) `update` a `disponible_ia=true` en `en_revision` falla por el check de la BD; (4) borra la ficha de prueba. Termina con código ≠ 0 si algo falla.

- [ ] **Step 1: Confirmar con Carlos que la migración está aplicada** (`select to_regclass('public.metodos')` no nulo). Si no, parar aquí.
- [ ] **Step 2: Escribir y ejecutar** `npx tsx scripts/probar-metodos.ts` → todas las comprobaciones pasan y no deja filas (`select count(*) from metodos where titulo like 'PRUEBA%'` = 0).
- [ ] **Step 3: Añadir la entrada de menú.**
- [ ] **Step 4: Verificación completa:** `npx tsc --noEmit`, `npx eslint components/Sidebar.tsx components/metodos app/entrenos/metodos app/api/metodos lib/metodos`, `npx tsx scripts/metodos.test.ts`, `npm run verificar:motor` (no debe empeorar). Esperado: todo limpio.
- [ ] **Step 5: Probar con Carlos en pantalla** (Mac y 390 px; claro y oscuro): crear una sesión con 2 bloques, subir miniatura, aprobar, activar «Disponible para la IA», filtrar, buscar «bulgara», intentar crear un duplicado (debe avisar). Anotar lo que falle.
- [ ] **Step 6: Actualizar la fila en `NUTRICION/CLAUDE.md`, commit y push** (`git add components/Sidebar.tsx scripts/probar-metodos.ts NUTRICION/CLAUDE.md && git commit -m "feat(metodos): menú, prueba de humo y documentación de la Fase 1"`). Push a `main` solo con la migración ya aplicada.

## Self-review (hecha)

- **Cobertura del spec (Fase 1):** tabla y campos (T2), vocabularios y huella (T1), alta manual con enlace/miniatura (T3, T5, T7), revisión con estados y eventos (T1, T4, T7), `disponible_ia` con la regla de Carlos (T1, T4, T7), lista visual para revisar (T6), duplicados (T1, T3), procedencia obligatoria (T1, T4), derechos (solo enlace + miniatura propia). Fuera a propósito: F2–F5.
- **Consistencia de nombres:** `Metodo`, `CamposMetodo`, `EstadoMetodo`, `cargarMetodo`, `registrarEvento`, `puedeAprobar`, `transicionMetodo`, `disponibleIaPermitido`, `filtrarMetodos` coinciden en todas las tareas.
- **Decisiones mías a revisar:** vocabularios de `objetivo` y `material`; límites de validación (160 caracteres de título, 12 bloques, 40 ejercicios, 5 MB); ruta `/entrenos/metodos` bajo Entrenamiento; subida de miniatura propia en vez de reutilizar `/api/subir-imagen-receta` (esa solo exige sesión y está atada a recetas).
