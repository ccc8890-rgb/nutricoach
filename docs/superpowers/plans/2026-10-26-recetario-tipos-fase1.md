# Recetario con tipos y familias — Fase 1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Que cada ficha del recetario tenga un **tipo** (plato o elaboración) y una **familia** de cocinero, que el recetario (cliente y coach) tenga un selector de tipo con chips por familia, y que las fichas nuevas (Content Radar, webs, editor) y las 55 de la cola de revisión caigan en su sitio.

**Architecture:** Dos columnas nuevas en `recetas` (`tipo_contenido`, `familia`). Un clasificador puro por nombre (TS y Python con los mismos casos) decide tipo y familia. `categoria` sigue siendo «cuándo se come» para los platos; en elaboraciones vale `Elaboración`. `tipo_receta='salsa_base'` se mantiene como marca interna para el planificador. Sustituye el filtro por categorías de la fase 1 de elaboraciones.

**Tech Stack:** Next.js (App Router, versión con cambios), Supabase (migración aditiva), tests con `npx tsx scripts/*.test.ts` (`node:assert`), Python 3 en `Content-Radar/scripts`.

**Spec:** `docs/superpowers/specs/2026-10-26-recetario-capas-y-tecnicas-design.md`. Quedan fuera de este plan (planes aparte): capa Estudio, técnicas, acceso profesional por cliente, alérgenos/Halal por elaboración.

## Global Constraints

- `tipo_contenido` ∈ `'plato' | 'elaboracion'` (no nulo, por defecto `'plato'`); toda elaboración lleva además `tipo_receta='salsa_base'` y `categoria='Elaboración'`.
- Familias de **elaboración**: `Panes y masas` · `Salsas` · `Condimentos y mezclas` · `Fondos y caldos` · `Grasas aromáticas` · `Mantequillas compuestas` · `Cremas y rellenos` · `Fermentos y curados`.
- Familias de **plato**: `Entrantes` · `Sopas y cremas` · `Verduras y ensaladas` · `Arroces` · `Pastas` · `Carnes` · `Pescados` · `Huevos` · `Bocadillos y bowls` · `Postres` · `Guarniciones`.
- `tipo_plato` NO se toca (la BD solo admite Desayuno, Almuerzo, Comida, Merienda, Cena, Snack, Postre). El planificador no cambia: sigue leyendo `categoria`/`tipo_receta`.
- Chips de «cuándo se come» para platos: `Todos · Desayuno · Comida · Cena · Merienda · Snack · Postre`.
- Selector de tipo: `PLATOS · ELABORACIONES · TODO` (Técnicas llega en otra fase). Por defecto `PLATOS`; si hay texto de búsqueda y el usuario no ha elegido tipo, se busca en `TODO`.
- Parámetros de URL: `tipo` (`platos`|`elaboraciones`|`todo`), `fam` (familia), `cat` (momento, solo platos). Los enlaces antiguos `?cat=Salsa|Condimento|Elaboración base` se traducen a `tipo=elaboraciones` + familia (`Salsa`→`Salsas`, `Condimento`→`Condimentos y mezclas`, `Elaboración base`→`Panes y masas`).
- Cambios de datos con script: simular por defecto, copia en `salidas/DD-MM-YYYY_BACKUP-*.json`, `--apply` para escribir; idempotente. Migraciones a producción solo con `supabase db query --linked -f <archivo>`.
- Los `.ts` de `scripts/` no admiten `await` de nivel superior con tsx: envolver en `main()`.
- Estilo: el editorial existente (`rc-cats`/`rc-cat`, `FiltroMenu`); sin cajas de colores nuevas. Textos de interfaz en castellano. Sin `err.message` al cliente.

## Review Focus

