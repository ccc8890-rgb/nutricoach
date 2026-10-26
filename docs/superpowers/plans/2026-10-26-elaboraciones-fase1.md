# Elaboraciones — Fase 1 (categorías + entrada por Radar) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Que salsas, condimentos y elaboraciones base sean categorías propias del recetario (cliente y coach), no salgan mezcladas con los platos en «Todos», y que las que entren por Content Radar o por webs caigan solas en su categoría.

**Architecture:** La familia es `recetas.categoria` (`Elaboración base` · `Salsa` · `Condimento`) con `tipo_receta='salsa_base'` como marca interna. Una función pura clasifica por nombre (TS y Python con los mismos casos). El filtro «Todos» excluye esas categorías salvo que haya búsqueda por texto. Sin migraciones de esquema.

**Tech Stack:** Next.js (App Router, versión con cambios: leer `node_modules/next/dist/docs/` si se toca API/rutas), Supabase, tests con `npx tsx scripts/*.test.ts` (`node:assert`), Python 3 en `Content-Radar/scripts/test_*.py`.

**Spec:** `docs/superpowers/specs/2026-10-26-elaboraciones-design.md`. Las fases 2 (enlace como ingrediente, `peso_final_g`, macros) y 3 (enlazar lo existente) tendrán planes aparte.

## Global Constraints

- Categorías exactas (con tilde y mayúscula): `Elaboración base`, `Salsa`, `Condimento`.
- Toda elaboración lleva `tipo_receta = 'salsa_base'`. `tipo_plato` NO se toca (la BD solo admite Desayuno, Almuerzo, Comida, Merienda, Cena, Snack, Postre).
- Una elaboración nueva entra siempre en `estado = 'en_revision'` (el puente ya lo hace; no cambiarlo).
- Cambios de datos con script: simular por defecto, copia previa en `salidas/DD-MM-YYYY_BACKUP-*.json`, `--apply` para escribir.
- Aplicar migraciones/consultas a producción solo con `supabase db query --linked -f` (no `db push`). Esta fase no necesita migración.
- Nombres de archivo de salidas: `DD-MM-YYYY_nombre.extensión`. Textos de interfaz en castellano.
- No tocar la estética más allá de añadir chips con el estilo existente (`rc-cat`, `chipActive/chipInactive`).

## Review Focus

- **Buscar «poolish» o «mayonesa» con «Todos» activo** debe devolver la elaboración (la búsqueda por texto no las excluye). Test en Task 3.
- **«Pollo con salsa barbacoa», «Salmón con vinagreta», «Pizza rápida»** no son elaboraciones: el clasificador no puede convertir platos en elaboraciones. Test en Task 1 (y su espejo en Task 5).
- **Una elaboración clasificada por la IA como Comida/Snack** (caso real del Poolish) debe corregirse por palabra clave. Test en Task 5.
- **Devolver una elaboración a plato** desde el editor (cambiando la categoría a Comida) debe quitarle `salsa_base`, o el planificador no la usaría nunca. Test en Task 4.
- **Reclasificar dos veces** no cambia nada la segunda (idempotente). Comprobación en Task 2.

---

### Task 1: Constantes y clasificador de elaboraciones (TS)

**Files:**
- Modify: `lib/recetas-constants.ts` (líneas 4, 7 y 12-21: `CATEGORIAS`, `TIPOS_PLATO`, `SUBCATEGORIAS`)
- Modify: `lib/recetas/tipo-receta.ts`
- Create: `scripts/elaboraciones.test.ts`

**Interfaces:**
- Produces (en `lib/recetas-constants.ts`):
  - `export const CATEGORIAS_ELABORACION = ['Elaboración base', 'Salsa', 'Condimento'] as const`
  - `export type CategoriaElaboracion = (typeof CATEGORIAS_ELABORACION)[number]`
  - `export function esCategoriaElaboracion(c: string | null | undefined): c is CategoriaElaboracion`
  - `export function categoriaCoincide(categoria: string | null | undefined, filtro: string, buscando: boolean): boolean` — con `filtro` vacío o `'Todos'`: true si `buscando` o la categoría no es de elaboración; con otro filtro: igualdad exacta.
- Produces (en `lib/recetas/tipo-receta.ts`):
  - `export function categoriaElaboracion(nombre: string): CategoriaElaboracion | null`

