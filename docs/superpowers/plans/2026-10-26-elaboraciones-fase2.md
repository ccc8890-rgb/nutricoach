# Elaboraciones — Fase 2 (enlace como ingrediente) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Que una receta pueda llevar una elaboración (poolish, masa, salsa, adobo…) como ingrediente enlazado, y que macros, lista de la compra, escandallo y comidas de los planes cuenten correctamente sus ingredientes base.

**Architecture:** `receta_ingredientes` gana `elaboracion_id` (una línea es un alimento, una elaboración o texto libre). Una función pura **aplana** las líneas de elaboración a sus ingredientes base escalando por gramos y por `peso_final_g`; una función de servidor la aplica a cualquier lista de líneas con la misma forma que hoy devuelve Supabase, de modo que cada lector (compra, escandallo, planes, macros) solo añade una llamada. Al cambiar una elaboración se recalculan las recetas que la usan.

**Tech Stack:** Next.js (App Router, versión con cambios), Supabase (migración aditiva), tests con `npx tsx scripts/*.test.ts` (`node:assert`).

**Spec:** `docs/superpowers/specs/2026-10-26-elaboraciones-design.md` (sección «Fase 2»). Fase 1 en `docs/superpowers/plans/2026-10-26-elaboraciones-fase1.md` (hecha). La **clasificación completa** (tipo Plato/Elaboración/Técnica, familias de cocinero) y las **alérgenos/Halal por elaboración** son planes aparte.

## Global Constraints

- Una elaboración es una receta con `tipo_receta = 'salsa_base'` y `estado = 'aprobada'`; solo esas se pueden enlazar.
- En cada línea, como máximo uno de `alimento_id` y `elaboracion_id` (check en BD).
- Profundidad máxima de anidación: 2 (una elaboración dentro de una elaboración dentro de una receta). Sin ciclos.
- Fórmula única de macros: suma de `valor_por_100g × gramos / 100` de las líneas base, dividida por `porciones` para la receta. En una elaboración, valores por 100 g = totales / `peso_final_g` × 100; `peso_final_g` vacío = suma de los gramos de sus líneas.
- Cantidades de `receta_ingredientes` son de la receta ENTERA (no por ración).
- Migraciones a producción solo con `supabase db query --linked -f <archivo>` (no `db push`). Migración aditiva y con bloque de reversión en comentarios.
- Los lectores que no expanden elaboraciones no deben fallar: ven una línea sin alimento (como un ingrediente libre) y la receta queda marcada `Revisar alérgenos` (ver Task 3).
- Clientes de Supabase en rutas: `createServiceSupabase` / `createApiSupabase` de `lib/supabase-server.ts` (nunca `createClient` suelto); rutas de coach con `autorizarCoach` de `lib/contenido/auth.ts`. Sin `err.message` al cliente.
- Cambios de datos con script: simular, copia en `salidas/`, aplicar. Textos de interfaz en castellano; estilo editorial sin cajas de colores.

## Review Focus

- **Ciclo A→B→A:** guardar un enlace que lo cree debe rechazarse con mensaje claro, sin dejar datos a medias. Test en Task 2 y comprobación en Task 4.
- **Elaboración con 0 g o sin ingredientes enlazados:** no divide por cero; la línea cuenta 0 kcal y se avisa. Test en Task 2.
- **Cambiar `peso_final_g` o un ingrediente de la elaboración** cambia los macros de todas las recetas que la usan (también las de segundo nivel). Test en Task 3.
- **Lista de la compra con la elaboración:** no pierde ni duplica ingredientes (la harina de la masa aparece una vez, sumada con la de la receta). Test en Task 6.
- **Borrar o descartar una elaboración en uso:** la BD lo impide (`on delete restrict`) y la pantalla muestra un mensaje comprensible, no un error genérico. Comprobación en Task 5.

---

### Task 1: Migración — `elaboracion_id` y `peso_final_g`

**Files:**
- Create: `supabase/migrations/20261026100000_elaboraciones_enlace.sql`

**Interfaces:**
- Produces: columnas `receta_ingredientes.elaboracion_id uuid null references recetas(id) on delete restrict`, `recetas.peso_final_g numeric null check (peso_final_g > 0)`, check `receta_ingredientes_alimento_o_elaboracion` (`not (alimento_id is not null and elaboracion_id is not null)`), índice `receta_ingredientes_elaboracion_idx`.

