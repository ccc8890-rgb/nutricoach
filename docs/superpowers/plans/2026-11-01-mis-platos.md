# Mis platos — Plan de implementación

> **Para agentes:** SUB-SKILL OBLIGATORIA: usar superpowers:subagent-driven-development (recomendada) o superpowers:executing-plans. Los pasos usan casillas `- [ ]`.

**Objetivo:** el cliente fotografía un plato habitual, la IA propone ingredientes/pasos/macros (marcados «estimado»), el cliente lo retoca y lo envía; el coach lo revisa, lo aprueba y puede meterlo en la dieta. Solo lo ven ese cliente y su coach.

**Arquitectura:** tablas propias `platos_cliente` / `platos_cliente_ingredientes` (no se toca `recetas`). Lógica pura en `lib/platos/*` con tests `tsx` + `assert`; rutas bajo `app/api/cliente/[codigo]/platos` (cliente) y `app/api/platos` (coach); visión por el enrutador de IA (`llamarIA`, tarea nueva `plato_foto`); fotos en Cloudinary.

**Stack:** Next.js (versión personalizada: leer `node_modules/next/dist/docs/` antes de tocar rutas/páginas), Supabase (service role vía `lib/supabase-server.ts`), Cloudinary (`lib/cloudinary.ts`), tests `npx tsx scripts/<x>.test.ts`.

**Spec:** `docs/superpowers/specs/2026-11-01-mis-platos-design.md`

## Restricciones globales

- UI y mensajes en español de España; fechas DD-MM-YYYY.
- Clientes Supabase solo de `lib/supabase-server.ts` (`createServiceSupabase`, `createApiSupabase`); nunca `createClient` suelto (caché de datos de Next).
- **Toda consulta a `platos_cliente*` desde una ruta de cliente filtra por `cliente_id = auth.clienteId`.** Escrituras del cliente exigen `auth.esCliente === true` (`autorizarAccesoPlan`, `lib/cliente/autorizar-escritura-plan.ts`). Rutas de coach: `autorizarCoachCliente` (`lib/auth/autorizar-coach-cliente.ts`) o rol coach propietario.
- Nunca devolver `err.message` al cliente en 500. Ningún secreto en código.
- Kcal/macros de un plato **no aprobado** nunca entran en plan, compra ni cálculo de la dieta; en pantalla salen como «estimado».
- Límite: `MAX_ANALISIS_POR_DIA = 10` por cliente. Foto: máx. 8 MB, `image/jpeg|png|webp|heic`.
- Migración **aditiva**; aplicarla (`supabase db query --linked -f <fichero>`, puede requerir que Carlos lo ejecute) **antes** de subir a `main`.
- Iconos del portal cliente solo desde `@/components/icons/portal-lucide` / `portal-phosphor`; coach desde `@/components/icons/lucide`. Estilo editorial existente (sin cajas de colores, rótulo mono pequeño).
- Estado de pantalla que deba sobrevivir a abrir un detalle → URL con `useEstadoUrl` (`lib/useEstadoUrl.ts`).
- `git add` solo de rutas concretas (hay cambios ajenos sin subir). Commits locales por tarea; no hacer `push` hasta aplicar la migración y que Carlos pruebe.

## Review Focus

Entradas/condiciones que el spec implica y que ningún caso feliz cubre; cada una tiene su test en la tarea indicada.

1. Un cliente pide el plato de otro cliente (UUID válido ajeno) → 404, nunca 200 ni 403 que confirme existencia (Tarea 5).
2. Aprobar con una línea sin enlazar o sin líneas → rechazado (Tarea 6).
3. La IA devuelve basura, vacío o gramos absurdos → el plato queda `borrador` sin líneas y con aviso, sin 500 (Tarea 3 y 5).
4. Archivo que no es imagen o de más de 8 MB, o el análisis nº 11 del día → 400 / 429 sin llamar a la IA (Tarea 5).
5. Editar un plato `aprobado` → vuelve a `pendiente` y el recetario sigue mostrando las cifras aprobadas, no las nuevas (Tarea 1).
6. Añadir a la dieta un plato que no está `aprobado` → rechazado (Tarea 6).