- **Una elaboración nunca se cuela entre los platos ni en el planificador** (con tipo `platos` y con «Todos» de la barra antigua). Test en Task 3 y comprobación con datos reales.
- **Búsqueda de «poolish»/«brioche» sin haber elegido tipo** encuentra la elaboración. Test en Task 3.
- **Pan con tomate**, **Tostada de pan integral**, **Pollo con salsa barbacoa**: son platos, no elaboraciones. Test en Task 1 (y su espejo en Task 5).
- **Enlaces antiguos** `?cat=Salsa` no dejan una pantalla vacía. Test en Task 1/3.
- **Reejecutar los scripts de datos** no cambia nada la segunda vez. Comprobación en Task 2.
- **Cambiar de elaboración a plato en el editor** devuelve `categoria` válida y quita `salsa_base`. Test en Task 4.

---

### Task 1: Migración, constantes y clasificador

**Files:**
- Create: `supabase/migrations/20261026200000_recetas_tipo_familia.sql`
- Create: `lib/recetas/clasificacion.ts`
- Modify: `lib/recetas-constants.ts` (líneas 4-30 de la fase 1: `CATEGORIAS`, `CATEGORIAS_ELABORACION`, `esCategoriaElaboracion`, `categoriaCoincide`, `filtroExcluyeElaboraciones`, `SUBCATEGORIAS`)
- Modify: `lib/recetas/tipo-receta.ts` (quitar `categoriaElaboracion` y `tipoRecetaTrasCambioCategoria`, que pasan a `clasificacion.ts`)
- Test: `scripts/clasificacion.test.ts` (sustituye a `scripts/elaboraciones.test.ts`, que se borra)

**Interfaces:**
- Produces en `lib/recetas-constants.ts`: `export const FAMILIAS_ELABORACION = [...] as const`, `export const FAMILIAS_PLATO = [...] as const`, `export const CATEGORIAS_PLATO = ['Todos','Desayuno','Comida','Cena','Merienda','Snack','Postre'] as const`; se eliminan `CATEGORIAS_ELABORACION`, `esCategoriaElaboracion`, `categoriaCoincide` y `filtroExcluyeElaboraciones`; `CATEGORIAS` pierde `Elaboración base` y `Condimento`.
- Produces en `lib/recetas/clasificacion.ts`:
  - `export type TipoContenido = 'plato' | 'elaboracion'`
  - `export type TipoVista = 'platos' | 'elaboraciones' | 'todo'`
  - `export function familiaElaboracion(nombre: string): (typeof FAMILIAS_ELABORACION)[number] | null`
  - `export function familiaPlato(r: { nombre: string; categoria?: string | null; tags?: string[] | null; tipo_receta?: string | null }): (typeof FAMILIAS_PLATO)[number] | null`
  - `export function clasificarFicha(r: { nombre: string; categoria?: string | null; tags?: string[] | null; tipo_receta?: string | null }): { tipo_contenido: TipoContenido; familia: string | null }`
  - `export function camposAlCambiarTipo(r: { nombre: string; tipo: TipoContenido; familia: string | null; categoria: string | null; kcal?: number | null; proteinas?: number | null; tipoRecetaActual: string | null }): { tipo_contenido: TipoContenido; familia: string | null; categoria: string | null; tipo_receta: string | null }` — elaboración: `categoria 'Elaboración'`, `tipo_receta 'salsa_base'`; plato: si venía de `salsa_base` recalcula `tipo_receta` con `inferirTipoReceta` y, si `categoria` es `'Elaboración'` o nula, la deja en `null` para que la elija quien edita.
  - `export function tipoEfectivo(tipoUrl: string | null, buscando: boolean): TipoVista` — `tipoUrl` válido gana; si no, `todo` cuando `buscando`, si no `platos`.
  - `export function visibleEnTipo(r: { tipo_contenido?: string | null }, tipo: TipoVista): boolean`
  - `export function migrarCategoriaAntigua(cat: string | null): { tipo: TipoVista; familia: string | null } | null` — traduce `Salsa`, `Condimento`, `Elaboración base` (ver Global Constraints); otro valor → `null`.