- [ ] **Step 1: Write** el SQL aditivo con `add column if not exists`, el check, el índice y un comentario final con la reversión (`alter table … drop column …`).
- [ ] **Step 2: Apply** — `supabase db query --linked -f supabase/migrations/20261026100000_elaboraciones_enlace.sql` — Expected: sin error.
- [ ] **Step 3: Verify** — consulta a `information_schema.columns` para ambas columnas y a `pg_constraint` para el check — Expected: las dos columnas existen, check presente; `select count(*) from receta_ingredientes where elaboracion_id is not null` = 0.
- [ ] **Step 4: Commit** — `git add supabase/migrations/20261026100000_elaboraciones_enlace.sql && git commit -m "feat: columnas para enlazar elaboraciones como ingrediente"`

---

### Task 2: Aplanado puro de elaboraciones

**Files:**
- Create: `lib/recetas/elaboraciones.ts`
- Create: `scripts/elaboraciones-enlace.test.ts`

**Interfaces:**
- Produces:
  - `export type Linea = { id?: string; alimento_id?: string | null; elaboracion_id?: string | null; nombre_libre?: string | null; cantidad_gramos: number; orden?: number | null; es_opcional?: boolean | null; alimento?: AlimentoMacros | null }` con `AlimentoMacros = { id?: string; nombre?: string; calorias: number; proteinas: number; carbohidratos: number; grasas: number; fibra?: number | null }`
  - `export type Elaboracion = { peso_final_g: number | null; lineas: Linea[] }`
  - `export class CicloElaboracion extends Error {}` (mensaje: «Esa elaboración ya contiene a esta receta»)
  - `export function pesoFinal(e: Elaboracion): number` — `peso_final_g` si > 0; si no, suma de `cantidad_gramos` de sus líneas (opcionales a 0 g no suman).
  - `export function aplanarLineas(lineas: Linea[], elaboraciones: Map<string, Elaboracion>, opciones?: { maxProfundidad?: number; raiz?: string }): { lineas: Linea[]; sinResolver: string[] }` — sustituye cada línea con `elaboracion_id` por las líneas base de esa elaboración escaladas por `cantidad_gramos / pesoFinal(e)`; las líneas conservan `alimento`, `alimento_id`, `nombre_libre`; `id` pasa a `${idLinea}:${idHija}`; `orden` hereda el de la línea. Lanza `CicloElaboracion` si una elaboración se contiene a sí misma o a `raiz`. Profundidad > `maxProfundidad` (por defecto 2): las líneas más hondas se dejan sin expandir y su id va a `sinResolver`. Elaboración ausente en el mapa o con `pesoFinal` 0: la línea se elimina y su id va a `sinResolver`.
  - `export function macrosPor100g(lineas: Linea[], pesoFinalG: number): { kcal: number; proteinas: number; carbohidratos: number; grasas: number; fibra: number }` — sobre líneas ya planas, valores por 100 g de producto final; con `pesoFinalG <= 0` devuelve ceros.
  - `export function macrosPorRacion(lineasPlanas: Linea[], porciones: number): { kcal; proteinas; carbohidratos; grasas; fibra }` — misma fórmula que la fase 4 de `scripts/pipeline-calidad.mjs` (ignora líneas sin `alimento` o con calorías 0), redondeo a 1 decimal.

- [ ] **Step 1: Write the failing test** `scripts/elaboraciones-enlace.test.ts` con estos casos exactos:
  - Masa: harina 300 g (364 kcal/100 g), agua 200 g (0 kcal), levadura 1 g (325 kcal/100 g); sin `peso_final_g` → `pesoFinal` = 501.
  - Receta con 250 g de esa masa → `aplanarLineas` devuelve harina ≈ 149,7 g, agua ≈ 99,8 g, levadura ≈ 0,5 g (tolerancia 0,05) y `sinResolver` vacío.
  - Con `peso_final_g = 450`, la misma línea de 250 g da harina ≈ 166,7 g.
  - Elaboración dentro de elaboración (masa lleva 100 g de «poolish», que lleva harina 50 g y agua 50 g, `peso_final_g` null → 100): receta con 250 g de masa → la harina total incluye la del poolish escalada dos veces; comprobar el valor con la fórmula.
  - Tercer nivel (profundidad 3) → esa línea no se expande y su id está en `sinResolver`.
  - Ciclo: A lleva B, B lleva A → `assert.throws(() => aplanarLineas(...), CicloElaboracion)`; también una elaboración que se contiene a sí misma, y una que contiene a `opciones.raiz`.
  - Elaboración con `pesoFinal` 0 → línea eliminada, id en `sinResolver`, sin NaN ni Infinity.
  - Líneas opcionales de 0 g se conservan sin aportar macros.
  - `macrosPorRacion`: receta de 2 raciones con 100 g de harina (364 kcal) → 182,0 kcal por ración.
