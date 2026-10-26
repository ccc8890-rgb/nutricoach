# Agente revisor del recetario — Fases 1 y 2 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Que cada ficha pase por un circuito ordenado — Carlos la revisa, un agente de IA la revisa cada X horas, Carlos la revisa por segunda vez — con pestañas propias, historial visible, coste acotado y sin que el agente apruebe nada.

**Architecture:** Columna `recetas.fase_revision` (nula = nueva; `en_agente`; `segunda`) y una tabla de eventos `recetas_revision_eventos` (acciones de Carlos y veredictos del agente). Un núcleo puro (`lib/recetas/revisor/`) valida la salida del modelo y decide qué correcciones son seguras; una capa de servidor orquesta (cargar ficha → hash → `llamarIA('revision_receta')` → validar → guardar evento → aplicar lo seguro → pasar a `segunda`). Se ejecuta de tres formas con el mismo código: botón «Revisar ahora», cron diario de Vercel y la pasada local de 6 h.

**Tech Stack:** Next.js (App Router, versión con cambios), Supabase (migración aditiva), enrutador de IA `lib/ia/enrutador.ts`, tests `npx tsx scripts/*.test.ts` (`node:assert`).

**Spec:** `docs/superpowers/specs/2026-10-26-revisor-recetario-agente-design.md`. Fuera de este plan: contraste con la fuente (guardar el texto del reel), autonomía gradual / auto-aprobación, tarjeta de acuerdo en Ajustes.

## Global Constraints

- El agente **nunca** cambia `estado`, ingredientes, cantidades, pasos, raciones ni macros. Solo puede escribir `tipo_contenido`, `familia` y (por coherencia al pasar a elaboración) `categoria='Elaboración'` y `tipo_receta='salsa_base'`.
- Correcciones automáticas solo si: ficha `estado='en_revision'`, `confianza >= 0.85`, `segura: true`, y el cambio es de familia dentro del mismo tipo **o** de plato a elaboración. **Nunca** de elaboración a plato (queda como sugerencia: puede estar en uso).
- Salida del modelo: JSON validado con esquema estricto antes de usarse; `familia` ∈ listas de `lib/recetas-constants.ts` (`FAMILIAS_PLATO`, `FAMILIAS_ELABORACION`) según el `tipo_contenido`; veredicto ∈ `lista|revisar|corregir`; `confianza` ∈ [0,1]; máx. 20 hallazgos. Si no valida: se registra el fallo, la ficha NO cambia de fase y se reintenta en la siguiente pasada (como mucho 1 reintento inmediato).
- No se revisa dos veces una ficha sin cambios: `hash_ficha` igual al del último evento del agente ⇒ se omite (salvo si Carlos la devolvió con una nota nueva).
- Tope de gasto: máx. **10 fichas por ejecución** y **600.000 tokens al día** (suma de `tokens_entrada + tokens_salida` de los eventos de hoy, hora de Madrid). Al llegar al tope se detiene y lo anota.
- Rutas con service role: `autorizarCoach` de `lib/contenido/auth.ts` (coach) o `CRON_SECRET` (cron); clientes Supabase solo desde `lib/supabase-server.ts`; sin `err.message` al cliente.
- Crons de Vercel: **solo diarios** (todos los del proyecto lo son; los sub-diarios pueden no estar permitidos en el plan). La frecuencia de 6 h la da la pasada local.
- Modelos: `revision_receta` por defecto `[Claude Sonnet 5.5, GPT 5.5, DeepSeek]`, cambiable con `IA_RUTA_REVISION_RECETA`. Familias de modelos distintas de la que generó la ficha no se exigen aquí.
- Migraciones solo con `supabase db query --linked -f <archivo>`; aditivas, con reversión en comentarios. Datos: simular, copia con hora en `salidas/`, `--apply`.
- Los `.ts` de `scripts/` no admiten `await` de nivel superior (envolver en `main()`). Estilo editorial existente; castellano; sin cajas de colores nuevas.