- [ ] **Step 1: Write the failing test** `scripts/clasificacion.test.ts`:
  - `familiaElaboracion`: «Turbo Poolish para Pizza Rápida», «Pan de hamburguesa de puré de papa», «Pan plano sin amasado con mantequilla de ajo», «Brioche», «Focaccia sin amasar con romero», «Masa madre de centeno» → `Panes y masas`; «Mayonesa de camarón», «Mayonesa de camarones», «Ajonesa de huevo cocido», «Mayonesa de albahaca de huevo cocido», «Mayonesa picante de huevo cocido», «Chimichurri», «Salsa de Hamburguesa y Salsa de Trufa», «Salsa de queso cheddar fit», «Salsas de yogur altas en proteína», «Hollandaise en bolsa», «Pesto de rúcula», «Vinagreta de mostaza», «Hummus clásico» → `Salsas`; «Mix de especias barbacoa», «Adobo de pollo», «Marinada de yogur», «Marinado mayak de verduras y aceitunas», «Sazonador para carne» → `Condimentos y mezclas`; «Demi-Glace Vegetal», «Caldo de huesos», «Fondo de ave» → `Fondos y caldos`; «Aceite de Cebollino», «Aceite verde de hierbas», «Chili oil casero» → `Grasas aromáticas`; «Mantequilla Café de París» → `Mantequillas compuestas`; «Ganache de caramelo y café», «Caramelo salado sin azúcar» → `Cremas y rellenos`; «Yema curada ahumada», «Kimchi casero» → `Fermentos y curados`.
  - `familiaElaboracion` devuelve `null` para: «Pan con tomate», «Pollo con salsa barbacoa», «Salmón al Horno con Espárragos y Vinagreta», «Pizza rápida», «Tostada de aguacate», «Tostada de pan integral con aguacate», «Palitos de Zanahoria con Hummus Casero», «Pasta con pesto», «Wraps de filete proteicos con pan plano de yogur», «Puré de zanahoria con mantequilla avellana».
  - `familiaPlato`: «Firecracker Beef and Broccoli» → `Carnes`; «Arroz de montaña con butifarra, costilla de cerdo y trompetas de la muerte» → `Arroces`; «Puré de zanahoria con mantequilla avellana» (con `tipo_receta: 'guarnicion'`) → `Guarniciones`; «Babă Neagră moldava (pastel panal)» con `categoria: 'Postre'` → `Postres`; «Bao perezoso» → `Bocadillos y bowls`; «Ñoquis crujientes con Gula del Norte y tomates cherry» → `Pastas`; «Tortilla de espinacas y champiñones con tomate» → `Huevos`; «Bowl de salmón con aguacate y edamame» → `Bocadillos y bowls`; «Gazpacho andaluz» → `Sopas y cremas`; «Ensalada de quinoa con aguacate y granada» → `Verduras y ensaladas`; «Merluza al horno con limón» → `Pescados`; «Buñuelo relleno crujiente» con `categoria: 'Entrante'` → `Entrantes`; un nombre sin pistas («Tofu Lava») → `null`.
  - `clasificarFicha`: «Brioche» → `{ tipo_contenido: 'elaboracion', familia: 'Panes y masas' }`; «Bao perezoso» → `{ tipo_contenido: 'plato', familia: 'Bocadillos y bowls' }`; «Tofu Lava» → `{ tipo_contenido: 'plato', familia: null }`.
  - `camposAlCambiarTipo`: tipo `elaboracion` → `categoria 'Elaboración'`, `tipo_receta 'salsa_base'`, `familia` conservada; tipo `plato` con `tipoRecetaActual 'salsa_base'`, nombre «Pollo al horno», categoría `'Elaboración'` → `categoria null` y `tipo_receta` igual a `inferirTipoReceta` de ese nombre; tipo `plato` con `tipoRecetaActual 'completa'` y categoría `Comida` → sin cambios (`tipo_receta 'completa'`, `categoria 'Comida'`).
  - `tipoEfectivo('elaboraciones', true) === 'elaboraciones'`, `tipoEfectivo(null, true) === 'todo'`, `tipoEfectivo(null, false) === 'platos'`, `tipoEfectivo('xx', false) === 'platos'`.
  - `visibleEnTipo({tipo_contenido:'elaboracion'}, 'platos') === false`, con `'elaboraciones'` y `'todo'` true; `visibleEnTipo({tipo_contenido: null}, 'platos') === true` (sin dato = plato).
  - `migrarCategoriaAntigua('Salsa')` → `{tipo:'elaboraciones', familia:'Salsas'}`; `'Condimento'` → `Condimentos y mezclas`; `'Elaboración base'` → `Panes y masas`; `'Comida'` → `null`.