- [ ] **Step 2: Run** — `npx tsx scripts/elaboraciones-enlace.test.ts` — Expected: FAIL (módulo no existe).
- [ ] **Step 3: Implement** las funciones de arriba en `lib/recetas/elaboraciones.ts`: recursivo con conjunto de ancestros para detectar ciclos; sin dependencias de Supabase.
- [ ] **Step 4: Run** — mismo comando — Expected: PASS.
- [ ] **Step 5: Commit** — `git add lib/recetas/elaboraciones.ts scripts/elaboraciones-enlace.test.ts && git commit -m "feat: aplanado puro de elaboraciones (macros, escala, ciclos)"`

---

### Task 3: Servidor — cargar, expandir, recalcular y propagar

**Files:**
- Create: `lib/recetas/elaboraciones-db.ts`
- Create: `scripts/probar-enlace-elaboraciones.ts`

**Interfaces:**
- Consumes: `Linea`, `Elaboracion`, `aplanarLineas`, `macrosPorRacion`, `macrosPor100g`, `pesoFinal`, `CicloElaboracion` (Task 2).
- Produces (todas reciben un cliente Supabase de servicio `db`):
  - `export async function cargarElaboraciones(db, ids: string[]): Promise<Map<string, Elaboracion>>` — carga elaboraciones aprobadas con sus líneas (`alimento:alimentos(id,nombre,calorias,proteinas,carbohidratos,grasas,fibra)`) y, por niveles (máx. 2), las elaboraciones que estas contengan.
  - `export async function expandirIngredientes<T extends Linea>(db, filas: T[], raiz?: string): Promise<T[]>` — devuelve `filas` con las líneas de elaboración sustituidas por sus líneas base (misma forma); sin líneas de elaboración devuelve el mismo array sin consultar. Si `sinResolver` no está vacío, registra un `console.warn` con los ids.
  - `export async function recalcularMacrosReceta(db, recetaId: string): Promise<{ kcal: number } | null>` — lee la receta (porciones) y sus líneas (incluido `elaboracion_id`), expande, calcula con `macrosPorRacion` y actualiza `recetas.kcal/proteinas/carbohidratos/grasas/fibra`; si la receta tiene líneas de elaboración añade la etiqueta `Revisar alérgenos` a `tags` (sin duplicar). No toca nada si no hay datos útiles.
  - `export async function recetasQueUsan(db, elaboracionId: string): Promise<string[]>` — ids de recetas que la usan directa o indirectamente (hasta 2 niveles).
  - `export async function propagarCambioElaboracion(db, elaboracionId: string): Promise<number>` — `recalcularMacrosReceta` de la propia elaboración (por si cambió `peso_final_g`) y de cada usuaria; devuelve cuántas.
  - `export async function enlaceCreaCiclo(db, recetaId: string, elaboracionIds: string[]): Promise<boolean>` — true si alguna de esas elaboraciones contiene (directa o indirectamente) a `recetaId` o es la propia receta.