## Review Focus

- **Modelo que devuelve basura o JSON con familia inventada** no cambia ninguna ficha ni la mueve de fase. Test en Task 2 y 3.
- **Ficha sin cambios** no se vuelve a revisar ni gasta tokens; **ficha devuelta con nota** sí. Test en Task 3.
- **Tope diario** corta la ejecución a mitad de lote sin dejar fichas a medias. Test en Task 3.
- **Aprobar/descartar desde cualquier pestaña** limpia `fase_revision` y deja el evento (si no, la ficha aparecería en «2ª revisión» ya aprobada). Test en Task 4.
- **Una elaboración usada por otras recetas** nunca pasa a plato por el agente. Test en Task 2.
- **Cola «Por revisar» (nuevas)** sigue mostrando fichas nuevas de Radar/webs/editor sin que éstas tengan que escribir `fase_revision`. Comprobación en Task 5.

---

### Task 1: Migración — fase y eventos

**Files:**
- Create: `supabase/migrations/20261026300000_revisor_recetario.sql`

**Interfaces:**
- Produces: `recetas.fase_revision text null check (fase_revision in ('en_agente','segunda'))` (nula = nueva); tabla `recetas_revision_eventos(id uuid pk default gen_random_uuid(), receta_id uuid not null references recetas(id) on delete cascade, tipo text not null check (tipo in ('al_agente','devuelta','volver_a_nueva','agente','aprobada','descartada','error')), actor text not null check (actor in ('carlos','agente')), nota text, veredicto text, confianza numeric, resumen text, hallazgos jsonb, correcciones jsonb, aplicadas jsonb, modelo text, tokens_entrada int, tokens_salida int, hash_ficha text, created_at timestamptz not null default now())`; índice `(receta_id, created_at)` y `(created_at)`; RLS activada sin políticas (solo service role).

- [ ] **Step 1: Write** el SQL aditivo con `add column if not exists`, `create table if not exists`, índices y bloque de reversión en comentarios.
- [ ] **Step 2: Apply** — `supabase db query --linked -f supabase/migrations/20261026300000_revisor_recetario.sql` — Expected: sin error.
- [ ] **Step 3: Verify** — una consulta que cuente la columna `fase_revision`, la tabla y el índice (cada uno 1) y `select count(*) from recetas where fase_revision is not null` = 0.
- [ ] **Step 4: Commit** — `git add supabase/migrations/20261026300000_revisor_recetario.sql && git commit -m "feat: fase de revisión y eventos del revisor"`

---

### Task 2: Núcleo puro del revisor

**Files:**
- Create: `lib/recetas/revisor/esquema.ts`
- Create: `lib/recetas/revisor/prompt.ts`
- Create: `scripts/revisor-recetario.test.ts`

**Interfaces:**
- Consumes: `FAMILIAS_PLATO`, `FAMILIAS_ELABORACION` (`lib/recetas-constants.ts`); `camposAlCambiarTipo`, `TipoContenido` (`lib/recetas/clasificacion.ts`).
- Produces en `esquema.ts`:
  - `export type Veredicto = 'lista' | 'revisar' | 'corregir'`
  - `export type Hallazgo = { campo: string; gravedad: 'alta' | 'media' | 'baja'; descripcion: string; sugerencia: string }`
  - `export type Correccion = { campo: 'tipo_contenido' | 'familia'; valor: string; segura: boolean }`
  - `export type RevisionAgente = { tipo_contenido: TipoContenido; familia: string | null; confianza: number; veredicto: Veredicto; resumen: string; hallazgos: Hallazgo[]; correcciones: Correccion[] }`
  - `export type FichaParaRevisar = { id: string; nombre: string; estado: string; tipo_contenido: string; familia: string | null; categoria: string | null; tipo_plato: string | null; tipo_receta: string | null; descripcion: string | null; instrucciones: string | null; consejos: string | null; porciones: number | null; kcal: number | null; proteinas: number | null; carbohidratos: number | null; grasas: number | null; tags: string[] | null; url_origen: string | null; ingredientes: { nombre: string; alimento: string | null; gramos: number; kcal100: number | null }[]; hallazgos_deterministas: string[]; usada_en_recetas: number }`
  - `export function validarRevision(raw: unknown): { ok: true; revision: RevisionAgente } | { ok: false; motivo: string }`
  - `export function correccionesAplicables(rev: RevisionAgente, ficha: Pick<FichaParaRevisar, 'estado' | 'tipo_contenido' | 'familia' | 'categoria' | 'nombre' | 'usada_en_recetas'>): Record<string, unknown>` — campos a escribir (vacío si nada es aplicable).
  - `export function hashFicha(f: FichaParaRevisar, nota?: string | null): string` — sha256 hex del contenido relevante en orden canónico (ingredientes ordenados por nombre), incluida la nota de Carlos.