- [ ] **Step 2: Run** `npx tsx scripts/clasificacion.test.ts` — Expected: FAIL (módulo no existe).
- [ ] **Step 3: Implement.** Migración: `add column if not exists tipo_contenido text not null default 'plato' check (tipo_contenido in ('plato','elaboracion'))`, `add column if not exists familia text`, índice `(tipo_contenido, familia)`, `update recetas set tipo_contenido='elaboracion' where tipo_receta='salsa_base'`, y comentario con la reversión. `familiaElaboracion`: reglas por palabra entre las **dos primeras** palabras (normalizadas sin tildes), sin palabra de plato (`PLATO` de `tipo-receta.ts`) antes; «pan» solo cuenta si la palabra siguiente no es «con»; listas de palabras por familia: base = pan, brioche, focaccia, masa, poolish, levain, prefermento; salsas = salsa(s), mayonesa(s), ajonesa, alioli, aliño, vinagreta, chimichurri, pesto, hummus, guacamole, tahini, ketchup, aderezo, dressing, mostaza, hollandaise, holandesa, bechamel, velouté, bearnesa; condimentos = mix, adobo(s), marinada, marinado, especias, sazonador, rub; fondos = fondo, caldo, demi, glace; grasas = aceite, chili, oil; mantequillas = mantequilla; cremas = ganache, caramelo, relleno, praliné, confitura; fermentos = curado/a/os/as, yema curada, kimchi, miso, kombucha, encurtido(s), fermentado. `familiaPlato`: prioridad fija — Postres (categoría `Postre` o nombre con tarta, brownie, mousse, helado, dona/donut, galleta, cookie, bizcocho, pudding, natillas, flan, pastel) → Sopas y cremas (sopa, gazpacho, salmorejo, «crema de») → Bocadillos y bowls (bowl, wrap, sandwich, sándwich, burrito, tostada, tosta, bocadillo, burger, hamburguesa, bao, kebab, taco) → Arroces (arroz, risotto, paella) → Pastas (pasta, ñoquis, noodles, tallarines, espaguetis, macarrones, lasaña, udon) → Huevos (huevo, tortilla, revuelto) → Guarniciones (`tipo_receta='guarnicion'` o «puré») → Pescados (pescado, salmón, atún, merluza, bacalao, gambas, dorada, lubina) → Carnes (pollo, ternera, cerdo, carne, beef, chicken, pork, cordero, filete, carrillera) → Verduras y ensaladas (ensalada, verdura, calabacín, berenjena, brócoli, coliflor) → Entrantes (categoría `Entrante`, croqueta, buñuelo) → `null`. También sirven las `tags` (`Pollo`→Carnes, `Pescado`→Pescados, `Arroz`→Arroces, `Pasta`→Pastas, `Sopa`→Sopas y cremas, `Huevo`→Huevos, `Ensalada`→Verduras y ensaladas, `Bowl`/`Wrap`/`Sandwich`/`Tostada`→Bocadillos y bowls) cuando el nombre no decide. En `recetas-constants.ts` sustituir lo que dice «Produces». Borrar `scripts/elaboraciones.test.ts` y las funciones eliminadas.
- [ ] **Step 4: Aplicar migración y comprobar** — `supabase db query --linked -f supabase/migrations/20261026200000_recetas_tipo_familia.sql`; consulta de verificación: dos columnas existen y `select count(*) from recetas where tipo_contenido='elaboracion'` = 14.
- [ ] **Step 5: Run** `npx tsx scripts/clasificacion.test.ts` y `npx tsx scripts/tipo-receta-criterios.test.ts` — Expected: PASS. `npx tsc --noEmit --pretty false` mostrará errores en los consumidores eliminados (se arreglan en Tasks 3-6): anotarlos, no corregirlos aquí.
- [ ] **Step 6: Commit** — `git add supabase/migrations/20261026200000_recetas_tipo_familia.sql lib/recetas/clasificacion.ts lib/recetas-constants.ts lib/recetas/tipo-receta.ts scripts/clasificacion.test.ts && git rm scripts/elaboraciones.test.ts && git commit -m "feat: tipo y familia de ficha (modelo y clasificador)"`