- [ ] **Step 1: Write** el script de prueba `scripts/probar-enlace-elaboraciones.ts` (con `main()`, service role de `.env.local`): crea dos recetas temporales con `estado='descartada'` y nombre `ZZ-PRUEBA-…` (una elaboración `salsa_base` aprobable por consulta directa, una receta normal), con alimentos reales de la BD (dos alimentos con calorías > 0), enlaza la elaboración en la receta y comprueba: (a) `recalcularMacrosReceta` da kcal igual a la fórmula manual; (b) cambiar `peso_final_g` de la elaboración y llamar `propagarCambioElaboracion` cambia las kcal de la receta en la proporción esperada; (c) `enlaceCreaCiclo` es true al intentar enlazar la receta dentro de la elaboración; (d) `expandirIngredientes` con una fila de elaboración devuelve las líneas base; (e) la receta recibe la etiqueta `Revisar alérgenos`. Al final (`finally`) borra todo lo creado. Nota: `cargarElaboraciones` exige `estado='aprobada'`; el script marca la elaboración temporal como `aprobada` y la borra al terminar.
- [ ] **Step 2: Run** — `npx tsx scripts/probar-enlace-elaboraciones.ts` — Expected: FAIL (módulo no existe).
- [ ] **Step 3: Implement** `lib/recetas/elaboraciones-db.ts` con las firmas de arriba; una consulta por nivel (no una por línea); paginar con `range` si hay más de 1.000 filas.
- [ ] **Step 4: Run** — mismo comando — Expected: PASS con las 5 comprobaciones impresas y 0 filas `ZZ-PRUEBA` restantes (comprobar con una consulta).
- [ ] **Step 5: Commit** — `git add lib/recetas/elaboraciones-db.ts scripts/probar-enlace-elaboraciones.ts && git commit -m "feat: expandir, recalcular y propagar elaboraciones en servidor"`

---

### Task 4: API para el editor — buscar, validar y recalcular

**Files:**
- Create: `app/api/recetas/elaboraciones/route.ts`
- Create: `app/api/recetas/[id]/enlaces/route.ts`

**Interfaces:**
- Consumes: `autorizarCoach` (`lib/contenido/auth.ts`), `createServiceSupabase`, `enlaceCreaCiclo`, `recalcularMacrosReceta`, `propagarCambioElaboracion`, `cargarElaboraciones`, `macrosPor100g`, `pesoFinal`, `aplanarLineas` (Tasks 2-3).
- Produces:
  - `GET /api/recetas/elaboraciones?q=` → `{ elaboraciones: { id, nombre, categoria, peso_final_g, kcal100: number }[] }` (solo `tipo_receta='salsa_base'`, `estado='aprobada'`, búsqueda con `aplicarBusquedaNombre` de `lib/recetas/busqueda.ts` si aplica al nombre, máx. 20, orden por nombre).
  - `POST /api/recetas/[id]/enlaces` con cuerpo `{ elaboracion_ids: string[] }` → `{ ok: true }` o `409 { error: 'Esa elaboración ya contiene a esta receta' }` si `enlaceCreaCiclo`; sirve de validación previa al guardado.
  - `POST /api/recetas/[id]/recalcular` → recalcula la receta y, si es elaboración, propaga a las usuarias; devuelve `{ recalculadas: number }`. 401/403 si no es coach propietario.

- [ ] **Step 1: Write the failing check** — con `curl` sin sesión a las tres rutas (servidor local `npm run dev` o ruta equivalente) Expected: 401 en las tres. Documentar el comando exacto en el commit; no hay test unitario porque la lógica está en Task 3.
- [ ] **Step 2: Implement** las tres rutas con los guards y sin `err.message` al cliente. Comprobar la propiedad de la receta igual que `app/api/recetas/[id]/salsas/route.ts`.
- [ ] **Step 3: Verify** — mismos `curl` → 401; con la sesión de Carlos (browse headed + handoff o script con service role que llame a las funciones) `GET …/elaboraciones?q=poolish` devuelve el Poolish con su `kcal100` > 0 — Expected: correcto. `npx tsc --noEmit --pretty false` y ESLint de los dos ficheros — Expected: sin errores.
- [ ] **Step 4: Commit** — `git add app/api/recetas/elaboraciones/route.ts "app/api/recetas/[id]/enlaces/route.ts" && git commit -m "feat: API de elaboraciones para el editor (buscar, validar, recalcular)"`

---

### Task 5: Editor — enlazar una elaboración en una línea y `peso_final_g`

**Files:**
- Modify: `app/recetas/[id]/editar/page.tsx` (tipo `Ingrediente` línea ~18, carga línea ~92 y ~139, buscador ~152-190 y ~533-575, guardado ~285-320, macros ~216)