---

## Mapa de archivos

| Archivo | Responsabilidad |
|---|---|
| `supabase/migrations/20261101120000_platos_cliente.sql` | Tablas, índices, RLS sin políticas, `comidas.plato_cliente_id` |
| `lib/platos/estado.ts` | Estados, transiciones, vista pública (snapshot), constantes |
| `lib/platos/macros.ts` | Cálculo de macros desde líneas, marca `incompleto` |
| `lib/platos/analizar.ts` | Prompt de visión + validación estricta de la respuesta |
| `lib/platos/enlazar.ts` | Enlazar ingredientes SOLO a alimentos existentes |
| `lib/platos/foto-limpia.ts` | Retoque opcional con OpenAI (null si no hay clave/saldo) |
| `lib/platos/anadir-a-dieta.ts` | Plato aprobado → comida del plan con `comida_alimentos` |
| `lib/ia/enrutador.ts`, `lib/ia/anthropic.ts` | Soporte de imágenes + tarea `plato_foto` |
| `app/api/cliente/[codigo]/platos/**` | API del cliente |
| `app/api/platos/**` | API del coach |
| `components/PortalCliente/PlatosCliente.tsx`, `EditorPlato.tsx` | UI cliente |
| `app/recetas/(revision)/platos-clientes/page.tsx` | Bandeja del coach |
| `scripts/platos-*.test.ts`, `scripts/probar-platos.ts` | Tests y prueba con BD real |

---

### Tarea 1: Migración y dominio de estados

**Files:**
- Create: `supabase/migrations/20261101120000_platos_cliente.sql`, `lib/platos/estado.ts`, `scripts/platos-estado.test.ts`

**Interfaces:**
- Produces (`lib/platos/estado.ts`):
  - `type EstadoPlato = 'borrador' | 'pendiente' | 'aprobado' | 'devuelto'`
  - `const MAX_ANALISIS_POR_DIA = 10`, `MAX_FOTO_BYTES = 8 * 1024 * 1024`, `TIPOS_FOTO = ['image/jpeg','image/png','image/webp','image/heic']`
  - `transicionPermitida(de: EstadoPlato, a: EstadoPlato, actor: 'cliente' | 'coach'): boolean`
  - `type VistaPlato = { nombre; kcal; proteinas; carbohidratos; grasas; ingredientes: {nombre_libre; cantidad_gramos}[]; estimado: boolean }`
  - `vistaPublica(p: { estado: EstadoPlato; aprobado_snapshot: VistaPlato | null } & VistaPlato): VistaPlato | null` → `aprobado` o (`pendiente` con snapshot) devuelve la versión aprobada; sin snapshot ni aprobado devuelve `null`.

- [ ] **Step 1: Test** `scripts/platos-estado.test.ts` (assert): cliente `borrador→pendiente` ok; `aprobado→pendiente` ok (edición); `devuelto→pendiente` ok; cliente `pendiente→aprobado` NO; coach `pendiente→aprobado|devuelto` ok; coach `borrador→aprobado` NO; `vistaPublica` de un `pendiente` con snapshot devuelve el snapshot (Review Focus 5); de un `borrador` devuelve `null`.
- [ ] **Step 2:** `npx tsx scripts/platos-estado.test.ts` → falla (módulo inexistente).
- [ ] **Step 3: Implementar** `lib/platos/estado.ts` con la firma anterior.
- [ ] **Step 4: Migración.** `platos_cliente` (id uuid pk, cliente_id fk `clientes` on delete cascade, nombre text, tipo_comida text check Desayuno|Comida|Cena|Snack|Otro, nota_cliente text, estado text check de `EstadoPlato` default `borrador`, foto_original_url text, foto_limpia_url text, porciones numeric default 1, pasos text, kcal/proteinas/carbohidratos/grasas numeric (totales del plato, calculados al guardar), incompleto boolean default false, estimado boolean default true, ia_modelo text, nota_coach text, aprobado_snapshot jsonb, aprobado_at, created_at, updated_at); `platos_cliente_ingredientes` (id, plato_id fk cascade, nombre_libre text, alimento_id fk `alimentos` null, cantidad_gramos numeric ≥ 0, orden int); `platos_analisis_log` (id, cliente_id, created_at) con índice `(cliente_id, created_at)`; `alter table comidas add column plato_cliente_id uuid references platos_cliente(id) on delete set null`. RLS activado en las tres tablas nuevas **sin políticas** (solo service role). Cabecera del SQL con cómo deshacerlo.
- [ ] **Step 5:** `npx tsx scripts/platos-estado.test.ts` → pasa; `npx tsc --noEmit` limpio.
- [ ] **Step 6: Commit** `git add supabase/migrations/20261101120000_platos_cliente.sql lib/platos/estado.ts scripts/platos-estado.test.ts` — «feat(platos): migración y estados».