---

### Task 2: Clasificar lo que ya existe (datos)

**Files:**
- Create: `scripts/clasificar-recetario.ts`
- Delete: `scripts/reclasificar-elaboraciones.ts` (queda obsoleto)

**Interfaces:**
- Consumes: `clasificarFicha`, `familiaElaboracion` (Task 1); cliente Supabase de servicio con `.env.local`.

- [ ] **Step 1: Implement** `scripts/clasificar-recetario.ts [--apply]` (con `main()`, paginando con `range`): para todas las recetas no descartadas:
  1. **Elaboraciones ya marcadas** (`tipo_receta='salsa_base'`) y **fichas en `en_revision`** que `familiaElaboracion` reconozca: fijar `{ tipo_contenido: 'elaboracion', familia, categoria: 'Elaboración', tipo_receta: 'salsa_base' }`.
  2. **Platos** (todo lo demás sin `familia`): fijar solo `{ familia }` cuando `familiaPlato` la dé; sin pistas se deja `null`.
  3. **No tocar** recetas `aprobada` que `familiaElaboracion` reconozca pero que hoy sean platos: listarlas como «candidatas a elaboración» para que Carlos decida.
  Simulación por defecto: imprime recuentos por tipo y familia, las que quedan sin familia, las candidatas, y las que cambian de tipo en la cola. Con `--apply`: copia previa `salidas/26-10-2026_BACKUP-clasificar-recetario.json` (id, tipo_contenido, familia, categoria, tipo_receta anteriores de las filas que cambian) y updates por lotes.
- [ ] **Step 2: Simular** — `npx tsx scripts/clasificar-recetario.ts` — Expected: 14 elaboraciones existentes + las de la cola con familia asignada (entre ellas Brioche, Pan de hamburguesa, Pan plano, Demi-Glace, Hollandaise, Mantequilla Café de París, Ganache, Caramelo salado, Yema curada, Marinado mayak); «Wraps de filete proteicos…», «Puré de zanahoria…», «Bao perezoso» siguen como platos; ningún plato `aprobada` cambia de tipo.
- [ ] **Step 3: Aplicar** — `npx tsx scripts/clasificar-recetario.ts --apply`; repetir sin `--apply`: Expected: 0 cambios pendientes. Verificar con consulta: `tipo_contenido='elaboracion'` coincide con lo listado y ningún `tipo_receta='salsa_base'` quedó como `plato`.
- [ ] **Step 4: Commit** — `git add scripts/clasificar-recetario.ts && git rm scripts/reclasificar-elaboraciones.ts && git commit -m "feat: script para clasificar el recetario por tipo y familia"`

---

### Task 3: Selector de tipo y chips por familia (cliente y coach)

**Files:**
- Modify: `app/api/cliente/[codigo]/recetario/route.ts` (filtros de categoría de la fase 1, ~líneas 64-70 y ~90)
- Modify: `components/PortalCliente/RecetarioExplorador.tsx` (estado ~líneas 101-106 y 126, petición ~183-187, chips ~229-240, filtros ~241+)
- Modify: `app/recetas/(revision)/page.tsx` (estado ~139, `select` ~168, `matchCategoria` ~214, chips ~429-450, `FiltroMenu` ~463+)
- Test: `scripts/clasificacion.test.ts` (casos de URL/ruta)