- Produces en `prompt.ts`: `export function construirPrompt(f: FichaParaRevisar, notaCarlos?: string | null): { sistema: string; usuario: string }` — el sistema lista las familias válidas de cada tipo, las reglas del proyecto (cantidades de la receta entera, `tipo_plato` permitido, lo que significa cada veredicto, formato JSON exacto, «responde SOLO JSON»); el usuario serializa la ficha (sin campos internos del coach) y la nota.

- [ ] **Step 1: Write the failing test** `scripts/revisor-recetario.test.ts`:
  - `validarRevision`: acepta un objeto válido (familia `Carnes`, tipo `plato`, confianza 0.9, veredicto `lista`); rechaza `familia: 'Inventada'`; rechaza `tipo_contenido: 'elaboracion'` con familia de plato (`Carnes`); rechaza `confianza: 1.5`; rechaza `veredicto: 'ok'`; rechaza JSON sin `hallazgos`; con 25 hallazgos conserva 20; ignora claves extra; rechaza una corrección con `campo: 'estado'`.
  - `correccionesAplicables` (ficha `en_revision`, `usada_en_recetas: 0`): corrección segura `familia → 'Pastas'` con confianza 0.9 ⇒ `{ familia: 'Pastas' }`; con confianza 0.8 ⇒ `{}`; corrección no segura ⇒ `{}`; ficha `aprobada` ⇒ `{}`; plato → elaboración (revisión con `tipo_contenido: 'elaboracion'`, familia `Salsas`, corrección segura de `tipo_contenido`) ⇒ `{ tipo_contenido: 'elaboracion', familia: 'Salsas', categoria: 'Elaboración', tipo_receta: 'salsa_base' }`; elaboración → plato ⇒ `{}` aunque sea segura y con `usada_en_recetas: 0`.
  - `hashFicha`: igual para la misma ficha con los ingredientes en otro orden; distinto si cambia un gramo; distinto si cambia la nota de Carlos.
  - `construirPrompt`: el `sistema` contiene todas las familias de plato y de elaboración y la palabra `JSON`; el `usuario` contiene el nombre de la ficha y la nota de Carlos, y NO contiene `notas_coach`.
- [ ] **Step 2: Run** `npx tsx scripts/revisor-recetario.test.ts` — Expected: FAIL (módulo no existe).
- [ ] **Step 3: Implement** los dos ficheros. `validarRevision` sin dependencias externas (comprobaciones manuales de tipos); `hashFicha` con `node:crypto`.
- [ ] **Step 4: Run** — Expected: PASS. `npx tsc --noEmit --pretty false` — Expected: sin errores.
- [ ] **Step 5: Commit** — `git add lib/recetas/revisor scripts/revisor-recetario.test.ts && git commit -m "feat: núcleo puro del revisor de recetas (validación, correcciones seguras, hash, prompt)"`