### Tarea 2: Macros desde líneas

**Files:** Create `lib/platos/macros.ts`, `scripts/platos-macros.test.ts`

**Interfaces:**
- Produces: `calcularMacrosPlato(lineas: { cantidad_gramos: number; alimento: { calorias: number; proteinas: number; carbohidratos: number; grasas: number } | null }[]): { kcal: number; proteinas: number; carbohidratos: number; grasas: number; incompleto: boolean }` — suma `valor/100 × gramos`; las líneas sin `alimento` no suman y ponen `incompleto = true`; redondeo a 1 decimal; sin líneas → todo 0 e `incompleto = true`.

- [ ] **Step 1: Test:** 200 g de un alimento 100 kcal/100 g → 200 kcal; una línea sin alimento → `incompleto` y las demás suman; lista vacía → `incompleto`.
- [ ] **Step 2:** ejecutar → falla. **Step 3:** implementar. **Step 4:** ejecutar → pasa.
- [ ] **Step 5: Commit** (`lib/platos/macros.ts`, test).

### Tarea 3: Visión en el enrutador y análisis del plato

**Files:**
- Modify: `lib/ia/enrutador.ts` (tipo `TareaIA`, `RUTAS_POR_DEFECTO`, `ParamsIA`, `adaptadorReal`), `lib/ia/anthropic.ts` (`llamarClaude`)
- Create: `lib/platos/analizar.ts`, `scripts/platos-analizar.test.ts`

**Interfaces:**
- Consumes: `llamarIA(tarea, params, opciones)` y `Adaptador` de `lib/ia/enrutador.ts`.
- Produces:
  - `ParamsIA.imagenes?: { mediaType: 'image/jpeg' | 'image/png' | 'image/webp'; base64: string }[]`
  - Tarea `'plato_foto'`: `[CLAUDE_SONNET_RAPIDO, GPT_RAPIDO]` (sin DeepSeek: no ve imágenes). En `adaptadorReal`: Anthropic recibe bloques `image` + texto; OpenAI recibe `image_url` con data URI; DeepSeek ignora/lanza si hay imágenes.
  - `type AnalisisPlato = { nombre: string; porciones: number; ingredientes: { nombre: string; gramos: number }[]; pasos: string[] }`
  - `validarAnalisisPlato(crudo: unknown): { ok: true; valor: AnalisisPlato } | { ok: false; motivo: string }` — nombre 2-80 car.; 1-25 ingredientes con `gramos` en (0, 2000]; ≤ 12 pasos de ≤ 300 car.; `porciones` 1-12 (por defecto 1); descarta texto con enlaces o la palabra «víspera/carrera».
  - `construirPromptPlato(nota: string | null): { sistema: string; usuario: string }` — pide JSON del tipo anterior, en español, ingredientes genéricos (sin marcas), gramos de lo que se ve en un plato servido y prohíbe inventar elementos que no se ven.
  - `analizarFotoPlato(p: { base64: string; mediaType: ...; nota: string | null }, opciones?: { adaptador?: Adaptador }): Promise<{ ok: true; valor: AnalisisPlato; modelo: string } | { ok: false; motivo: string }>` — usa `llamarIA('plato_foto', {... json: true, presupuestoMs: 45_000, esfuerzo: 'low'})`; cualquier `ErrorIA` o JSON inválido → `{ ok:false }`, nunca lanza.