**Interfaces:**
- Consumes: `tipoEfectivo`, `visibleEnTipo`, `migrarCategoriaAntigua` (Task 1); `FAMILIAS_ELABORACION`, `FAMILIAS_PLATO`, `CATEGORIAS_PLATO`.
- Produces: la API del cliente acepta `tipo` (`platos`|`elaboraciones`|`todo`, por defecto `platos`) y `familia`; `GET …/recetario?tipo=elaboraciones&familia=Salsas`.

- [ ] **Step 1: Write the failing test** (en `scripts/clasificacion.test.ts`): `migrarCategoriaAntigua` ya cubierto; añadir una función pura `export function filtrosRecetarioDeUrl(p: { tipo: string | null; cat: string | null; fam: string | null; buscando: boolean }): { tipo: TipoVista; categoria: string; familia: string | null }` en `lib/recetas/clasificacion.ts` que aplica `tipoEfectivo`, traduce `cat` antiguo (si `migrarCategoriaAntigua(cat)` no es `null` devuelve su tipo/familia y `categoria 'Todos'`) y, si el tipo no es `platos`, fuerza `categoria 'Todos'`. Casos: `{tipo:null,cat:'Salsa',fam:null,buscando:false}` → `{tipo:'elaboraciones',categoria:'Todos',familia:'Salsas'}`; `{tipo:null,cat:'Cena',fam:'Carnes',buscando:false}` → `{tipo:'platos',categoria:'Cena',familia:'Carnes'}`; `{tipo:null,cat:null,fam:null,buscando:true}` → `{tipo:'todo',…}`; `{tipo:'elaboraciones',cat:'Cena',fam:'Salsas',buscando:false}` → `categoria 'Todos'`.
- [ ] **Step 2: Run** — Expected: FAIL.
- [ ] **Step 3: Implement.** Función pura; ruta del cliente: `tipo`→`.eq('tipo_contenido', …)` (no se filtra con `todo`), `familia`→`.eq('familia', …)`, `categoria` solo se aplica cuando `tipo` es `platos`; quitar la exclusión por categorías de la fase 1 en ambas consultas. Explorador: estado `tipo` y `fam` con `useEstadoUrl` (`'tipo'`, `'fam'`; `tipo` nulo por defecto), efectivos vía `filtrosRecetarioDeUrl`; fila nueva de selector (mismas clases `rc-cats`/`rc-cat`, rótulos `PLATOS · ELABORACIONES · TODO`) encima de los chips; chips: `CATEGORIAS_PLATO` para platos, `['Todas', …FAMILIAS_ELABORACION]` para elaboraciones, ninguno para todo; grupo nuevo «Familia» (`FAMILIAS_PLATO`) en `.rc-filtros` solo en platos; los parámetros `tipo`/`familia` se envían a la API y entran en las dependencias del efecto de carga. Biblioteca del coach: añadir `tipo_contenido, familia` al `select`, mismo selector y chips, `FiltroMenu` «Familia», filtro en memoria con `visibleEnTipo` y `familia`; quitar `categoriaCoincide`.
- [ ] **Step 4: Run** `npx tsx scripts/clasificacion.test.ts`, `npx tsc --noEmit --pretty false` (los errores de Task 1 en estos ficheros deben desaparecer), `npx eslint` de los tres ficheros, `npx tsx scripts/cliente-visual-system.test.ts` — Expected: sin errores.
- [ ] **Step 5: Verificar con datos reales** (script de solo lectura con service role): con `tipo=platos` ninguna ficha `elaboracion` aparece; con `tipo=elaboraciones&familia=Salsas` salen las salsas reclasificadas; con `todo` aparecen ambos; contar recetas aprobadas por tipo.
- [ ] **Step 6: Commit** — `git add lib/recetas/clasificacion.ts "app/api/cliente/[codigo]/recetario/route.ts" components/PortalCliente/RecetarioExplorador.tsx "app/recetas/(revision)/page.tsx" scripts/clasificacion.test.ts && git commit -m "feat: selector de tipo y familias en el recetario"`

---

### Task 4: Editor — tipo y familia al crear y editar