---

### Task 3: Orquestación en servidor y tarea de IA

**Files:**
- Modify: `lib/ia/enrutador.ts` (añadir `'revision_receta'` a `TareaIA` y a `RUTAS_POR_DEFECTO`: `[CLAUDE_SONNET, GPT, DEEPSEEK]`)
- Create: `lib/recetas/revisor/revisar.ts`
- Create: `scripts/probar-revisor.ts`
- Test: el propio `scripts/probar-revisor.ts` (datos temporales `ZZ-PRUEBA-*` con IA simulada, sin gasto)

**Interfaces:**
- Consumes: Task 2; `llamarIA` y `Adaptador` (`lib/ia/enrutador.ts`, el parámetro `opciones.adaptador` permite simular); `createServiceSupabase`.
- Produces en `revisar.ts` (todas reciben `db` de servicio):
  - `export async function cargarFicha(db, recetaId: string): Promise<FichaParaRevisar | null>` — receta + líneas con su alimento (`alimento:alimentos(nombre, calorias)`), `quality_issues` convertidos a `hallazgos_deterministas`, y `usada_en_recetas` (cuenta de `receta_ingredientes.elaboracion_id = id`).
  - `export type ResultadoRevision = { estado: 'revisada' | 'omitida_sin_cambios' | 'invalida' | 'sin_presupuesto' | 'no_en_agente'; veredicto?: Veredicto; aplicadas?: Record<string, unknown>; tokens?: number }`
  - `export async function revisarFicha(db, recetaId: string, o?: { adaptador?: Adaptador; forzar?: boolean }): Promise<ResultadoRevision>` — si `fase_revision !== 'en_agente'` y no `forzar` ⇒ `no_en_agente`; calcula `hashFicha` con la última nota de Carlos (último evento `devuelta`); si coincide con el último evento `agente` y no hay devolución posterior ⇒ `omitida_sin_cambios` (la ficha pasa igualmente a `segunda`); llama a `llamarIA('revision_receta', { sistema, usuario, json: true, maxTokens: 2500, presupuestoMs: 90_000 })`; valida (un reintento si inválida); inserta evento `agente` con tokens/modelo/hash/hallazgos/correcciones/aplicadas; aplica `correccionesAplicables` (con `camposAlCambiarTipo` cuando cambia el tipo) y añade la etiqueta `Revisada por el agente`; pone `fase_revision='segunda'`. Si es inválida inserta evento `error` y no cambia la fase.
  - `export async function tokensGastadosHoy(db): Promise<number>`
  - `export async function revisarPendientes(db, o?: { limite?: number; tokensDia?: number; adaptador?: Adaptador }): Promise<{ revisadas: number; omitidas: number; invalidas: number; paradoPorPresupuesto: boolean; tokens: number }>` — toma fichas `en_agente` por antigüedad del evento `al_agente`, máx. `limite` (10); antes de cada una comprueba `tokensGastadosHoy < tokensDia` (600.000).
  - `export async function acuerdoConCarlos(db): Promise<{ total: number; acuerdo: number }>` — para cada ficha con evento `agente` y luego `aprobada`/`descartada`/`devuelta`: acuerdo si `lista`↔`aprobada`; desacuerdo si `lista`↔`descartada`/`devuelta`; el resto no cuenta.