- [ ] **Step 1: Write the failing test** `scripts/elaboraciones.test.ts` (estilo de `scripts/halal.test.ts`):
  - Las 14 reales: `categoriaElaboracion('Turbo Poolish para Pizza Rápida') === 'Elaboración base'`; `'Mayonesa de camarón'`, `'Mayonesa de camarones'`, `'Ajonesa de huevo cocido'`, `'Mayonesa de albahaca de huevo cocido'`, `'Mayonesa picante de huevo cocido'`, `'Chimichurri'`, `'Salsa de Hamburguesa y Salsa de Trufa'`, `'Salsa de queso cheddar fit'`, `'Salsas de yogur altas en proteína'` → `'Salsa'`; `'Aceite de Cebollino'`, `'Aceite verde de hierbas'`, `'Chili oil casero'`, `'Mix de especias barbacoa'` → `'Condimento'`.
  - Extras: `'Masa madre de centeno'`, `'Caldo de huesos'`, `'Fondo de ave'`, `'Levain'` → `'Elaboración base'`; `'Adobo de pollo'`, `'Marinada de yogur'`, `'Sazonador para carne'` → `'Condimento'`; `'Pesto de rúcula'`, `'Vinagreta de mostaza'`, `'Hummus clásico'` → `'Salsa'`.
  - Negativos (`null`): `'Pollo con salsa barbacoa'`, `'Salmón al Horno con Espárragos y Vinagreta'`, `'Pizza rápida'`, `'Tostada de aguacate'`, `'Palitos de Zanahoria con Hummus Casero'`, `'Pasta con pesto'`.
  - Regla a respetar: la palabra clave debe estar entre las dos primeras palabras del nombre y ninguna palabra de plato (`PLATO` ya definido en el fichero: pollo, salmón, pan, bowl, ensalada…) puede ir **antes** de ella. «Huevo» NO bloquea si va después («Ajonesa de huevo cocido»).
  - `esCategoriaElaboracion('Salsa') === true`, `esCategoriaElaboracion('Comida') === false`, `esCategoriaElaboracion(null) === false`.
  - `categoriaCoincide('Salsa', 'Todos', false) === false`; `categoriaCoincide('Salsa', 'Todos', true) === true`; `categoriaCoincide('Comida', 'Todos', false) === true`; `categoriaCoincide('Salsa', 'Salsa', false) === true`; `categoriaCoincide('Comida', 'Salsa', false) === false`; `categoriaCoincide(null, 'Todos', false) === true`.
- [ ] **Step 2: Run it** — `npx tsx scripts/elaboraciones.test.ts` — Expected: FAIL (imports no definidos).
- [ ] **Step 3: Implement** lo anterior. En `CATEGORIAS` insertar `'Elaboración base'` y `'Condimento'` justo antes de `'Salsa'`/`'Acompañamiento'` (orden: …`Postre`, `Elaboración base`, `Salsa`, `Condimento`, `Acompañamiento`). No añadir a `TIPOS_PLATO` (es el tipo de plato del planificador). Añadir en `SUBCATEGORIAS`: `'Elaboración base': ['Masa', 'Fermento', 'Fondo', 'Caldo']`, `'Condimento': ['Adobo', 'Mix', 'Aceite', 'Marinada']` (`Salsa` ya tiene su lista). Clasificador con tres conjuntos de palabras (normalizadas sin tildes, como `palabras()` del fichero): base = poolish, masa, fermento, levain, fondo, caldo; condimento = mix, adobo, adobos, marinada, marinado, especias, sazonador, rub, aceite, chili, oil; salsa = salsa, salsas, mayonesa, mayonesas, ajonesa, alioli, aliño, vinagreta, chimichurri, pesto, hummus, guacamole, tahini, ketchup, aderezo, dressing, mostaza.
- [ ] **Step 4: Run** — mismo comando — Expected: PASS. Ejecutar también `npx tsx scripts/tipo-receta-criterios.test.ts` — Expected: PASS (no se toca `inferirTipoReceta`).
- [ ] **Step 5: Commit** — `git add lib/recetas-constants.ts lib/recetas/tipo-receta.ts scripts/elaboraciones.test.ts && git commit -m "feat: categorías de elaboraciones y clasificador por nombre"`

---

### Task 2: Reclasificar las 14 elaboraciones actuales (datos)

**Files:**
- Create: `scripts/reclasificar-elaboraciones.ts`

**Interfaces:**
- Consumes: `categoriaElaboracion` (Task 1), `createServiceSupabase` de `lib/supabase-server.ts` o cliente de `@supabase/supabase-js` con `.env.local` (igual que otros scripts de `scripts/*.ts`; ejecutar con `npx tsx`).
- Produces: nada para otras tareas; deja los datos listos para Tasks 3-4.