- [ ] **Step 1: Tests** (`scripts/platos-analizar.test.ts`): `validarAnalisisPlato` rechaza `{}`, 0 ingredientes, gramos 0 o 5000, nombre vacío; acepta un ejemplo válido; `analizarFotoPlato` con un adaptador falso que devuelve JSON válido → ok y comprueba que el adaptador recibió `imagenes` con 1 elemento; con adaptador que devuelve texto basura → `{ ok:false }` (Review Focus 3); con adaptador que lanza → `{ ok:false }`. Añadir a `scripts/enrutador-ia.test.ts` un caso: `rutasDe('plato_foto')` no contiene DeepSeek.
- [ ] **Step 2:** ejecutar ambos → fallan.
- [ ] **Step 3:** implementar las firmas anteriores; `llamarClaude` acepta `imagenes` y las antepone como bloques de contenido del mensaje de usuario.
- [ ] **Step 4:** ejecutar ambos tests y `npx tsx scripts/enrutador-ia.test.ts` → pasan; `npx tsc --noEmit` limpio.
- [ ] **Step 5: Commit** (los 5 ficheros por ruta).

### Tarea 4: Enlazar solo a alimentos existentes

**Files:** Modify `lib/recetas/auto-match-ingrediente.ts` (exportar); Create `lib/platos/enlazar.ts`, `scripts/platos-enlazar.test.ts`

**Interfaces:**
- Consumes: `fase1_matchAlimentos` (hoy privada: añadir `export`), `calidadVinculo(libre, alimento): CalidadVinculo` de `lib/recetas/reconstruccion-segura.ts`.
- Produces: `enlazarSoloExistente(supabase: SupabaseClient, nombre: string, cache: AlimentoCache[]): Promise<{ alimento_id: string; alimento_nombre: string } | null>` — usa solo la fase 1; descarta el match si `calidadVinculo` es `dudosa` o `sin`. **Nunca crea alimentos ni usa fases 2-3.** `AlimentoCache` = el tipo de elemento de `alimentosCache` de `autoMatchIngrediente`.

- [ ] **Step 1: Test:** con una caché de 3 alimentos («Huevo», «Patata», «Aceite de oliva virgen extra») y un `supabase` falso que lanza si se le llama: «huevos» → Huevo; «patata cocida» → Patata; «salsa secreta de la abuela» → `null`; un nombre que `calidadVinculo` marca `dudosa` → `null`.
- [ ] **Step 2:** ejecutar → falla. **Step 3:** implementar. **Step 4:** pasa; `tsc` limpio (el export no cambia comportamiento previo: `npx tsx scripts/reconstruccion-segura.test.ts` sigue pasando).
- [ ] **Step 5: Commit.**

### Tarea 5: API del cliente

**Files:**
- Create: `app/api/cliente/[codigo]/platos/route.ts` (GET lista, POST analizar foto), `app/api/cliente/[codigo]/platos/[id]/route.ts` (GET, PATCH, DELETE), `app/api/cliente/[codigo]/platos/[id]/enviar/route.ts` (POST), `lib/platos/guardar.ts`, `scripts/platos-aislamiento.test.ts`, `scripts/probar-platos.ts`