**Files:**
- Modify: `app/recetas/[id]/editar/page.tsx` (selector de categoría ~líneas 495-505, `update` ~255-265 y la lógica de `tipoRecetaTrasCambioCategoria` de la fase 1)
- Modify: `app/recetas/nueva/page.tsx` (selector ~línea 228 y el insert)
- Test: `scripts/clasificacion.test.ts` (ya cubre `camposAlCambiarTipo`)

**Interfaces:**
- Consumes: `camposAlCambiarTipo`, `FAMILIAS_ELABORACION`, `FAMILIAS_PLATO`, `CATEGORIAS_PLATO` (Task 1).

- [ ] **Step 1: Implement** en ambos formularios: selector «Tipo» (`Plato` / `Elaboración`) y selector «Familia» dependiente (lista del tipo, con opción vacía); si el tipo es elaboración el selector de «Categoría» se oculta (`categoria` queda `Elaboración`); si es plato, el selector usa `CATEGORIAS_PLATO` sin `Todos`. Al guardar se escriben `tipo_contenido`, `familia`, `categoria`, `tipo_receta` con `camposAlCambiarTipo`. En el editor, el valor inicial sale de la receta. En «nueva», `tipo` por defecto `plato`, y al escribir el nombre se **propone** (sin imponer) la clasificación con `clasificarFicha` (texto «Parece una elaboración: Salsas», con botón «Usar»). Quitar de `recetas/[id]/editar` la importación de `tipoRecetaTrasCambioCategoria` y `esCategoriaElaboracion`; `components/recetas/EdicionRapida.tsx` (sin uso) se deja salvo que deje de compilar por el cambio de `CATEGORIAS`.
- [ ] **Step 2: Run** `npx tsc --noEmit --pretty false`, `npx eslint` de los dos ficheros, `npx tsx scripts/clasificacion.test.ts` — Expected: sin errores.
- [ ] **Step 3: Verificar en pantalla** (Carlos o `browse --headed` + handoff): abrir «Pan de hamburguesa de puré de papa» (ya clasificado en Task 2) → Tipo Elaboración, Familia Panes y masas; cambiar a Plato y guardar devuelve `tipo_receta` calculado y obliga a elegir categoría; deshacer.
- [ ] **Step 4: Commit** — `git add "app/recetas/[id]/editar/page.tsx" app/recetas/nueva/page.tsx && git commit -m "feat: el editor de recetas elige tipo y familia"`

---

### Task 5: Content Radar y webs clasifican al entrar

**Files** (repositorio `Content-Radar/`, salvo la última línea):
- Modify: `Content-Radar/scripts/receta_calidad.py` (sustituye `inferir_categoria_elaboracion`)
- Modify: `Content-Radar/scripts/bridge_nutricoach.py` (bloque de la fase 1, ~líneas 1146-1175)
- Modify: `Content-Radar/scripts/recipe_extractor.py` (lista de categorías del prompt)
- Modify: `Content-Radar/scripts/notion_recetario_sync.py` (`_VALID_CATEGORIAS`)
- Test: `Content-Radar/scripts/test_receta_calidad.py`
- Modify: `nutricoach/scripts/importar-lote-verificado.ts` (bloque de la fase 1, ~línea 150)

**Interfaces:**
- Produces en `receta_calidad.py`: `def familia_elaboracion(nombre: str) -> str | None` y `def familia_plato(nombre: str, categoria: str | None = None, tags: list[str] | None = None, tipo_receta: str | None = None) -> str | None`, `def clasificar_ficha(nombre, categoria=None, tags=None, tipo_receta=None) -> tuple[str, str | None]` (tipo_contenido, familia); mismas reglas y mismos casos que `lib/recetas/clasificacion.ts`.
- El `receta_payload` del puente añade `tipo_contenido` y `familia`; para elaboraciones `categoria='Elaboración'` y `tipo_receta='salsa_base'`.