- [ ] **Step 1: Implement** `scripts/reclasificar-elaboraciones.ts`: lee todas las recetas con `tipo_receta='salsa_base'` (paginar con `range`, no `limit` grande); para cada una calcula `categoriaElaboracion(nombre)`; si es `null` la lista como «sin categoría clara» y NO la toca; si no, prepara `{categoria, tipo_receta:'salsa_base'}`. Por defecto solo imprime la tabla `nombre · categoría actual → nueva`. Con `--apply`: guarda antes `salidas/26-10-2026_BACKUP-reclasificar-elaboraciones.json` (id, categoria, tipo_plato, tipo_receta anteriores) y aplica los updates. Además imprime (sin tocar) las «candidatas»: recetas aprobadas/en revisión con `tipo_receta<>'salsa_base'` para las que el clasificador devuelve algo, para que Carlos las revise.
- [ ] **Step 2: Simular** — `npx tsx scripts/reclasificar-elaboraciones.ts` — Expected: 14 filas; Turbo Poolish → `Elaboración base`, ninguna «sin categoría clara» (si alguna sale, ajustar las palabras de Task 1, no el script).
- [ ] **Step 3: Aplicar** — `npx tsx scripts/reclasificar-elaboraciones.ts --apply` — Expected: 14 actualizadas y el fichero de copia creado.
- [ ] **Step 4: Verify idempotencia y estado** — repetir el comando sin `--apply`: Expected: 0 cambios pendientes. Comprobar con una consulta (service role) el recuento por `categoria` para `tipo_receta='salsa_base'`: `Elaboración base` 1, `Salsa` y `Condimento` según el reparto del spec (`Salsa` 9, `Condimento` 4).
- [ ] **Step 5: Commit** — `git add scripts/reclasificar-elaboraciones.ts && git commit -m "feat: script para reclasificar elaboraciones en su categoría"` (la copia en `salidas/` está ignorada).

---

### Task 3: «Todos» no mezcla elaboraciones con platos (cliente y coach)

**Files:**
- Modify: `app/api/cliente/[codigo]/recetario/route.ts` (alrededor de las líneas 57-87: consulta y variante con ingredientes)
- Modify: `app/recetas/(revision)/page.tsx` (línea ~214: `matchCategoria`)
- Modify: `scripts/elaboraciones.test.ts` (añadir casos de la ruta si hay helper puro; ver Step 1)

**Interfaces:**
- Consumes: `CATEGORIAS_ELABORACION`, `categoriaCoincide` (Task 1).
- Produces: comportamiento: con categoría vacía/«Todos» y sin `q`, ni la API del cliente ni la Biblioteca devuelven las tres categorías; con `q` no vacío, sí.

- [ ] **Step 1: Write the failing test** — en `scripts/elaboraciones.test.ts` añadir `export`-free pruebas sobre `categoriaCoincide` ya cubiertas en Task 1, y una prueba de la regla que usa la ruta: extraer a `lib/recetas-constants.ts` la función `export function filtroExcluyeElaboraciones(categoria: string, q: string): boolean` (true cuando `categoria` es `''` o `'Todos'` y `q.trim()===''`) y probar: `('', '') → true`, `('Todos', '') → true`, `('Todos', 'poolish') → false`, `('Salsa', '') → false`.
- [ ] **Step 2: Run** `npx tsx scripts/elaboraciones.test.ts` — Expected: FAIL (función no definida).
- [ ] **Step 3: Implement** la función y usarla: en la ruta del cliente, si `filtroExcluyeElaboraciones(categoria, q)` añadir a la consulta `.not('categoria', 'in', '("Elaboración base","Salsa","Condimento")')` (en ambas consultas, la normal y la `conIngredientes`; construir la cadena desde `CATEGORIAS_ELABORACION`). En la Biblioteca sustituir la condición `categoria === 'Todos' || tagFilter !== null || r.categoria === categoria` por `tagFilter !== null || categoriaCoincide(r.categoria, categoria, palabrasBusqueda.length > 0)` (usar el nombre real de la variable de búsqueda del fichero). Comprobar que los chips de categoría de ambas pantallas salen de `CATEGORIAS` (ya importado) y por tanto muestran las dos nuevas sin más cambios.
- [ ] **Step 4: Run** `npx tsx scripts/elaboraciones.test.ts` — Expected: PASS. `npx tsc --noEmit --pretty false` (borrar `.next/types` antes si hay errores de rutas antiguas) — Expected: sin errores. `npx eslint "app/recetas/(revision)/page.tsx" "app/api/cliente/[codigo]/recetario/route.ts" lib/recetas-constants.ts` — Expected: sin errores nuevos.
- [ ] **Step 5: Verificación con datos reales** (solo lectura, script suelto con service role): contar recetas aprobadas devueltas por la consulta con exclusión frente a sin ella; Expected: la diferencia es 8 (las elaboraciones **aprobadas**, incluido el Poolish; las 6 restantes están en revisión) y «Turbo Poolish para Pizza Rápida» no está en la lista pero sí al filtrar `categoria=Elaboración base`.
- [ ] **Step 6: Commit** — `git add lib/recetas-constants.ts "app/api/cliente/[codigo]/recetario/route.ts" "app/recetas/(revision)/page.tsx" scripts/elaboraciones.test.ts && git commit -m "feat: Todos no mezcla elaboraciones con platos"`