**Interfaces:**
- Consumes: `autorizarAccesoPlan`, `uploadToCloudinary(buffer, { folder: 'nutricoach/platos/<clienteId>' })`, `analizarFotoPlato`, `enlazarSoloExistente`, `calcularMacrosPlato`, `transicionPermitida`, `vistaPublica`.
- Produces (`lib/platos/guardar.ts`): `recalcularYGuardar(db: SupabaseClient, platoId: string): Promise<void>` — recarga líneas con alimento, calcula macros, escribe totales + `incompleto` y `updated_at`.
- Contratos HTTP:
  - `POST …/platos` (multipart: `foto`, `nota?`, `tipo_comida`): valida tipo y tamaño (400); cuenta `platos_analisis_log` de las últimas 24 h y si ≥ 10 → 429 **antes** de llamar a la IA; sube la foto; analiza; crea el plato `borrador` con líneas enlazadas (las no enlazadas con `alimento_id = null`); inserta en el log; responde `{ plato }`. Si el análisis falla: crea el `borrador` vacío con `nota_coach = null` y respuesta `{ plato, aviso: 'No pude leer el plato; añade los ingredientes a mano' }`.
  - `GET …/platos?estado=` → lista del propio cliente; para estados `aprobado`/`pendiente` devuelve `vistaPublica`.
  - `PATCH …/platos/[id]`: edita nombre, tipo, porciones, pasos, líneas (reemplazo completo, máx. 25); si el plato estaba `aprobado` o `devuelto` pasa a `pendiente` (guardando `aprobado_snapshot` antes si venía de `aprobado` y no hay uno); recalcula macros.
  - `POST …/enviar`: `borrador|devuelto → pendiente`; exige ≥ 1 línea.
  - `DELETE`: solo `borrador|devuelto`.
  - Plato de otro cliente o inexistente → **404** en todos los verbos.

- [ ] **Step 1: Test estático** `scripts/platos-aislamiento.test.ts` (mismo patrón que `scripts/recetas-solo-aprobadas.test.ts`): recorre `app/api/cliente/**` y `lib/platos/**`; cada fichero que contiene `.from('platos_cliente` debe contener también `.eq('cliente_id'` o `auth.clienteId`; falla si alguno no (Review Focus 1).
- [ ] **Step 2:** ejecutar → falla (aún no hay rutas) o pasa vacío; tras implementar debe pasar con las rutas incluidas.
- [ ] **Step 3: Implementar** rutas y `recalcularYGuardar` según los contratos.
- [ ] **Step 4: `scripts/probar-platos.ts`** (patrón de `scripts/probar-metodos.ts`, usa BD real con service role y un cliente de prueba, con IA simulada): crea plato, edita, envía; comprueba que un segundo cliente de prueba recibe «no encontrado» al pedirlo (Review Focus 1), que el análisis nº 11 da 429 sin llamar a la IA, y que un archivo `text/plain` da 400 (Review Focus 4). Limpia lo creado.
- [ ] **Step 5:** `npx tsx scripts/platos-aislamiento.test.ts`, `npx tsx scripts/probar-platos.ts` (tras aplicar la migración en el entorno de prueba), `npx tsc --noEmit`, ESLint de los ficheros tocados → limpios.
- [ ] **Step 6: Commit.**

### Tarea 6: API del coach y «Añadir a la dieta»

**Files:** Create `app/api/platos/route.ts` (GET bandeja), `app/api/platos/[id]/route.ts` (GET, PATCH líneas), `app/api/platos/[id]/revisar/route.ts` (POST `aprobar|devolver`), `app/api/platos/[id]/dieta/route.ts` (POST), `lib/platos/anadir-a-dieta.ts`, `scripts/platos-coach.test.ts`

**Interfaces:**
- Consumes: `autorizarCoachCliente`, `transicionPermitida`, `recalcularYGuardar`.
- Produces:
  - `puedeAprobar(p: { lineas: { alimento_id: string | null; cantidad_gramos: number }[] }): { ok: true } | { ok: false; motivo: string }` en `lib/platos/estado.ts` — falla si no hay líneas o alguna tiene `alimento_id = null`.
  - `anadirPlatoADieta(db: SupabaseClient, p: { platoId: string; planId: string; dia: number; franja: string; raciones: number }): Promise<{ comidaId: string }>` — exige plato `aprobado`; crea la comida siguiendo el mismo camino que `POST app/api/clientes/[id]/semana-dieta` (leerlo para columnas y franjas válidas), inserta sus `comida_alimentos` con `cantidad_gramos × raciones / porciones`, y rellena `comidas.plato_cliente_id`.