- [ ] **Step 1: Write the failing test** en `test_receta_calidad.py`: los mismos casos de Task 1 (`familiaElaboracion` positivos y negativos, `familiaPlato` y `clasificarFicha`), llamando a las funciones Python con los mismos resultados.
- [ ] **Step 2: Run** `cd Content-Radar && python3 scripts/test_receta_calidad.py` — Expected: FAIL (funciones no definidas).
- [ ] **Step 3: Implement** las funciones Python con las mismas listas de palabras y prioridades; en el puente: `tipo, familia = clasificar_ficha(nombre_receta, recipe.get("categoria"), tags)`; si el extractor ya devuelve una `categoria` de elaboración antigua (`Salsa`, `Condimento`, `Elaboración base`), traducirla con el mismo mapa que `migrarCategoriaAntigua`; la palabra clave gana sobre la IA; elaboración → `categoria 'Elaboración'`, `tipo_receta 'salsa_base'`; las fichas siguen entrando en `en_revision`. Prompt del extractor: describir las 8 familias de elaboración (y pedir `Elaboración` solo si la preparación se usa dentro de otras recetas). `_VALID_CATEGORIAS` de Notion: añadir `Elaboración`. Importador de webs: llamar a `clasificarFicha` y fijar `tipo_contenido`, `familia`, y para elaboraciones `categoria`/`tipo_receta` (sin tocar `tipo_plato`).
- [ ] **Step 4: Run** `python3 scripts/test_receta_calidad.py` y `python3 -m py_compile scripts/bridge_nutricoach.py scripts/recipe_extractor.py scripts/receta_calidad.py scripts/notion_recetario_sync.py` — Expected: PASS y sin salida. En `nutricoach`: `npx tsc --noEmit --pretty false`.
- [ ] **Step 5: Commit** — `git -C Content-Radar add` de esos cuatro ficheros más el test `&& git -C Content-Radar commit -m "feat: el puente clasifica tipo y familia de la ficha"`; en `nutricoach`: `git add scripts/importar-lote-verificado.ts && git commit -m "feat: el importador de webs clasifica tipo y familia"`.

---

### Task 6: Cola de revisión, verificación y documentación

**Files:**
- Modify: `lib/recetas/revision.ts` (añadir `tipo_contenido, familia` al `select`)
- Modify: `app/recetas/(revision)/revisar/page.tsx` (tarjeta y fila: etiqueta de tipo, líneas ~397 y ~408; tipo `RecetaRevision` ~línea 19)
- Modify: `CLAUDE.md` (raíz `NUTRICION/`) y `nutricoach/CLAUDE.md`

**Interfaces:**
- Consumes: columnas de Task 1.

- [ ] **Step 1: Implement** en la cola: el subtítulo de cada ficha muestra `Elaboración · {familia}` cuando `tipo_contenido='elaboracion'` y `{tipo_plato ?? categoria} · {familia}` cuando es plato y tiene familia. Sin cambios en acciones ni filtros.
- [ ] **Step 2: Verificación global:** `npx tsx scripts/clasificacion.test.ts`, `npx tsx scripts/tipo-receta-criterios.test.ts`, `npx tsx scripts/elaboraciones-enlace.test.ts`, `npx tsx scripts/recetas-solo-aprobadas.test.ts`, `npx tsx scripts/menu-recetario.test.ts`, `npm run verificar:motor`, `npx tsc --noEmit --pretty false`, `python3 Content-Radar/scripts/test_receta_calidad.py` — Expected: todo OK (63/63 en el motor).
- [ ] **Step 3: Comprobar en pantalla** (Carlos): recetario del cliente → selector Platos/Elaboraciones/Todo, chips por familia, buscar «brioche» sin elegir tipo; Biblioteca del coach igual; cola «Por revisar» con las etiquetas de tipo; abrir «Pan de hamburguesa…» y aprobarlo.
- [ ] **Step 4: Documentar y subir:** fila en la tabla de `NUTRICION/CLAUDE.md` y sección en `nutricoach/CLAUDE.md` (hecho, decisiones, pendientes: fases 2-5 del diseño, candidatas a elaboración entre las aprobadas, recetas sin familia). Commits separados por repositorio (`NUTRICION/` y `nutricoach/` son repos distintos) y `git push origin main` en `nutricoach`; comprobar el despliegue con `vercel ls --yes`.