---

### Task 4: El editor mantiene categoría y tipo_receta coherentes

**Files:**
- Modify: `app/recetas/[id]/editar/page.tsx` (el `update` de `recetas`, líneas ~247-262)
- Modify: `lib/recetas/tipo-receta.ts`
- Modify: `scripts/elaboraciones.test.ts`

**Interfaces:**
- Consumes: `esCategoriaElaboracion` (Task 1), `inferirTipoReceta` (existente).
- Produces: `export function tipoRecetaTrasCambioCategoria(r: { nombre: string; categoria: string | null; kcal?: number | null; proteinas?: number | null; tipoActual: string | null }): { tipo_receta: string | null; tipo_plato?: string }` en `lib/recetas/tipo-receta.ts`.

- [ ] **Step 1: Write the failing test** en `scripts/elaboraciones.test.ts`: categoría `Condimento` → `{ tipo_receta: 'salsa_base', tipo_plato: 'Salsa' }`; categoría `Comida` con `tipoActual: 'salsa_base'` y nombre «Pollo al horno» → `tipo_receta` igual a `inferirTipoReceta` del mismo (`'completa'`) y **sin** `tipo_plato`; categoría `Comida` con `tipoActual: 'completa'` → `tipo_receta: 'completa'` (no se toca lo que no es elaboración).
- [ ] **Step 2: Run** — Expected: FAIL.
- [ ] **Step 3: Implement** la función (una línea de criterio: si la categoría es de elaboración → fija los dos valores; si no y el tipo actual era `salsa_base` → recalcula con `inferirTipoReceta`; si no → devuelve el actual sin cambios). En el editor, añadir al `update` `tipo_receta` (y `tipo_plato` solo cuando la función lo devuelve) usando los macros ya cargados en `receta`. Sin tocar el resto de campos.
- [ ] **Step 4: Run** `npx tsx scripts/elaboraciones.test.ts` y `npx tsc --noEmit --pretty false` — Expected: PASS y sin errores.
- [ ] **Step 5: Commit** — `git add "app/recetas/[id]/editar/page.tsx" lib/recetas/tipo-receta.ts scripts/elaboraciones.test.ts && git commit -m "feat: el editor mantiene tipo_receta al cambiar a o desde una elaboración"`

---

### Task 5: Content Radar clasifica las elaboraciones al entrar

**Files** (repositorio `Content-Radar/`, no `nutricoach/`):
- Modify: `Content-Radar/scripts/receta_calidad.py`
- Modify: `Content-Radar/scripts/recipe_extractor.py` (prompt, líneas ~25-45)
- Modify: `Content-Radar/scripts/bridge_nutricoach.py` (bloque `receta_payload`, líneas ~1146-1166)
- Test: `Content-Radar/scripts/test_receta_calidad.py`

**Interfaces:**
- Produces en `receta_calidad.py`: `def inferir_categoria_elaboracion(nombre: str) -> str | None` con las mismas reglas y casos que `categoriaElaboracion` de Task 1 (misma lista de palabras; misma regla de «entre las dos primeras palabras y sin palabra de plato antes»). Devuelve `"Elaboración base"`, `"Salsa"`, `"Condimento"` o `None`.
- Consumes en el puente: `inferir_categoria_elaboracion`; `recipe.get("categoria")` del extractor.