- [ ] **Step 1: Write** `scripts/probar-revisor.ts` (con `main()`, service role de `.env.local`, adaptador falso que cuenta llamadas y devuelve JSON controlado). Crea fichas temporales `ZZ-PRUEBA-*` (`estado='en_revision'`, `fase_revision='en_agente'`, con dos ingredientes de alimentos reales) y comprueba: (a) respuesta válida `lista` con corrección segura de familia (conf. 0.9) ⇒ evento `agente`, familia cambiada, etiqueta `Revisada por el agente`, `fase_revision='segunda'`, `estado` intacto; (b) segunda ejecución sin cambios ⇒ `omitida_sin_cambios`, 1 sola llamada al modelo en total; (c) devolver con nota (insertando evento `devuelta` y poniendo `en_agente`) ⇒ vuelve a llamar (2 llamadas); (d) respuesta basura (`'no soy json'`) y respuesta con familia inventada ⇒ `invalida`, evento `error`, la ficha sigue en `en_agente`, sin cambios en sus campos; (e) `tokensDia: 0` ⇒ `paradoPorPresupuesto`, 0 llamadas; (f) una elaboración con `usada_en_recetas > 0` y corrección segura a plato ⇒ no cambia de tipo; (g) `acuerdoConCarlos` cuenta un par `agente lista` + `aprobada` como acuerdo. Todo en un `try/finally` que borra eventos y recetas temporales.
- [ ] **Step 2: Run** `npx tsx scripts/probar-revisor.ts` — Expected: FAIL (módulos/tarea no existen).
- [ ] **Step 3: Implement** `enrutador.ts` y `revisar.ts` según las firmas de arriba.
- [ ] **Step 4: Run** `npx tsx scripts/probar-revisor.ts` (Expected: todas las comprobaciones OK y `restos ZZ-PRUEBA: 0`), `npx tsx scripts/revisor-recetario.test.ts`, el test existente del enrutador (`ls scripts | grep -i enrutador` y ejecutarlo) y `npx tsc --noEmit --pretty false` — Expected: sin errores.
- [ ] **Step 5: Commit** — `git add lib/ia/enrutador.ts lib/recetas/revisor/revisar.ts scripts/probar-revisor.ts && git commit -m "feat: orquestación del revisor con tope de gasto y tarea de IA revision_receta"`

---

### Task 4: Rutas — fase, historial, «Revisar ahora» y cron diario

**Files:**
- Create: `app/api/recetas/[id]/fase/route.ts`
- Create: `app/api/recetas/[id]/historial/route.ts`
- Create: `app/api/recetas/revisor/ahora/route.ts`
- Create: `app/api/cron/revisor-recetas/route.ts`
- Modify: `app/api/recetas/[id]/estado/route.ts` (limpiar fase y registrar evento al aprobar/descartar)
- Modify: `vercel.json` (cron diario `/api/cron/revisor-recetas` a las `30 5 * * *`)
- Modify: `lib/sistema/registrar-cron.ts` (añadir `'revisor-recetas'` a `NombreCron`)

**Interfaces:**
- Consumes: `revisarPendientes`, `acuerdoConCarlos` (Task 3); `registrarCron`; `autorizarCoach`.
- Produces:
  - `PATCH /api/recetas/[id]/fase` con `{ fase: 'en_agente' | 'segunda' | 'nueva', nota?: string }`, solo coach, solo si `estado='en_revision'`. `en_agente` desde nueva ⇒ evento `al_agente`; `en_agente` desde `segunda` ⇒ evento `devuelta` con la `nota` (obligatoria, máx. 500 caracteres); `nueva` ⇒ `fase_revision=null` y evento `volver_a_nueva`. Devuelve `{ ok: true, fase }`.
  - `GET /api/recetas/[id]/historial` (solo coach) ⇒ `{ eventos: { tipo, actor, nota, veredicto, confianza, resumen, hallazgos, correcciones, aplicadas, modelo, created_at }[] }` ordenado por fecha ascendente.
  - `POST /api/recetas/revisor/ahora` (solo coach) ⇒ `revisarPendientes(db, { limite: 5 })` con `maxDuration = 120`; devuelve el resumen.
  - `GET /api/cron/revisor-recetas` (`CRON_SECRET`, falla cerrado sin secreto, `maxDuration = 300`) ⇒ `revisarPendientes(db)` y `registrarCron(db, 'revisor-recetas', errores, detalle)`.
  - El cambio de estado a `aprobada`/`descartada` deja `fase_revision = null` y un evento `aprobada`/`descartada` (actor `carlos`).