**Interfaces:**
- Consumes: `GET /api/recetas/elaboraciones`, `POST /api/recetas/[id]/enlaces`, `POST /api/recetas/[id]/recalcular` (Task 4).
- Produces: comportamiento del editor; `Ingrediente` gana `elaboracion_id?: string | null` y `elaboracion?: { nombre: string; kcal100: number }`; el formulario gana `peso_final_g: string` (solo se muestra si la receta es elaboración, es decir `tipoRecetaActual === 'salsa_base'` o la categoría elegida es de elaboración).

- [ ] **Step 1: Write the check** (no hay tests de componente en el proyecto): lista a mano de lo que debe cumplirse, usada en el Step 4: (1) el buscador de ingredientes muestra, además de alimentos, resultados de elaboraciones con distintivo «Elaboración» y su kcal/100 g; (2) elegir una enlaza la línea (`alimento_id` null, `elaboracion_id` fijado, `nombre_libre` = nombre de la elaboración) y los macros totales del editor la incluyen con `kcal100 × gramos / 100`; (3) antes de guardar, si hay líneas de elaboración se llama a `/enlaces`; un 409 detiene el guardado con aviso «Esa elaboración ya contiene a esta receta»; (4) al guardar se escribe `elaboracion_id` en la línea (en insert y update) y `peso_final_g` en `recetas` (vacío = null); (5) tras guardar se llama a `/recalcular` (propaga si es elaboración); (6) las líneas con `elaboracion_id` no cuentan como «sin alimento vinculado» en el aviso de la línea ~533.
- [ ] **Step 2: Implement** lo anterior reutilizando el buscador existente (`queryAlimento`, `resultados`, `vincularAlimento`): fusionar las dos fuentes de resultados sin cambiar la estética (mismas clases). Cargar `elaboracion_id` y los datos de la elaboración enlazada al abrir (consulta a `recetas` con los ids).
- [ ] **Step 3: Run** `npx tsc --noEmit --pretty false` y `npx eslint "app/recetas/[id]/editar/page.tsx"` — Expected: sin errores nuevos.
- [ ] **Step 4: Verify en pantalla** con la receta temporal de la prueba (o una real duplicada y descartada): enlazar el Turbo Poolish, guardar, comprobar que los macros de la receta cambian y que enlazar la receta dentro del Poolish da el aviso de ciclo. Intentar borrar el Poolish desde su ficha y comprobar que sale un mensaje comprensible: añadir en `app/recetas/[id]/page.tsx` (acción de borrar) el caso `23503` de Postgres → «Esta elaboración se usa en otras recetas: quítala de ellas primero».
- [ ] **Step 5: Commit** — `git add "app/recetas/[id]/editar/page.tsx" "app/recetas/[id]/page.tsx" && git commit -m "feat: enlazar elaboraciones como ingrediente en el editor de recetas"`

---

### Task 6: Lectores — compra, escandallo y planes usan los ingredientes base

**Files:**
- Modify: `app/api/compra/route.ts` (consulta ~línea 62)
- Modify: `app/api/precios/escandallo/receta/route.ts` (~línea 47)
- Modify: `lib/recetas/aplicar-receta-comida.ts` (~líneas 128-160)
- Modify: `lib/nutricion/detalle-dia.ts`, `lib/nutricion/plantilla-semana.ts`, `lib/nutricion/semanas-futuras.ts`, `lib/nutricion/complementos.ts`, `lib/contenido/compra-tanda.ts`, `lib/plan-recetas.ts` — solo los puntos donde se lee `receta_ingredientes` con su `alimento` para calcular o repartir cantidades
- Test: `scripts/elaboraciones-enlace.test.ts` (compra pura)

**Interfaces:**
- Consumes: `expandirIngredientes(db, filas, raiz?)` (Task 3).