- [ ] **Step 1: Write the failing test** en `test_receta_calidad.py` (seguir su estilo): los mismos 14 nombres reales, los extras y los negativos de Task 1, con los mismos resultados esperados.
- [ ] **Step 2: Run** `cd Content-Radar/scripts && python3 test_receta_calidad.py` — Expected: FAIL (función no definida).
- [ ] **Step 3: Implement** `inferir_categoria_elaboracion` y la decisión del puente: `cat_elab = inferir_categoria_elaboracion(nombre_receta) or (recipe.get("categoria") if recipe.get("categoria") in {"Elaboración base","Salsa","Condimento"} else None)`. Si `cat_elab`: `categoria = cat_elab`, `tipo_receta = "salsa_base"` (`tipo_plato` sigue el valor que ya calcula `inferir_tipos`) (la palabra clave gana sobre lo que diga la IA; si la IA devuelve una de las tres y la palabra clave no, se respeta la IA). Si no, el comportamiento actual sin cambios. `estado` sigue `en_revision`. En el prompt del extractor sustituir `Salsas` por `Elaboración base, Salsa, Condimento` en CATEGORÍAS VÁLIDAS y añadir una línea: «Usa Elaboración base para masas, fermentos (poolish, masa madre), caldos y fondos; Salsa para salsas, mayonesas, aliños y vinagretas; Condimento para mezclas de especias, adobos, marinadas y aceites aromáticos. Solo si la preparación se usa dentro de otras recetas y no es un plato por sí sola.»
- [ ] **Step 4: Run** `python3 test_receta_calidad.py` — Expected: PASS. Además `python3 -m py_compile bridge_nutricoach.py recipe_extractor.py receta_calidad.py` — Expected: sin salida.
- [ ] **Step 5: Commit** (en el repo de Content-Radar) — `git -C Content-Radar add scripts/receta_calidad.py scripts/recipe_extractor.py scripts/bridge_nutricoach.py scripts/test_receta_calidad.py && git -C Content-Radar commit -m "feat: el puente clasifica elaboraciones en su categoría"`. Si `Content-Radar` no es un repo propio, hacer el commit en el repo que lo contenga.

---

### Task 6: El importador de webs usa la misma regla

**Files:**
- Modify: `scripts/importar-lote-verificado.ts` (línea ~154, donde se compone `tipo_receta`)
- Modify: `scripts/elaboraciones.test.ts` solo si se extrae un helper puro

**Interfaces:**
- Consumes: `categoriaElaboracion` (Task 1).

- [ ] **Step 1: Implement** — localizar donde `importar-lote-verificado.ts` construye el insert de la receta y, antes de escribirlo, si `categoriaElaboracion(receta.nombre)` no es `null` o el lote ya declara una de las tres categorías, fijar `categoria` y `tipo_receta = 'salsa_base'` (sin tocar `tipo_plato`) (la categoría explícita del lote manda; si no hay, la inferida). Sin tocar el resto del flujo (`rol_ingrediente`, rechazo por kcal, `en_revision`).
- [ ] **Step 2: Verify** — simular con un lote mínimo de una sola receta llamada «Vinagreta de mostaza» y otra «Tostada de aguacate» usando el modo sin `--apply` de `importar-lote-verificado.ts` (ver `docs/23-10-2026_ingesta-recetas-web.md`): Expected: la primera sale con categoría `Salsa` y `tipo_receta salsa_base`, la segunda sin cambios. `npx tsc --noEmit --pretty false` — Expected: sin errores.
- [ ] **Step 3: Commit** — `git add scripts/importar-lote-verificado.ts && git commit -m "feat: el importador de webs clasifica elaboraciones"`

---

### Task 7: Revisión final y documentación

**Files:**
- Modify: `NUTRICION/CLAUDE.md` (fila nueva en la tabla de tareas) y `nutricoach/CLAUDE.md` (sección corta de la sesión)

- [ ] **Step 1: Verificar el conjunto** — `npx tsx scripts/elaboraciones.test.ts`, `npx tsx scripts/tipo-receta-criterios.test.ts`, `npx tsc --noEmit --pretty false`, `npm run verificar:motor` (toca el planificador solo indirectamente; Expected: todo OK) y `python3 Content-Radar/scripts/test_receta_calidad.py`. Comprobar que el planificador no ve las elaboraciones: `SLOT_CATEGORIAS` en `lib/plan-recetas.ts` no incluye ninguna de las tres categorías (Expected: correcto, sin cambios necesarios).
- [ ] **Step 2: Comprobar en pantalla** (Carlos, o con `browse --headed` + handoff): app cliente → Recetas → Archivo completo con «Todos» no muestra el Poolish ni las mayonesas; los chips **Elaboración base · Salsa · Condimento** sí; buscar «poolish» con «Todos» lo encuentra; la Biblioteca del coach se comporta igual.
- [ ] **Step 3: Documentar** y commit — fila en la tabla de `NUTRICION/CLAUDE.md` y sección en `nutricoach/CLAUDE.md` con lo hecho, lo pendiente (fases 2 y 3) y la lección; `git add` solo esas rutas y `git commit -m "docs: elaboraciones fase 1 (categorías y entrada por Radar)"`. Push a `main` según la práctica del proyecto.