- [ ] **Step 1: Write the failing check** — `curl` sin sesión (o sin `CRON_SECRET`) a las cuatro rutas nuevas en producción tras el despliegue: Expected 401 en todas; el test unitario de la lógica de transiciones va en `scripts/revisor-recetario.test.ts`: función pura `transicionPermitida(desde: 'nueva'|'en_agente'|'segunda', hacia: 'nueva'|'en_agente'|'segunda'): { ok: boolean; evento?: string }` en `lib/recetas/revisor/esquema.ts` (nueva→en_agente `al_agente`; segunda→en_agente `devuelta`; en_agente→nueva y segunda→nueva `volver_a_nueva`; nueva→segunda y en_agente→segunda NO permitidas desde la API) con sus casos.
- [ ] **Step 2: Run** el test — Expected: FAIL (función no existe).
- [ ] **Step 3: Implement** la función y las rutas; en la ruta de estado, tras el `update` correcto, `update({ fase_revision: null })` y el evento si el nuevo estado es `aprobada` o `descartada`.
- [ ] **Step 4: Run** `npx tsx scripts/revisor-recetario.test.ts`, `npx tsc --noEmit --pretty false`, `npx eslint` de los ficheros nuevos — Expected: sin errores. Tras subir a `main`: `curl -s -o /dev/null -w '%{http_code}'` a las cuatro rutas — Expected: 401.
- [ ] **Step 5: Commit** — `git add` de las rutas, `vercel.json`, `registrar-cron.ts`, el test `&& git commit -m "feat: rutas del circuito de revisión y cron diario del revisor"`

---

### Task 5: Pestañas y tarjetas del circuito

**Files:**
- Modify: `app/api/recetas/revisar/route.ts` (parámetro `fase`, y `counts.fases = { nueva, en_agente, segunda }`)
- Modify: `components/recetas/CabeceraRevision.tsx` (pestañas)
- Modify: `app/recetas/(revision)/revisar/page.tsx` (acciones por fase, línea del agente, historial)
- Create: `components/recetas/LineaAgente.tsx`, `components/recetas/HistorialFicha.tsx`
- Modify: `lib/recetas/revision.ts` (tipo `FaseRevision = 'nueva' | 'en_agente' | 'segunda'` y `normalizarFase(v: string | null): FaseRevision | null`)

**Interfaces:**
- Consumes: rutas de Task 4; `GET /api/recetas/revisar?tarea=cola&fase=…`.
- Produces: pestañas `Por revisar (nuevas) · Con el agente · 2ª revisión` en el grupo «Revisar» de la cabecera, con contadores (`fase=nueva` ⇒ `fase_revision is null`); la página `revisar` lee `fase` de la URL (por defecto `nueva`) y muestra: en **nuevas**, además de Aprobar/Descartar, el botón «Pasar al agente»; en **Con el agente**, la lista con la fecha de entrada, «Revisar ahora» y «Volver a nuevas»; en **2ª revisión**, la línea del agente (`LineaAgente`: veredicto, confianza, resumen y hallazgos desplegables, correcciones aplicadas), «Aprobar», «Descartar» y «Devolver al agente» (pide una nota); en las tres, el historial desplegable (`HistorialFicha`, línea de tiempo corta en mono: fecha · quién · qué).