- [ ] **Step 1: Write the failing test** en `scripts/elaboraciones-enlace.test.ts`: función pura ya existente `aplanarLineas` + suma por `alimento_id`: una receta con 100 g de harina propia y 250 g de masa (que lleva 300 g de harina sobre 501 g) da una sola entrada de harina de ≈ 249,7 g y el agua una sola vez — Expected tras Task 2: ya pasa; sirve de red de seguridad de la regla «no pierde ni duplica». Además, añadir en `scripts/probar-enlace-elaboraciones.ts` una comprobación de `app/api/compra` y de `aplicar-receta-comida` con la receta temporal (el script llama directamente a las funciones exportadas; si la ruta no exporta lógica reutilizable, extraer la agregación a una función pura en el mismo fichero y probarla).
- [ ] **Step 2: Implement** en cada lector: añadir `elaboracion_id` al `select` de las líneas y pasar las filas por `expandirIngredientes` antes de agrupar, calcular o escalar. En `aplicar-receta-comida.ts` las comidas del plan (`comida_alimentos`) deben recibir los alimentos base, no la línea de elaboración. En los lectores que solo necesitan nombres (planificador, Halal) basta expandir para que vean también los ingredientes de la elaboración.
- [ ] **Step 3: Run** `npx tsx scripts/elaboraciones-enlace.test.ts`, `npx tsx scripts/probar-enlace-elaboraciones.ts`, `npx tsc --noEmit --pretty false`, `npm run verificar:motor` — Expected: todo OK (63/63 en el motor).
- [ ] **Step 4: Verify con la receta temporal:** la lista de la compra de un plan que la contenga muestra los ingredientes base de la elaboración con cantidades proporcionales, y el escandallo suma su coste (la misma receta sin enlazar y enlazada deben dar el mismo coste ±1 %). Limpiar los datos temporales.
- [ ] **Step 5: Commit** — `git add` de los ficheros tocados `&& git commit -m "feat: compra, escandallo y planes cuentan los ingredientes de las elaboraciones"`

---

### Task 7: Fichas — ver la elaboración dentro de la receta

**Files:**
- Modify: `app/recetas/[id]/page.tsx` (carga ~línea 185 y lista de ingredientes ~597)
- Modify: `app/api/cliente/[codigo]/recetas/[recetaId]/route.ts` (~línea 30)
- Modify: `app/cliente/receta/[id]/page.tsx`
- Modify: `components/premium/IngredientChecklist.tsx` (campo `href?: string`)

**Interfaces:**
- Consumes: ninguna de tareas anteriores salvo la columna (Task 1). `IngredientItem` gana `href?: string` (la línea se pinta como enlace discreto con «ver preparación»).
- Produces: en la ficha del coach, la línea de elaboración enlaza a `/recetas/{elaboracion_id}`; en la del cliente a `/cliente/receta/{elaboracion_id}`; en la ficha de una elaboración (coach) un bloque «Se usa en» con las recetas que la usan (nombre enlazado), calculado en servidor con una consulta a `receta_ingredientes` por `elaboracion_id`.

- [ ] **Step 1: Write the check:** línea de ingrediente con `elaboracion_id` muestra nombre + gramos + «ver preparación» enlazado; sin `elaboracion_id` se pinta como hoy. Añadir un test a `scripts/cliente-visual-system.test.ts` solo si ya comprueba esa lista; si no, verificación en pantalla.
- [ ] **Step 2: Implement** pasando `elaboracion_id` desde las dos cargas y `href` al componente. El macro por ingrediente de una línea de elaboración usa `kcal100` de la elaboración (calculado como en Task 5, ya disponible vía `/api/recetas/elaboraciones` o consulta directa en el servidor). Estilo editorial, sin cajas: texto gris pequeño en mono para «ver preparación».
- [ ] **Step 3: Run** `npx tsc --noEmit --pretty false`, `npx eslint` de los ficheros tocados, `npx tsx scripts/cliente-visual-system.test.ts` — Expected: sin errores.
- [ ] **Step 4: Verify en pantalla** (Carlos o `browse --headed` + handoff, 390 px): en la receta temporal la línea de elaboración se ve y el enlace abre la ficha del Poolish; en el Poolish aparece «Se usa en» con la receta de prueba. Retirar los datos de prueba.
- [ ] **Step 5: Commit y documentación** — commit de los ficheros; añadir sección a `nutricoach/CLAUDE.md` y fila a `NUTRICION/CLAUDE.md` (hecho, pendiente: alérgenos/Halal por elaboración — la etiqueta `Revisar alérgenos` lo marca —, enlazar recetas existentes (fase 3), clasificación completa), `git push origin main` en `nutricoach`.