- Contratos: `GET /api/platos?estado=pendiente` lista los de los clientes del coach (con nombre de cliente); `PATCH /api/platos/[id]` edita gramos y permite sustituir/quitar una línea o enlazarla a un `alimento_id` elegido; `POST revisar` con `{ accion: 'aprobar' }` aplica `puedeAprobar`, guarda `aprobado_snapshot` (= `VistaPlato` actual), `aprobado_at`, `estimado = false`; `{ accion: 'devolver', nota }` exige nota no vacía; `POST dieta` con plato no aprobado → 409.

- [ ] **Step 1: Test** `scripts/platos-coach.test.ts`: `puedeAprobar` rechaza lista vacía y línea con `alimento_id: null` (Review Focus 2), acepta líneas todas enlazadas; test estático adicional: en `app/api/platos/**` y `lib/platos/anadir-a-dieta.ts` aparece una comprobación de `estado` `'aprobado'` antes de insertar en `comidas` (Review Focus 6).
- [ ] **Step 2:** ejecutar → falla. **Step 3:** implementar. **Step 4:** ejecutar → pasa. Ampliar `scripts/probar-platos.ts` con: coach de otro cliente no puede ver el plato; aprobar → añadir a dieta crea la comida con las kcal esperadas; un plato `pendiente` no se puede añadir.
- [ ] **Step 5:** `tsc` y ESLint limpios. **Step 6: Commit.**

### Tarea 7: Interfaz del cliente

**Files:** Create `components/PortalCliente/PlatosCliente.tsx`, `components/PortalCliente/EditorPlato.tsx`; Modify `app/cliente/page.tsx` (sub-pestaña `platos` en el `useEstadoUrl('sub', …)` de la línea ~190 y en `items` de la línea ~603), `components/PortalCliente/RecetarioExplorador.tsx`, la vista «En tu plan» (comidas con `plato_cliente_id`), `scripts/cliente-visual-system.test.ts` si exige registro de componentes.

**Interfaces:**
- Consumes: contratos HTTP de la Tarea 5; `useEstadoUrl`; iconos `portal-*`.
- Produces: sub-pestaña **«Mis platos»** (junto a En tu plan / Favoritas / Archivo completo) con botón «Añadir mi plato» (cámara/galería, nota, tipo de comida), lista con estados (Borrador · Pendiente de revisión · Aprobado · Devuelto con nota del coach) y `EditorPlato` (foto original + limpia si existe, nombre, ingredientes con gramos editables y quitar/añadir línea, pasos, cifras con rótulo «estimado» hasta aprobar, aviso si hay líneas «sin datos», botón «Enviar al coach»). Los `aprobado` (vía `vistaPublica`) aparecen también en «Archivo completo» con marca de texto «Mi plato». «En tu plan» muestra las comidas con `plato_cliente_id` con la misma marca.

- [ ] **Step 1:** implementar componentes y cableado siguiendo el estilo editorial (rótulos mono, sin cajas de colores; fila de ejercicio/ingrediente en una línea; detalle tras un toque).
- [ ] **Step 2:** `npx tsc --noEmit`, ESLint de los ficheros, `npx tsx scripts/cliente-visual-system.test.ts` → limpios.
- [ ] **Step 3:** comprobar en navegador a 390 px (Chrome visible con sesión de Carlos; si se pierde la sesión, dar pasos a Carlos): subir foto → borrador editable → enviar → pendiente; claro y oscuro; «volver atrás» conserva la sub-pestaña.
- [ ] **Step 4: Commit.**

### Tarea 8: Bandeja del coach