- [ ] **Step 1: Write the failing test** en `scripts/revisor-recetario.test.ts`: `normalizarFase('en_agente') === 'en_agente'`, `normalizarFase(null) === null`, `normalizarFase('xx') === null`.
- [ ] **Step 2: Run** — Expected: FAIL.
- [ ] **Step 3: Implement.** API: `fase` aplica `is('fase_revision', null)` / `eq('fase_revision', fase)` en `aplicarAvanzados`; `counts.fases` con tres consultas de recuento sobre `estado in (en_revision, borrador)`. Cabecera: reutilizar el patrón de contadores existente (una petición `tarea=cola&pageSize=1`) leyendo `counts.fases`. Página: añadir el `fase` a la clave de la URL con `useEstadoUrl`; los botones llaman a `PATCH /api/recetas/[id]/fase` y recargan; comprobar siempre `res.ok`.
- [ ] **Step 4: Run** el test, `npx tsc --noEmit --pretty false`, ESLint y `npx tsx scripts/menu-recetario.test.ts` — Expected: sin errores.
- [ ] **Step 5: Verificación en pantalla** (Carlos o `browse --headed` + handoff, 390 px y escritorio): las 51 fichas aparecen en «Por revisar (nuevas)»; pasar 2 al agente las mueve de pestaña y los contadores cambian; «Devolver» exige nota; el historial muestra los eventos.
- [ ] **Step 6: Commit** — `git add` de los ficheros `&& git commit -m "feat: pestañas del circuito de revisión (nuevas, con el agente, 2ª revisión)"`

---

### Task 6: Script, pasada local, medición real y documentación

**Files:**
- Create: `scripts/revisar-cola.ts`
- Modify: `scripts/auditoria-semanal.mjs` (llamada a `npx tsx scripts/revisar-cola.ts --aplica --limite=5`, tras `corregir-marcadas`)
- Modify: `CLAUDE.md` (raíz `NUTRICION/`) y `nutricoach/CLAUDE.md`

**Interfaces:**
- Consumes: `revisarPendientes`, `revisarFicha`, `tokensGastadosHoy`, `acuerdoConCarlos` (Task 3).

- [ ] **Step 1: Implement** `scripts/revisar-cola.ts [--aplica] [--limite=N] [--id=<uuid>] [--forzar] [--tokens-dia=N]` con `main()`: sin `--aplica` muestra qué fichas `en_agente` revisaría y los tokens gastados hoy (no llama a la IA); con `--aplica` ejecuta `revisarPendientes` (o `revisarFicha` con `--id` y `--forzar`, que permite probar una ficha que no está en `en_agente`); imprime resumen, tokens y acuerdo con Carlos. Enganchar la llamada en `auditoria-semanal.mjs` de forma que un fallo del revisor no pare el resto de la pasada.
- [ ] **Step 2: Medición real con 5 fichas** (la única parte que gasta): con permiso expreso de Carlos para ese gasto (≈ céntimos), pasar a `en_agente` 5 fichas de la cola mediante la API de fase o el script, ejecutar `npx tsx scripts/revisar-cola.ts --aplica --limite=5` y registrar: tokens de entrada y salida por ficha, modelo usado, veredictos, correcciones aplicadas, y un juicio de Claude sobre si los hallazgos son correctos (leer cada ficha y contrastar). Si la calidad es floja, ajustar el prompt (`prompt.ts`) y repetir con otras 5. Anotar el coste medido por ficha (tokens × precio del proveedor, indicando la fuente del precio).
- [ ] **Step 3: Verificación global:** `npx tsx scripts/revisor-recetario.test.ts`, `npx tsx scripts/probar-revisor.ts`, `npx tsx scripts/clasificacion.test.ts`, `npx tsx scripts/menu-recetario.test.ts`, `npm run verificar:motor`, `npx tsc --noEmit --pretty false` — Expected: todo OK (63/63 en el motor).
- [ ] **Step 4: Documentar y subir:** fila en la tabla de `NUTRICION/CLAUDE.md` y sección en `nutricoach/CLAUDE.md` (flujo, tope de gasto, dónde corre, coste medido, pendientes: contraste con la fuente, autonomía gradual, tarjeta de acuerdo). Commits por repositorio (`NUTRICION/` y `nutricoach/` son repos distintos), `git push origin main` en `nutricoach` y comprobar el despliegue con `vercel ls --yes`.