**Files:** Create `app/recetas/(revision)/platos-clientes/page.tsx`, `components/recetas/RevisionPlato.tsx`; Modify `components/recetas/CabeceraRevision.tsx` (pestaña «Platos del cliente» con contador de pendientes), ficha del cliente (`app/clientes/[id]/page.tsx`: enlace/lista corta «Sus platos»).

**Interfaces:** Consumes los contratos de la Tarea 6.

- [ ] **Step 1:** bandeja con filtro por cliente y estado; `RevisionPlato`: foto original/limpia, líneas editables (gramos, enlazar a alimento con el selector existente `GET /api/alimentos?selector=1`, quitar), macros reales, encaje con el objetivo del día del cliente (kcal y proteína frente al objetivo de su comida), botones Aprobar / Devolver con nota / Añadir a su dieta (selector de día y franja).
- [ ] **Step 2:** `tsc` y ESLint limpios. **Step 3:** comprobar en navegador (Mac y 390 px) el flujo completo con Carlos: foto → aprobar → añadir a la dieta → aparece en «En tu plan» del cliente.
- [ ] **Step 4: Commit.**

### Tarea 9: Foto limpia opcional y limpieza de borradores

**Files:** Create `lib/platos/foto-limpia.ts`, `scripts/limpiar-borradores-platos.ts`, `scripts/platos-foto-limpia.test.ts`; Modify `app/api/cliente/[codigo]/platos/route.ts` (invocar tras crear), `scripts/auditoria-semanal.mjs` (añadir la limpieza a la pasada de 6 h)

**Interfaces:**
- Produces: `promptFotoLimpia(): string` (conserva el plato y el recipiente, quita desorden/manos/texto, luz natural, recorte cuadrado, **no añade ni cambia elementos**); `limpiarFotoPlato(p: { buffer: Buffer; mediaType: string }, opciones?: { fetchFn?: typeof fetch }): Promise<Buffer | null>` — devuelve `null` sin `OPENAI_API_KEY`, ante cualquier error de red/saldo o respuesta vacía (nunca lanza). La ruta guarda `foto_limpia_url` solo si no es `null`; el plato funciona igual sin ella.
- `scripts/limpiar-borradores-platos.ts [--aplica]` (simula por defecto): borra `borrador` con más de 30 días y sus fotos en Cloudinary (`uploader.destroy`).

- [ ] **Step 1: Test:** sin clave → `null`; con `fetchFn` que devuelve 402 → `null`; `promptFotoLimpia()` contiene «no añadas» (o equivalente exacto fijado en el prompt).
- [ ] **Step 2:** ejecutar → falla. **Step 3:** implementar. **Step 4:** pasa; simular el script de limpieza sin `--aplica`.
- [ ] **Step 5:** `tsc` y ESLint limpios. **Step 6: Commit.**

### Tarea 10: Verificación final y despliegue

- [ ] **Step 1:** `npx tsc --noEmit`; ESLint de todo lo tocado; todos los `scripts/platos-*.test.ts`; `npx tsx scripts/enrutador-ia.test.ts`; `npx tsx scripts/reconstruccion-segura.test.ts`; `npm run build`.
- [ ] **Step 2:** aplicar la migración en producción (pedir a Carlos si el clasificador de permisos lo bloquea) y ejecutar `npx tsx scripts/probar-platos.ts` contra producción con los clientes de prueba (Review Focus 1-6).
- [ ] **Step 3:** Carlos sube 3-5 platos reales suyos; anotar acierto del plato, error de kcal frente a la revisión del coach y que ningún otro cliente de prueba los ve.
- [ ] **Step 4:** solo entonces `git push` a `main`; comprobar con `vercel ls --yes` hasta `Ready`.
- [ ] **Step 5:** documentar en `nutricoach/CLAUDE.md` y la fila de `NUTRICION/CLAUDE.md` (cierre de sesión), con pendientes: fase 2 (pasar al recetario general), fase 3 (modo «solo calcular»), saldo de OpenAI para la foto limpia.
