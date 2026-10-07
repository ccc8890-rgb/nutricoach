# CLAUDE.md — NutriCoach (Human Lab)

## ✅ SESIÓN 08-10-2026 (Codex) — Bienvenida contextual al primer plan

- Sustituida la bienvenida antigua, que solo aparecía con `?onboarding=completo`, usaba una clave global y afirmaba que existían dieta y entrenamiento aunque faltara alguno.
- `app/cliente/page.tsx` muestra ahora una tarjeta cuando el cliente tiene su primer plan nutricional activo y todavía no la ha visto en ese dispositivo.
- La persistencia está aislada por cliente con `nutricoach:bienvenida-plan:<clienteId>`; cerrar la tarjeta o usar un CTA la marca como vista.
- CTA principal **Ver mi dieta**. CTA **Ver entrenamiento** únicamente cuando existe un plan de entrenamiento activo.
- Sin migraciones ni escrituras en base de datos. Helper puro: `lib/cliente/bienvenida-plan.ts`. Regresión: `scripts/bienvenida-plan.test.ts`.
- Verificación: test específico, ESLint focalizado, `tsc --noEmit`, `node scripts/audit-portal-patterns.mjs` y `npm run build`, todo limpio.
- Commit y despliegue: `2db9de4`; Vercel Production `Ready`.
- Se respetaron los cambios paralelos del dashboard coach y `supabase/.temp/cli-latest`; no se incluyeron en el commit.

## ✅ SESIÓN 07-10-2026 (noche, Claude) — Ficha cliente: cabecera del plan de entreno simplificada

Carlos: el bloque «Training desk / Plan activo» de Entrenamiento tenía demasiada información. Ahora es una sola fila (nombre del plan, semanas y botones Abrir plan / Regenerar / Plantilla / Nuevo plan) y debajo «Rutina de la semana» sin el «De un vistazo…». Eliminadas las 3 tarjetas (plan, historial, siguiente acción) y el panel «Acceso rápido». Archivo: `app/clientes/[id]/page.tsx`, commit `dfeaa41` (en `origin/main`; el primer push dio un 500 de GitHub pero sí llegó). `tsc` limpio. **Revisado y aprobado por Carlos.**

Más ajustes de la misma ficha (`app/clientes/[id]/page.tsx`), pedidos por Carlos por ocupar pantalla con poca información:
- **Tarjeta «Plan activo» (kcal/prot/carbs/grasas)** ahora solo en la pestaña **Nutrición** (antes arriba en todas). El aviso «Sin dieta activa / Generar dieta IA» también. Revisado y aprobado.
- **Pestaña Perfil:** una sola columna (Perfil y planificación → Inteligencia clínica → Analíticas → Membresía). El informe clínico vacío es una fila («Sin informe clínico · Necesita al menos 1 check-in» + Generar ahora) en vez de una tarjeta grande; el calendario (`PlanificacionCalendario`) va plegado en «Calendario y revisión» (la fecha de próxima revisión se edita ahí); quitados los rótulos «Datos base» / «Flags y criterios» y acortado el texto del vídeo original. **Pendiente: Carlos lo revisa en pantalla.**
- Decisión abierta: el calendario del Perfil duplica el de Entrenamiento; si estorba, quitarlo.
- Nota: el push a `main` muestra «Changes must be made through a pull request» pero los commits llegan igualmente; comprobar con `git branch -r --contains HEAD`. `supabase/.temp/cli-latest` modificado no es de esta sesión.

## ✅ SESIÓN 07→08-10-2026 (noche, Claude) — Motor de dietas con sentido, aprendizaje de gustos, reglas clínicas y recetario limpio

Todo en `main` (último commit de código `bf987e4`+; docs al cierre). Sin migraciones de BD (se reutilizó `swap_rechazada`, que ya existía en el CHECK de `receta_interacciones_cliente`). Detalle de fallos y recetas pendientes: `docs/07-10-2026_fallos-motor-y-recetas-pendientes.md`.

### Tarjeta de comida del coach (`components/clientes/DetalleDiaDieta.tsx`)
- Complementos agrupados: Plato principal / Plato / Guarnición / Postre / Otros extras (`rol` deducido de la receta o de la categoría del alimento, no se guarda). «Mover a…» entre comidas del mismo día (`PATCH /api/clientes/[id]/semana-dieta/complemento` → `moverComplemento`, reajusta origen y destino). Buscador de alimentos acotado (`GET /api/alimentos?generico=1`: exacto > empieza por > contiene, elaborados al final, 12 resultados).

### Motor de complementos (`lib/nutricion/completar-comidas.ts`)
- Reglas (`tieneSentido`, test `scripts/completar-comidas-reglas.test.ts`): sin base de hidrato repetida, fruta/yogur de postre en comida y cena, sin lácteo tras pescado, sin grasa extra si el plato ya es graso, desayuno dulce con dulce y salado con salado (por palabras del nombre), raciones en medidas reales (1 manzana, 1 yogur, puñado de nueces), guarniciones máx. 200 g, sin avena ni pan sueltos (el desayuno se completa con recetas componente). Si nada encaja, deja el hueco y avisa (`avisos`, visible al generar la semana).

### Aprendizaje de gustos (`lib/nutricion/preferencias-cliente.ts`, test `scripts/preferencias-cliente.test.ts`)
- Platos habituales del cuestionario (`dieta_habitual_cliente`) puntúan recetas y complementos de su franja (+0,1; «sustituible» pesa la mitad); alimentos a evitar del perfil excluyen complementos; recetas que el **cliente** cambia por otra se anotan como `swap_rechazada` (1 vez: ×0,85; ≥2: fuera si quedan ≥3). Las comidas al día salen del cuestionario si no hay `comidas_dia` ni franjas en el plan (`franjasDeHabitual`).
- Grupos a evitar: «pescado azul», «marisco», «carne roja», «lácteos», «frutos secos» se expanden a sus alimentos (`lib/plan-recetas.ts`).

### Reglas clínicas (`lib/nutricion/reglas-clinicas.ts`, test `scripts/reglas-clinicas.test.ts`)
- Desde `condiciones_salud` (texto libre): dislipidemia (excluye vísceras y embutidos, penaliza burgers/kebab/queso/fritos, favorece legumbre y pescado), hipertensión, diabetes/prediabetes (penaliza azúcares), anemia (favorece hierro). Se aplican en `filtrarRecetasPorSlot`; «sin diabetes» o «TA normal-alta» no activan nada.

### Recetario (743→~755 aprobadas)
- **Pool de merienda:** `SLOT_TIPOS_PERMITIDOS` ahora admite `completa` en Merienda/Media mañana/Snack (7→22 candidatas).
- **96 recetas nuevas** (en 7 lotes `scripts/lotes/2026-10-07_*.json`, generadores `_generar-lotes-2026-10-07*.py`): desayunos de deportista, meriendas, comidas ligeras, veganas, variedad de proteínas, desayunos con menos azúcar. Aprobadas por Carlos y verificadas.
- **Mantenimiento** (`scripts/mantenimiento-recetario-2026-10-07.mjs`, `corregir-raciones-ligeras-…`, `variantes-recetario-…`, `auditar-recetario-uso-…`, `auditar-etiquetas-vegano-…`): 43 recetas sin categoría hechas visibles, 8 etiquetas Vegano/Vegetariano falsas retiradas (caballa «Vegano»…), salsas/bebidas/panes reclasificados (`salsa_base`, `bebida`, `guarnicion`), 19 nombres en castellano, 2 títulos «Pre-Running» limpiados, 23 recetas descartadas (duplicados y variantes casi idénticas), 10 platos únicos con ración real. Copias y `--revertir` en los scripts.
- **Clientes de prueba:** «Carlos Rodríguez» renombrado a **Marcos**; nueva **Laura Vidal** (`scripts/crear-clienta-trail.ts`, ultra 50 km el 15-11-2026). `scripts/regenerar-semana-cliente.ts [prefijo]` regenera y muestra la semana con copia previa.

### Lecciones
- Probar el motor con clientes distintos (vegana, dislipidemia, deportista de 3.000 kcal) destapa fallos de datos que no se ven con uno solo: una etiqueta «Vegano» falsa, tipos de receta mal puestos y un pool de merienda recortado por el tipo.
- `tipo_receta`, `categoria` y `tipo_plato` deciden qué ve el planificador; una receta sin categoría es invisible. Auditar esos tres campos tras cada importación.
- Una receta con ración mal marcada engaña al motor (kcal/ración baja); antes de «corregir» comprobar la proteína por ración resultante (60-70 g = no).
- La repetición de proteína se calcula por palabras del nombre: nombres en inglés o ingredientes nuevos (alubia, dorada…) hay que añadirlos a `PROTEINAS`.
- GitHub devolvió «Internal Server Error» en un push durante varios minutos con «All Systems Operational»; reintentar más tarde (no es del código).

### Auditoría de seguridad de lo tocado
- Ruta nueva `PATCH …/semana-dieta/complemento` usa `autorizarSemanaDieta` (coach propietario). `GET /api/alimentos?generico=1` es el mismo endpoint público de catálogo (solo lectura, sin datos de clientes). Scripts nuevos leen `.env.local`, ningún secreto en commits (revisado). Los lotes y mantenimientos operan con service role solo desde terminal.

### Pendiente
1. Fotos (≈389 recetas sin foto; OpenAI sin saldo). 2. 19 recetas con <3 ingredientes y 2 con datos erróneos (arroz con pollo y salsa de cilantro, lentejas estofadas). 3. Decidir Mealprep Carne / Kebab / Pollo burger (siguen saliendo en planes). 4. Más recetas veganas y cenas ligeras. 5. Migración para sabor (dulce/salado) y mini-comida. 6. Que el coach vea por qué se propone cada plato y una pantalla de lo aprendido del cliente. 7. El aviso de huecos solo sale al generar la semana (no al reajustar ni activar).

## ✅ SESIÓN 07-10-2026 (tarde, Claude) — Contenido probado, Fase B cerrada, víspera corregida y reconstrucción autónoma de recetas

Commits en `main`: `f1340d2`, `a5194c5` (Contenido), `7b41642` (coste), `c4fc3ad` (micronutrientes), `d6435a7` (víspera), `db23c2d` (reconstrucción segura) y docs.

### Contenido (probado en producción con la sesión de Carlos)
- Recorrido completo bien: Bandeja → Tablero → Día de grabación (compra, orden, escaleta, planos persistentes) → Colocar en dieta → Calendario con 🎬. Verificado también en BD (`comidas_planificadas`) y restaurado todo lo tocado.
- Arreglado: selector «Dieta de» (`/api/clientes` devuelve `nombre` y `apellidos` por separado; el regex buscaba «casanova» solo en `nombre`) → hook `components/contenido/useClientes.ts` + `lib/contenido/clientes.ts` (etiquetas sin duplicados por plan, recuerda la elección); resultado de «Colocar» ahora es un cuadro fijo (el toast pasaba desapercibido; con la semana en curso no coloca y lo explica); el día de grabación se recuerda por pestaña (`sessionStorage`).
- Auditoría: `plan_id` de una pieza debe ser de un cliente del coach (`planEsDelCoach`); `estado` + `planos_hechos` a la vez manda el estado; `/api/clientes` ya no expone `error.message`.

### Fase B (verificada: casi todo existía desde mayo)
- Coste semanal admite semanas planificadas +1…+8 (`?semana=N`, selector en la tarjeta) y **ahora comprueba que el cliente es del coach** (antes cualquier usuario logueado lo leía).
- Informe de micronutrientes para el coach (`lib/micronutrientes/plan.ts`, tarjeta «Micronutrientes del plan» en Nutrición → «Más herramientas»). Corrige un fallo del portal: sumaba TODAS las comidas del plan contra objetivos diarios (×7 en planes de 7 días); ahora media diaria.

### Planificador de víspera/carrera
- Causa 1: el planificador descarta recetas sin `verificacion` si hay ≥3 verificadas → tras aprobar un lote hay que ejecutar `verificar-recetas-auto.ts --apply`. Causa 2: `repartirSemanaSinRepetir` solo re-puntuaba las 24 primeras candidatas por encaje de macros; en víspera ahora mira 80 con penalización 0,05 por posición. Probado con un maratón ficticio en Andrés (borrado).

### Sistema autónomo de reconstrucción de recetas (`lib/recetas/reconstruccion-segura.ts`)
- `scripts/reconstruir-recetas-seguro.ts [--apply]` + `scripts/restaurar-receta.ts <id> --apply`. Valida cada vínculo (exacta/buena/dudosa), tabla `ALIAS` revisada, puertas de plausibilidad, ajuste de raciones que conserva el tamaño de ración, mismo quality gate ANTES de escribir, copia + verificación + reversión automática, informe en `salidas/`.
- 8 de 11 propuestas aplicadas. Bloqueadas (decisión humana): Mealprep Carne, Kebab de ternera, Pollo burger (propuesta absurda de 2.925 kcal).
- Creado el alimento «Mayonesa ligera» (275 kcal/100 g, `fuente='coach'`, `fuente_nutricional='desconocida'`: el `CHECK` de `fuente` solo admite coach/curada/ia/bedca/openfoodfacts).

### Datos de Carlos corregidos
- Plan rendimiento, comida «Pollo Shawarma Crujiente»: salsa de soja 100 g (alimento basura «Daqui pii») → 15 g de «Salsa de soja»; sodio 6.390 → 1.721 mg. El alimento «Daqui pii» sigue en el catálogo sin uso (borrar solo con confirmación).

### Lecciones
- Un `alimento_id` ya rellenado en una propuesta no es prueba de que el vínculo sea correcto: validar SIEMPRE el nombre.
- Al filtrar salidas con `grep` por palabras clave se pueden atribuir líneas a la receta equivocada (el «wok con bloqueantes» era un error mío: los bloqueantes eran de las 2 siguientes, descartadas). Ver el JSON completo antes de afirmar.
- Antes de crear alimentos «que faltan», buscar el equivalente en el catálogo con otro nombre (Col=Repollo, etc.).
- `comida_alimentos.cantidad_gramos` es la cantidad final aplicada; `factor_ajuste` solo informa de la proporción frente a la receta base.
- Sesiones en paralelo (Codex): `git status` mostraba cambios que no eran míos; commitear solo los ficheros propios (`git add <rutas>`).
- Prueba contra producción: refs de `browse` caducan al re-renderizar; usar `js` con `find` por texto y esperar 4-6 s tras cada clic.

### Pendiente para la próxima sesión (Carlos revisa la app y plantea cambios)
1. Revisar en pantalla: tarjetas de coste y micronutrientes (Nutrición → «Más herramientas»), recetas reconstruidas (Kebaprol 6 raciones, Burrito 5, Tofu 2, Ensalada de pollo 762 kcal) y el apartado Contenido.
2. Decidir Mealprep Carne y Kebab (versión actual o propuesta); Pollo burger no aplicar.
3. Menores: «Colocar» y fecha en la semana en curso no se coloca (solo +1…+8); fotos de las 11 recetas de víspera (OpenAI sin saldo); borrar el alimento «Daqui pii» si Carlos confirma; reel real de Content Radar para probar el enlace automático por `url_origen`.

## ✅ SESIÓN 07-10-2026 (Claude) — Apartado «Contenido»: ideas, tandas de grabación y publicación

Pedido de Carlos: apuntar recetas que ve en Instagram/TikTok o que ya tiene en el recetario, documentarlas y organizar días de grabación en tanda, alineados con su dieta y con la compra. Spec: `docs/superpowers/specs/2026-10-07-contenido-grabacion-design.md`; plan: `docs/superpowers/plans/2026-10-07-contenido-grabacion.md` (13 tareas, ejecutado en modo nativo con TDD). Commits `52b7e63`→`e21db3e` más el cierre.

### Qué hay
- **Menú del coach → «Contenido»** (`/contenido`), 4 vistas: **Bandeja** (entrada rápida: nota, enlace o ambos), **Día de grabación** (compra consolidada, orden de cocinado, escaleta de 6 planos con casillas, «Añadir desde mi dieta», «Añadir otra receta del recetario», casilla «Entra en mi dieta» y «Colocar en mi dieta»), **Tablero** (7 estados, fechas de grabación y publicación) y **Calendario** (semana con grabación, publicación y lo que comes cada día; 🎬 si una receta «para grabar» ya está en la dieta).
- **Tabla `piezas_contenido`** (migración `20261007120000`, **aplicada en producción** con `supabase db query --linked` tras confirmación de Carlos): estado `idea→documentada→para_grabar→grabada→editada→programada→publicada`, `receta_id`/`plan_id` opcionales, `planos_hechos text[]`, RLS por `coach_id`. Las rutas usan service role y filtran por coach.
- **Módulos puros con test** en `lib/contenido/` (`estados`, `escaleta`, `fechas`, `enlace`, `tanda`, `validacion`) y con cliente Supabase falso (`piezas`, `compra-tanda`). Tests: `scripts/contenido-*.test.ts` y `scripts/lista-compra-agregar.test.ts` (ejecutar con `npx tsx`). `agregarIngredientes` se extrajo de la ruta semanal a `lib/lista-compra/agregar.ts` (la ruta no cambia de comportamiento).
- **El icono de vídeo del planificador** (`/api/recetas/[id]/contenido`) ahora escribe en piezas y `recetas.contenido_estado` es un **caché derivado** (`sincronizarIconoReceta`): no tocar sus 4 lectores.
- Un enlace de Instagram/TikTok se enlaza con la receta buscando `recetas.url_origen` normalizado (sin `www`, parámetros ni barra final; YouTube conserva `v`). **No se lanza Content Radar desde la app**: Carlos sigue compartiendo el reel a Content Radar y la pieza se enlaza sola cuando la receta aparece.

### Auditoría de la sesión
- Toda ruta `app/api/contenido/**` y la del icono pasan por `autorizarCoach`; las que reciben `cliente_id` comprueban además `autorizarSemanaDieta` (coach propietario). Sin `err.message` en respuestas, sin claves en componentes cliente, UUID y fechas validados.
- **Hallazgo corregido con TDD:** `enlace_referencia` aceptaba `javascript:` y se pinta como `<a href>`. Ahora solo http(s).
- RLS y restricciones comprobadas contra la BD real: estado inválido rechazado, pieza válida insertada y borrada, 0 restos.
- **Menores aplazados:** el caché del icono se actualiza por `receta_id` sin comprobar de qué coach es la receta (hoy hay un solo coach); un PATCH con `estado` y `planos_hechos` a la vez no los reconcilia; `plan_id`/`receta_id` llegan del cliente sin comprobar pertenencia (solo referencias).

### Límites conscientes
- «Colocar en mi dieta» solo cubre las semanas +1…+8 (`comidas_planificadas`); la semana en curso avisa y no coloca. **Sustituye** lo que haya en esos huecos de Comida/Cena (pide confirmación).
- La tanda usa las cantidades completas de la receta (se cocina entera para grabar); el coste usa el precio más barato por ingrediente; «ya lo tengo» vive en localStorage.
- Sin entreno en el calendario ni arrastre en el tablero (decisión de Carlos: el entreno se graba aparte).

### Pendiente
1. **Probar la interfaz en navegador con Carlos** (no se pudo: exige que inicie sesión; `browse --headed` + handoff). Recorrido: apuntar idea con enlace → marcar para grabar → fecha → día de grabación → marcar planos → colocar en dieta (semana +1) → calendario con dieta. Comprobar que el icono del planificador y el contador «en la dieta» cuadran.
2. Probar con un reel real ya extraído por Content Radar que el enlace automático por `url_origen` funciona (el puente Content Radar→NutriCoach sigue sin probarse con datos reales: pendiente #1 del CLAUDE.md raíz).
3. Si estorba: entreno en el calendario, arrastrar tarjetas, coste por supermercado, tipo de cocción en el orden.

### Lecciones
- Verificar el plan contra el código antes de prometer: la primera versión del plan prometía lanzar Content Radar desde la app, algo imposible; salió al leer cómo funciona Content Radar.
- Los módulos con base de datos también se testean TDD con un cliente Supabase falso (tabla → filas fijas, registra escrituras); cubrió el enlace por `url_origen` y la sincronización del icono.
- Escribir un componente de UI una sola vez cuando tres tareas lo comparten, y dejarlo anotado, es más barato que reescribirlo tres veces.

## ✅ SESIÓN 07-10-2026 (Claude) — Prueba de extremo a extremo con Carlos y fallos encontrados

Carlos pidió probar todo con su propio cliente (`04cc53b3`) y apuntar los fallos. Probado en producción: analíticas, duración/hora de sesión, competición, planificador (semana +2), suplementación (propuestas, aprobar/descartar), bandeja de recetas y API con entradas inválidas.

**Fallos encontrados y corregidos**
1. **Dos sistemas contradictorios en Competiciones:** la tarjeta antigua (`CompeticionesManager` + `lib/alto-rendimiento/macros-por-fase.ts`) decía «Pico máximo, 9 g/kg» a 18 días (y 10 g/kg de tapering), contra el motor nuevo. Ahora `GET /api/clientes/[id]/fase-deportiva` calcula la fase con `faseEnFecha(…, disciplina)` y devuelve `objetivo_hoy` del mismo motor; la tarjeta lo muestra con g/kg y el consejo del día. `macros-por-fase.ts` quedó **sin usos** (código muerto, no borrado).
2. **Aprobar desde la bandeja no verificaba:** el motor solo usa recetas verificadas si hay ≥3 (`lib/plan-recetas.ts`), así que las recetas recién aprobadas quedaban fuera de los planes sin avisar. Nuevo `lib/recetas/verificacion-auto.ts` (`motivosIncompleta`, `verificarRecetasCompletas`) llamado al aprobar (lote y individual); el script `verificar-recetas-auto.ts` lo reutiliza. Efecto medido: la semana +2 de Carlos con Hyrox el 25-10 pasó a usar las recetas nuevas (víspera 3.086 kcal frente a un objetivo de 3.109).
3. **Instrucciones demasiado cortas** (<80 caracteres) en 3 recetas del lote 2: ampliadas.
4. Botón «Aprobar aprobables» mostraba (0) mientras cargaba: ahora «…».

**Pendiente / no corregido** (las otras 3 incidencias de la lista original se corrigieron después: aprobar sin dosis la completa con la propuesta actual, `intensidad_sesion` deducida de la sesión de hoy para la cafeína de sesión —sin cambiar las pautas diarias— y «Ninguna» ya no cuenta como condición; contexto en `lib/nutricion/contexto-suplementos.ts` con test)
- La vista previa de semanas futuras no incluye complementos (se añaden al activar la semana). **Resuelto como aviso (07-10):** el encabezado dice «media estimada sin complementos», los totales llevan «≈» y solo se ponen en rojo si superan el objetivo; comprobado en producción. Calcular los complementos en la propia vista previa queda sin hacer.
- **Dos sesiones de Claude Code a la vez comparten el mismo navegador de pruebas (`browse`, una sola pestaña) y la misma base de datos:** produjeron lecturas incoherentes (contadores a 0, clics ambiguos, pestaña movida) y archivos temporales ajenos. No lanzar dos sesiones sobre este proyecto a la vez.
- **Tarjeta de suplementación del portal comprobada** con la sesión del cliente: agrupa por «Día a día» / «Día de carrera», muestra dosis, momento y nota del coach, no enseña lo descartado, usa «Según la pauta del coach» cuando falta dosis y no desborda a 390 px.

**3.er lote de víspera/carrera/recuperación (07-10-2026, ya aprobado y verificado con `aprobar-aprobables-gate.ts` + `verificar-recetas-auto.ts`):** `scripts/lotes/2026-10-07_vispera-carrera-3.json`, 7 recetas importadas **en revisión** (todas aprobables, calidad media 82,3): macarrones con merluza, fideos con gambas, tortitas de arroz con atún y 4 de **recuperación** marcadas `es_post_entreno` (arroz con pollo y huevo, batido de plátano/leche/proteína, bocadillo de pavo y queso fresco, pasta con pollo). Se descartaron 2 de cuscús (6,3-6,7 g de fibra por la propia composición). Al aprobarlas desde la bandeja se verifican solas. **Regla de Carlos (07-10-2026): las recetas para víspera/carrera/recuperación no llevan ese uso en el título ni en los textos** (se usó para renombrar 3 recetas y reescribir descripciones, consejos e instrucciones de los 3 lotes en tono general; el uso se marca con `perfil: pre|post` y la composición). «Ensalada de pollo con aderezo» perdió la verificación al reutilizar el módulo en el script: **siempre tuvo una sola instrucción** (59 caracteres; extracción de Instagram incompleta, confirmado en `salidas/copia-receta-950773b4….json` y en la propuesta del 02-10), no fue un daño de la otra sesión. Se redactaron 6 pasos completos a partir de sus 23 ingredientes y se volvió a verificar (score 97). Revisado también **todo el recetario**: se renombraron 4 recetas antiguas («Batido de recuperación de plátano y proteína», «Batido pre-entreno de plátano y naranja», «Pre-carrera: pan blanco con mermelada y plátano» —ahora con `es_pre_entreno`—, «Smoothie Verde de Recuperación…») y se reescribieron los textos de «Bowl de Patata Asada con Pollo y Salsa de Yogur»; ninguna estaba en un plan. Comprobado: 0 títulos y 0 descripciones/consejos con ese tipo de uso.

**Auditoría de seguridad de cierre (07-10-2026):** (1) `GET/POST/DELETE /api/clientes/[id]/fase-deportiva` solo comprobaban sesión (GET) o rol coach (POST/DELETE) sin verificar que el cliente fuera del coach; el GET devolvía además, desde mi cambio de la tarjeta, el peso y el objetivo de hoy del cliente → ahora `autorizarCoachCliente` en los tres. (2) `GET/POST /api/recetas/revisar` solo exigían sesión: cualquier usuario identificado (también un cliente) podía listar el recetario con su calidad interna y **aprobar hasta 250 recetas en lote** → ahora exige `profiles.role = 'coach'`. Revisadas y correctas: analíticas, comidas-dia, hora de sesión, suplementación (coach + propiedad + validación + catálogo cerrado), `/api/cliente/suplementacion` (sesión del cliente, solo filas aprobadas propias). Pendiente a vigilar: el resto de rutas de `/api/recetas/*` no se auditaron hoy.

**Datos de prueba: ya limpiados (07-10-2026).** Se borraron la competición, las analíticas simuladas, las propuestas aprobadas (queda la fila original de creatina en «propuesta»), la hora/duración de la sesión del miércoles, la semana +2 y la tabla temporal de respaldo; la semana +1 real de Carlos quedó idéntica a su respaldo (24 comidas, 0 diferencias).

## ✅ SESIÓN 06-10-2026 (Claude + Codex) — Recetas de víspera/carrera, bandeja única de revisión y analíticas

Commits en `main`: `0ceec65`, `ebdb424`, `b060c51` y dos correcciones visuales (`fix:` botones Aprobar invisibles y tabla cortada).

### Recetas de víspera y carrera
- `candidatasDeCompeticion()` (`planificar-semana.ts`) pide candidatas **con el objetivo del día** (660 g de hidratos la víspera de un maratón, no los 356 g del plan) para los huecos de víspera, carrera y recuperación; `repartirSemanaSinRepetir` las usa por clave `contexto:franja` (`claveCompeticion`) y recurre a las de la franja si no hay. Con un test en `scripts/receta-competicion.test.ts`.
- **El cuello de botella era el recetario, no el algoritmo:** de 242 recetas de Comida/Cena solo 17 servían para víspera (≥55 % de las kcal en hidratos, fibra <6 g, grasa ≤20 g). Se creó `scripts/lotes/2026-10-06_vispera-carrera.json` (10 recetas: arroz blanco, macarrones, fideos, bocadillo y 4 desayunos pre-carrera marcados `es_pre_entreno`), importadas con `importar-lote-verificado.ts`. Lección repetida: ajo/perejil <5 g bloquean el quality gate (`cantidad_muy_pequena`); el importador no inserta nada si hay una rechazada (usar un lote temporal solo con las nuevas).
- Medido con el plan real de Carlos y un maratón simulado el 11-10 (solo lectura): CHO medio de las 6 comidas de víspera/carrera **52 % → 59 %**. El día de carrera sale bien (tostadas con mermelada y plátano, macarrones, fideos); la víspera mejora menos (porridge con 7,9 g de fibra y un wrap con 47 % de hidratos). Falta más variedad de recetas de víspera.

### Bandeja única de revisión (`/recetas/revisar`)
- Antes: Revisión, Pendientes (`/recetas/cola`), Imágenes, Auditoría y Cobertura se pisaban y `/revisar` listaba las 699 recetas por nombre, así que las pendientes se perdían. Ahora `/recetas/revisar` es la **Bandeja de revisión** con pestañas por tarea y contador: Pendientes, Nuevas hoy, Con bloqueos, Sin foto, Todas; buscador, «Más filtros» (nivel fit, tipo de uso, apta para), aprobar/descartar/abrir en cada fila y «Aprobar aprobables». `/recetas/cola` redirige aquí; el menú tiene una sola entrada «Revisión» con el badge de pendientes. `lib/recetas/revision.ts` (+ test) tiene las reglas de tarea y el día en hora de Madrid. Imágenes sigue como pantalla propia, enlazada desde la columna Foto.
- **Bugs vistos al probarlo en producción con Carlos:** `var(--primary-foreground)` no existe en el tema (botón Aprobar con texto del color del fondo; el patrón del proyecto es `color: var(--bg)`), y a 1280 px la tabla cortaba la columna de acciones (ahora tarjetas hasta `2xl` y acciones fijas en la tabla). Barrido de variables CSS no definidas en los componentes de hoy: ninguna más.
- **Cuidado con sesiones paralelas:** a las 12:41-12:43 otra sesión aprobó por lote las 118 pendientes (eventos `aprobada_lote`) y verificó 649 con `verificacion_auto`; la bandeja quedó con 0 pendientes. Las 10 recetas de víspera/carrera están aprobadas. No se pudo explicar un descuadre de 3 recetas entre `en_revision` (121→118) y `descartada` (3→6) antes de ese lote; las 6 descartadas son de mayo/junio.

### Bebidas de hidratos y sales (07-10-2026)
- Petición de Carlos: el día previo de una prueba larga se suele meter **drink mix tipo Maurten** (muchos hidratos, más cómodo que comer sólido) y sales/pastillas. `suplementos.ts` añade `bebida_hidratos` (solo en `carrera_inminente` y si la prueba lo pide: 8 g/kg a 60-150 min, 10 g/kg >150 min): propone cubrir ~30 % del objetivo diario con bebida (25-40 %), con los gramos calculados con el peso (p. ej. 82 kg, media maratón: ~197 g de 656 g ≈ 2 sobres de 80 g, en 2-4 tomas) y la advertencia de que esos hidratos **cuentan dentro del total del día** y de que los gramos por sobre se leen de la etiqueta (no se han fijado cifras de producto). `hidratacion_previa` (race_day): 5-7 mL/kg ≥4 h antes con sodio o snack salado (ACSM 2007, Sawka). `electrolitos_sodio` indica ahora las formas: pastillas o cápsulas de sales, sobres de electrolitos, bebida o geles con sodio. El consejo de los días de carga sugiere repartir en 5-6 tomas y llevar parte en bebida. **No hay evidencia para recomendar «carga de sodio» antes de la prueba** (por eso solo se habla de sodio durante el esfuerzo y de hidratación previa).
- Aún no descuenta los hidratos de la bebida del objetivo de comida sólida del planificador (el objetivo del día los incluye todos).

### Analíticas del cliente
- `GET/PATCH /api/clientes/[id]/analiticas` (solo coach propietario; fusiona con `analisis_valores`, `null` borra una clave, valida claves/valores) y `components/clientes/AnaliticasPanel.tsx` en la pestaña **Perfil**. `lib/analiticas-marcadores.ts` es la lista única de marcadores (la usa también el onboarding). Vitamina D y ferritina <30 ng/mL activan esas propuestas en Suplementación. Cargado y revisado en producción; **no se probó a guardar** (no se quiso escribir en la ficha de Carlos).

### Pendiente
1. ~~Aprobar los lotes 2 y 3 de víspera/carrera/recuperación~~ **Hecho (07-10-2026):** los 3 lotes (28 recetas) están aprobados y verificados (711 aprobadas, 0 pendientes). Falta probar la semana de carga con una competición real cargada.
2. Probar el guardado de analíticas y la tarjeta de suplementación del portal con un cliente que tenga datos.
3. Revisar el descuadre de 3 recetas y quién lanzó el lote de aprobación; la API `GET /api/recetas/revisar` solo exige sesión (no rol coach).

## ✅ SESIÓN 05-10-2026 (tarde, Claude + Codex) — Periodización por competición, suplementación y hora por sesión

Pedido de Carlos: seguir con los pendientes de la lista. Hecho de punta a punta y probado en producción con su sesión de coach (handoff). Commits en `main`: `c1aeb68`, `048a2ca`, `84ae038`, `6361854`, `3bdc301`, `5ee0ac4`, `8b37cda`.

### Flujo de trabajo (cambio importante)
Desde hoy **solo Claude y Codex**; DeepSeek (sin saldo, 402) y Gemini quedan fuera del flujo hasta nuevo aviso (memoria `config_delegation_rules`). Codex: `~/.claude/scripts/codex_ejecutor.sh "BRIEFING" <dir> workspace-write` (si «at capacity», `CODEX_MODELO=gpt-6-sol`). No escribe fuera de `nutricoach/`, no hace commit y `tsx` le falla por EPERM: Claude revisa el diff, ejecuta `tsc` y tests y commitea.

### Periodización por competición (`lib/nutricion/competicion.ts`, `objetivo-dia.ts`)
- `faseEnFecha(fechaPrueba, fecha, disciplina?)` replica la vista SQL `fase_deportiva_cliente` por fecha (sirve para semanas futuras). `objetivosPorDia(db, clienteId, plan, semana = 0)` calcula la fecha real de cada día, consulta `competiciones` activas y **sustituye** el ajuste por tipo de entreno en tapering, víspera, día de carrera y recuperación (10 días). Las semanas futuras, la lista de la compra y `planificar-semana` pasan el offset de semana.
- Perfil por disciplina (duración típica de aficionado): corta (5k, 10k, CrossFit), media (Hyrox, triatlón sprint), larga (media maratón, trail corto, olímpico), muy larga (maratón, trail largo, 70.3, ciclismo de fondo, Ironman, ultra). **Tapering** 7 / 10 / 14 días (Mujika & Padilla 2003, Bosquet 2007). **Carga de hidratos** en g/kg con el peso del cliente (último check-in o `peso_inicial`), según la **duración** de la prueba (corta ≤60 min, media 60-90, larga 90-150, muy larga >150; si la competición tiene `tiempo_objetivo_min` se usa ese tiempo, si no la duración típica de la disciplina): 8 g/kg las últimas 36-48 h en pruebas de 90-150 min (media maratón, olímpico, trail corto), 10 g/kg a partir de 150 min (maratón, 70.3, Ironman, ultra, ciclismo de fondo), 8 g/kg solo el día previo en pruebas de 60-90 min (Hyrox, sprint). **Base (06-10-2026):** metaanálisis 2026 de acceso abierto (doi 10.1111/sms.70379, en la KB): >8 g/kg/día durante 36-48 h, con mucha heterogeneidad; la guía clásica (Burke 2011: 10-12 g/kg en pruebas >90 min) no se pudo comprobar en el texto completo (no es abierto; los abstracts no traen la cifra), por eso se usa su extremo bajo. Antes se usaba 10 g/kg en media maratón y 12 en Ironman/ultra (820 g/día en 82 kg: poco práctico). Más de 7 días antes: −5 % kcal y hidratos por kilo constantes. Los días de carga el consejo recomienda repartir en 5-6 tomas.
- Los umbrales de perfil, las duraciones típicas y los 8 g/kg de Hyrox son decisión de criterio dentro de las guías, no cifras de un paper; revisarlos como dietista.

### Suplementación (`lib/nutricion/suplementos.ts`)
- Catálogo cerrado con dosis calculadas por peso: cafeína 3-6 mg/kg, creatina 3-5 g/día, hidratos intra (30-60 g/h; 60-90 con glucosa:fructosa 2:1; geles tipo Maurten con evidencia limitada de ventaja sobre geles convencionales), sodio solo >2 h, beta-alanina, bicarbonato y nitrato como opcionales a probar, recuperación 1,0-1,2 g/kg CHO + 0,3 g/kg proteína. Vitamina D y hierro **solo con analítica** (<30 ng/mL); sin analítica sale el aviso. Renal/hipertensión/embarazo excluyen lo contraindicado. En la prueba manda la duración típica de la disciplina, no la del entreno de hoy. Avisos propios para Hyrox (evidencia directa limitada), triatlón (ingerir en la bici) y pruebas muy largas.
- `GET/PATCH /api/clientes/[id]/suplementacion` (solo coach propietario). Decisiones en la tabla **`suplementacion_cliente`** (migración `20261005180000`, aplicada; RLS: coach gestiona, el cliente solo lee lo `aprobada`). Panel `components/clientes/SuplementacionPanel.tsx` en Nutrición → «Más herramientas»: aprobar, descartar, deshacer, editar dosis/momento/nota. Nada llega al cliente sin aprobar; **el portal del cliente aún no lo muestra**.

### Hora por sesión y comidas al día
- Migración `20261005170000` (aplicada con `supabase db query --linked`, el historial local de migraciones sigue desincronizado): `sesiones_entrenamiento.hora_inicio` (text HH:MM) y `clientes.comidas_dia` (2-5, nullable). El motor usa la hora de la sesión sobre `onboarding_perfil_profundo.hora_entreno` para pre/post, y `franjasDelCliente` (tras las franjas que elija el coach) para generar semana. UI: campo de hora en cada sesión de la rutina (guarda al salir del campo) y selector «Comidas al día» en el planificador. `PATCH /api/entrenos/sesion/[id]/hora` y `PATCH /api/clientes/[id]/comidas-dia`.

### Base de conocimiento
- 20 trabajos de referencia añadidos a `knowledge_base` (230 → 250) con `scripts/cargar-papers-clave.ts` (simula por defecto, `--apply` inserta; DOI verificado en PubMed, abstract real, tags para el motor): consensos IOC/ISSN, Jeukendrup 2011/2014, «Training the gut», bicarbonato y nitrato (paraguas), CrossFit/Hyrox, triatlón, ultra, tapering. Los puntos clave solo dicen para qué se usa cada paper; no resumen resultados. `categoria`/`disciplina` están restringidas por CHECK (lista cerrada). Falta el consenso de hiponatremia 2015 (PubMed sin abstract).

### Verificación y lecciones
- Tests: `scripts/competicion.test.ts`, `suplementos.test.ts`, `hora-sesion-comidas-dia.test.ts`, `ajustes-coach-validacion.test.ts` (ejecutar con `npx tsx`). `tsc` limpio.
- Probado en producción: panel (aprobar → persiste tras recargar → deshacer), selector de comidas al día y hora de sesión (el planificador pasó de «entrena sobre las 14:03» a «07:30»). Todo revertido en el cliente de Carlos.
- La hora de entreno del cuestionario de Carlos es 14:03 (valor raro, revisar). Las sesiones no tienen `duracion_estimada_min`, por eso «Entreno de hoy» sale vacío.
- `<input type="time">` no dispara el guardado hasta salir del campo; `browse fill` no acepta valor vacío (vaciar con JS y el setter nativo).
- Los ajustes de periodización se probaron con base de datos simulada y en producción solo sin competiciones; **falta probarlos con una competición real cargada** (Carlos no tiene ninguna).

### Segunda tanda de la noche (commits `9992f39`, `4468c53`, `3d58173`)
- **Portal del cliente:** `GET /api/cliente/suplementacion` (sesión del cliente, solo filas `aprobada` de su propio cliente) y `components/PortalCliente/SuplementacionPortal.tsx`, tarjeta colapsable en la pestaña de dieta de `app/cliente/page.tsx`. Codex unificó el catálogo (`getFichaSuplemento`) para no duplicar textos. **No probado visualmente** (el cliente de Carlos no tiene nada aprobado ahora mismo).
- **Analíticas:** `analiticaDe()` en la ruta del coach lee `onboarding_perfil_profundo.analisis_valores` (`vitamina_d`, `ferritina`, ng/mL) y activa vitamina D/hierro si <30. Hoy ningún cliente tiene analítica guardada.
- **Víspera / día de carrera / recuperación en el motor:** `lib/nutricion/receta-competicion.ts` puntúa (hidratos/kcal, fibra y grasa bajas, pre-entreno en el desayuno de carrera, absorción fácil en la víspera) y `generar-semana.ts` solo **reordena** las 24 candidatas más cercanas; sin competición el resultado es idéntico. Se añadió `fibra` al select de recetas (las 575 aprobadas la tienen).
- **Límite medido con datos reales (maratón simulado el 11-10 en el plan de Carlos, solo lectura):** los huecos salen etiquetados, pero la mejora de recetas es modesta (el desayuno de carrera salió un wrap con 42 % de las kcal en hidratos). Causa: el pool de candidatas se filtra por kcal/proteína del plan, no por el objetivo del día, y el reparto sin repeticiones mueve las mejores a otros huecos. Probé ventana 60 y penalización suave: no mejoró, se revirtió. Mejora real pendiente: pedir candidatas por día con el objetivo de hidratos del día.
- **Duración de sesión:** el mismo `PATCH /api/entrenos/sesion/[id]/hora` admite `duracion_estimada_min` (10-480); campo «Duración (min)» en la rutina del coach. Alimenta hidratos y sodio del «Entreno de hoy».
- **Lección de herramientas:** Codex lee `~/.Codex/AGENTS.md` (copia de las reglas globales con Director/DeepSeek) y dos de cuatro tareas se negaron a escribir código «porque había que delegar en DeepSeek». Arreglado añadiendo la regla vigente (solo Claude y Codex) al prompt de `~/.claude/scripts/codex_ejecutor.sh`. Si vuelve a pasar, revisar ese prompt.

### Pendiente
1. Elegir recetas de víspera/carrera con el objetivo de hidratos del día (ver límite arriba) y probar la semana de carga en el planificador con una competición cargada de verdad.
2. Probar visualmente la tarjeta de suplementación del portal con un cliente que tenga algo aprobado, y el campo de duración en la rutina.
3. Pantalla para guardar las analíticas del cliente (hoy solo se rellenan en el onboarding).

## ✅ SESIÓN 05-10-2026 (Claude) — Planificador semanal: rendimiento, Resumen, guarniciones, varios platos por comida, objetivo por entreno y pre/post

Carlos: el planificador semanal del coach iba lento y no seleccionaba bien el día; la pestaña Resumen era redundante; en la semana regenerada salían "patatas gajo" como media mañana. De ahí salió un rediseño del motor para que **una comida pueda llevar varios platos "como un dietista"** y para que el objetivo dependa del entrenamiento. Commits en `main`: `eb2c1a1`, `b49a3a8`, `cbac7b0`, `a52c432`, `25c824b`, `d70702b`, `30fcec2`, `c7ee385`, `1dcea64` (todos desplegados en Vercel; Carlos prueba recargando la webapp, ver memoria `feedback_push_directo_main`).

### Planificador: rendimiento y selección de día
- **Causa 1:** `DetalleDiaDieta` mostraba el nombre del día nuevo con el contenido del anterior hasta que respondía el servidor. **Causa 2:** cada clic pedía `/semana-dieta/dia` y el servidor releía todo el plan (7 días con alimentos anidados) para quedarse con uno.
- **Arreglo:** `detalleSemanaEnCurso` / `detalleSemanaFutura` (`lib/nutricion/detalle-dia.ts`) devuelven los 7 días en una lectura (`GET /semana-dieta/dia` sin `dia`); el componente los carga una vez por semana y cambiar de día es instantáneo. Cabecera del día entera clicable y día seleccionado resaltado.
- **Resumen de la ficha** (`components/clientes/ResumenCliente.tsx`): "Requiere tu atención" (plan sin revisar, sin dieta/entreno, check-in atrasado o sin respuesta, chat sin leer, revisión vencida, membresía por caducar) + "Evolución" (peso, tendencia, adherencia/energía/sueño vs check-in previo). Quitado el snapshot redundante.
- **Tarjeta "Plan activo"** de la ficha: cada macro se compara con el día seleccionado en el planificador (`onResumen` → `ResumenDia`): `faltan X` / `+X de más` y media de la semana. Solo en escritorio y solo se actualiza desde la pestaña Nutrición.
- **Kanban de dieta del portal cliente:** kcal por plato y por día, color según desviación y toast de aviso si el día destino se desvía >20 %.

### Motor: complementos, guarniciones y varios platos por comida
- **`lib/nutricion/completar-comidas.ts`** (`completarSemana`): tras asignar los platos principales cierra el hueco de kcal/macros de cada comida con hasta 3 complementos (guarnición o base, fruta o lácteo, grasa buena). Para cada candidato prueba su ración óptima (pasos de 10 g, mín/máx por alimento) y gana el que deja menos macros por cubrir; **pasarse penaliza el doble** que quedarse corto, repetir en la semana penaliza (×1,12 por uso) y para si ya no mejora un 8 %. Respeta restricciones (sin gluten/lactosa/vegano/vegetariano). Los complementos son `comida_alimentos.es_complemento` (alimento suelto) o receta (`complemento_receta_id`, 1 ración).
- **Se ejecuta** al final de `generarSemana` (parámetro `complementar`, por defecto sí), de `activarProximaSemana` y de `reajustarSemana`. Al regenerar/activar se **borran antes** los complementos de la semana anterior (si no, quedaban pegados a recetas que ya no estaban).
- **`tipo_receta = 'guarnicion'`** = no es plato: ya no sale como plato suelto en Comida/Cena/Media mañana/Snack (`SLOT_TIPOS_PERMITIDOS` en `lib/plan-recetas.ts`; antes Cena y Media mañana lo admitían). En desayuno, las recetas `guarnicion` con `tipo_plato='Desayuno'` son componentes (tostadas, yogur con granola, crema de arroz…).
- **UI:** en el detalle de cada comida, "Añadir plato, fruta o postre" con pestañas *Fruta / alimento*, *Plato / guarnición* (cualquier receta aprobada, guarniciones primero; `GET /semana-dieta?franja=…&todas=1`) y *Postre*. Varios platos por comida a mano.
- **Recetas nuevas (29, aprobadas):** `scripts/lotes/2026-10-05_guarniciones.json` (16: patatas, boniato, arroces, verduras, puré, ensalada, cuscús, quinoa, guacamole) y `2026-10-05_desayuno-componentes.json` (13: 6 tostadas, crema de arroz, porridge, yogures, skyr, café con leche, tortitas). `importar-lote-verificado.ts` admite `tipo_receta` por lote o por receta. 5 guarniciones se rechazaban por llevar <5 g de ajo (regla del gate `cantidad_muy_pequena`): se subió a 5 g y se recalcularon macros. Hay 35 guarniciones/componentes aprobados en total.
- **Fotos:** `generar-fotos-lote.mjs --desde=2026-10-01 --genera` (OpenAI recargado por Carlos): 91 recetas, ~3,1 $. Prueba de 3 correcta (estilo food blogger), resto en segundo plano.

### Motor: objetivo por día según el entrenamiento y comidas pre/post
- **`lib/nutricion/objetivo-dia.ts`** (`objetivosPorDia`): con las sesiones del plan de entreno activo clasifica cada día (`clasificarDiaNutricional`, helper de `lib/periodizacion/dia-entreno-nutricion.ts`; se añadió `h[ií]brid` al regex para "Híbrida…") y ajusta kcal/proteína/hidratos (fuerza +8 %, cardio +10 %, híbrido +12 %, descanso −5 %); la grasa es lo que cuadra las kcal (mín. 60 % de la base). Sin plan de entreno activo = objetivo base. Se usa al generar semana, asignar receta (`POST semana-dieta`), `reajustarPlato` de complementos, activar semana, estimaciones de semanas futuras y la UI (columna del día con tipo y objetivo, detalle y tarjeta de macros). **Botón "Ajustar al entreno"** (`POST /semana-dieta/reajustar`, `reajustarSemana`): mantiene recetas, recalcula cantidades por día y rehace complementos.
- **`lib/nutricion/momentos-entreno.ts`** (`momentoDeEntreno`): con la **hora habitual de entreno (`onboarding_perfil_profundo.hora_entreno`**, NO está en `onboarding_responses`) decide qué comida cae pre y cuál post cada día de entreno (horas por defecto: D 08:00, MM 11:00, C 14:30, Mer 17:30, Cen 21:00; sesión de 75 min; una comida que cae durante la sesión se retrasa a después). Con 3 comidas la "comida previa" puede quedar lejos: nota de tentempié de hidratos. Efecto: `Hueco.momento` hace que `repartirSemanaSinRepetir` prefiera recetas `es_pre_entreno`/`es_post_entreno`; en `completarSemana` pre pesa hidratos ×1,5 y post proteína ×1,5, y no se añade grasa suelta. UI: "· pre/· post" en la comida y línea "Entrena sobre las 14:03 · antes… · después…" en el detalle.

### Datos reales tocados (con permiso de Carlos)
- Semana en curso de Carlos regenerada varias veces (franjas: **3 comidas D/C/C**; yo usé 5 por error la primera vez porque había media mañana/merienda sueltas; se borraron 14 comidas). Días finales 2.570–3.128 kcal vs objetivo 3.108–3.164 en días de entreno, 2.684 en descanso.
- 5 recetas guarnición recalculadas (ajo 5 g); 6 recetas marcadas `guarnicion` de las existentes (gajos de patata al chimichurri, ensaladas de aguacate-pepino y pepino chafado + 3 que ya lo eran).

### Lecciones
- **Franjas por defecto:** "Generar semana" toma las franjas que ya existen en el plan; unas comidas sueltas de media mañana/merienda activan las 5 casillas. Aún no se guarda cuántas comidas al día tiene cada cliente (pendiente, ver abajo).
- **Dónde está el dato:** antes de leer una columna de onboarding comprobar en qué tabla vive (`hora_entreno` está en `onboarding_perfil_profundo`); un `select` a una columna inexistente devuelve `null` sin error visible.
- Una receta con un ingrediente <5 g (ajo incluido) la rechaza el quality gate; subir a 5 g.
- Medir antes de dar por bueno: probar cada cambio del motor sobre la semana real y leer desviaciones por día (se detectó el clasificador "Híbrida→fuerza" y los complementos a ración máxima gracias a ello).
- `sed -i` de macOS no admite el mismo formato que GNU: editar con Python.

### Seguridad de lo tocado
Rutas nuevas (`semana-dieta/reajustar`, `/dia` por semana) usan `autorizarSemanaDieta` (coach propietario del cliente) y `createServiceSupabase` solo tras autorizar; sin secretos nuevos; los lotes de recetas entran en `en_revision` salvo aprobación explícita.

### Pendiente — próximas sesiones (por orden)
1. **Periodización por competición (tapering y carga):** semanas de carga y tapering según carreras programadas (`competiciones` y vista `fase_deportiva_cliente` ya existen para nutrición): objetivo de kcal/CHO por semana y por día, menú del día antes y del día de la carrera, comidas pre-carrera (cena de víspera, desayuno precarrera) y recuperación. Conectar con `objetivosPorDia`.
2. **Suplementación:** pre / intra / post entreno según tipo de sesión, duración y condiciones, y **suplementación diaria** según perfil (edad, sexo, deporte, analíticas/condiciones del informe clínico: vitamina D, hierro, omega-3, creatina, magnesio…). Con evidencia citada (KB de papers), aprobación del coach y sin sustituir a la dieta. Guardar como complemento del plan y mostrarlo en el portal cliente.
3. **Hora de entreno por sesión** (columna en `sesiones_entrenamiento`; migración, requiere permiso): hoy una sola hora para todos los días y a Carlos a veces corre antes.
4. **Guardar comidas al día por cliente** para que "Generar semana" no dependa de las franjas existentes.
5. Semanas futuras (+1…): la vista previa no muestra complementos (se calculan al activar). Valorar mostrarlos estimados.
6. Más recetas de guarnición y de pre/post (coherentes con el tipo de deporte), y Fase B (coste semanal por cliente, lista de la compra inteligente).
7. Pendientes anteriores: 142 hallazgos de ingredientes por revisar a mano, 8 recetas divergentes, velocidad portal (precalentar pestañas), `/auth/callback` ignora `?error=`.

---

## ✅ SESIÓN 04-10-2026 (Claude) — Velocidad "instantánea" del portal cliente: caché, fotos y Suspense

Carlos: la app cargaba al abrir y al pinchar pestañas; "no es instantáneo como debería en cualquier app". Se midió en su sesión real (`browse --headed` + handoff) y se corrigieron 4 causas. Commits `ed9698e`→`13bb69c`, todo en producción.

### Causas y arreglos
1. **Todo esperaba al servidor en cada apertura** → caché SWR persistida en localStorage (`lib/cliente/cache-swr.ts`, provider en `components/PortalCliente/CachePortal.tsx`, montado en `app/cliente/layout.tsx` para compartirla entre `/cliente` y `/cliente/receta/[id]`). Se pinta lo último conocido y se revalida en segundo plano. Se borra en `SIGNED_OUT` y al cerrar sesión. `focusThrottleInterval` 30 s, sin reintentos en error.
2. **Datos de pestañas pedidos al abrirlas** → precarga escalonada en reposo (`requestIdleCallback`) tras pintar: `semana-completa`, recetario página 0 y las 4 primeras recetas de hoy (datos + foto). Al tocar un enlace a receta (`pointerdown`) se pide su detalle antes del clic.
3. **Fotos lentas (la causa mayor): `f_auto,q_auto` de Cloudinary responde con `Vary: Accept, User-Agent, Save-Data`** → una copia en CDN por navegador; la primera petición de cada uno tardaba ~0,8 s aunque se hubiera precalentado con curl. Loader ahora `f_webp,q_75,w_N,c_limit` fijos (`lib/cloudinary-loader.ts`), `deviceSizes [640,1080]` / `imageSizes [48,96,256,384]` en `next.config.mjs`, `preconnect` a res.cloudinary.com en `app/layout.tsx`. Foto de receta en dos capas (`components/PortalCliente/FotoReceta.tsx`): la de 640 px que la tarjeta ya descargó + la grande fundiéndose encima.
4. **React retenía la pantalla 300 ms (FALLBACK_THROTTLE_MS de Suspense)** por componentes `dynamic()`/lazy: contenido listo a los 145 ms, pintado a los 450 ms. Import estático de TLSGauge, NotasCoach, MiPlan, EntrenoSubTabs, RecetarioExplorador y AjustesTabs en `app/cliente/page.tsx`. Mejor caso: primera pintada 488 → 252 ms; commit del contenido tras montar 300 → ~15 ms.
- Otros: proxy usa `getClaims()` (JWT ES256, validación local) en vez de `getUser()` (llamada a Supabase Auth en cada navegación); `lib/cliente/imagen-receta.ts` (misma medida de foto para precargar y pintar).

### Herramientas nuevas
- `scripts/calentar-imagenes-cloudinary.mjs`: precalienta las 4 variantes (96/384/640/1080) de todas las recetas. **Ejecutar tras importar/regenerar fotos** (pedir permiso: consume transformaciones de Cloudinary). Las subidas vía `uploadToCloudinary()` ya se calientan solas (`calentarVariantes`). **Ojo:** las fotos que suba el bridge de Content-Radar (Python) NO pasan por ahí → ejecutar el script después de cada lote.
- Marcas `performance.mark('nc:...')` permanentes en `page.tsx` y `cache-swr.ts` para medir el arranque (`modulo-portal`, `montado`, `contenido-commit`…).

### Lecciones
- **Medir antes de optimizar**: dos de las cuatro causas (Vary por navegador y el throttle de Suspense de 300 ms) no eran las sospechadas; salieron de números reales en la sesión del cliente.
- No usar `f_auto`/`q_auto` en el loader. No usar `dynamic`/`lazy` en lo que se ve en las pestañas principales del portal (solo en lo raro: check-in, chat, compra).
- `browse` no permite throttling de red/CPU (CDP bloqueado a propósito, no saltarlo): los números son de ordenador, no de iPhone. Tras cada deploy el móvil baja el JS nuevo: valorar siempre la SEGUNDA apertura.
- Un `getUser()` en el proxy (middleware) es una ida y vuelta a Supabase por navegación; con claves asimétricas `getClaims()` valida en local.

### Auditoría de seguridad de lo tocado
- La caché guarda datos del cliente (plan, perfil, peso, recetas) en localStorage: se borra en `SIGNED_OUT` y en logout; claves ligadas a la sesión. Riesgo residual: móvil compartido con sesión aún válida. Sin secretos nuevos en código; el script de calentado lee `.env.local` y no escribe nada. El proxy no bloquea accesos (solo sincroniza cookies), cambiar a `getClaims` no altera la seguridad.

### Recetario (misma jornada, noche)
- **59 recetas de los lotes del 01-10 aprobadas y verificadas** (`scripts/aprobar-aprobables-gate.ts`, simula por defecto; usa el último informe `salidas/quality-gate-*.json` por fecha de modificación). 3 snacks simples (score 69-73) se quedan en revisión: Tostadas de jamón con zumo, Bagel con mermelada, Tortitas de arroz con uvas. `verificar-recetas-auto.ts --apply`: 59 verificadas, 1 antigua retirada. Quality gate sobre las 171 en revisión: 11 OK; las 109 de mayo tienen 43 con bloqueantes (cantidades muy pequeñas/sospechosas, match semántico dudoso).
- **Fotos de las 62 nuevas: BLOQUEADO — OpenAI sin saldo** (`insufficient_quota`). `scripts/generar-fotos-lote.mjs --desde=2026-10-01 [--prueba] --genera` (gpt-image-1.5, ~0,034 $/foto, ~2,1 $ las 62; sube a Cloudinary, actualiza `imagen_url`/`imagen_tipo='txt2img'` y precalienta). Para ante falta de saldo. Recargar en platform.openai.com/settings/organization/billing y relanzar (prueba de 3 primero).
- **Fase A (recetario profesional amplio) estaba ~85% hecha, no 0%:** columnas de clasificación, `score_calidad` en las 533 aprobadas (media 85) y `recetas_auditoria` con eventos ya existían; detalle de receta muestra score y clasificación. Faltaba la auditoría en la importación por lote: ahora `lib/recetas/post-import-audit.ts` (`auditarLoteRecetas`) es el punto único y lo usan `app/api/recetas/importar-lote`, `scripts/importar-lote-verificado.ts` y el script de aprobación (59 eventos `aprobada_lote` registrados). **A1 cerrado (commit `ce63a58`):** migración `20261004230000_recetas_clasificacion_manual.sql` (`recetas.clasificacion_manual boolean default false`, aplicada con `supabase db query --linked`). `auditarRecetaProfesional` respeta la clasificación si es manual (solo recalcula el score). `PATCH /api/recetas/[id]/clasificacion` (solo coach, valida contra los enums de `lib/recetas/profesional.ts`; `{auto:true}` vuelve a la automática; deja evento `clasificada`). Editor en la ficha de receta (`components/recetas/ClasificacionEditor.tsx`, chip "editada a mano") y filtros Nivel fit / Tipo de uso / Apta para en `/recetas/revisar`. Probado contra la BD real (manual sobrevive a la auditoría, auto recalcula) y 401 sin sesión en producción; **no probado visualmente en el navegador**. **Fase A completa.**

### Pendiente (de esta línea)
1. Medir en iPhone real (Carlos: "lo veo parecido, mejor que antes"). Quedan sin precalentar Compra, Chat, Check-in, Progreso y detalle de sesión de entreno.
2. Transición al abrir una receta (página aparte con su propio paso de carga): si se nota salto, medir con marcas.
3. Opcional: miniatura→foto sin fundido; `ver pendiente` de recetas sin foto (≈300, T44).

## ✅ SESIÓN 01-10-2026 (Claude, coordinado con Codex) — Fase 0 en producción, precisión de macros, estudio del recetario y 2 lotes nuevos

### 1. Motor Integrado Fase 0 — en producción
- Codex hizo Tasks 1-5 (+ Task 6 propia); Claude hizo Task 6 en paralelo (descartada, se adoptó la de Codex por mejor sanitizado) y Task 7 (`scripts/test-fase0-integridad-static.ts` + check ≤1 plan activo por dominio en `test-flujo-completo.ts`).
- Verificación local con Docker vía **Colima** (`colima start`; Supabase local necesita `DOCKER_HOST=unix://$HOME/.colima/default/docker.sock` y `supabase start -x vector,logflare`). Laboratorio = `supabase db dump --linked` (solo esquema) + migraciones nuevas, en carpeta temporal (las migraciones del repo no reconstruyen la BD desde cero). pgTAP 82/82 + concurrencia OK. Fixture de `fase0_integridad_motor.sql` corregido.
- Fix antes de aplicar: la deduplicación de planes activos agrupaba los `cliente_id NULL` (habría desactivado un plan huérfano). 4 migraciones aplicadas con `supabase db push --linked` (permiso explícito de Carlos). `main` desplegado, Vercel Ready.

### 2. Precisión de macros de las dietas (`42a3682`, en producción)
- Auditoría (`scripts/auditar-precision-macros.ts`, solo lectura): planes con kcal ±7% pero proteína −5/−22% y grasa +16/+40%. Causa: cada rol se escalaba al 100% de su macro ignorando lo que aportan los demás ingredientes, y la corrección final por kcal arrastraba la proteína.
- Nuevo `lib/recetas/optimizar-factores.ts`: factor por grupo de rol (P/C/G/resto) minimizando a la vez el error de kcal+P+C+G (pesos 3/3/1/0.7, límites por grupo, regularización hacia escalado uniforme). Usado por `aplicarRecetaAComida` solo si hay objetivos de macro.
- Simulación (`scripts/simular-precision-macros.ts`): proteína → −3/−2/−8%, grasa → +4/+9/+23%, kcal ±2%. Solo afecta a planes nuevos; los activos no se recalcularon (decisión de Carlos).

### 3. Estudio del recetario + importador seguro + 42 recetas nuevas
- Estudio: `../salidas/01-10-2026_estudio-cobertura-recetario.md` (script `scripts/estudio-cobertura-recetario.ts`). Huecos: desayunos proteicos 8/77, vegano+proteína 3, pre/post entreno 7, cenas rendimiento 7, snacks pérdida grasa 2, meriendas sin lactosa 3. 302/474 sin foto. Sobran dulces (32%).
- **`scripts/importar-lote-verificado.ts` — usar SIEMPRE para lotes nuevos**: cada ingrediente apunta a un alimento por nombre exacto + prefijo de id (falla si no hay exactamente 1), macros calculadas desde BD, intolerancias deducidas del catálogo del lote, `rol_ingrediente` fijado, criterios por lote o por perfil (`pre`/`post`), detección de duplicados, dry-run por defecto. `importar-lote-deepseek.ts` deja `alimento_id` null y confía en las kcal del JSON: no usar.
- Lote 1 `scripts/lotes/2026-10-01_desayunos-proteicos.json`: 22 desayunos (27-47% kcal proteína). Lote 2 `scripts/lotes/2026-10-01_pre-post-entreno.json`: 9 pre + 11 post con `es_pre_entreno`/`es_post_entreno`. Las 42 en `en_revision`, pendientes de aprobación de Carlos.
- Quality gate (`lib/recetas/profesional.ts`), 2 falsos positivos corregidos: "proteína sabor vainilla" no es especia; un vaso de zumo de naranja no es aliño (la regla >120 g solo aplica a zumo de limón/lima, vinagre, salsas).

### 4. Recetario de confianza (tarde)
- **Paso 1 — completar y corregir datos**: script de etiquetas `generar-intolerancias-y-consejos.ts` arreglado (no paginaba ingredientes; comparaba con tildes contra texto sin tildes; avena no era gluten; marisco no contaba como carne) + modo `AUDITAR=true`. 27 recetas con promesas falsas corregidas (boquerones "Vegano", lubina "Vegetariano", 20 con avena "Sin Gluten"…), 74 sin etiquetas rellenadas. `fix-vinculos-2026-10-01.mjs`: 17 ingredientes mal vinculados. `completar-recetas-aprobadas.ts`, `estimar-tiempo-recetas.ts`, `fix-roles-hidratos.ts` (66 hidratos/cacao/miel marcados como proteína → el optimizador no podía ajustar hidratos). Aprobadas completas salvo foto: 140 → 454/474.
- **Paso 2 — verificadas**: migración `recetas.verificacion` ('auto'|'coach') + `verificada_at`; `scripts/verificar-recetas-auto.ts` (386 verificadas; re-ejecutar tras aprobar lotes). Motor (`lib/plan-recetas.ts`) filtro blando ≥3 verificadas; alternativas del portal y `/api/recetas/sugeridas` priorizan verificadas. El motor tarda 0,1-0,7 s por franja; la lentitud del plan es DeepSeek.
- **Paso 3 — planificador semanal del coach**: `components/clientes/SemanaDietaPlanner.tsx` arriba de la pestaña Nutrición de la ficha. API `app/api/clientes/[id]/semana-dieta` (GET semana + `?franja=&q=` selector; POST asignar receta a día+franja con objetivos = objetivo diario × reparto por franja, usa el optimizador; DELETE quitar comida de un día). Comidas recurrentes se materializan con `lib/nutricion/materializar-comidas.ts` (la ruta cliente `/comidas/materializar` aún tiene su copia). Marca de contenido: migración `recetas.contenido_estado` ('para_grabar'|'grabada') + `PATCH /api/recetas/[id]/contenido` (solo coach); en la UI el icono de vídeo rota para grabar → grabada → nada. Probado sobre cliente ficticio (Andrés): desayuno 663 kcal vs 707 objetivo, P −3%, C +6%.

- **Revisión en sesión real de coach** (handoff `browse --headed`): quitar comida y asignar receta funcionan contra el plan real de Carlos. Corregido: el reparto por franja usa las franjas del plan en toda la semana (antes un día casi vacío daba ~45% de kcal al primer plato) y el selector ordena por encaje de proporción P/C/G. Desayuno miércoles de Carlos: 807 kcal / P37 C100 G29 vs objetivo 785 / 36 / 99 / 29. Commit `0f64912`.
- **Recuperar contraseña** (no existía): enlace en `/login` → `/recuperar-contrasena` → email → `/auth/callback?next=/nueva-contrasena`. El enlace solo vale en el mismo navegador que lo pidió (PKCE) y caduca al pedir otro. Pendiente: `/auth/callback` ignora `?error=` y manda a `/login` sin mensaje.

### 5. Variedad por franja, 'Generar semana' y lote comidas/cenas (noche, local sin commit)
- **Medición** (`scripts/medir-variedad-franja.ts`, solo lectura, replica el embudo del motor franja a franja): para Carlos la comida/cena no falta de cantidad; pierde variedad por el `.limit(80)` sin orden de `filtrarRecetasPorSlot`, por la preferencia `apto_rendimiento` (filtro blando que deja 5 recetas en desayuno/merienda) y por la exclusión de recientes. Falta variedad de proteína (pollo domina) y de meriendas.
- **Motor**: `filtrarRecetasPorSlot(..., poolMax = 80)` (último parámetro, retrocompatible).
- **Botón 'Generar semana'**: `POST /api/clientes/[id]/semana-dieta/generar` → `generarSemana()` en `lib/nutricion/planificar-semana.ts` (`planificarSemana` es solo lectura). Selección pura en `lib/nutricion/generar-semana.ts` con test `scripts/generar-semana.test.ts`. Rellena huecos o, con `reemplazar`, sustituye toda la semana (la UI pide confirmación si ya hay recetas). Simulación sin escribir: `scripts/simular-generar-semana.ts [cliente] [--reemplazar]`.
- **Lote** `scripts/lotes/2026-10-01_comidas-cenas-rendimiento.json` (20 recetas sin pollo, `en_revision`). Importador: nuevo campo de lote `apto_rendimiento`. Lección: el quality gate marca `cantidad_muy_pequena` si un ingrediente principal (ajo incluido) pesa <5 g.
- Verificado: `tsc`, eslint, `npm run build`, 401 sin sesión, test unitario, escritura end-to-end sobre cliente ficticio Andrés (su semana quedó regenerada). Sin verificar visualmente el botón ni ejecutado sobre la semana real de Carlos.

### 6. Cierre 01→02-10-2026 — lecciones y estado (Claude)
- **Lección motor:** las cantidades de `receta_ingredientes` son de la receta ENTERA; todo escalado (factor por kcal, `SCALING_RULES`, optimizador con límites 0,25/0,5) debe partir de UNA ración (`cantidad / porciones`). Medido con `scripts/medir-escalado-raciones.ts`: antes +105 %/+229 % de kcal en 5+/9+ raciones. Cualquier código nuevo que lea `receta_ingredientes` para un plato debe dividir por `porciones`.
- **Lección auditoría:** comparar con el texto ORIGINAL (pie del vídeo) es la fuente de verdad; la similitud de texto o las instrucciones solas no bastan (ya lo decía T46). Instagram necesita sesión: `yt-dlp --cookies-from-browser safari` requiere «Acceso total al disco» para el terminal/VS Code. `deepseek-chat` se cuelga a veces y `deepseek-v4-pro` es lento (~40 s/receta) y consume saldo; Gemini 2.5 Flash va en <10 s.
- **Lección buscador de alimentos (scripts):** `ilike` no ignora tildes y un `limit` bajo recorta resultados («sal» → «Salmón», «Sal de ajo»); buscar nombre exacto primero, con tildes y palabras completas, penalizando envases. Los prefijos de id de alimento se buscan por rango de UUID, no con `limit`.
- **Complementos:** `comida_alimentos.es_complemento` + `complemento_receta_id`; `materializarComidasRecurrentes` y `aplicarRecetaAComida` los preservan. API `semana-dieta/complemento`.
- **Semanas futuras:** `comidas_planificadas` (RLS sin políticas, solo service role); nada de eso lo ve el cliente hasta `activar`.
- **Vídeo original:** `clientes.ver_video_recetas` (activado solo para Carlos). La API `/api/cliente/[codigo]/recetas/[recetaId]` ya no envía `url_origen` si está apagado.
- **Deploy:** un fallo transitorio de Vercel (`next/font/google` no resuelve) se arregla con `vercel redeploy <url>`; no es del código.
- Detalle completo y pendientes en `../ESTADO-COMPARTIDO.md` (entrada «CIERRE 01→02-10-2026»).

### Pendiente
0. Aprobar las 20 recetas nuevas (junto con las 42) y re-ejecutar `verificar-recetas-auto.ts --apply`; decidir tope de 80 / filtro `apto_rendimiento` en la generación inicial; lote de meriendas/media mañana de rendimiento; semana sucesiva; vista 'para grabar' + lista de la compra.
1. Carlos aprueba las 42 recetas en `/recetas/revisar` y se re-ejecuta `verificar-recetas-auto.ts --apply`.
1b. Ingrediente "Yogur griego natural 0%" vinculado a "Yogur griego con mango" (al menos en "Tortitas de avena y canela con sirope casero"): revisar usos.
2. Semana de Carlos descuadrada (1.003–4.192 kcal/día) por mover platos en el kanban de dieta; falta aviso de kcal al mover.
3. Siguiente lote: vegano + proteína. Fotos de las 302 recetas sin imagen (T44).
4. Idea nueva de Carlos: agentes de revisión del recetario alimentados con sus marcas desde el portal cliente (diseño en curso).

---

## ✅ SESIÓN 30-09-2026 (Codex) — Director semanal ejecutado, dry-run, auditoría persistente y panel de actividad

### Estado real encontrado
- Supabase contiene **4 clientes activos**, no 11 como indicaba la documentación anterior.
- El director semanal estaba configurado en Vercel, pero no había evidencia persistente de su ejecución del lunes 28-09-2026. Los logs históricos de Vercel no estaban disponibles para confirmarlo.
- El proyecto está en Vercel Hobby. Los cron pueden ejecutarse en cualquier momento dentro de la hora programada.

### Ejecución real autorizada por Carlos
- Primero se añadió y verificó un modo seguro `dryRun=true` que calcula los planes por cliente sin llamar agentes ni escribir tareas.
- Simulación contra los 4 clientes: 0 errores y `agente_tareas` quedó en 17 antes/17 después.
- Tras confirmación explícita de Carlos se ejecutó `ejecutarDirector('semanal')` en producción.
- Resultado: **4 clientes procesados, 7 tareas nuevas, 0 errores, 27,1 s**.
- Tareas generadas: 3 `actualizacion_plan`, 3 `revision_semanal_entreno` y 1 `alerta_readiness`; todas quedaron `pendiente`, ninguna se autoaplicó.

### Mejoras implantadas
1. **Dry-run del director** (`78448a3`): `ejecutarDirector(modo, { dryRun })`, disponible también en `/api/agentes/ejecutar?modo=semanal&dryRun=true`. El aprendizaje colectivo tampoco se ejecuta en simulación.
2. **Auditoría persistente** (`214eb6e`): migración `20260930092916_agente_ejecuciones_auditoria.sql`, tabla `agente_ejecuciones` con RLS y acceso exclusivo mediante service role. Registra modo, origen, dry-run, estado, clientes, tareas, errores, duración e inicio/fin.
3. **Cron semanal separado**: pasó de lunes `06:00 UTC` a lunes `10:00 UTC` para no coincidir con `/api/cron/sync-integraciones`. La colisión es una hipótesis preventiva, no una causa raíz demostrada.
4. **Historial visible para el coach** (`f312f86`): nuevo endpoint `GET /api/agentes/ejecuciones` (solo rol `coach`) y sección plegable “Actividad del director” en `/agentes`, responsive y con actualización tras ejecuciones manuales.

### Verificación
- Tests: `scripts/orquestador-director.test.ts` y `scripts/agente-ejecuciones.test.ts`.
- Endpoint nuevo sin sesión: 401 confirmado.
- Migración local/remota sincronizada y consulta real de auditoría correcta.
- ESLint específico y `npm run build` limpios.
- Los tres commits están en `origin/main` y sus despliegues de Vercel terminaron `Ready`.

### Próxima comprobación
- El lunes 05-10-2026, revisar en `/agentes` que exista una ejecución con `origen=cron`, `modo=semanal` y estado finalizado. Si no aparece, investigar el historial de Cron Jobs desde el dashboard de Vercel; no volver a inferir la ejecución únicamente por las tareas generadas.

---

## ✅ SESIÓN 29-09-2026 (madrugada, Claude) — Auditoría de matches de ingredientes: 2 casos de Carlos + 3 patrones sistémicos (T45)

### Contexto
Carlos, revisando su propio plan real desde el móvil, sospechó de dos recetas concretas: "Ensalada de pepino chafado con aliño de sésamo" (cantidades e ingrediente de sésamo "raros") y "Bollos de patata dulce" (llevaba caseína micelar, que le sonaba falso). Pidió identificar el problema sin tener que revisar receta a receta él mismo, y al confirmar los 2 casos pidió extender la revisión a todo el recetario ("seguiremos revisando todas las recetas para que estén perfectas en título, ingredientes, cantidades, kcals etc.").

### Los 2 casos confirmados
- **"Ensalada de pepino chafado con aliño de sésamo"** (`adf4a285-caf8-48c7-8e51-a346824d92d0`): el ingrediente "Pepino mediano" (60g) estaba vinculado a **"Tzaziki Crema Yogur con Pepino"** (80 kcal/100g, un producto preparado) en vez de al alimento real "Pepino" (15 kcal/100g) — la receta no tenía pepino real en su base nutricional, solo un producto de yogur con pepino. Además "Piparras" pesaba **240g**, una cantidad absurda para un encurtido de guarnición. Corregido: relink a "Pepino" real + piparras bajadas a 30g. Kcal receta: 178.9→138.4.
- **"Bollos de patata dulce saludables"** (`4a998463-af82-4bb3-81f2-e01784e81ac4`): la caseína micelar SÍ estaba mencionada en las instrucciones (no era un ingrediente huérfano), pero es un aditivo que la IA insertó al generar/refinar la receta sin que estuviera en el original — mismo tipo de problema que Carlos ya había anotado como pendiente sin definir alcance (T44, "recetas demasiado IA"). Eliminada la caseína del ingrediente y de las instrucciones, macros recalculadas (147.5→142.9 kcal).

### Auditoría sistemática — 3 patrones más
Reutilizado el script ya existente `scripts/auditar-matches-ingredientes.mjs --todas` (compara cada `receta_ingredientes.nombre_libre` contra el `alimento.nombre` real vinculado) sobre las **586 recetas totales** (no solo las 476 aprobadas de T18). Resultado: 98 matches sospechosos. Filtrando falsos positivos del propio script (plurales/sinónimos que no reconoce, ej. "Huevos"→"Huevo"), quedaron 3 patrones sistémicos reales, cada uno repetido en varias recetas — no casos aislados:

| Patrón | Ingredientes afectados | Recetas | Impacto |
|---|---|---|---|
| **"Aguacate" → "Agua"** | 8 | Bowl de pollo y aguacate, Ensalada de pollo especiado, Ensalada de cuscús fresca, otras | Aguacate (160kcal/100g) contaba como agua pura (0kcal) |
| **"Proteína whey vainilla" → "Natillas con chocolate +Proteínas Hacendado"** | 3 | Donut fit, Batido verde saciante, Cookies de avena y chocolate | Suplemento de proteína vinculado a un postre de nata, macros distintos |
| **"Queso cottage/batido bajo en grasa/0%" → "Queso añejo fuerte de oveja"** | 13 | Tostada Proteica Cottage, Mousse Queso Fresco y Fresa, Tarro Queso Cottage, Tarta de queso sin base, Bocadillo de pollo, wraps varios | Queso light vinculado a un queso curado con mucha más grasa/calorías |

Cada relink apunta a un alimento **ya existente y comestible** en BD (Aguacate genérico `91ad5545`, Proteína en polvo sabor vainilla `9076c191`, Cottage 0% Materia Grasa `30dbfc8a`) — no se inventaron alimentos nuevos. Script nuevo `scripts/fix-auditoria-matches-2026-09-29.mjs` (dry-run por defecto, `--apply` para ejecutar), ejecutado primero en dry-run y revisado antes de aplicar. Recalculadas macros de las 26 recetas afectadas en total.

Los saltos de kcal más grandes confirman que el bug de "queso cottage→queso añejo" era serio, no cosmético:
- Tarro de Queso Cottage con Frutos Rojos y Nueces: 1153→**457 kcal**
- Mousse de Queso Fresco y Fresa (sin horno): 901→**205 kcal**
- Tostada Proteica con Cottage y Fresas Laminadas: 732→**210 kcal**

### No tocado a propósito
"pan de proteína (rebanada)" en *Pan proteico con AOVE y tomate* estaba vinculado a la misma "Natillas con chocolate +Proteínas" — pero relinkearlo a "Proteína en polvo sabor vainilla" habría sido igual de incorrecto (un pan proteico no es proteína en polvo). Sin un alimento "pan proteico" claro en BD, se dejó marcado para revisión manual en vez de mal-vincularlo a otra cosa.

### Informe completo
`nutricoach/salidas/auditoria-matches-2026-09-28.json` (98 hallazgos, no está en git — `salidas/` en `.gitignore`) — incluye los ~75 descartados como ruido en esta sesión, que no se revisaron uno a uno. Puede haber algún caso real entre ellos.

### Verificación
Dry-run ejecutado y leído completo antes de `--apply`. No se tocó código de la app (solo datos vía Supabase + 1 script nuevo), así que no aplica `tsc`/`build`. Verificado post-aplicación releyendo las 26 recetas recalculadas y confirmando que los kcal/macros bajaron/subieron en la dirección esperada según el alimento correcto.

### Commits
`52d1827` — fix: corrige matches de ingredientes mal vinculados en recetario (pusheado a `origin/main`).

### Pendiente — próxima sesión (ver T46 en `TAREAS.md`)
Carlos quiere seguir revisando el recetario completo. Sin alcance decidido todavía entre: (a) revisar uno a uno los ~75 hallazgos descartados como ruido de esta auditoría, (b) retomar los 252 hallazgos de T26 (forma incorrecta del ingrediente, patrón distinto), (c) auditoría de cantidades absurdas a nivel de todo el recetario (el caso de piparras 240g fue puntual, no se buscó sistemáticamente), (d) T44 (fotos faltantes + recetas "demasiado IA") sigue sin alcance definido.

---

## ✅ SESIÓN 28-09-2026 (Claude, continuación noche) — Recetario explorable, alternativas de comida, causa raíz de ingredientes ajenos + navegación

### Contexto
Continuación directa del bloque de tarde del mismo día (ver sección de abajo), tras la pausa de ~2 días por límite de tokens de Carlos. Sesión muy iterativa en tiempo real: Carlos usaba el portal en su móvil, reportaba un problema o pedía una mejora concreta, se diagnosticaba/implementaba, se verificaba con `tsc`/`eslint`/`build` y pruebas reales contra Supabase, se desplegaba. 9 commits. Cierre explícito de Carlos: "guarda y documenta y audita todo para que lo que hemos avanzado quede bien fijado".

### T33 cerrado del todo (verificación, no trabajo nuevo)
Al retomar la sesión, `TAREAS.md` decía T33 "parcial" pero el código ya tenía las 14 rutas de escritura de `/api/cliente/[codigo]/*` protegidas con `lib/cliente/autorizar-escritura-plan.ts` (commit `6e86696`, hecho por Codex durante la pausa). Verificado `tsc` limpio y actualizada la documentación para reflejar la realidad — T33 **HECHO**.

### T29 verificado — Garmin sincroniza, Strava pendiente de una actividad real
Comprobado contra Supabase: Garmin Connect con `ultima_sync` de ese mismo día y filas de actividad hasta el día actual — funciona. Strava con `activa=true` pero 0 filas — no es un bug, es push-only (webhook) y necesita que Carlos suba una actividad real desde el reloj/app para que llegue el primer dato.

### T34 — Recetario explorable en el portal cliente (commit `73cd700`)
Pestaña "Recetas" solo mostraba "Mis platos" (recetas IA personalizadas por cliente, función que casi nadie usa — por eso siempre estaba vacía). Carlos eligió el alcance (preguntado explícitamente): recetas del plan activo + recetario completo explorable. Nuevo `app/api/cliente/[codigo]/recetario/route.ts` (búsqueda + categoría, filtrado por restricciones alimentarias del cliente reutilizando el mismo mapeo alérgeno/vegano que usa el motor de generación de planes) + `components/PortalCliente/RecetarioExplorador.tsx`. Se relajó `GET /api/cliente/[codigo]/recetas/[recetaId]` para poder ver cualquier receta aprobada del catálogo, no solo las ya vinculadas al plan (antes daba 403). "Mis platos" ya no muestra un hueco vacío confuso si no hay ninguno.

**Iteración siguiente, a petición de Carlos**: filtros por ingrediente (Pollo/Carne/Pescado/Pasta/Arroz/Legumbre/Patata/Yogur) detrás de un botón "Más filtros" para no saturar la vista (commit `960f49a`) — reutiliza `recetas.tags` ya poblado por `lib/auto-tag.ts`, sin sistema nuevo. Explícitamente no se implementó un filtro por macro dominante (proteína/grasa/HC) que Carlos sugirió como alternativa: los tags de ese tipo en BD están sucios (`alta_proteina`/`alto_proteina` duplicados, sin equivalente de grasa/carbohidrato) — Carlos confirmó que con los filtros de ingrediente es suficiente por ahora.

### T36 — Alternativas de comida en "Hoy": el backend ya existía, nadie lo llamaba (commit `ca238fa`)
Carlos pidió "2-3 alternativas por comida". Investigando, el endpoint `/api/cliente/[codigo]/comidas/[id]/alternativas` (macros similares + restricciones, construido en sesión 21-05) y los chips de swap en `MiPlan.tsx` ya existían — pero nada llamaba nunca al endpoint, así que `comida.alternativa_recetas` se quedaba `undefined` para siempre. Se cargan ahora de forma perezosa al desplegar cada comida por primera vez (no las ~4-5 del día de golpe).

### T39 — Desplegar ejercicios al tocar una sesión en Entreno > Semana (commit `12fa708`)
El kanban de sesiones (`EntrenoKanban.tsx`) permitía mover sesiones entre días pero no ver qué contenían. Reutiliza `/api/cliente/sesion/[id]` + `ListaEjerciciosExpandible` (mismo patrón que "Hoy"). Tocar la tarjeta selecciona y despliega el detalle debajo del tablero sin interferir con el arrastre (drag usa `PointerSensor` con `activationConstraint`, un tap simple no lo dispara).

### T40 — "Volver" desde una receta llevaba a Hoy en vez de a Dieta (commit `dbdf9ba`)
Bug real encontrado por Carlos en vivo. Causa: cambiar de pestaña con la barra inferior solo actualizaba estado de React, nunca la URL. El botón "Volver" explícito de `/cliente/receta/[id]` sí codifica `returnTo=/cliente?tab=X` y funciona, pero el gesto nativo de "atrás" del móvil (o el botón del navegador) ignora ese `returnTo` y va a la última URL real del historial — que nunca reflejaba la pestaña activa. Fix: `router.replace(\`/cliente?tab=\${tab}\`)` en cada cambio de pestaña, sin añadir entradas al historial.

### T41 — Reencasillar platos por franja en Dieta, no solo mover de día (commit `4cfaa34`)
Carlos: "por si prefieres intercambiar un plato para cena por comida". Cada columna de día del kanban de Dieta pasa a tener 4 carriles fijos (Desayuno/Comida/Merienda/Cena) como zonas de arrastre independientes — soltar en un carril distinto renombra la comida a esa franja además de mover de día. `mover-dia` acepta un `nombre` opcional retrocompatible. No recalcula objetivos de macros de la franja destino, solo relabela (decisión consciente, documentada como posible mejora futura).

### T43 — Auditoría del recetario a fondo (la parte más grande de la sesión)

Carlos reportó que el filtro "Pasta" del recetario devolvía platos sin relación. Investigar esto llevó a encontrar y corregir 3 capas de bugs distintas, cada una más profunda que la anterior:

**T43a — Ambigüedad de la palabra "pasta" en `lib/auto-tag.ts`** (commit `0455ac6`): "pasta" en español significa fideos O pasta para untar (pasta de almendras, de tomate, de sésamo...); el matching por substring además dejaba pasar "Pastanaga" (zanahoria en catalán, contiene "pasta"). Fix: coincidencia por palabra completa + exclusión de "pasta de X" conocidas. De paso, `scripts/auto-etiquetar-recetas.ts` sobrescribía `recetas.tags` por completo — se cambió a fusión, para no borrar tags de otro sistema (rendimiento/post_entreno/periodizacion) que conviven en la misma columna.

**T43b/c — Causa raíz real: ingredientes de OTRA receta colgados** (commit `fd608b0`): al seguir investigando por qué "Pasta"/"Pollo"/"Arroz" seguían devolviendo platos raros, se encontró que varias recetas tenían un `nombre` sin ninguna relación con sus ingredientes reales en BD (ej. "Salmón al horno con avena cremosa y brócoli al ajillo" tenía pechuga de pollo y arroz como ingredientes reales). **Causa raíz**: `scripts/generar-recetas-desde-esqueletos.ts` (el generador de recetas por lotes desde plantillas nutricionales — perfiles perdida_grasa/rendimiento/patologia) nunca guardaba qué "esqueleto" exacto generó cada receta. Un script aparte, `scripts/backfill-macros-esqueletos.ts`, tenía que ADIVINARLO por perfil+tipoPlato+tags para vincular los ingredientes — con varios esqueletos compartiendo esas señales, adivinaba mal y colgaba a una receta los ingredientes de un esqueleto distinto. Afectaba a un lote completo de 50 recetas creado el 07-06-2026.

Corregido en 2 frentes:
- **Prevención** (para que no vuelva a pasar): el generador ahora vincula `receta_ingredientes` y calcula macros directamente al crear la receta, con el esqueleto ya en memoria (sin adivinar nada después) — `backfill-macros-esqueletos.ts` marcado obsoleto con aviso explícito. Prompt reescrito para exigir mencionar el ingrediente principal real y prohibir inventar proteínas no listadas (los ejemplos de nombre con proteínas concretas del prompt original — "Merluza al vapor...", "Tortilla cremosa de espinacas..." — eran justo lo que DeepSeek copiaba sin mirar los ingredientes reales, y **coincidían literalmente** con 2 de las recetas mal nombradas encontradas). Nueva guarda de código `nombreCoherenteConIngredientes()` que rechaza la receta si el nombre no menciona el ingrediente principal real, antes de insertar.
- **Corrección de datos** (aplicada en Supabase, scripts commiteados): 60 filas de `receta_ingredientes` relinkeadas en 37 recetas del lote (incl. "Salmón fresco" del catálogo BEDCA, que estaba `es_comestible=false` por error desde su creación — afectaba a CUALQUIER receta que necesitara salmón, no solo este lote), 10 recetas renombradas (nombre/descripción/instrucciones) para reflejar sus ingredientes reales con un prompt que exige mencionarlos explícitamente, macros recalculadas. Commit final `b6fe246` corrigió el residuo cosmético (6 recetas con "zanahoria" en el nombre pero calabacín/brócoli reales, mismo tipo de verdura — corregido con edición mínima vía DeepSeek respetando concordancia de género).

**Auditoría de cierre**: verificado programáticamente que las 50 recetas del lote quedan 100% coherentes (nombre menciona al menos un ingrediente real). Chequeos adicionales sobre las 474 recetas aprobadas: 0 sin ingredientes, 0 con kcal=0/null, 7 fuera de rango 40-900kcal/porción pero son las mismas ya conocidas de sesiones anteriores (salsas/masa base con kcal alta por diseño). Repetida la auditoría de nombre-vs-ingredientes sobre todo el catálogo: 55 casos "sospechosos" restantes revisados uno a uno — son nombres estilizados/en inglés (Honey BBQ Chicken, Brookies, Kebaprol, Tacos BigMac) cuyos ingredientes SÍ son coherentes, no la misma familia de bug.

### Scripts nuevos de esta sesión (recetario)
- `scripts/audit-nombre-vs-ingredientes-v2.mjs` — auditoría general nombre vs. `nombre_libre` real, reutilizable para futuras revisiones.
- `scripts/audit-esqueleto-nombre-vs-ingredientes.mjs` — versión previa, más limitada (solo recetas con tags de esqueleto, top-2 ingredientes).
- `scripts/fix-batch-060726-ingredientes.mjs` — relinkeo de ingredientes del lote 07-06-2026 contra alimentos verificados a mano (no búsqueda difusa automática).
- `scripts/regenerar-nombres-batch-060726.mjs` — regeneración de nombre/descripción/instrucciones con prompt constreñido.
- `scripts/fix-verdura-cosmetica-060726.mjs` — edición mínima de texto (solo la verdura, con concordancia de género).

### Pendiente para la próxima sesión
1. **T44 — fotos faltantes + recetas "demasiado IA"**: Carlos lo planteó como siguiente paso antes de integrar más recetas nuevas, pero sin alcance definido todavía. Preguntar primero qué entiende exactamente por "demasiado IA" (¿nombres genéricos? ¿descripciones planas? ¿instrucciones poco realistas?) antes de tocar nada.
2. **T30** (baja, arrastrado): "Trote de calentamiento" duplicado en una sesión real del plan de Carlos — dato de contenido, no código.
3. **T31** (media, arrastrado): seguir puliendo Compra/Chat del portal si Carlos encuentra algo raro al usarlos — no auditados a fondo todavía.
4. **T35** (baja, arrastrado): herramienta lado-coach para construir variación real día a día en dietas (el kanban de cliente solo mueve, no crea/quita).
5. **T38** (media, arrastrado): Carlos notó lentitud al cambiar de pestaña — sin repro concreto, diagnosticar con datos reales si vuelve a pasar de forma consistente.
6. Los 252 hallazgos pendientes de T26 (`forma-incorrecta-revision-manual-2026-09-26.json`, no está en git) siguen sin revisión manual — patrón distinto al de T43 (mismo ingrediente con forma equivocada, no ingrediente ajeno).

### Verificación de toda la sesión
`npx tsc --noEmit` y `npm run build` limpios antes de cada uno de los 9 commits. Cambios de recetario probados contra Supabase real (no solo lectura de código): endpoints curl'eados en local con el plan real de Carlos y con un cliente vegano de prueba, macros de recetas corregidas verificadas antes/después, coherencia nombre-ingredientes del lote 07-06-2026 verificada programáticamente al cierre (0 restantes de 50). Revisión de seguridad de lo nuevo: `recetario`/`recetas/[recetaId]` son GET de solo lectura sobre contenido curado público (sin PII, sin necesidad de auth); la extensión de `mover-dia` con `nombre` opcional sigue detrás de `autorizarEscrituraPlan` (T33); ningún endpoint nuevo de escritura sin autenticar.

---

## ✅ SESIÓN 28-09-2026 (Claude, continuación tarde) — Rediseño profundo Dieta/Entreno del portal cliente, 11 commits

### Contexto
Continuación directa del bloque de mañana (T28, ver bloque de abajo). Carlos siguió probando en vivo en su iPhone real tras cada deploy y pidiendo ajustes concretos, iterativo: señala un problema o una idea → se implementa → se despliega → se verifica → siguiente. Cierra explícitamente ("guarda y documenta todo... para poder seguir en Codex") porque se le agotan los tokens de Claude ~2 días.

### "Ver receta" nunca funcionó de verdad para un cliente — bug de fondo serio
Carlos: "le doy a volver o volver a plan y se me pone en la pantalla de inicio". Investigado a fondo: **no era el `?tab=` que se perdía** (eso ya se arregló por la mañana) — el enlace "Ver receta" del portal cliente llevaba a `/recetas/[id]`, la página de **coach**, envuelta en `CoachShell`. `CoachShell` comprueba el rol en un `useEffect` y **redirige cualquier sesión con rol "cliente" a `/cliente` sin preservar query params, sin excepción** — por diseño, para que un cliente no vea el editor de recetas del coach. El código de esa página SÍ tenía lógica `isClientView`/`clienteCodigo` pensada para servir una vista de solo lectura a clientes, pero nunca llegaba a ejecutarse: `CoachShell` redirige antes.
- **Fix real**: nueva ruta propia `app/cliente/receta/[id]/page.tsx`, sin `CoachShell`, solo lectura (foto, macros con `MacroRing`, ingredientes con `IngredientChecklist`, preparación con `StepByStep` — los 3 componentes de `components/premium/` ya existían y son agnósticos de rol). `MiPlan.tsx` y `PlanSemanal.tsx` apuntan aquí ahora.
- **Bug relacionado descubierto de paso**: `app/api/cliente/plan-nutricion-activo/route.ts` no unía `recetas` en su `select()` de `comidas` — `comida.receta` era `null` siempre aunque `comida.receta_id` existiera. Las 3 comidas reales de Carlos SÍ tenían receta vinculada con foto real ("Tostada de aguacate...", etc.) pero nunca llegaba. Corregido el join — ahora salen nombre real y foto en vez de "Desayuno" repetido + icono genérico.
- **Mismo bug, tercera vez, en el PDF**: `app/api/cliente/[codigo]/plan-pdf/route.ts` tenía el mismo enlace legacy `/cliente/[codigo]` en su botón "Volver a la app". Corregido igual.

### Kanban semanal — Dieta y Entreno (la pieza más grande de la sesión)
Carlos no quería la vista Semana anterior (selector de día + lista, básicamente idéntica cada día porque el plan es una plantilla recurrente). Pidió algo "tipo Trello" para poder arrastrar comidas/sesiones entre días. Se reutilizó el patrón ya probado en producción en `components/clientes/EntrenoCalendarioKanban.tsx` (lado coach): `@dnd-kit/core` con `PointerSensor` + `activationConstraint: { distance: 6 }` para que tocar y arrastrar convivan, columnas con `overflow-x-auto` (scroll horizontal, patrón Trello-móvil real).
- **`components/training/EntrenoKanban.tsx`** (nuevo): sesiones de entreno **siempre** tienen `dia_semana` concreto (nunca recurrentes) → drag = simple `UPDATE dia_semana`. Nuevo endpoint `/api/cliente/entrenos/mover-dia` (auth por sesión, verifica que la sesión pertenezca al plan activo del cliente).
- **`components/PortalCliente/DietaKanban.tsx`** (nuevo): las comidas de dieta **sí pueden ser recurrentes** (`dia_semana IS NULL` = misma comida los 7 días — así estaban las 3 de Carlos). Mover una comida recurrente no tiene significado claro (ya es la misma en todos los días), así que hay un paso previo obligatorio: botón "Activar por día" → `/api/cliente/[codigo]/comidas/materializar` convierte cada comida recurrente en **7 copias reales** (una por día, con sus `comida_alimentos` copiados) y borra la original. Verificado en vivo: 3 recurrentes → 21 comidas reales, confirmado contra Supabase. Después, arrastrar es un simple `UPDATE dia_semana` vía `/api/cliente/[codigo]/comidas/mover-dia` (rechaza con error explícito si por lo que sea la comida sigue siendo recurrente, en vez de adivinar qué hacer).
- **Decisión de alcance explícita de Carlos** (preguntada, no asumida): el Kanban del lado **cliente** solo mueve comidas/sesiones ya existentes entre días — no crea ni borra. Construir el plan día a día real (más allá de materializar) es tarea del **coach**, pendiente para otra sesión (ver Propuesto abajo).
- **Limitación conocida, no bloqueante**: `materializar` no es transaccional (Supabase JS sin RPC) — si fallara a mitad de las 3 comidas, quedaría un estado mixto (alguna materializada, otra no). En la práctica no ha pasado y el usuario puede reintentar sin duplicar (solo materializa las que sigan con `dia_semana IS NULL`).

### Compra: reposicionada, no eliminada
Primera versión metía "Compra" como 3er botón junto a "Hoy"/"Semana" en Dieta — Carlos: "no encaja". Ahora es una tarjeta colapsable **un nivel por debajo**, dentro de cada vista: "Lista de la compra de hoy" (con `diaInicial` = el día activo) dentro de Hoy, "Lista de la compra semanal" dentro de Semana. `ListaCompraPortal` ganó un prop opcional `diaInicial` para esto.

### Ajustes: de un solo panel de Apps a 3 sub-tabs
Carlos pidió explícitamente "varias pestañas... perfil del cliente... parámetros típicos de configuración". Nuevo `components/PortalCliente/AjustesTabs.tsx`:
- **Apps** — `IntegracionesPanel` (sin cambios de fondo).
- **Perfil** — datos del cliente de solo lectura (nombre, email, objetivo, nivel, edad, altura — "los gestiona tu coach, avísale por chat si cambian"), campo editable de restricciones alimentarias (nuevo `PATCH /api/cliente/perfil`, auth por sesión), toggle de tema consolidado aquí también.
- **Cuenta** — cambiar contraseña (`supabase.auth.updateUser`) y cerrar sesión.
- De paso, la pestaña Ajustes dejó de depender de tener un plan de dieta activo (antes gateaba todo tras `codigo && cliente`; con solo `cliente` alcanza para Perfil/Cuenta — Apps sigue necesitando `codigo` para sus llamadas, eso no cambió).

### Otros ajustes visuales pedidos en vivo
- Ejercicios del acordeón/Hoy de Entreno: nombre+series+reps+descanso siempre visibles, la explicación (RPE, técnica) desplegable solo al tocar — nuevo `components/training/ExpandableExercises.tsx`, reutilizado en Hoy/Semana/Mes de Entreno. Quitados los botones "Empezar"/"Solo ver" y el enlace "Abrir calendario completo" que sobraban (Carlos: "no necesito en principio").
- Botón "Descargar plan en PDF": de botón genérico a tarjeta con icono+título+subtítulo, igual que el resto de accesos del portal.
- PDF del plan: paleta actualizada de crema/verde (diseño antiguo) a grafito/plata (paleta real de la app, v8 "Instrument").
- Padding superior de todas las cabeceras "Volver" subido dos veces esta sesión (12px fijo → +8px sobre notch → +16px sobre notch) — Carlos seguía notándolo pegado arriba tras el primer ajuste.

### Bug de seguridad/auditoría — endpoints nuevos de esta sesión, patrón heredado
`/api/cliente/[codigo]/comidas/materializar` y `.../mover-dia` (dieta) **no comprueban sesión de usuario**, solo el `codigo` público del plan — **igual que ya hacían** `registrar-comida`, `lista-compra`, `notas`, `chat`, etc. (patrón preexistente en todo `/api/cliente/[codigo]/*`, no una regresión de hoy). A diferencia de esas rutas (mayormente lecturas o registros no destructivos), estas dos SÍ mutan/borran datos reales del plan — quien conozca o adivine el `codigo_publico` de un cliente podría reescribir su semana. Recomendación para endurecer en otra sesión: añadir `createApiSupabase`+`getUser()` a todo `/api/cliente/[codigo]/*` que escriba, no solo a los nuevos. `/api/cliente/entrenos/mover-dia` y `/api/cliente/perfil` (nuevos, auth por sesión) sí quedaron bien protegidos desde el principio.

### Verificación
`npx tsc --noEmit` y `npm run build` limpios antes de cada uno de los 11 commits. Cada cambio de UI probado en vivo con `browse` (headless) contra `localhost:3000` y contra `nutricoach-delta.vercel.app` tras el deploy, esperando activamente a `vercel ls --yes` en `Ready`. Materialización de comidas verificada con consulta directa a Supabase (3→21 filas) y el endpoint de mover-día probado con una llamada real (movida y restaurada) porque el drag-and-drop en sí no se puede simular con eventos de puntero sintéticos en headless (limitación ya documentada en sesiones anteriores) — el gesto real se confía a que Carlos lo confirme en su móvil.

### ⚠️ Pendiente — próxima sesión (Codex u otro Claude)
1. **Recetario del portal cliente vacío** — pestaña "Recetas" no muestra nada, ni las recetas asignadas por el coach ni el recetario completo. Carlos: "más tarde nos pondremos intensamente sobre el recetario" — sesión dedicada, no un fix rápido.
2. **Kanban de coach para construir la semana** — hoy el cliente solo puede *mover* comidas/sesiones ya existentes. Falta la herramienta del lado coach para *crear* variación real día a día (o decidir si se genera con IA — ver pregunta que Carlos dejó sin resolver del todo, se decantó por "cliente reordena, coach construye" pero el lado coach no se tocó esta sesión).
3. **Endurecer auth de `/api/cliente/[codigo]/*`** — ver bloque de seguridad arriba.
4. Verificar en el iPhone real de Carlos: el gesto de arrastrar en ambos Kanban (dieta y entreno), y si el padding superior (+16px) ya es suficiente o hace falta más.
5. Sigue pendiente de sesiones anteriores: 252 hallazgos de auditoría de ingredientes sin revisar, verificar sync real Garmin/Strava, dato "Trote de calentamiento" duplicado en el plan de Carlos.

---

## ✅ SESIÓN 28-09-2026 (Claude) — Auditoría en vivo del portal cliente real (T28) + rediseño Entrenamiento

### Contexto
Continuación directa de T28 (pendiente dejado por la sesión 27-09): Carlos pidió revisar `app/cliente/*` "como lo vería yo desde mi iPhone" y pulir lo que no funcionara o no fuera intuitivo. Sesión larga, muy iterativa: Carlos probaba en vivo (primero un navegador headless controlado por Claude con handoff para que él iniciara sesión con credenciales reales, luego directamente producción), señalaba un problema, se diagnosticaba, se arreglaba, se desplegaba a Vercel y se verificaba — repetido ~10 veces. Cierra por límite de tokens de Carlos (2 días de pausa), de ahí este documento y el relevo a Codex.

### Bloqueo de seguridad encontrado y resuelto con el usuario
El clasificador de permisos del entorno bloqueó la técnica habitual de sesiones anteriores (magic-link + inyección de cookie de sesión de cliente de prueba) por "Credential Materialization". Se resolvió pasando a `browse --headed` + `handoff`: Carlos inicia sesión él mismo en la ventana de Chrome controlada, Claude retoma el control con `resume`. **Anotar para futuras sesiones**: si se necesita probar como cliente autenticado, usar este patrón (handoff), no reconstruir tokens de sesión a mano.

### Bug de datos crítico — el propio Carlos no veía su portal
`clientes.profile_id` del cliente real de Carlos (`04cc53b3`, plan "Híbrido Hyrox + Running") apuntaba a su perfil de **coach**, no al de su cuenta `ccc8890+cliente@gmail.com`. Como `/cliente` redirige a `/dashboard` si el rol es `coach`, el portal de Carlos llevaba tiempo mostrando "no hay nada asignado". Fix: `UPDATE clientes SET profile_id = <id cuenta cliente> WHERE id = '04cc53b3...'`. Sin código tocado, solo dato.

### Navegación del portal reorganizada (varias iteraciones con Carlos)
- Barra inferior: **Hoy · Dieta · Entreno · Recetas** (antes Hoy·Mi Plan·Check-in·Progreso — Mi Plan mezclaba dieta+entreno, Check-in/Progreso ocupaban sitio fijo con poco uso). Check-in/Progreso/Compra/Chat/Apps pasan a "Accesos rápidos" en Hoy.
- `app/cliente/page.tsx` ahora lee `?tab=` al montar; los enlaces "Volver" desde calendario/sesión pasan `?tab=entreno` — antes cualquier "volver" aterrizaba siempre en Hoy perdiendo el contexto (bug que encontró Carlos en vivo).
- Fix bug real: `.pt-4` fijo en `/cliente/semana` y `/cliente/mes` dejaba el botón "Volver" oculto bajo el notch en la PWA del iPhone — cambiado a `.pt-safe`.

### Pestaña Entreno — rediseño a petición explícita de Carlos
De "sesión de hoy + botón a otra pantalla" a 3 sub-tabs propios dentro de la pestaña:
- **Hoy**: sesión de hoy con todos los ejercicios ya desplegados.
- **Semana**: acordeón de 7 días, tocar un día expande sus ejercicios inline (fetch perezoso a `/api/cliente/sesion/[id]`, cacheado en memoria).
- **Mes**: calendario tipo Apple Calendar (`components/training/CalendarioMesEntreno.tsx`, reutilizado también en `/cliente/mes` como deep-link) — tocar un día abre el detalle debajo, sin navegar fuera.
- Iteración final: cada ejercicio se lista siempre con nombre+series+reps+descanso; la explicación/RPE/técnica solo se despliega al tocar el ejercicio (`components/training/ExpandableExercises.tsx`, nuevo, reutilizado en Hoy/Semana/Mes). Quitados los botones "Empezar"/"Solo ver" y el enlace "Abrir calendario completo" — Carlos los pidió fuera por redundantes.
- `SemanaEntrenoCard.tsx` queda sin uso en el portal cliente (no borrado, por si se reutiliza en otro sitio).

### Bug de pérdida de datos real en ejercicios de cardio
`app/cliente/sesion/[id]/page.tsx` al guardar la sesión completa (`registrar-sesion`) solo mapeaba `peso_kg`/`reps`/`rpe` — para SkiErg/Carrera/etc. (que se registran en metros/tiempo, campos `distancia_m`/`tiempo_s` ya soportados por el backend) esos datos se descartaban en silencio. Con la mitad de las sesiones del programa Híbrido Hyrox+Running siendo de carrera, esto afectaba directamente a los datos reales de Carlos. Corregido enviando también `tiempo_s`/`distancia_m`. Relacionado: `lib/training/session-progress.ts` mostraba "Volumen: 0 kg" en ejercicios de cardio (fórmula solo contaba kg×reps) — ahora cae a metros/calorías cuando no hay kg.

### Bug de seguridad — nota interna de IA filtrada al chat del cliente
`lib/agentes/aplicar.ts` → `aplicarMensajeCliente()` tenía `payload.mensaje_cliente || tarea.propuesta` como fallback: `tarea.propuesta` es la recomendación interna para el coach en el kanban, nunca debe llegar al cliente. Se encontró en el chat REAL de Carlos un mensaje literal: *"Contacta urgentemente al cliente... no ajustes el plan hasta comprender la situación"* — filtrado desde una tarea de agente antigua (03-06-2026) sin `mensaje_cliente`. Fallback eliminado; los 2 mensajes filtrados borrados del chat de Carlos.

### Otros bugs de datos corregidos en el plan real de Carlos
- Ingredientes duplicados en `comida_alimentos` (Harina de trigo 90g + Agua 50g repetidos dos veces en la misma comida) inflaban el total 1142→827 kcal reales tras el fix. Filas duplicadas borradas directamente en Supabase.
- `components/PortalCliente/MiPlan.tsx`: comidas sin receta vinculada mostraban el nombre de la categoría dos veces ("Desayuno" / "Desayuno"). Nueva función `nombreDesdeIngredientes()` genera un nombre legible desde los 3 ingredientes con más peso calórico. Comidas ahora colapsadas por defecto (antes todas expandidas, imposible ver el día de un vistazo).
- `/cliente/semana`: el mensaje "Tu coach todavía no ha cargado sesiones" aparecía siempre ~1s en cada carga (no estaba condicionado a `loading`) — corregido.

### Bugs de contraste en modo oscuro (patrón repetido, 3 sitios)
`color: 'white'` fijo sobre `background: var(--primary)`/`var(--accent)` — en modo oscuro esas variables son casi blancas (`#E8E8F0`), dejando texto blanco sobre fondo casi blanco, invisible. Encontrado y corregido en: toggle Hoy/Semana de `MiPlan.tsx`, botón "Empezar entreno" de `SemanaEntrenoCard.tsx`, selector de días de `ListaCompraPortal.tsx`. Patrón correcto ya usado en otras partes de la app: `color: 'var(--bg)'` en vez de `'white'` (se invierte solo con el tema).

### Garmin Connect + Strava — verificados y conectados de verdad
Carlos preguntó si estaban bien implementados: código correcto (cifrado AES-256-CBC con IV único, OAuth completo, refresco de token, verificación de webhook), pero **cero conexiones activas** en producción (`integraciones_cliente` y `actividad_externa_cliente` vacías) — el reset de clientes del 27-09 se llevó también las conexiones, incluida la propia de Carlos. Reconectadas en vivo con credenciales reales (handoff): Garmin Connect activo, Strava autorizado (`proveedor_user_id: 62828992`). Pendiente que el reloj sincronice + cron 06:00 para ver datos reales.

### Hallazgo sin corregir (dato, no código)
Sesión "Carrera: Series Cortas en Descarga" (martes) tiene 2 ejercicios y ambos se llaman "Trote de calentamiento" (con RPE distinto) — probablemente debería ser calentamiento + series reales de 400m. Visible en el nuevo acordeón Semana. No es un bug de UI, es contenido del plan — decisión de programación, no de Claude.

### Metodología
Cada cambio verificado con `browse` (headless con handoff cuando hacía falta sesión real) contra local primero y contra producción tras cada deploy. `npx tsc --noEmit` y `npm run build` limpios antes de cada uno de los 8 commits. `vercel ls --yes` esperado hasta `Ready` antes de dar nada por confirmado.

### ⚠️ Pendiente — próxima sesión (ver también `TAREAS.md` en la raíz de `NUTRICION/`)
1. **252 hallazgos de la auditoría "forma de ingredientes vs instrucciones"** (sesión 26-09) siguen sin revisar manualmente — `nutricoach/salidas/forma-incorrecta-revision-manual-2026-09-26.json`, no está en git.
2. **"Trote de calentamiento" duplicado** en la sesión de carrera del martes del bloque Híbrido de Carlos — revisar contenido del plan, no código.
3. **Chat/Notas/Check-in/Compra/Wearables dependen del código del plan de nutrición** (`dieta.codigo_publico`), no de un identificador propio del cliente — frágil si algún día hay un cliente solo con entreno sin dieta. Hoy no afecta a nadie (todos los clientes activos tienen ambos planes). Documentado, no corregido.
4. **Verificar sincronización real de Garmin/Strava** tras el primer ciclo de cron (06:00) o reloj sincronizado.
5. Seguir puliendo visualmente otras pestañas del portal cliente (Compra, Recetas, Chat, Apps) si Carlos encuentra más cosas — no se auditaron a fondo esta sesión, solo se verificó que cargan sin errores.

### Verificación
`npx tsc --noEmit` y `npm run build` limpios en cada commit (8 commits). Cada cambio de UI probado en vivo contra `localhost:3000` y contra `nutricoach-delta.vercel.app` tras el deploy, con capturas de pantalla — no solo "el build pasa". 2 bugs de datos corregidos directamente en Supabase con confirmación explícita de Carlos antes de aplicar (`clientes.profile_id`, ingredientes duplicados, mensajes de chat filtrados).

---

## ✅ SESIÓN 27-09-2026 (tarde/noche, Claude) — Reset de clientes + rediseño ficha Entrenamiento + fixes reales de matching

### Contexto
Continuación directa de la sesión anterior (mismo día, ver bloque de abajo). Arrancó con la lista de 5 pendientes que dejó esa sesión (nutrición personal de Carlos, auditoría lado coach, progresión intra-bloque, verificación móvil, hallazgos menores) pero Carlos redirigió pronto: "vamos a hacer un pequeño reset de clientes y vamos a empezar de nuevo con 3 clientes más el mío propio... revisando cada uno para dejar la interfaz del panel de coach como quiero". El resto de la sesión fue iterativo: Carlos revisaba en el navegador, señalaba un problema visual o de datos concreto, se diagnosticaba y arreglaba, se desplegaba, se verificaba en producción con Playwright, siguiente.

### Parte 1 — Plan de nutrición personal de Carlos (afinado, dentro de NutriCoach)
Carlos ya tenía un `cliente` real (`04cc53b3`, vinculado a su propio perfil de coach) con un plan activo "Plan mantenimiento híbrido" (2886 kcal). Auditado: la proteína real de las comidas (95g/1.44g·kg) estaba muy por debajo del objetivo guardado (104g) y del estándar del propio proyecto para `rendimiento` (1.8-2.0g/kg). Ajustado a 131g (1.98g/kg) subiendo huevo del desayuno, añadiendo pechuga de pollo a la comida y recortando miel para mantener las kcal casi iguales (2886→2825). Verificado sumando macros reales de `comida_alimentos`, no solo el objetivo guardado.

### Parte 2 — Reset de clientes
Confirmado con Carlos: borrados los 10 clientes de prueba/legacy con todo su historial (planes, checkins, onboarding), conservada su cuenta propia. Creados 3 clientes ficticios nuevos con perfiles muy distintos para estresar la interfaz: Carlos Rodríguez (Hyrox rendimiento), Andrés López (powerlifter, recomposición + dislipidemia), Natalia González (vegana estricta, maratón + anemia). Generados sus planes de nutrición y entreno reales pasando por el motor de producción (no simulado).

**2 bugs reales encontrados generando esos planes:**
1. Los ejemplos de comida peri-entreno (`lib/nutricion-peri-entreno.ts`) eran texto libre hardcodeado con lácteos/huevo/whey — a Natalia (vegana) le sugería "leche desnatada", "pollo + arroz". Añadido filtro por restricción (vegano quita todo lo animal; vegetariano solo quita carne/pescado, no huevo/lácteos).
2. `inferirModalidadEntreno()` en `generar-plan-inicial` clasificaba a Natalia (maratoniana pura) como `sport_modality: 'hibrido'` solo porque su descripción de semana mencionaba "fuerza + core" como trabajo accesorio normal de running — activaba el protocolo Híbrido Hyrox completo (SkiErg, Sled Push...) sin que lo pidiera. Corregido para que esa señal solo mire el campo estructurado `tipo_entreno`, no el texto libre completo.

### Parte 3 — Auditoría "por qué esta merienda es tan mala" (a partir de un caso real de Natalia)
Carlos señaló una merienda vegana de "patatas gajos fritas" con muy poca proteína. Investigado a fondo:
- El `select()` de `filtrarRecetasPorSlot` (`lib/plan-recetas.ts`) **nunca pedía las columnas** `apto_rendimiento`, `apto_sop`, `apto_hashimoto`, `es_post_entreno`, `es_pre_entreno`, `densidad_proteica`, `score_saciedad` — el filtro de tags clínicos llevaba siendo un no-op silencioso para TODOS los clientes desde que se creó, no solo para Natalia. Corregido + añadidas las columnas.
- Aun con el filtro corregido, si hay pocas recetas con el tag puesto (vegano+merienda+rendimiento: 1 de 16), el filtro se descarta y no quedaba ninguna señal nutricional en el ranking — solo "calidad" de producción (foto/ejecución). Añadido un bonus de score (densidad proteica + saciedad) para esos casos.
- Bug encadenado: el texto `adaptacion_habitual` de la IA a veces describe una receta DISTINTA de la que realmente vincula (ej. dice "garbanzos" pero vincula "Muesli casero"). Añadida una guarda que compara el texto con el nombre real de la receta (por prefijo, no palabra exacta — el español declina por género/número) y lo oculta si no coincide.
- Pendiente sin resolver, es contenido no código: el recetario solo tiene 16 meriendas veganas y 1 sola apta para rendimiento — hace falta añadir recetas, no hay más margen algorítmico.

### Parte 4 — Rediseño completo de la pestaña Entrenamiento de la ficha del cliente
Carlos, tras ver la primera versión de sub-pestañas: "esto es muy denso, quiero la rutina real de un vistazo, no un botón que me lleve a otra pantalla". Iterado en vivo hasta:
- **5 sub-pestañas** dentro de Entrenamiento: Plan activo, Calendario, Historial, Perfil atleta, Competiciones (antes: 6 bloques pesados apilados, ~2300 líneas de scroll).
- **`RutinaSemanaAccordion.tsx`** (nuevo): rutina de la semana en acordeón, primera cosa que se ve en "Plan activo", día de hoy abierto por defecto, pace visible en la cabecera de cada fila sin desplegar.
- **`EntrenoCalendarioKanban.tsx`** (nuevo): calendario semanal drag-and-drop (`@dnd-kit`, ya usado en el proyecto) — mover una sesión de día, botón "+ Sesión" para programar una segunda sesión el mismo día, y clic en cualquier sesión para desplegar sus ejercicios in-situ.
- **`EntrenoCalendarioMes.tsx`** + `app/api/entrenos/mes-coach` (nuevos): vista mensual del calendario, con las competiciones activas del cliente marcadas en su fecha.
- **`DecisionesIACliente.tsx`** (nuevo): "aprobar IA" vivía triplicado (cockpit `/entrenos`, cola global `/entrenos/brain-ia` de 840 líneas, enlace de salida desde la ficha) — Carlos decidió que la ficha del cliente sea la única pantalla de trabajo. Versión compacta scopeada a un cliente, misma API que brain-ia (`PATCH /api/agentes/tareas`). `/entrenos/brain-ia` se deja intacta (otros sitios como `/dashboard` aún enlazan a ella) pero sale del menú lateral. `/entrenos` (el cockpit "Training OS") pasa de 3 columnas con paneles duplicados a una lista simple de clientes que enlaza a su ficha.
- **Tipografía**: texto de 9-10px en calendario (semana y mes) y filas de ejercicio subido a 11-16px con más padding — Carlos: "cuesta verlo, hay texto pegado a los extremos".
- **Panel IA colapsado por defecto**: el bloque "Training OS / decisiones" (denso, muchos "Sin dato" en un cliente nuevo) baja debajo de la rutina y empieza cerrado.

### Parte 5 — Bug real de matching de ejercicios (encontrado por Carlos revisando el calendario)
"Tirada Larga Z2" (rodaje 90min) tenía vinculado un ejercicio de máquina de gimnasio ("SkiErg Continuo"). Causa: `matchEjercicio()` en `proponer-plan-ciencia`, nivel 3 (búsqueda por palabra suelta), devolvía el primer resultado de Postgres sin ninguna preferencia por tipo ni disciplina. Auditoría posterior encontró el mismo patrón en 19 sesiones de carrera de todos los clientes (activos e históricos) — el más gracioso: "Carrera Series Cortas" (8x400m) vinculada a "Series de crol 50m" (natación).
- `matchEjercicio()` ahora recibe un `tipoPreferido` inferido del nombre de la sesión y elige entre varios candidatos por palabra en vez de quedarse con el primero — prioriza tipo correcto y excluye nombres con pinta de otra disciplina (SkiErg, sled, wall ball, natación/crol, kettlebell...).
- Bug propio en la primera versión del fix: si NINGÚN candidato de una palabra pasaba el filtro, devolvía igualmente el primero (malo) en vez de dejar que el nivel de arriba probara la siguiente palabra del nombre — eso bloqueaba que "Series 800m" llegara a probar "800m" (que sí tenía "Intervalos 800m" esperando) porque "series" ya había devuelto "Series de crol 50m". Corregido para devolver `null` y dejar pasar a la siguiente palabra.
- 5 ejercicios de running puro mal etiquetados como `tipo='fuerza'` en la tabla `ejercicios` corregidos a `'cardio'` (Tempo Run T-pace, Intervalos Umbral 1km, Carrera Larga E-pace, Strides de Velocidad, Intervalos I-pace 1000m) — alimentaban el mismo bug aguas abajo.
- Datos reales corregidos en los 2 planes actualmente activos con el patrón (Carlos Casanova, Carlos Rodríguez).

### Parte 6 — Reparto Híbrido Hyrox+Running: 5→6 sesiones
Carlos: "hace mucho énfasis en hyrox pero solo dos días de run". El reparto (3 híbridas + 2 carrera, fijado a propósito en el prompt desde el diseño original) pasó a 3 híbridas + 3 carrera — la sesión de series y la de tempo run entre semana ahora se incluyen las dos en vez de elegir una, más la tirada larga del fin de semana. Verificado regenerando el bloque real de Carlos dos veces hasta que salió limpio (6 sesiones, 0 sospechosos de matching).

### Metodología de esta sesión
- Cada cambio de UI se verificó con `browse` (headless Chromium) contra `localhost:3000` primero, con una cookie de sesión de coach real construida vía `admin.auth.admin.generateLink()`, y luego contra producción tras cada deploy — no solo "el build pasa".
- El drag-and-drop del calendario no se pudo verificar con eventos de puntero sintéticos en headless (dnd-kit no responde igual a `PointerEvent` scripteado que a un puntero real) — se verificó la escritura en BD directamente y se le pidió a Carlos que confirmara el gesto con el ratón.
- Cada commit se desplegó y se esperó activamente a `vercel ls --yes` en estado `Ready` antes de dar nada por confirmado — dos veces Carlos preguntó "¿ya está?" mientras un deploy seguía en German `Building`.
- 8 commits, todos con `tsc`/`build` limpios antes de cada push.

### ⚠️ Pendiente — próxima sesión
1. **Carlos se centra en el portal cliente (`app/cliente/*`)**: quiere ver desde el lado del cliente en su iPhone cómo se materializa todo lo que se ha tocado hoy (plan de entreno, rutina, calendario) y encontrar fallos visuales/de usabilidad ahí. Sesión previa (26/27-09 noche, ver bloque de abajo) ya hizo un pase grande de portal cliente (fix crítico de RLS + 4 pestañas nuevas conectadas) — esta sería la continuación con foco puramente visual/UX en móvil real.
2. **252 hallazgos de la auditoría "forma de ingredientes vs instrucciones"** (sesión 26-09) siguen sin revisar manualmente — `nutricoach/salidas/forma-incorrecta-revision-manual-2026-09-26.json`, no está en git (`salidas/` en `.gitignore`).
3. **Progresión intra-bloque + periodización real hacia fecha de carrera**: diseño ya aprobado por Carlos a mitad de esta sesión (usar `calcularEstadoBloque` existente para variar carga semana 1→4, y la tabla `competiciones`/`fase_deportiva_cliente` ya construida para nutrición para elegir la fase del bloque según días-hasta-la-carrera en vez de rotación fija) — nunca se llegó a implementar porque Carlos pivotó al reset de clientes. La spec conversacional sigue vigente si se retoma.
4. **9 sesiones de carrera con el mismo bug de matching en planes inactivos/históricos** (no visibles en ninguna ficha activa ahora mismo) quedaron sin corregir a propósito — sin impacto visible, revisar si se reactivan esos planes alguna vez.
5. Recetario: solo 16 meriendas veganas, 1 apta para rendimiento — contenido, no código.
6. Otras 5 pestañas de la ficha (Resumen, Nutrición, Seguimiento, Comunicación, Perfil) no se tocaron — son más ligeras que Entrenamiento, Carlos prefirió ver primero cómo quedaba esto antes de decidir si hace falta un rediseño más completo ahí también.

### Verificación
`npx tsc --noEmit` y `npm run build` limpios antes de cada uno de los 8 commits. Cada cambio de UI probado en vivo con `browse` contra local y contra producción tras el deploy (capturas, sin errores de consola). 2 planes de entreno reales regenerados dos veces para confirmar los fixes de matching de ejercicios. Datos de producción verificados por consulta directa a Supabase antes y después de cada corrección (nunca solo "debería funcionar").

---

## ✅ SESIÓN 26/27-09-2026 (noche, Claude) — Programa Híbrido Hyrox+Running + hallazgo crítico: portal cliente mostraba planes vacíos a TODOS los clientes

### Contexto
Carlos pidió construir un sistema de rutinas de entrenamiento centrado en Hyrox + running (5-10-21k), usándose a sí mismo como primer cliente real (dogfooding) antes de tocar nutrición o abrir a más clientes. Sesión completa: brainstorming → spec → plan → implementación con TDD → revisión final con fixes → auditoría abierta del resto de la app a petición de Carlos ("sigue probando cosas tú... debería funcionar como una app top del mercado").

### Parte 1 — Programa Híbrido Hyrox + Running (spec + plan + 8 tareas)

Spec: [`docs/superpowers/specs/2026-09-26-hyrox-running-training-system-design.md`](docs/superpowers/specs/2026-09-26-hyrox-running-training-system-design.md). Plan: [`docs/superpowers/plans/2026-09-26-hyrox-running-training-system.md`](docs/superpowers/plans/2026-09-26-hyrox-running-training-system.md).

**Sin ninguna migración de BD** — se reutilizaron 3 columnas ya existentes y sin usar: `sesiones_entrenamiento.fase_bloque`, `sesion_ejercicios.peso_sugerido`, `ejercicios.tipo`.

- **Motor de generación** (`app/api/entrenos/proponer-plan-ciencia/route.ts`): nuevo protocolo combinado quese activa solo si `perfil_entreno_cliente.sport_modality === 'hibrido'` — 3 sesiones híbridas (estaciones Hyrox reales + hipertrofia accesoria rotando espalda/pecho/bíceps/hombro) + 2 de carrera (tirada larga fija fin de semana + series/tempo alternando entre semana según la fase del bloque). Bloques de 4 semanas rotando Base→Fuerza→Resistencia→Deload. Pesos y ritmos concretos estimados por IA (sin RM/VDOT reales aún), con autoajuste por RPE ya existente en el motor. Clientes no-híbridos generan exactamente igual que antes (verificado con cliente real gym_fuerza).
- **`lib/entrenos/bloques.ts`** (nuevo, con test real `scripts/bloques-entreno.test.ts`): lógica pura de rotación de fase, cálculo de semana-en-bloque (por día de calendario, no por horas), clasificación híbrido/carrera de una sesión por mayoría de tipo de ejercicio, helper `calcularBloqueInfo` compartido.
- **3 vistas cliente**: `/cliente` (pill de bloque en `SemanaEntrenoCard`), `/cliente/semana` (pill + iconos Dumbbell/Footprints por sesión), `/cliente/mes` (nueva página, calendario completo con fases por semana y transición de bloque).
- **Panel coach**: `components/clientes/GenerarBloqueHibridoPanel.tsx` en la pestaña Entrenamiento — "Generar plan Híbrido..." / "Generar siguiente bloque: X", oculto para clientes no-híbridos (evita desactivar por error el plan de un cliente que no es de este programa).
- **Revisión final (subagente opus, rama completa)**: 4 hallazgos Critical/Important corregidos con TDD — cabecera del calendario mensual desalineada un día completo, botón de bloque apareciendo/actuando sobre clientes no-híbridos, ritmo de carrera invisible durante la ejecución real de la sesión (solo se veía en "solo ver"), `fase_bloque_objetivo` sin validar. 8 hallazgos menores corregidos después en una segunda pasada (fechas por día completo en vez de por horas, umbral de clasificación híbrido/carrera a mayoría simple, helper de bloque unificado, varios detalles de `/cliente/mes`).
- Trabajado en worktree (`feature/hyrox-running-training`) con ledger de ejecución, merge fast-forward a `main` al terminar.

### Parte 2 — Auditoría abierta del portal cliente real (a petición de Carlos)

**Hallazgo crítico de la noche**: el portal cliente autenticado (`/cliente`) pedía la dieta y el entreno activos con un join anidado de 3 niveles (`planes_nutricion→comidas→comida_alimentos→alimentos`, y lo mismo para entrenamiento) **directamente desde el cliente Supabase del navegador**. RLS corta esos joins en silencio — sin error, sin 403 — así que **absolutamente todo cliente real veía su plan de dieta y de entreno con 0 comidas, 0 sesiones y 0 kcal**, aunque el coach le hubiera preparado un plan completo. Verificado con 3 cuentas de cliente reales distintas antes del fix (0 comidas vistas / 4 reales en BD, 0 sesiones vistas / 6 reales), y con capturas antes/después (0 kcal/día → 3193 kcal/día tras el fix).

Fix: dos endpoints nuevos con `service_role` (mismo patrón ya usado para las APIs de entrenamiento de la Parte 1) — `/api/cliente/plan-nutricion-activo` y `/api/cliente/plan-entrenamiento-activo`, que resuelven el cliente por sesión autenticada. `app/cliente/page.tsx` ahora los consume en vez del join roto.

**3 bugs más encontrados y corregidos en la misma auditoría**:
1. `components/PortalCliente/MiPlan.tsx` tenía su propia función privada de filtrado de comidas por día (`comidaDelDiaActivo`) que anclaba las comidas recurrentes (`dia_semana` null) al Lunes fijo — cualquier otro día mostraba "No hay comidas construidas" aunque el plan sí tuviera comidas. Corregido delegando en el helper compartido y ya probado `lib/nutricion/comidas-dia.ts` (46/46 tests) en vez de reimplementar la regla por tercera vez.
2. `app/api/cliente/[codigo]/mis-platos/route.ts` buscaba el código público en `clientes.codigo_publico` — columna que no existe (vive en `planes_nutricion.codigo_publico`, regla ya documentada en este archivo). La pestaña "Recetas" daba 404 siempre. Corregido.
3. Barrido sistemático confirmó que ningún otro componente de `components/PortalCliente/*` hace queries directas a Supabase (todos pasan por `fetch()` a rutas API) — el patrón roto estaba solo en `app/cliente/page.tsx` y `MiPlan.tsx`. Barrido de `codigo_publico` confirmó que `mis-platos` era la única ruta con ese bug.

**Feature nueva conectada** (decisión explícita de Carlos al ver el hueco): el portal cliente real solo tenía 4 pestañas (Hoy, Mi Plan, Check-in, Progreso). Compra (`ListaCompraPortal`), Recetas personalizadas (`MisPlatos`), Chat con el coach (`ChatPanel`) e integraciones con wearables (`IntegracionesPanel`) ya estaban completamente construidos y probados, pero solo se usaban desde el portal público antiguo por código (`/cliente/[codigo]`) — inalcanzables para un cliente autenticado normal. Añadidos como accesos rápidos desde la pestaña Hoy (no en el nav inferior fijo, para no saturar de pestañas el móvil), reutilizando el mismo `codigo`/`cliente.id` que la página ya resolvía.

**Verificado con interacciones reales, no solo carga de pantalla**: marcar una comida como "Hecha" (pasa a 1/4 completadas, toast "Comida registrada"), enviar un mensaje de chat (aparece en el hilo), completar un check-in (peso + sliders → "¡Check-in completado!", historial actualizado a 1 registro) — los tres verificados de principio a fin contra Supabase real.

### Metodología de esta sesión (para repetir en próximas auditorías)
- Cuentas de cliente reales de prueba usadas: `andres.lopez.powerlifting@nutricoach-test.dev`, `carlos.rodriguez.hyrox@nutricoach-test.dev`, `natalia.gonzalez.maraton@nutricoach-test.dev`, `sofia.ruiz.ciclismo@nutricoach-test.dev` (rol `cliente` real, no coach — necesario para probar el portal tal cual lo ve un cliente, ya que la cuenta de Carlos tiene rol `coach` y `/cliente` la redirige a `/dashboard`).
- Cookie de sesión real construida vía `admin.auth.admin.generateLink({type:'magiclink'})` + `/auth/v1/verify` + cookie `sb-<ref>-auth-token` en formato `base64-<base64 JSON>` — mismo patrón ya documentado en sesiones anteriores.
- Cuando se detecta "0 de algo que debería ser N": comparar SIEMPRE lo que devuelve la query tal cual la ejecuta el código (con el JWT del usuario, no con service role) contra la realidad en BD (con service role) — así se confirma si es un problema de RLS silencioso o de datos realmente vacíos. Sin error, sin 403, 0 filas: esa combinación es la huella del patrón "join anidado desde el cliente + RLS", no un dato vacío legítimo.
- `DashboardCliente.tsx` (9 pestañas: Dieta/Training/Compra/Recetas/Chat/Apps/etc.) es el portal **antiguo público por código** (`/cliente/[codigo]`), NO el portal autenticado real. El portal real es `app/cliente/page.tsx` (solo 4 pestañas antes de esta sesión). Cualquier auditoría futura del "portal cliente" debe apuntar a `app/cliente/page.tsx`, no a `DashboardCliente.tsx` — confundir los dos hizo perder tiempo al principio de esta sesión.

### Verificación de toda la sesión
`npx tsc --noEmit` y `npm run build` limpios en cada paso · test unitario `scripts/bloques-entreno.test.ts` en verde · cada fix probado en vivo con Playwright contra Supabase real y capturas de pantalla, no solo lectura de código · 4 clientes de prueba × 8 pestañas (32 combinaciones) sin errores de consola/red tras el fix crítico.

### ⚠️ Pendiente — próxima sesión
1. **Nutrición**: Carlos quiere afinar su propio plan de nutrición (quedó fuera de alcance explícitamente esta sesión — el objetivo era validar primero el sistema de entrenamiento).
2. **Seguir auditando el resto de la app** como pidió Carlos ("debería funcionar como una app top del mercado"): quedó pendiente el lado coach a fondo y el recetario. Se hizo un barrido estático del patrón "`clientes.codigo_publico`" (sin más hallazgos) y del patrón "join anidado desde componente cliente" (sin más hallazgos en `components/PortalCliente/*`), pero no se auditaron a fondo `app/clientes/*`, `app/dietas/*`, `app/recetas/*`, `app/entrenos/*` (lado coach) en esta sesión.
3. **Progresión intra-bloque** (semana 1 vs semana 4 del bloque con series/reps distintas, hoy se repite la misma semana tipo) y **periodización real hacia una fecha de carrera** (usar tabla `competiciones` ya existente) — mejoras futuras documentadas en la spec, no implementadas a propósito (fuera de alcance v1).
4. Verificar visualmente en el móvil real de Carlos (PWA) el programa Híbrido y las 4 pestañas nuevas — todo verificado con Playwright/dev server esta sesión, no en dispositivo real.
5. 5 hallazgos menores documentados pero no corregidos (deliberadamente, no bloqueantes): ver ledger de la Parte 1 en `docs/superpowers/plans/2026-09-26-hyrox-running-training-system.md` si se recupera el workspace, o el propio historial de commits (`git log --oneline` desde `49b3e9a` hasta `39f48bb`) para el detalle exacto de cada uno.

---

## ✅ SESIÓN 26-09-2026 (noche, Claude) — Cron Garmin/Strava roto, PWA cliente rota, auditoría masiva del recetario

### Contexto
Continuación de la sesión de tarde (T18/T20/T15, ver bloque de abajo). Carlos pidió cerrar T13/T14 (Strava/Garmin), pero al investigar T14 se encontró un bug de código real (no un tema de reautorizar Strava). Mientras se corregía, Carlos reportó en vivo que la PWA de su iPhone "no funciona como debería" y, revisando una receta en la app, encontró un ingrediente con la forma equivocada (avena en copos en vez de harina) — eso escaló a una auditoría sistemática de todo el recetario.

### T14 — Cron de sync Garmin/Strava llevaba roto desde que se creó
`app/api/cron/sync-integraciones/route.ts` comprobaba un header (`x-cron-secret`/`?secret=`) que Vercel nunca envía al invocar el cron automático — Vercel manda `Authorization: Bearer <CRON_SECRET>`, que es lo que ya comprobaba bien `agentes/ejecutar/route.ts`. El cron se disparaba solo cada día a las 06:00 UTC pero devolvía 401 en silencio siempre, sin sincronizar nada. Fix: `checkAuth()` ahora lee `Authorization: Bearer` primero. `CRON_SECRET` regenerado con valor real en Vercel Production (Vercel CLI quedó autenticado en esta sesión, `vercel whoami` → `ccc8890-9712`). Verificado con deploy nuevo + curl real → `HTTP 200`, sincronizó 2 registros Garmin, confirmados en `actividad_externa_cliente`.

**⚠️ Lección importante:** `vercel env pull` devuelve `""` para 36 de 46 variables de entorno sensibles de este proyecto (incluida `SUPABASE_SERVICE_ROLE_KEY`, que sabemos tiene valor real porque se usa con éxito en todos los scripts de esta sesión leyendo `.env.local`). Es un bug/limitación del propio comando `env pull`, no refleja el estado real de las env vars en Vercel. **No usar `vercel env pull` para diagnosticar si una env var está vacía** — verificar siempre contra el comportamiento real del endpoint desplegado.

Commit `9be9b68`.

### T25 — PWA de `/cliente` abría el dashboard de coach en el iPhone
Carlos: "la app que tenía puesta en el iphone de cliente no funciona como debería". Causa: `/cliente` (portal cliente autenticado, el de uso diario — no confundir con `/cliente/[codigo]`, el portal público antiguo) no tenía `layout.tsx` propio, así que heredaba el manifest raíz (`manifest.json`, `start_url: /dashboard`, panel de coach). Al añadir el portal a pantalla de inicio desde Safari en `/cliente`, el icono instalado abría el dashboard de coach. Nuevo `app/cliente/layout.tsx` declara `manifest-cliente-carlos.json` (`start_url: /cliente`) para toda la subruta — mismo patrón que ya tenía `/cliente/[codigo]` desde sesión 07-06, pero esa ruta vieja no cubre `/cliente`. Verificado con curl: `/cliente` sirve ahora `rel="manifest" href="/manifest-cliente-carlos.json"`.

Commit `ab94edf`.

### T26 — Auditoría IA "forma de ingredientes vs instrucciones" + limpieza recetario
Carlos, revisando "Tortitas de avena y plátano sin harina": el ingrediente "avena en copos" no permite una masa homogénea de tortita, debería ser harina de avena. También encontró "vinagre" contando en macros/lista de compra en una receta de huevo escalfado, cuando solo se usa para el agua de cocción y se descarta. Se generalizó a una auditoría sistemática con DeepSeek sobre las 474 recetas aprobadas, comparando instrucciones vs ingrediente vinculado.

**Resultado: 376 hallazgos en 240/474 recetas (51%)** — mucho más grave de lo esperado. No era solo "forma equivocada": muchos ingredientes están vinculados a un alimento completamente distinto dentro de la misma receta (patrón de varios ingredientes desplazados a la vez, probablemente un bug de algún script de importación/reparación masiva pasado, no investigado a fondo). Ejemplos reales encontrados:
- "Merluza al vapor con patata y judías verdes": "patata cocida" → **"Albóndigas con Patatas a lo Provenzal"** (un plato preparado).
- "Macarrones guisados con pavo y tomate": "pasta blanca" → **"Pastanaga"** (zanahoria en catalán).
- Varias recetas de salmón/atún con el pescado vinculado a **pechuga de pollo**.

**4 scripts nuevos** (`scripts/auditar-forma-ingredientes-ia.mjs`, `fix-no-se-ingiere-t18b.mjs`, `matchear-forma-incorrecta.mjs`, `aplicar-forma-incorrecta-alta-confianza.mjs`):
1. Auditoría DeepSeek read-only → 362 "forma_incorrecta" + 14 "no_se_ingiere" (ingrediente de técnica que se descarta, ej. vinagre de escalfar).
2. Aplicados 12/14 "no_se_ingiere" (2 excluidos tras revisión manual: 1 falso positivo donde la sal sí se ingiere, 1 caso donde la IA confundió el vinagre de otra receta con un ingrediente de spaghetti sin relación).
3. Segunda pasada que **no se fía del texto libre de la sugerencia de la IA**: busca en `alimentos` real y solo marca "alta confianza" cuando hay un match inequívoco (110 de 362; el resto — 252 — queda en `salidas/forma-incorrecta-revision-manual-2026-09-26.json` para revisión manual, no está en git porque `salidas/` va en `.gitignore`).
4. Aplicados 107 de los 110 de alta confianza (3 excluidos, datos de origen demasiado confusos para automatizar). Recalculadas macros de 86 recetas.

**Bug propio detectado y corregido durante la aplicación**: al re-vincular un ingrediente a un alimento de densidad calórica muy distinta (ej. "leche semidesnatada" 200g → "Aceite de coco virgen", o "pimiento asado" 100g → "Nueces troceadas") sin ajustar `cantidad_gramos`, 3 recetas dispararon a >900kcal/porción de forma absurda ("Arroz cremoso con plátano y aceite de coco" llegó a 2081kcal). Detectado con un barrido de sanidad post-aplicación (buscar recetas con kcal fuera de rango 50-850) antes de dar la tarea por cerrada, y corregido a mano ajustando las cantidades a valores realistas.

**Bonus**: detectadas y eliminadas 2 recetas de prueba/desarrollo que llevaban filtradas en producción como `estado='aprobada'` desde mayo (`url_origen` literal "test-url", sin imagen real): "Tortitas de Avena y Plátano" (duplicado sin imagen de la receta real que Carlos revisó) y "Gofres proteicos". Estaban en uso por 2 planes (1 inactivo, 1 de clienta sintética de test — ningún cliente real afectado), migradas a recetas reales antes de borrar.

Commit `64eba83`.

### ⚠️ Pendiente — próxima sesión
1. **252 hallazgos + 3 casos confusos** de la auditoría del recetario sin aplicar, en `salidas/forma-incorrecta-revision-manual-2026-09-26.json` — necesitan ojo humano (Carlos), son ambiguos o sin candidato claro en BD. Regenerar el JSON con `node scripts/auditar-forma-ingredientes-ia.mjs` si no está a mano.
2. **T13 — Strava reautorizar**: Carlos tiene que hacer login/consentimiento en Strava desde la app (`/cliente` → tab Apps → Conectar). No automatizable.
3. Investigar la causa raíz del patrón de "varios ingredientes desplazados a la vez dentro de la misma receta" (visto en varias recetas de la auditoría) — no se investigó a fondo esta sesión, solo se corrigieron los síntomas.

### Verificación
`npx tsc --noEmit` limpio en cada paso. Cada fix probado contra Supabase real y/o contra el endpoint desplegado en producción (`nutricoach-delta.vercel.app`), no solo `git push`. Vercel CLI quedó autenticado (`ccc8890-9712`) — útil para futuras sesiones (deploys, logs, env vars — con la salvedad de `env pull` documentada arriba).

---

## ✅ SESIÓN 26-09-2026 (parte 3, Claude) — Simplificación del menú: quitar duplicados, menos pestañas

### Contexto
Carlos, no programador: "necesito que todo funcione de una manera lógica y sencilla... sin demasiadas pestañas... y que no haya funciones duplicadas aquí y allá... todo organizado y en su justa medida." Se le presentaron los duplicados reales encontrados y confirmó por dónde empezar antes de tocar nada de navegación (ver preguntas respondidas: código muerto primero, dar protagonismo al generador de entreno con ciencia real, fusionar las 3 pestañas de revisión de recetas).

### Cambios hechos
1. **Código muerto eliminado**: `app/api/recetas/migrar/route.ts` + `scripts/migrar-recetas.mjs` (migración de esquema ya completada hace meses, sin ninguna pantalla que lo usara). `components/training/TrainingSubNav.tsx` (componente de navegación de entreno huérfano — nunca se importaba desde ningún sitio, era el residuo de un rediseño anterior).
2. **Un solo generador de plan de entreno con IA**: eliminado `/entrenos/generar-ia` (página + API), el motor simple que además citaba menos ciencia y llevaba roto (bug de esta sesión, parte 2). Se quitó su entrada de 3 sitios distintos donde estaba duplicada (`components/Sidebar.tsx`, `components/training/TrainingWorkspaceShell.tsx`, CTA en `/entrenos/plantillas`) — el propio hecho de que hubiera 3 definiciones de menú de entreno casi idénticas mantenidas a mano por separado (con etiquetas ligeramente distintas: "Plan con IA" vs "Plan IA") era parte del problema de duplicación que reportó Carlos. El motor bueno (`proponer-plan-ciencia`, con papers citados y periodización real) ya era accesible desde la ficha de cada cliente (`/clientes/[id]/revisar-plan`, botón "Regenerar") — se dejó ahí, que es donde tiene sentido: un plan de entreno se genera PARA un cliente concreto, no en abstracto.
3. **Recetario: 3 pestañas del menú → 1**. "Imágenes", "Pendientes" y "Revisión" eran en el fondo la misma tarea ("recetas que necesitan atención antes de publicarse"). Se creó `components/recetas/RevisionTabs.tsx`, una pestaña interna ligera insertada dentro de las 3 páginas existentes (`/recetas/revisar`, `/recetas/cola`, `/recetas/imagenes`) — **sin tocar la lógica interna de cada una** (cada una sigue siendo su propio código, ~400-500 líneas, con su propia función real y distinta: cola de importación, aprobación con quality-gate, control de calidad visual). El menú principal ahora solo tiene una entrada ("Revisión" → `/recetas/revisar`); desde ahí se navega a las otras dos con pestañas dentro de la misma pantalla, sin volver al menú lateral.
4. **Imports huérfanos limpiados** en `components/Sidebar.tsx` (`Images`, `Sparkles` ya no se usaban).

### Por qué NO se tocó todavía (fuera de alcance de lo confirmado)
- **4 páginas distintas llamadas "Dashboard"** (Inicio, Dashboard Nutrición, Dashboard Entrenamiento, Dashboard Sistema) — detectado y reportado a Carlos, pero renombrarlas es una decisión de naming que no se confirmó explícitamente en esta sesión.
- **Precios/Compra con 4 pestañas** (Escandallo y Precios se solapan conceptualmente) — reportado, no confirmado.
- **`generar-dieta-ia`** (API paralela y más simple a `generar-plan-inicial`) — se pensó inicialmente que era código muerto (nadie la enlazaba desde ninguna página top-level), pero SÍ se usa desde `components/RespuestasClientes.tsx` (flujo de generar dieta a partir de una respuesta de cuestionario, no del flujo de onboarding normal). No se tocó — consolidarla con el motor bueno es un cambio más grande que requiere entender ambos flujos primero.
- El propio `/entrenos` tiene DOS sistemas de navegación en paralelo (el sidebar principal + una barra de pestañas interna del "workspace" de entreno, `TrainingWorkspaceShell.tsx`, con Command/Plan/Library/Brain) que muestran cosas parecidas por caminos distintos — es un patrón de doble navegación más profundo que no se rediseñó esta sesión, solo se le quitó el duplicado del generador de IA.

### Continuación — los 3 pendientes que quedaban abiertos (Carlos dijo "sigue")

**1. Los 4 "Dashboard" con el mismo nombre — corregido.** Renombrados a "Resumen" (`/nutricion`, `/entrenos`, `/sistema`); `/dashboard` ya se llamaba "Inicio" y no hacía falta tocarlo. Ninguna de las 3 páginas mostraba la palabra "Dashboard" en su propio contenido, así que el cambio es solo de etiqueta de menú, sin riesgo.

**2. Precios / Escandallo / Rentabilidad — investigado, NO son duplicados reales.** Se abrió el código de las 3: `Precios` (`components/AdminPrecios.tsx`, 595 líneas) es el catálogo de precios de supermercado en bruto; `Escandallo` (484 líneas) es la cobertura de coste por receta a partir de ese catálogo; `Rentabilidad` es un buscador de cliente para ver el coste de SU plan concreto. Son 3 tareas distintas sobre el mismo dominio (coste de la comida), no la misma función repetida — fusionarlas habría mezclado "gestionar mi base de precios" con "auditar qué recetas tienen coste sin calcular" con "ver cuánto le cuesta a este cliente su dieta". Se dejaron separadas pero con nombres que dicen qué hace cada una en vez de una palabra genérica: "Catálogo de precios", "Coste de recetas", "Rentabilidad por cliente".

**3. Doble navegación en Entrenamiento — eliminada.** `app/entrenos/layout.tsx` envolvía cada página con `TrainingWorkspaceShell`, una barra superior propia (con sus propios "modos" Operate/Plan/Library/Brain) que repetía casi los mismos enlaces que ya están en el menú lateral. Además tenía una caja de "buscar cliente, plan, ejercicio" que **no hacía nada** (era texto decorativo, no un input funcional) y 3 indicadores ("Riesgo: live", "IA: review", "Sesiones: hoy") con **valores fijos, no datos reales** — parecía información en vivo pero era decoración estática. Se quitó el shell entero; `/entrenos/*` ahora usa el mismo patrón que todas las demás secciones (`CoachShell` a secas). Las 5 páginas de Entrenamiento ya tenían su propio título, así que ninguna se quedó sin cabecera. También se borró `TrainingSubNav.tsx`, un tercer intento de menú de entreno que llevaba tiempo sin usarse desde ningún sitio — la app llegó a tener 3 listas de navegación de Entrenamiento mantenidas por separado (Sidebar, TrainingSubNav muerto, TrainingWorkspaceShell), ahora queda solo 1.

### Verificación (de toda la parte 3)
`npx tsc --noEmit` 0 errores · `npm run build` producción completo sin errores · crawl con Playwright de las 3 páginas de revisión de recetas + `/nutricion` + `/entrenos` (y sus 4 subpáginas) + `/sistema` + `/precios` (y sus 2 subpáginas): 13 páginas comprobadas, todas cargan sin error de página ni de consola.

---

## 🐛 Hallazgo de Carlos (sesión 26-09-2026, revisando una dieta real) — auto-match de ingredientes a productos equivocados

Carlos, revisando una dieta ya aplicada, encontró: **"Bowl de skyr con granola de almendra y frutos rojos"** con ingredientes reales `frambuesas congeladas` → vinculado a **"Frambuesas Cubiertas Choc,Blanc y Choc,Leche"** (450kcal/100g, un producto de chocolatería, no fruta), `arándanos congelados` → vinculado a **"Barritas de galleta rellenas de arándanos"** (420kcal/100g), y `granola sin azúcar` → vinculado a **"Granola Fitness Chocolate"** con **0 kcal registradas en la base de datos**. Los 4 (+ `yogur skyr natural 0%`→yogur de sabor) se corrigieron a mano en la receta `8ab0fee9-d55e-4764-ba32-0a68e0f8ba2a`, vinculándolos a alimentos base reales.

Es la 3ª instancia de este patrón detectada en el día (ver también el bug de "Bebida de coco/almendras"→lácteo real de la parte 1). **No es un caso aislado** — ver `TAREAS.md` T18 (subida a prioridad alta) para el criterio de detección sistemática propuesto y quedar pendiente de una auditoría completa del recetario, que Carlos pidió dejar para más adelante ("nos meteremos más tarde en el recetario").

---

## ✅ SESIÓN 26-09-2026 (parte 2, Claude) — Auditoría funcional completa de la app: 11 bugs reales más encontrados y corregidos

### Contexto
Carlos pidió, tras revisar los planes de la parte 1: "cerciórate que todos los parámetros y secciones de la app funcionen correctamente... antes de pasar a otras cosas" y "revisa todos esos fallos". Se hizo una auditoría sistemática de TODA la app, no solo del motor de planes.

### Metodología (2 técnicas automatizadas, no revisión manual página por página)
1. **Prueba en vivo de cada `.from().select()` estático del código** contra el esquema real de Supabase (625 pares encontrados, cruzados contra columnas y relaciones reales vía el esquema OpenAPI de PostgREST). Esto reproduce exactamente el error que vería un usuario real, sin adivinar.
2. **Crawl con navegador real (Playwright)** de las ~36 páginas del panel coach y 2 del portal cliente, con una sesión de coach/cliente auténtica (cookie de Supabase construida igual que en la parte 1), capturando errores de consola, `pageerror` y respuestas HTTP ≥400.

### 11 bugs reales encontrados y corregidos
| # | Bug | Causa raíz | Fix | Archivo |
|---|-----|-----------|-----|---------|
| 1 | **`/clientes/[id]/revisar-rapido` (cualquier cliente nuevo sin revisar) → "Cliente no encontrado"** | `clientes` tiene DOS FK a `profiles` (`coach_id` y `profile_id`); el embed `profiles(...)` sin desambiguar hace que PostgREST rechace la consulta entera (`PGRST201`) | `profiles!profile_id(...)` | `app/clientes/[id]/revisar-rapido/page.tsx` |
| 2 | `GET /api/clientes` (usado en `/compra`) fallaba con el mismo error | Mismo problema | `profiles!profile_id(...)` | `app/api/clientes/route.ts` |
| 3 | `costes-clientes` (dashboard, ya retirado de la UI) y el "informe de caso clínico" (`inteligencia-clinica.ts`, usado dentro de la generación de plan) tenían el mismo problema silencioso | Mismo problema | `profiles!profile_id(...)` | `app/api/dashboard/costes-clientes/route.ts`, `lib/inteligencia-clinica.ts` |
| 4 | El **"informe de caso clínico"** (capa de personalización que se inyecta en el prompt de generación de dieta) llevaba roto además por 2 motivos más: intentaba leer `onboarding_perfil_profundo` como columna en vez de relación, y usaba `restricciones_alimentarias`/`tipo_entrenamiento` que no existen donde los buscaba | — | Embeds correctos (`onboarding_perfil_profundo(condiciones_salud)`, `onboarding_responses(tipo_entreno)`) + lectura de `restricciones_alimentarias` desde `clientes` | `lib/inteligencia-clinica.ts` |
| 5 | El **"perfil de gusto" del cliente** (28-30% del peso del algoritmo de selección de recetas, ver sesión parte 1) llevaba roto desde su creación: leía `checkins.peso_kg` y `checkins.adherencia_pct`, columnas que nunca existieron (son `peso` y `adherencia`, escala 1-10 no %) | — | Alias en el select + conversión de escala (`adherencia * 10`) | `lib/agentes/perfil-gusto.ts` |
| 6 | El **"aprendizaje colectivo"** (retroalimentación entre todos los clientes) leía 2 columnas más que tampoco existen (`alimentos_rechazados_categorias`, `adherencia_historica_media`, `tasa_ejecucion_media`) | Mismo patrón que el bug de aprendizaje-colectivo ya corregido en la sesión de ayer (25-09) — nueva instancia no detectada entonces | `categorias_evitar`, `adherencia_promedio_30d`; se retira `tasa_ejecucion_media` (sin dato real disponible) | `lib/agentes/aprendizaje-colectivo.ts` |
| 7 | El **motor de detección de estancamiento (`training-brain.ts`)** no podía nombrar el ejercicio en plateau (`ejercicio_nombre` no existe en la vista `prs_por_ejercicio`) ni leer `nivel_experiencia` (no existe, es `nivel`) | — | Embed `ejercicio:ejercicios(nombre)` + columna `nivel` | `lib/agentes/training-brain.ts` |
| 8 | `command-center` (dashboard de entrenamiento) filtraba PRs de la semana por `fecha_pr`, columna inexistente (`fecha`) | — | `fecha` | `app/api/entrenos/command-center/route.ts` |
| 9 | **`/entrenos/generar-ia`** (página real, enlazada desde el sidebar) rompía siempre: pedía `profiles.edad/peso_actual/altura`, que no existen ahí | — | Se retiran del select (no se usaban en el prompt) | `app/api/entrenos/generar-ia/route.ts` |
| 10 | **`generar-plan-inicial`** leía `plantillas_dieta` (typo, la tabla real es `plantillas_dietas`) — no rompía la generación (el código tolera `null`) pero las plantillas de dieta del coach nunca se inyectaban en el prompt | — | `plantillas_dietas` | `app/api/generar-plan-inicial/route.ts` |
| 11 | **AutoCoach** (panel del dashboard) usaba una relación `profile!inner` que no existe (es `profiles`) y buscaba `fecha_proxima_revision` en `planes_nutricion` en vez de en `clientes` — la alerta "revisión de plan pendiente" nunca se disparaba | — | `profiles!profile_id(...)` + fecha leída de `clientes` | `lib/auto-coach.ts` |
| 12 | `/api/precios/escandallo` (página real) daba 500 en segundo plano vía `/api/precios/cobertura`: `receta_ingredientes` tiene DOS FK a `recetas` (`receta_id` y `receta_vinculada_id`), mismo patrón que el bug #1 | — | `recetas!receta_ingredientes_receta_id_fkey(...)` | `app/api/precios/cobertura/route.ts` |
| 13 | La IA de entrenamiento (`lib/agentes/aplicar.ts`) no podía leer ni escribir el RPE de una sesión real asignada a un cliente — la columna `rpe` solo existía en las plantillas, no en `sesion_ejercicios` | Columna nunca se creó al añadir RPE a las plantillas (Training Pro Plan 1) | **Migración de base de datos** `alter table sesion_ejercicios add column rpe text` aplicada directamente con `supabase db query --linked` (el historial de migraciones locales está desincronizado del remoto — `supabase db push` normal falla, ver Pendientes) | `supabase/migrations/20260926_add_rpe_sesion_ejercicios.sql` + Supabase remoto |

### 🚨 Incidente propio durante la sesión (documentado para que no se repita)
Al limpiar la infraestructura de test de la parte 1 (coach sintético temporal), se llamó a `supabase.auth.admin.deleteUser()` sobre el coach de prueba **después** de haber generado los 6 planes de nutrición/entrenamiento bajo su `coach_id`. Borrar ese usuario **hizo cascada sobre `planes_nutricion`/`planes_entrenamiento`** (FK a `profiles.id`) y borró los 6 planes recién creados sin avisar (no hubo error, simplemente desaparecieron). Se detectó porque el portal cliente de Natalia empezó a dar 406 (0 filas donde se esperaba 1). **Regla nueva para cualquier sesión futura que use un coach sintético temporal para pruebas**: antes de borrar el usuario de prueba, reasignar el `coach_id` de CUALQUIER fila que lo referencie (no solo `clientes`) al coach real. Los 6 planes se regeneraron sin problema tras detectarlo.
**Implicación para producción, no solo para pruebas**: si alguna vez se borra una cuenta de coach real con clientes activos, esto mismo borraría en cascada todos los planes de todos sus clientes. Merece decidir si `planes_nutricion.coach_id`/`planes_entrenamiento.coach_id` deberían tener `ON DELETE SET NULL` o `ON DELETE RESTRICT` en vez de `CASCADE` — no se ha tocado esta sesión, es una decisión de producto/seguridad de datos que le corresponde a Carlos.

### Cierre de los 2 pendientes (a petición explícita de Carlos: "sí arréglalo todo")

**1. Duplicado de planes de entrenamiento — causa real encontrada y corregida.**
No era un bug de una sola llamada duplicando su propio insert: son **dos features distintas** que crean un `planes_entrenamiento` activo cada una sin desactivar el anterior — `generar-plan-inicial` (asigna una plantilla automáticamente) y `proponer-plan-ciencia` (genera uno nuevo con IA). Si un coach usa ambas para el mismo cliente (flujo normal: primero el inicial, luego refinarlo con IA), el cliente termina con 2+ planes "activos" a la vez. Mismo problema ya sospechado para `planes_nutricion` (nota de la sesión de ayer 25-09).
- Fix: los 3 puntos de inserción (`planes_nutricion` en `generar-plan-inicial`, `planes_entrenamiento` en `generar-plan-inicial` vía plantilla, `planes_entrenamiento` en `proponer-plan-ciencia`) ahora desactivan (`activo:false`) cualquier plan previo del mismo `cliente_id` antes de insertar el nuevo.
- Datos ya existentes de los 6 clientes ficticios corregidos a mano (cada uno tenía 2 planes de entreno activos; se desactivó el más antiguo — el asignado por plantilla — y se dejó activo el generado por IA, que es más específico).
- Archivos: `app/api/generar-plan-inicial/route.ts`, `app/api/entrenos/proponer-plan-ciencia/route.ts`.

**2. Cascada de borrado en `coach_id` — aplicada.**
Migración `supabase/migrations/20260926_fix_cascade_coach_id_planes.sql`: `planes_nutricion.coach_id` y `planes_entrenamiento.coach_id` pasan de `ON DELETE CASCADE` a `ON DELETE RESTRICT`. Confirmado en el esquema remoto tras aplicar. Ahora borrar una cuenta de coach con planes en BD da un error explícito de FK en vez de borrarlos en cascada en silencio — hay que reasignar o borrar sus planes primero. Aplicada con `supabase db query --linked` (Carlos confirmó explícitamente antes de ejecutar, ya que el entorno la bloqueó por defecto al ser una modificación de la base de datos de producción). Mismo pendiente de higiene que la migración del RPE: el historial de migraciones local sigue desincronizado del remoto (ver Pendiente #1 más abajo), así que `supabase db push` normal seguirá sin funcionar hasta que se resuelva en sesión dedicada.

### Verificación
`npx tsc --noEmit` 0 errores · `npm run build` producción completo sin errores · cada fix probado en vivo contra Supabase real (no solo tsc) · crawl completo con Playwright de 36 páginas del panel coach + 2 del portal cliente, todas en verde tras los fixes · los 6 planes de clientes ficticios de la parte 1 regenerados y verificados de nuevo (Natalia sigue 100% vegana).

### Pendiente — próxima sesión
1. `supabase db push` normal falla: el historial de migraciones locales no coincide con el remoto (migraciones antiguas sin timestamp válido + versiones remotas no trackeadas localmente). La migración de esta sesión (`rpe` en `sesion_ejercicios`) se aplicó directamente con `supabase db query --linked`, saltándose el sistema de versionado — funciona pero deja el historial de migraciones sucio. Recomendado: `supabase db pull` + `supabase migration repair` en una sesión dedicada, con cuidado.
2. Investigar por qué `proponer-plan-ciencia` inserta 2 planes de entrenamiento activos por llamada.
3. Decidir la política de `ON DELETE` para `coach_id` en `planes_nutricion`/`planes_entrenamiento` (ver incidente de arriba).
4. `app/api/recetas/migrar/route.ts` sigue roto (`recetas.ingredientes` no existe) pero es un endpoint de migración de esquema ya completada hace meses, sin ninguna página que lo use — candidato a borrar directamente en vez de arreglar.
5. Seguir con los pendientes de la parte 1 (revisar los 6 planes regenerados, decidir si commitear todo junto).

---

## ✅ SESIÓN 26-09-2026 (parte 1, Claude) — Auditoría con 6 clientes ficticios reales: 4 bugs de personalización encontrados y corregidos

### Contexto
Carlos pidió "seguir puliendo y probando con clientes ficticios para corroborar que el sistema es realmente bueno y potente, no un sistema genérico". Ya existían 6 clientes de prueba muy exigentes creados en sesión previa (`scripts/crear-clientes-diversos.ts`): Hyrox en 8 semanas, triatleta con hipotiroidismo (goitrógenos), powerlifter con dislipidemia, ciclista con SII/protocolo FODMAP, runner con prediabetes sin lactosa, maratoniana vegana con anemia ferropénica. Estaban creados en BD pero **nunca se les había generado un plan real** (0 planes, 0 checkins).

### Metodología — se probó el motor real de producción, no una réplica
Para no usar las credenciales reales de Carlos, se creó un coach sintético temporal (`coach-qa-sintetico@nutricoach-test.dev`, ya eliminado al cerrar la sesión), se le copiaron temporalmente las 35 plantillas de entrenamiento reales, se levantó `next dev` en local y se llamó a los endpoints de producción **tal cual los llama la UI** (`POST /api/generar-plan-inicial`, `POST /api/entrenos/proponer-plan-ciencia`) construyendo una cookie de sesión real de Supabase (`@supabase/ssr`, formato `sb-<ref>-auth-token` + chunking oficial). Esto validó el pipeline completo: TDEE → mesociclo → informe clínico → protocolos científicos → filtrado de recetas → DeepSeek → validación de recetas → micronutrientes → persistencia en BD. Al terminar, los 6 clientes se devolvieron al coach real y toda la infraestructura de test se borró.

### Lo que confirma que el sistema SÍ es sofisticado (no genérico)
- Plan de Carlos (Hyrox): periodización por bloques citando Wilson 2012, Schumann & Rønnestad 2019, Zourdos 2016, RPE progresivo, sesiones y notas de coaching específicas de Hyrox.
- Plan de Sofía (FODMAP): mesociclo con carga de carbohidratos progresiva atada a su fecha real de competición (La Purito Andorra).
- Cada plan cita ISSN/Helms/Morton para la proteína objetivo, aplica distribución proteica con umbral de leucina, e inyecta flags psicológicos (confianza baja, estrés, sueño) cuando aplica.

### 4 bugs reales de personalización encontrados y corregidos (commits pendientes de crear)
| # | Bug | Causa raíz | Fix | Archivo |
|---|-----|-----------|-----|---------|
| 1 | Clienta **vegana estricta recibió carne** (pato, pollo) en su plan | `filtrarRecetasPorSlot` solo *excluía* recetas con alérgeno presente (Lácteos/Huevos/Pescado); la carne no es un alérgeno EU así que ninguna receta con carne quedaba nunca excluida para un cliente vegano/vegetariano | Nuevo filtro duro **positivo**: para restricción vegano/vegetariano, la receta debe tener el tag `Vegano`/`Vegetariano` explícito en `intolerancias`, no basta con no tener alérgenos | `lib/plan-recetas.ts` |
| 2 | 30 recetas del recetario estaban **mal etiquetadas** como Vegano/Vegetariano pese a tener pato, pollo, miel, queso, salmón, gelatina, jamón (el bug #1 las habría dejado pasar igualmente) | Etiquetado histórico manual/import sin verificación cruzada contra ingredientes reales | Auditadas las 59 recetas "Vegano" y 191 "Vegetariano" aprobadas contra sus ingredientes reales; corregidas 13 + 17 (con solape) quitando el tag incorrecto | datos en Supabase (`recetas.intolerancias`) |
| 3 | Restricciones declaradas solo como **texto libre clínico** (ej. "sin cebolla, ajo crudo, lácteos alta lactosa" del protocolo FODMAP de Sofía) nunca llegaban al filtro duro de recetas — solo se inyectaban como texto en el prompt de la IA, que podía ignorarlas | `filtroCliente.alimentos_evitar_extra` en `generar-plan-inicial/route.ts` leía un campo de `onboarding` que ningún flujo real rellena; `perfil.alimentos_evitar_extra` y `onboarding.alimentos_no_gustan` (donde sí vive el dato real) nunca se pasaban | (a) Se combinan las 3 fuentes en un único array de términos a evitar, comprobado contra nombre de receta **e ingredientes reales** (antes solo el nombre). (b) Palabras clave clínicas ("lactosa", "gluten", "marisco") en el texto libre se traducen a la restricción estructurada equivalente para activar el filtro duro por alérgeno | `app/api/generar-plan-inicial/route.ts`, `lib/plan-recetas.ts` |
| 4 | Receta con ingrediente **"Bebida de coco o almendras"** auto-matcheada al alimento real "Bebida láctea de piña y coco" (un lácteo real) — bug de auto-match de ingredientes, no de restricciones | Mismo patrón ya documentado en sesiones previas (auto-match por substring sin verificar coherencia semántica) | Corregido el `alimento_id` de ese ingrediente a "Bebida de Coco Sin Azúcar ni Edulcorante" y recalculadas las macros de la receta | datos en Supabase (`receta_ingredientes`, `recetas`) |

### Pendiente — recomendado, no ejecutado esta sesión
1. **Auditoría sistemática de auto-match de ingredientes**: el bug #4 es una instancia nueva de un patrón ya conocido (ver sección "Sistema de calidad de recetas" en `NUTRICION/CLAUDE.md`). Recomiendo correr un script que cruce cada `receta_ingredientes.nombre_libre` contra el `alimento.nombre` real vinculado y marque discrepancias semánticas grandes (ej. "coco/almendra" → "láctea").
2. **Filtro duro sin red de seguridad**: el nuevo filtro de "alimentos a evitar" (bug #3) es dobladamente estricto (nombre + ingredientes) y no tiene un mínimo de candidatos de reserva — si un cliente declara una lista larga de alimentos a evitar, un slot podría quedarse sin candidatas. No ha ocurrido con los 6 perfiles de prueba, pero merece un test con una lista de evitar deliberadamente larga.
3. Los otros vocabularios de alérgeno (Sin Gluten/Sin Huevo/Sin Frutos Secos/Sin Soja/Sin Cerdo) no se auditaron sistemáticamente contra ingredientes reales como sí se hizo con Vegano/Vegetariano — mismo riesgo potencial, no confirmado.
4. `planes_nutricion` no desactiva el plan anterior al generar uno nuevo (`activo:true` se inserta sin poner `activo:false` en los previos) — iría bien revisarlo aparte, no se tocó por ser un problema de otra naturaleza (higiene de datos, no de personalización).

### Verificación
`npx tsc --noEmit` 0 errores · `npm run build` producción completo sin errores · 6 planes de nutrición y 6 de entrenamiento reales generados y persistidos en Supabase para los 6 clientes ficticios (revisables por Carlos en `/clientes` bajo el coach real) · cada fix confirmado regenerando el plan real tras el cambio y verificando que el ingrediente/receta problemático desaparece.

### Próxima sesión
1. Carlos revisa los 6 planes generados en `/clientes` (coach real) para dar el visto bueno de calidad "de verdad", no solo desde el punto de vista técnico.
2. Decidir si se ejecuta la auditoría sistemática de auto-match de ingredientes (pendiente #1).
3. Sigue pendiente T13/T14/T15 de `TAREAS.md` (Strava, cron Garmin, director completo en producción) — no tocado esta sesión.

---

## ✅ SESIÓN 25-09-2026 (tarde/noche, Claude) — Validación motor de recalculo + 5 bugs reales + integración wearables

### Contexto
Continuación de la sesión de hoy (ver bloque de abajo). Carlos pidió centrar la sesión en pulir el motor de recalculo automático de dietas (estado corporal + entreno + gasto calórico + planning) para que sea competitivo en el mercado. Protocolo de relevo Claude↔Codex activo (`ESTADO-COMPARTIDO.md`/`TAREAS.md` en la raíz de `NUTRICION/`): Codex tenía el lock sobre la reparación de `app/cliente/page.tsx`; Carlos confirmó que Codex ya no estaba activo, se verificó el archivo íntegro (no era necesario ningún fix) y se tomó la dirección.

### Diagnóstico inicial — por qué no había datos reales que validar
- El cron de sync de Garmin/Strava en Vercel llevaba parado desde el 06-06-2026 (sin error registrado — simplemente no se disparaba). Sync manual disparado con éxito: trajo body battery/training readiness/RHR frescos de hoy para el perfil de prueba de Carlos.
- Garmin **sí estaba vinculado** (contradice lo apuntado en la sesión de la mañana — se había re-vinculado durante el día). Strava seguía con datos solo hasta el 30-06-2026 porque usa webhook push (no polling) — no es un bug de sync, hace falta que Carlos vuelva a autorizar la app en Strava para que el webhook vuelva a recibir actividades nuevas.
- `registros_entreno` (log manual de TLS) = 0 en las últimas semanas para los 11 clientes reales.

### 5 bugs reales encontrados y corregidos en el motor (commits `b228221`, `f0326a8`)
| # | Archivo | Bug | Impacto |
|---|---------|-----|---------|
| 1 | `lib/agentes/revisor-semanal.ts` | El árbol de 19 nodos no comprobaba la frescura del check-in — calculaba "semanas en déficit" desde el último check-in (122 días de antigüedad en el cliente de prueba) y fabricaba una tendencia semanal inexistente, proponiendo ajustes de macros reales sobre datos fantasma cada lunes desde el 24-08-2026 | El motor llevaba 5 semanas "ajustando" la dieta de Carlos con datos de mayo |
| 2 | `lib/agentes/revisor-semanal-entreno.ts` | Repetía la alerta "0 sesiones, contactar urgentemente" cada lunes sin escalado mientras durara la inactividad — puro ruido en el inbox del coach | Alertas duplicadas semana tras semana sin que aportaran nada nuevo |
| 3 | `lib/agentes/aprendizaje-colectivo.ts` | El lector (`obtenerPatronesRelevantes`) y el escritor (`ejecutarAprendizajeColectivo`) usaban nombres de columna que nunca existieron en la tabla real `conocimiento_colectivo` (`patron`/`condicion_contexto`/`recomendacion_accion` vs. las reales `observacion`/`condicion`/`accion_sugerida`). El error se ignoraba en silencio | El sistema de "aprendizaje entre todos los clientes" llevaba desde su creación sin persistir ni servir un solo patrón, pese a tener 4 patrones válidos ya guardados esperando a usarse |
| 4 | `lib/agentes/riesgo-entreno.ts` | Solo miraba `registros_sets` (sets de gimnasio logueados a mano) para decidir "días sin entrenar" | Un cliente que corre/pedalea de verdad con el reloj puesto pero no loguea series de gimnasio salía marcado como inactivo |
| 5 | `lib/agentes/revisor-semanal-entreno.ts` | Mismo problema: "sesiones realizadas" de la semana solo contaba `registros_sets` | Actividad real de Garmin/Strava invisible para el revisor semanal de entreno |

### Mejoras de autoalimentación (lo que pidió Carlos: "que se retroalimente")
- `revisor-semanal-entreno.ts` y `training-brain.ts` ahora también consultan `conocimiento_colectivo` (antes solo lo hacía el revisor de nutrición) — el lado de entreno empieza a aprender de todos los clientes, no solo de la KB de papers.
- `riesgo-entreno.ts`/`revisor-semanal-entreno.ts` ahora cuentan actividad de `actividad_externa_cliente` (Garmin/Strava) además de `registros_sets` — el "entrenamiento realizado" que alimenta el recalculo ya no depende de que el cliente loguee manualmente en la app.
- Infraestructura de auto-aplicado conectada: `guardarTareaAgente` ahora dispara `aplicarTarea()` cuando un agente marca `requiere_aprobacion:false` (existía el campo pero nada lo ejecutaba). **Salvaguarda aplicada a propósito**: `revisor-semanal.ts` (la única tarea que puede reescribir macros reales de un cliente) fija `requiere_aprobacion:true` de forma incondicional — no se deja que el JSON crudo de DeepSeek decida si un cambio de dieta se salta la revisión del coach. Hoy esta infraestructura está lista pero inerte: ningún agente auto-aplica nada a clientes reales todavía.

### Verificación
`npx tsc --noEmit` 0 errores · `npm run build` producción completo (2 veces) · 4 tests nuevos en verde (`revisor-semanal-checkin-staleness`, `revisor-semanal-entreno-dedup`, `aprendizaje-colectivo-columnas`) · cada fix probado contra el cliente real en Supabase (perfil de prueba de Carlos) antes de dar por bueno.

### Pendiente — próxima sesión
1. Carlos: re-autorizar Strava en la app para que el webhook vuelva a recibir actividades (dato: última actividad Strava real es del 30-06-2026).
2. Carlos: registrar/confirmar que Garmin sigue sincronizando solo (ya se disparó manualmente hoy, revisar que el cron de Vercel lo haga solo sin intervención — no se pudo verificar el cron de Vercel en sí desde esta sesión, sin acceso CLI autenticado).
3. Con datos frescos de verdad (Strava reconectado + al menos 1 semana), volver a ejecutar `revisor-semanal.ts`/`revisor-semanal-entreno.ts` contra el cliente real y confirmar que el recalculo usa señales actuales, no solo que no rompe.
4. Decisión de producto pendiente (no tomada por Claude, deliberadamente): si/cuándo activar `requiere_aprobacion:false` en algún agente de bajo riesgo (ej. mensajes de apoyo, nunca cambios de macros) para autonomía real.
5. No se ejecutó el director completo (`ejecutarDirector`) contra los 11 clientes reales — sigue siendo una acción de efecto compartido que requiere confirmación explícita de Carlos antes de lanzarla.

---

## ✅ SESIÓN 25-09-2026 — Reactivación uso personal + motor nutrición/entreno + colisión con Astra

### Contexto
Retomada la reactivación del proyecto (guía `salidas/24-09-2026_guia-reactivacion-nutricoach.md`, estrategia: Carlos como primer cliente real de su propio sistema). Trabajo en paralelo con Astra (ChatGPT) sobre los mismos archivos — hubo una colisión real donde Astra sobrescribió 3 fixes ya aplicados (ver más abajo); reaplicados y verificados de nuevo.

### Bugs de producción corregidos (afectan a cualquier cliente, no solo a Carlos)
| # | Archivo | Bug | Impacto |
|---|---------|-----|---------|
| 1 | `app/cliente/page.tsx`, `components/PortalCliente/MiPlan.tsx` | Macros "Hoy" sumaban TODAS las comidas del plan, no solo las del día. `MiPlan` anclaba comidas sin `dia_semana` (recurrentes) al lunes fijo | Cliente veía macros/comidas incorrectas el resto de la semana |
| 2 | `app/api/cliente/[codigo]/plan-pdf/route.ts` | Mismo bug en el PDF: comidas recurrentes amontonadas en "Lunes", resumen "kcal/día" podía inflarse hasta 7x | PDF exportado al cliente roto para planes sin días asignados |
| 3 | `app/api/cliente/[codigo]/lista-compra/route.ts` | Filtro `?dia=X` excluía comidas recurrentes — plan sin días daba lista vacía en cualquier día | Lista de la compra por día rota |
| 4 | `app/api/entrenos/proponer-plan-ciencia/route.ts` | `profiles.edad/sexo/peso_actual` no existen (viven en `clientes`) → 500 en toda generación de plan. `knowledge_base.referencias` no existe (es `fuente`) → 0 papers KB siempre, sin error visible | Generación de plan de entreno con IA rota para TODOS los coaches |
| 5 | `app/api/generar-plan-inicial/route.ts` | `comidas.origen_adherencia` tiene CHECK constraint; DeepSeek puede devolver valores fuera del enum (ej. "nuevo") → insert falla y la comida desaparece en silencio | Plan de dieta con comidas faltantes sin aviso |
| 6 | `app/api/generar-plan-inicial/route.ts` | Cuando una comida trae varias recetas, cada una recibía el target completo (o partes iguales × porciones, que podía sumar >100%) en vez de reparto proporcional al peso de porciones | Comidas multi-receta con kcal muy por encima del objetivo |
| 7 | `lib/agentes/riesgo-entreno.ts`, `revisor-semanal-entreno.ts`, `training-brain.ts` | Consultaban `profiles.eq('id', clienteId)` con el id de `clientes`, no de `profiles` — nunca encontraban fila | Mensajes de estos 3 agentes siempre decían "el cliente" en vez del nombre real |

### Motor de personalización — mejora estructural (lo que pidió Carlos: "una vuelta de tuerca" real)
- `lib/plan-recetas.ts`: `filtrarRecetasPorSlot`/`distanciaEuclidiana` ahora pesan carbohidratos y grasas además de kcal+proteína al puntuar qué receta encaja mejor (antes solo miraba 2 de 4 macros).
- `lib/recetas/aplicar-receta-comida.ts`: escalado de raciones ahora es **multi-macro** — ingredientes con rol `proteina_principal`/`carbohidrato_base`/`grasa_saludable` escalan hacia SU propio objetivo de macro (no heredan el ratio de la receta original), con una corrección de seguridad que reancla el total a las kcal objetivo si el escalado independiente por rol se desvía >15%.
- `lib/ingredient-roles.ts`: quesos/nata/semillas con grasa Y proteína altas (ej. cheddar 33g grasa/25g proteína) se reclasifican correctamente como `grasa_saludable` en vez de `proteina_principal`.
- Verificado end-to-end regenerando el plan real de Carlos varias veces: desviación de macros pasó de **+40% a +115%** (según el macro) a **kcal -1.3%, carbohidrato +11.6%, grasa -11.1%, proteína -20.5%**.

### Carlos activado como cliente real de su propio sistema
- Perfil Atleta relleno (`perfil_entreno_cliente`): híbrido, 5 días/semana, recuperación alta, sin lesiones, psicología competición.
- Plan de entreno real generado con motor + KB (230+ papers): "Plan Híbrido de Rendimiento — Fuerza + Resistencia con Periodización Ondulante", 12 semanas, 5 papers citados (Wilson 2012, Schumann & Rønnestad 2019, Zourdos 2016, Ralston 2017).
- Plan de nutrición real generado y activo: 2886 kcal / 104P / 415C / 90G, 3 comidas (Desayuno 25% / Comida 40% / Cena 35%), pendiente de que Carlos lo revise en la app.
- 4 registros de prueba antiguos desactivados (2 nutrición "prueba"/"prueba 2", 2 entreno duplicados).

### Auditoría del motor de recálculo automático (Garmin → periodización)
- Crons verificados en `vercel.json`: sync-integraciones diario, agentes diario/semanal.
- `lib/agentes/director.ts` orquesta correctamente todos los agentes por cliente con manejo de errores aislado.
- **Pendiente de Carlos, no de código**: sin Garmin vinculado como cliente (`integraciones_cliente` vacío) ni sesiones de entreno registradas — el motor no tiene datos aún. Carlos entró a vincular Garmin durante la sesión; puede que los permisos se hayan revocado y haya que rehacerlo.
  - **Actualización misma noche**: Garmin quedó vinculado — sync manual confirmado con datos frescos. Ver bloque "SESIÓN 25-09-2026 (tarde/noche)" arriba para el diagnóstico completo (incluye que Strava sigue sin autorizar de nuevo).
- **No se ejecutó el director completo en producción** (afecta a los 11 clientes reales activos — acción de efecto compartido, requiere confirmación explícita antes de lanzarla).

### Incidente de colisión con Astra (documentado para que no se repita)
Mientras Astra trabajaba en paralelo sobre los mismos archivos, sobrescribió 3 fixes ya aplicados (`proponer-plan-ciencia`, `lista-compra`, `plan-pdf`) volviendo a introducir los bugs originales. Se detectaron por las notas de "archivo cambiado en disco" del entorno y se reaplicaron. Lección: si se trabaja en paralelo con otro agente sobre el mismo repo sin control de versiones intermedio, verificar el estado real de los archivos críticos antes de dar por buena una corrección anterior.

### Verificación de toda la sesión
`npx tsc --noEmit` 0 errores · ESLint sin errores nuevos (solo warnings preexistentes) · `npm run build` producción completo · 4 suites de test en verde (`test-comidas-dia` 46/46, `test-garmin-authorization` 15/15, `test-training-client-week`, `test-calcular-cantidad-aplicada` 6/6 nueva) · `scripts/audit-portal-patterns.mjs` sin problemas.

### Próxima sesión
1. Carlos revisa el plan de nutrición generado (recetas/cantidades concretas) y el de entreno.
2. ~~Revincular Garmin Connect como cliente~~ — hecho la misma noche, ver bloque de arriba. Strava sigue pendiente de reautorizar.
3. Registrar al menos una sesión de entreno real para que el motor de recálculo semanal tenga datos.
4. Decidir si ejecutar el director completo (`POST /api/agentes/ejecutar?modo=semanal`) contra los 11 clientes reales para verificar en producción.
5. Nutrición pendiente de afinar más si Carlos ve macros aún desviados tras su revisión — la corrección de kcal funciona bien (±1-2%), carbohidrato/grasa individual todavía depende de qué receta concreta elige la IA en cada generación.

Ver también la lista de pendientes del bloque "SESIÓN 25-09-2026 (tarde/noche)" arriba — es la continuación real de esta lista.

---

## ✅ SESIÓN 07-06-2026 (Sesión 56) — Fix PWA cliente arrancando en portal público antiguo

### Bug detectado por Carlos en iPhone

| Bug | Causa raíz | Fix |
|-----|-----------|-----|
| Al pulsar "limpiar" o reabrir la PWA, se abría directamente la app cliente rara básica | `public/manifest-cliente-carlos.json` tenía `start_url: "/cliente/2tp7rtMS"`. Esa URL es el portal público antiguo por código y monta `DashboardCliente`. Si iOS arrancaba ahí sin sesión/cookie válida, veía la app básica. | Manifest cliente arranca en `/cliente`; `limpiar-sw.html` manda a `/login?next=/cliente`; `/cliente/[codigo]` tiene guardia client-side para modo PWA standalone y no renderiza el dashboard público en apps instaladas antiguas; login/callback redirigen por rol. |

### Regla permanente

- La PWA cliente autenticada debe arrancar siempre en `/cliente`, nunca en `/cliente/[codigo]`.
- `/cliente/[codigo]` es compatibilidad pública para enlaces por código, no destino de PWA instalada.
- Si iOS conserva una PWA antigua con start_url viejo, `ClientePublicoPwaGuard` debe redirigir antes de mostrar `DashboardCliente`.
- Al limpiar caché, usar siempre `/login?next=%2Fcliente&limpiado=1`.

### Verificación

```bash
node scripts/audit-portal-patterns.mjs
npx eslint 'app/cliente/[codigo]/page.tsx' 'app/cliente/[codigo]/ClientePublicoPwaGuard.tsx' app/login/page.tsx app/auth/callback/page.tsx
npx tsc --noEmit --pretty false
npm run build
```

## ✅ SESIÓN 07-06-2026 (Sesión 55) — Fix raíz: portal cliente antiguo en historial Training

### Segundo bug detectado tras revisar en producción

| Bug | Causa raíz | Fix |
|-----|-----------|-----|
| Al entrar como coach a la app cliente, pulsar "Empezar" mostraba "Sesión no encontrada" y al volver caía en perfil/dashboard coach | `DashboardCliente` abría `/cliente/sesion/[id]` sin `codigo`. La API `/api/cliente/sesion/[id]` solo resolvía cliente por usuario autenticado (`clientes.profile_id`). Carlos estaba logueado como coach, así que no había cliente asociado y devolvía 404. | Flujo público por código completo: link `?codigo=...`, API de sesión verifica por `planes_nutricion.codigo_publico`, vuelta a `/cliente/[codigo]`, y `registrar-sesion` acepta `codigo` para guardar sesión del cliente correcto. |
| Cliente real en PWA iPhone seguía viendo "Sesión no encontrada" tras deploy | `public/sw.js` cacheaba todas las API routes con fallback, incluidas respuestas 401/403/404 de `/api/cliente/sesion/[id]`. Una PWA instalada podía devolver un error antiguo aunque la red/backend ya estuviera corregido. | `sw.js` subido a `nutricoach-v7`; `/api/*` network-only; endpoints cacheables solo guardan `res.ok`; auditoría bloquea cache fallback de APIs. |

### Bug recurrente corregido

| Bug | Causa raíz | Fix | Commit |
|-----|-----------|-----|--------|
| Al empezar entrenamiento y volver atrás aparecía una "app cliente" rara con dashboard distinto | Coexistían dos portales cliente: `/cliente` autenticado actual y `/cliente/[codigo]` público antiguo con `DashboardCliente`. Enlaces viejos, PDF, recetas o historial podían dejar `/cliente/{codigo}` detrás de `/cliente/sesion/[id]`. | `app/cliente/[codigo]/page.tsx` ahora es Server Component: si hay sesión y `profiles.role === 'cliente'`, hace `redirect('/cliente')` antes de renderizar `DashboardCliente`. | este commit |

### Auditoría de patrones similares

- Único montaje directo de `DashboardCliente`: `app/cliente/[codigo]/page.tsx`.
- Enlaces antiguos detectados dentro del flujo público por código: `DashboardCliente`, `PlanSemanal`, `MiPlan`, PDFs e integraciones. Se mantienen para compatibilidad pública.
- Para cliente logueado, cualquier entrada a `/cliente/[codigo]` debe caer en `/cliente` por redirección server-side.
- No volver a arreglar este bug tocando `router.back()`, `replace` o botones de vuelta uno por uno: eso solo tapa síntomas.

### Verificación

```bash
node scripts/audit-portal-patterns.mjs
npx eslint 'app/cliente/[codigo]/page.tsx'
npx tsc --noEmit --pretty false
npm run build
```

## ✅ SESIÓN 06-06-2026 (Sesión 54) — Prevención: script auditoría + invariantes AGENTS.md

### Qué se hizo

| Acción | Detalle | Commit |
|--------|---------|--------|
| Script `scripts/audit-portal-patterns.mjs` | Detecta 4 patrones peligrosos: `href` en portales, Supabase directo en componentes, links sin `replace` en páginas secundarias | `de26b33` |
| Bloque `portal-navigation-invariants` en `AGENTS.md` | 4 reglas irromibles con ejemplos ✅/❌ + comando de verificación | `de26b33` |

### Cómo usar el script

```bash
# Ejecutar antes de cualquier cambio en el portal cliente
node scripts/audit-portal-patterns.mjs

# Si falla → no deployar. Si pasa → ✅
```

### Las 4 reglas permanentes (también en AGENTS.md)

| Regla | Patrón prohibido | Patrón correcto |
|-------|-----------------|----------------|
| 1 | `window.location.href` en portales | `window.location.replace()` |
| 2 | `<Link href="/cliente">` sin replace en páginas secundarias | `<Link href="/cliente" replace>` |
| 3 | `<Link href="/cliente/sesion/..." replace>` en SemanaEntrenoCard | Sin `replace` (push) |
| 4 | `supabase.from()` con joins cruzados en PortalCliente components | `fetch('/api/...')` con service role |

---

## ✅ SESIÓN 06-06-2026 (Sesión 53) — Fix bucle historial coach + auditoría navegación completa

### Bugs corregidos

| # | Bug | Causa raíz | Fix | Commit |
|---|-----|-----------|-----|--------|
| 1 | "App rara" = coach dashboard al volver de sesión | `window.location.href='/dashboard'` en `/cliente/page.tsx` añadía entrada al historial → iOS swipe-back creaba bucle `/cliente→/dashboard→/cliente→...` | Cambiado a `window.location.replace()` en los 3 redirects del portal | `4bf4182` |
| 2 | `limpiar-sw.html` redirigía a landing tras limpiar | Redirigía a `/?_=timestamp` → sin tokens → LandingPage pública | Redirige a `/login` con mensaje "te pedirá iniciar sesión" | `e651579` |

### Causa raíz del bucle coach

```
Antes:
  Session ← (replace) → /cliente → window.location.href='/dashboard' (PUSH) → /dashboard
  iOS swipe-back → /cliente → push a /dashboard → bucle infinito
  El /dashboard (panel coach con datos de clientes) = "app rara"

Ahora:
  Session ← (replace) → /cliente → window.location.replace('/dashboard') (REPLACE) → /dashboard
  iOS swipe-back → lo que había antes de /cliente → limpio
```

### Regla añadida
Todos los redirects de autenticación/rol dentro de páginas cliente deben usar `window.location.replace()`, nunca `window.location.href`. El `href` añade al historial y crea bucles con el swipe-back de iOS.

---

## ✅ SESIÓN 06-06-2026 (Sesión 52) — Fix estructural training portal cliente

### Qué se hizo

| Bug | Causa raíz | Fix | Commit |
|-----|-----------|-----|--------|
| `SemanaEntrenoCard` mostraba vacío (sin entrenamiento) | Query directa a `sesiones_entrenamiento + sesion_ejercicios` desde cliente Supabase — RLS silencia joins cruzados | Nueva API `GET /api/entrenos/sesiones-plan` con service role | `3ef923e` |
| `/cliente/semana` mostraba vacío | Mismas queries directas + `planes_entrenamiento + sesiones_entrenamiento + registros_sets` sin service role | Nueva API `GET /api/entrenos/semana-completa` con service role | `3ef923e` |
| Back button ← de sesión acumulaba historial | `Link href="/cliente"` sin `replace` → cada uso duplicaba /cliente en historial → iOS swipe-back volvía a sesión vacía | Añadido `replace` en ← de header de sesión | `3ef923e` |
| Back button ← de semana acumulaba historial | Mismo patrón | Añadido `replace` en ← de semana page | `3ef923e` |

### APIs nuevas (ambas con service role)

```
GET /api/entrenos/sesiones-plan?plan_id=X
  → sesiones con ejercicios_count + completadas_hoy
  → usado por SemanaEntrenoCard (reemplaza query directa Supabase)

GET /api/entrenos/semana-completa
  → lee plan activo del usuario autenticado
  → sesiones con ejercicios_count + registros_count semanal + completada + esHoy
  → usado por /cliente/semana (reemplaza 4 queries directas Supabase)
```

### Regla definitiva — navegación portal cliente (actualizada)

```
TODOS los back buttons que navegan a /cliente deben usar replace:
  ✅ /cliente/sesion/[id] ← button → /cliente: replace
  ✅ /cliente/sesion/[id] pantalla completada → /cliente: replace
  ✅ /cliente/sesion/[id] estado error → /cliente: replace
  ✅ /cliente/semana ← button → /cliente: replace

  ❌ NUNCA usar Link href="/cliente" sin replace en estas páginas
```

### Por qué se repite este bug

El mismo patrón persiste porque:
1. Los back buttons sin `replace` acumulan historial → iOS swipe-back vuelve a páginas inesperadas
2. Las queries directas a Supabase con joins cruzados (`sesiones_entrenamiento → sesion_ejercicios`) fallan silenciosamente por RLS → array vacío → UI muestra "sin datos"

**Regla de proyecto:** cualquier nueva página del portal que tenga ← back button a `/cliente` → siempre `replace`. Cualquier query que cruce ≥2 tablas con RLS → siempre API route con `createServiceSupabase()`.

---

## ✅ SESIÓN 06-06-2026 (Sesión 51) — Fix navegación iOS swipe-back portal cliente

### Qué se hizo

| Bug | Fix | Commits |
|-----|-----|---------|
| `SemanaEntrenoCard` usaba `replace` para links de sesión — swipe-back desde sesión saltaba `/cliente` y volvía a página anterior | Eliminado `replace` del componente (`SemanaEntrenoCard` vive en `/cliente`, no en `/cliente/semana`) | `6f888d1` |
| "Volver al portal" en pantalla de sesión completada no usaba `replace` — swipe-back desde `/cliente` volvía a la sesión vacía | Añadido `replace` en link y en estado de error | `a93d3fa` |

### Regla definitiva — navegación en portal cliente

```
REGLA: usar replace solo cuando la página actual NO debe aparecer en el historial de vuelta

✅ /cliente/semana  → /cliente/sesion/[id] : replace (saltar semana al volver atrás)
✅ /cliente/sesion  → /cliente (pantalla completada/error): replace (no volver a sesión vacía)
✅ /cliente/sesion  → /cliente (back button ←): Link sin replace (ya se gestiona por historial)

❌ SemanaEntrenoCard (/cliente) → /cliente/sesion/[id]: NO usar replace
   → /cliente debe quedar en historial para que swipe-back funcione
```

### Causa raíz (patrón de este bug)
El `replace` se introdujo en sesión 49 para evitar que swipe-back fuera a `/cliente/semana`. Pero se aplicó a todos los links de sesión incluyendo los de `SemanaEntrenoCard`, que está embedido en `/cliente` (no en `/cliente/semana`). Esto reemplazaba `/cliente` en el historial y el swipe-back saltaba a la página anterior al portal.

---

## ✅ SESIÓN 06-06-2026 (Sesión 49+50) — Bugs portal cliente + Métricas cardio entreno

### Qué se hizo

| Tarea | Commits | Detalle |
|-------|---------|---------|
| Fix bug "empezar entrenamiento" | `634575b`, `97aeb3b` | Auth check fallaba con RLS en cadena. Nuevo `GET /api/cliente/sesion/[id]` con service role bypasea todo. Back button ← cambiado de `/cliente/semana` → `/cliente`. |
| Fix "portal roto" al volver | `dfe25c6` | Links a sesión usan `replace` en vez de `push` — swipe back iOS ya no va a `/cliente/semana`. |
| Métricas cardio en registro sesión | `3875b21`–`956a285` | SkiErg/remo/bici muestran **metros + cal + tiempo + RPE** en lugar de kg/reps. Detección automática por nombre del ejercicio (sin config manual). |
| Selector tipo ejercicio en coach | `7ac8707` | Panel `/entrenos/ejercicios` permite cambiar tipo entre fuerza/cardio/funcional/flexibilidad. |

### Causa raíz bug sesión (IMPORTANTE — patrón recurrente)
Mismo patrón de sesión 38 y 49: **PostgREST falla silenciosamente con joins anidados y RLS en cadena** (`sesiones_entrenamiento → planes_entrenamiento → clientes`). El cliente Supabase devolvía `null` aunque los datos existían.

**Regla definitiva:** cualquier query que cruce ≥2 tablas con RLS activo → API route con `createServiceSupabase()`. Nunca joins anidados profundos desde el cliente.

### Arquitectura métricas cardio

```
getModo(tipo, nombre) → 'fuerza' | 'cardio'
  1. tipo === 'cardio' en BD → cardio
  2. nombre contiene keyword (ski, remo, bici, rowing...) → cardio automático
  3. resto → fuerza

Fuerza: SetRegistroSheet muestra kg + reps + RPE
Cardio: SetRegistroSheet muestra metros (±10) + cal (±1) + tiempo MM:SS (±5s) + RPE

SetData unificado: { kg?, reps?, metros?, calorias?, tiempo_s?, rpe, hecho }
sets_ejecutados JSONB acepta ambas estructuras sin cambio en BD
PRs solo calculan para fuerza (peso_kg > 0)
```

### Keywords cardio detectadas automáticamente
`ski`, `skierg`, `remo`, `rowing`, `bici`, `ciclismo`, `assault`, `air bike`, `echo bike`, `airdyne`, `running`, `correr`, `carrera`, `cinta`, `treadmill`, `nataci`, `swim`, `kayak`, `ergómetro`

---

## ✅ SESIÓN 06-06-2026 (Sesión 50) — Training visual diferenciado + dark mode fixes portal cliente

### Qué se hizo

| Tarea | Commits | Detalle |
|-------|---------|---------|
| Eliminar divider separador en tab "plan" | `ac07ce0` | Borrado el `{/* Separador */}` entre dieta y entrenamiento — ya no es necesario |
| Header B1 en `SemanaEntrenoCard` | `0b0d75f` | Gradiente indigo sutil + pill "Hoy: [día]" + icono indigo. Título "Entrenamiento" en bold. Subtítulo con plan y días/semana |
| Dark mode fixes `SemanaEntrenoCard` | `0b0d75f` | Leyenda con 4 colores explícitos, metadata `#9898A0`, badge "Ver entreno" indigo sólido, "Completada" verde `#4ADE80` |
| Dark mode fixes `/cliente/semana` | `01324ce` | Labels stats, metadata sesiones y "sets registrados" con colores de contraste correcto |
| Spec + plan documentados | `9394055` `a8f182b` | `docs/superpowers/specs/2026-06-06-training-visual-darkmode-design.md` + `docs/superpowers/plans/2026-06-06-training-visual-darkmode.md` |

### Tokens de color dark mode establecidos para training

| Elemento | Color |
|---|---|
| Texto secundario (metadata, subtítulos) | `#9898A0` |
| Día actual / botones indigo / leyenda "Hoy" | `#818CF8` |
| Sesión con entreno (dots, badges) | `#8A9AB8` |
| Sesión completada / "sets registrados" | `#4ADE80` |
| Día de descanso en leyenda | `#45454F` |
| Texto muted mínimo legible | `#6F6F78` |

### Arquitectura visual del bloque training (tab "plan")

```
┌─────────────────────────────────────────────┐
│ [🏋️] Entrenamiento          [Hoy: Viernes]  │ ← gradiente indigo, pill solo si hay sesión hoy
│      Híbrido Elite · 4 días / semana        │
├─────────────────────────────────────────────┤
│  L   M   ✓   J  [V]  S   D                 │ ← dots con colores por estado
│  ● Hoy  ● Entreno  ✓ Hecho  ● Descanso     │
│                                             │
│  [▶] Fuerza + Carrera         [Empezar]    │ ← CTA día actual
│      8 ej · ~55 min                        │
│  L  Upper + HYROX           6 ej · 50m  ›  │
│  X  Lower + Running         ✓ Completada   │
│  S  Cardio Zona 2           60m          ›  │
│  Ver semana completa                     ›  │
└─────────────────────────────────────────────┘
```

---

## ✅ SESIÓN 06-06-2026 (Sesión 49) — Fix bug crítico portal cliente: empezar entrenamiento

### Bugs corregidos

| # | Archivo | Bug | Fix | Commit |
|---|---------|-----|-----|--------|
| 1 | `app/cliente/sesion/[id]/page.tsx` | Auth check fallaba cuando join `planes_entrenamiento` devolvía null por RLS → "Sesión no encontrada" | Cambiar a API route con service role | `634575b` |
| 2 | `app/cliente/sesion/[id]/page.tsx` | Back button ← iba a `/cliente/semana` (página sin bottom nav → parecía "app rota") | Cambiado a `/cliente` | `634575b` |
| 3 | `app/cliente/sesion/[id]/page.tsx` | Query directo supabase (cliente) fallaba silenciosamente: RLS en cadena `sesiones_entrenamiento → planes_entrenamiento → clientes` → sesión nunca cargaba | Nuevo endpoint `GET /api/cliente/sesion/[id]` con `createServiceSupabase()` | `97aeb3b` |
| 4 | `app/api/cliente/sesion/[id]/route.ts` | (nuevo) | Verifica pertenencia explícita por `cliente_id`, devuelve sesión completa con ejercicios | `97aeb3b` |

### Causa raíz
El mismo patrón de sesión 38: **PostgREST falla silenciosamente con joins anidados cuando las RLS tienen subqueries en cadena** (`sesiones_entrenamiento` → `planes_entrenamiento` → `clientes`). El query del cliente devolvía `null` aunque los datos existían. Solución definitiva: **nunca usar joins anidados profundos desde el cliente; usar siempre API route con service role para queries que crucen más de 2 tablas con RLS**.

### Regla añadida (crítica)
> Cualquier query que cruce ≥2 tablas con RLS activo debe ir por API route con `createServiceSupabase()`. El cliente supabase solo es válido para lecturas simples de una tabla (sin joins).

---

## ✅ SESIÓN 05-06-2026 (Sesión 48) — Limpieza sidebar + tab Formularios en Clientes

### Qué se hizo

| Tarea | Commit | Detalle |
|-------|--------|---------|
| Limpieza sidebar | `c27de53` | Eliminados Probador IA, Scraping, Enriquecer, Consultas. Cuestionarios suelto al final. KBPanel y CostesClientes eliminados del dashboard. |
| Badge noLeidas → Clientes | `c27de53` | El badge de formularios sin leer (+ clientes pendientes) se mueve al item Clientes en lugar de Consultas. |
| Tab Formularios en /clientes | `c27de53` | Dos tabs: "Clientes" (lista CRM) y "Formularios" (respuestas_clientes). Mark-as-read al abrir. Skeleton correcto. |
| Fix bugs tab Formularios | `c27de53` | try/finally en loadRespuestas (evita spinner infinito). Flag `formulariosCargados` para evitar flash de empty state antes del primer fetch. |

### Estado del sidebar tras esta sesión
- ✅ Sidebar: 4 items primarios (Radar, Clientes, Inbox IA, Entrenamiento)
- ✅ Módulos: Nutrición, Recetario, Conocimiento (sin sección Sistema)
- ✅ Cuestionarios: item suelto al final, separado por divisor
- ✅ Dashboard: Stats → Acciones → AutoCoach → Check-ins → Analytics (sin KB ni Costes)
- ✅ /clientes con tab Formularios integrado (respuestas de cuestionarios = leads)
- ✅ /respuestas sigue existiendo como URL directa (no está en sidebar)

### Bugs corregidos
| # | Archivo | Bug | Fix |
|---|---------|-----|-----|
| 1 | `app/clientes/page.tsx` | `loadRespuestas` sin try/finally → spinner infinito si Supabase falla | try/catch/finally añadido |
| 2 | `app/clientes/page.tsx` | Flash de empty state al abrir tab Formularios (useEffect asíncrono) | Flag `formulariosCargados` + condición `!formulariosCargados \|\| respuestasLoading` |

---

## ✅ SESIÓN 04-06-2026 (Sesión 47) — Training Polish: Phosphor + EjercicioDemoModal + Timer feedback

### Qué se hizo

| Tarea | Commits | Detalle |
|-------|---------|---------|
| Migración iconos Lucide → Phosphor | `3ccec66`–`e8552a8` | 6 archivos: HistorialEntreno, SemanaEntrenoCard, SetRegistroSheet, EjercicioDemoModal, SesionCardMobile, `/cliente/sesion/[id]`, ejercicios/page |
| EjercicioDemoModal reescrito | `cde9273` | 4 niveles de fallback: YouTube embed → Instagram/TikTok/Vimeo (botón + thumbnail) → foto → placeholder Barbell. Prop `instruccion_ejercicio` nueva con sección colapsable |
| Timer feedback físico | `bab90ea` | Web Audio API beep 440Hz + `navigator.vibrate([200,100,200])` al llegar el timer de descanso a 0. Guard SSR incluido |
| `instruccion_ejercicio` en callers | `bab90ea` `0cc4dbe` | SesionCardMobile y `/cliente/sesion/[id]` pasan el campo al modal. Estado `demoEjercicio` extendido |
| Animación PRs en pantalla éxito | `0cc4dbe` | `fadeIn` staggered por item, fondo `--semantic-active-bg` cuando hay PRs |
| Spec + plan documentados | `a535f40` `46dd297` | `docs/superpowers/specs/2026-06-04-training-polish-design.md` + `docs/superpowers/plans/2026-06-04-training-polish.md` |

### Estado del módulo de entrenamiento tras esta sesión
- ✅ Consistencia visual completa: todos los componentes training usan `@phosphor-icons/react`
- ✅ EjercicioDemoModal soporta todas las plataformas sin salir de la app
- ✅ Timer de descanso con feedback físico (beep + vibración)
- ✅ Instrucciones del ejercicio visibles en el modal (colapsadas por defecto)
- ✅ Pantalla de PRs con animación celebratoria

### Audit de bugs (sesión 47) — commit `4bc4053`

| # | Gravedad | Archivo | Bug | Estado |
|---|----------|---------|-----|--------|
| 1 | 🔴 Crítico | `entrenos/generar-ia/page.tsx` | `.json()` llamado antes de `res.ok` — si la API devuelve HTML en 500, lanza excepción | ✅ Corregido |
| 2 | 🟠 Alto | `cliente/sesion/[id]/page.tsx` | `registrarSesion()` no mostraba error si `data.ok === false` o si `.json()` fallaba | ✅ Corregido — nuevo estado `errorGuardado` + banner "Reintentar" |
| 3 | 🔴 Falso positivo | `entrenos/[id]/page.tsx:127` | Optional chaining `cli?.profile?.nombre` ya protege correctamente | ⚪ No aplica |
| 4 | 🟡 Medio | `entrenos/plantillas/page.tsx` | IIFE en useEffect — patrón menor, funciona | ⚪ Documentado, no crítico |
| 5 | 🟡 Medio | `entrenos/[id]/page.tsx` | `selectedSesionId` puede quedar huérfano tras refetch en edge case | ⚪ Documentado, edge case poco probable |
| 6 | 🟠 Alto | `entrenos/plantillas/page.tsx:641` | Modal de asignación con `plantillaActual` undefined muestra nombre vacío pero no crashea (optional chaining) | ⚪ UX menor, no crash |
| 7 | 🟡 Medio | `cliente/sesion/[id]/page.tsx` | Error en historial de pesos ignorado silenciosamente | ⚪ No impacta flujo crítico |
| 8 | 🟡 Medio | `entrenos/[id]/page.tsx:160` | `map.get(eid)!` non-null assertion — podría fallar si estado stale | ✅ Corregido — `filter(eid => map.has(eid))` antes del `.map` |

---

## ✅ SESIÓN 29-05-2026 (Sesión 46) — Rediseño /clientes + Agente Retención

### Qué se hizo

| Tarea | Commits | Detalle |
|-------|---------|---------|
| SQL migration membresía | `a47479a` | +3 cols en `clientes`: `tipo_membresia`, `fecha_inicio_membresia`, `fecha_fin_membresia` — **aplicada en Supabase** |
| `lib/clientes-utils.ts` | `6df484c` | Tipos + score adherencia, predictor baja, deuda atención, filtros, sort |
| `ClientesToolbar.tsx` | `40e9666` | Búsqueda 185px + chips estado + filtros membresía/fecha/chats + sort |
| `ClientesTabla.tsx` | `c266ef5` | Tabla densa desktop — membresía+barra progreso, check-in, adherencia, estado, planes dots |
| `ClientesListaMobile.tsx` | `4a62627` | Lista iPhone compacta 3 filas por cliente |
| Reescritura `/clientes` | `c24c2c6` | 8 queries paralelas, enriquecimiento ClienteRow, filtros/sort useMemo, back button mobile |
| Editor membresía ficha cliente | `039b848` | Tab Perfil → tipo + fechas inicio/fin → guardar en Supabase |
| `agente-retencion.ts` | `d5c8f2d` | Nuevo agente — caduca_pronto / baja_adherencia / nuevo_sin_enganche → propuesta coach |
| Wiring orquestador + director | `ddcbf3d` | `'retencion'` en `PasoDirector`, `ejecutar.retencion: true`, import + call en director |
| Fix bugs post-auditoría | HEAD | `caduca_pronto` excluye ya-expiradas (d<0); try/catch en llamarDeepSeek |

### Pendiente manual
- ⚠️ Terra: registrarse en tryterra.co + `TERRA_API_KEY` + `TERRA_DEV_ID` en Vercel + webhook (ver sesión 45)
- ⚠️ COROS OAuth: open.coros.com developer portal (opcional, Terra ya cubre COROS)

---

## ✅ SESIÓN 30-05-2026 (Sesión 45) — Integraciones nativas TrainingPeaks, Whoop, COROS + iconos oficiales

### Qué se hizo

| Tarea | Commit | Detalle |
|-------|--------|---------|
| Iconos oficiales Garmin + Strava + COROS | `cdd90b6` | PNGs descargados de App Store vía iTunes Lookup API. Reemplazan los SVGs artesanales. |
| Fix sueño en API integraciones | `cdd90b6` | `sueno_h` y `sueno_calidad` añadidos al SELECT de Supabase + `datos_hoy` del response |
| GarminMiniCard — iconos PNG + stat sueño | `cdd90b6` | Iconos Garmin/Strava/COROS como `<img>`. Stat "Sueño" con icono Moon añadido |
| Garmin sync restaurada | manual | Credenciales re-vinculadas (fila `activa=true` pero `credenciales_json=NULL` después de fix sesión 43) |
| Fix sleep data en UI | `cdd90b6` | Datos `sueno_h` ya existían en BD (5.5–6.8h); solo faltaba seleccionarlos en la query |
| Terra API integrada | `cdd90b6` | `lib/integraciones/terra.ts` completo: widget session, disconnect, webhook HMAC, normalizadores activity/daily/sleep |
| COROS OAuth nativo | `cdd90b6` | `lib/integraciones/coros.ts`: 30 tipos actividad, OAuth2, sync 14d, token refresh |
| Webhook Terra | `cdd90b6` | `app/api/webhooks/terra/route.ts`: recibe activity/daily/sleep, mapea terra_user_id→cliente_id, persiste |
| Migration `terra_usuarios` | `cdd90b6` | `supabase/migrations/20260530_terra_usuarios.sql` — tabla para mapear terra_user_id→cliente_id+provider |
| Tarjetas nativas TrainingPeaks/Whoop/COROS | `06cba51` | IntegracionesPanel: 3 cards individuales con logo oficial, estado conectado/desconectado, botón propio |
| Terra oculto como intermediario | `06cba51` | Cada card hace `?provider=TRAININGPEAKS/WHOOP/COROS` al widget de Terra, que abre el proveedor directamente |
| Icono Whoop añadido | `06cba51` | `/public/icons/whoop.jpg` App Store oficial |

### Arquitectura integraciones después de esta sesión

```
Pestaña Apps portal cliente:
  ├── Garmin Connect (credenciales cifradas, unofficial API)
  ├── Strava (OAuth2 oficial)
  ├── Google Fit (OAuth2 oficial)
  ├── TrainingPeaks ──┐
  ├── Whoop          ─┤→ Terra API (oculto) → webhook → actividad_externa_cliente
  └── COROS          ─┘
```

### ⚠️ PENDIENTE MANUAL — Para activar Terra en producción

| # | Tarea | Cómo |
|---|-------|------|
| 🔴 | **Registrarse en tryterra.co** como developer | tryterra.co → Sign up |
| 🔴 | **Añadir TERRA_API_KEY + TERRA_DEV_ID** a Vercel Production | Dashboard → Settings → Environment Variables |
| 🔴 | **Registrar webhook Terra** | Dashboard Terra → Webhooks → URL: `https://nutricoach-delta.vercel.app/api/webhooks/terra` |
| 🔴 | **Aplicar SQL migration** `supabase/migrations/20260530_terra_usuarios.sql` | Supabase → SQL Editor |
| 🟠 | **COROS OAuth nativo** (opcional, Terra cubre COROS) | open.coros.com developer portal → `COROS_CLIENT_ID` + `COROS_CLIENT_SECRET` en Vercel |

### Commits sesión 45
- `cdd90b6` — feat: iconos oficiales + sueño Garmin + Terra API completa + COROS OAuth
- `06cba51` — feat: tarjetas nativas TrainingPeaks, Whoop y COROS + provider param Terra widget

---

## ✅ SESIÓN 29-05-2026 (Sesión 44) — Pendientes Codex cerrados + bugs

### Qué se hizo

| Tarea | Commit | Detalle |
|-------|--------|---------|
| Banner bienvenida portal eliminado | `436bd47` | `mostrarBienvenida` state + useEffect + JSX eliminados de `DashboardCliente.tsx` |
| Sprint 4 activado | `2fac169` | Migration `20260529_ejercicios_media.sql` — `foto_url`, `video_url`, `video_tipo` en tabla `ejercicios`. Código coach + cliente ya existía (Codex). Aplicar SQL en Supabase manualmente. |
| D7 Fase 2 — ajuste nutricional por tipo de sesión | `0822bf6` | Card en tab Dieta del portal: muestra tipo de sesión + % ajuste CHO/kcal + consejo. Solo en día actual. Usa `lib/periodizacion/dia-entreno-nutricion.ts` (helper existente). |
| Rate limiting endpoints IA | `91476bb` | `lib/rate-limit.ts` — 5 req/min por usuario en `generar-plan-inicial`, `generar-dieta-ia`, `proponer-plan-ciencia`. In-memory, sin dependencias externas. |
| Fix memory leak rate limiter | `HEAD` | Limpieza de entradas expiradas cuando el Map supera 100 entradas. |
| Instrucciones concatenadas + especias + ajo BD | SQL manual | `20260529_fix_instrucciones_y_especias.sql` aplicado en Supabase. Pasos sin salto de línea → normalizados. Especias ≥50g → 2-5g. Ajo dientes >40g → 8-12g. |

### Estado de pendientes Codex

| Bloque | Estado |
|--------|--------|
| Banner bienvenida | ✅ Eliminado |
| Sprint 4 ejercicios (foto/vídeo) | ✅ Completo — migration aplicada |
| D7 Fase 2 ajuste nutricional | ✅ Completo |
| Rate limiting IA | ✅ Completo |
| Instrucciones concatenadas BD | ✅ SQL aplicado |
| Adherencia Fase C | ✅ Ya estaba completo (Codex lo había implementado) |

**No quedan pendientes de Codex.**

### Próximas sesiones (no urgente)

- D7 Fase 3 (opcional): mostrar ajuste de macros calculado en kcal absolutas (no solo %) para facilitar comprensión al cliente
- Training Sprint 4: añadir vídeos/fotos a los ejercicios vía UI del coach (`/entrenos/ejercicios`)
- Rate limiting más granular (Upstash) si el volumen de clientes escala

---

## ✅ SESIÓN 28-05-2026 (Sesión 43) — Revisión código Codex + lote recetas recomposición

### Qué se hizo

**Revisión y corrección de 3 bugs críticos introducidos por Codex en las últimas sesiones:**

| Bug | Severidad | Fix | Commit |
|-----|-----------|-----|--------|
| `sync-integraciones`: fallback a credenciales Garmin del coach sincronizaba datos del **coach** bajo el ID del **cliente** (mezcla de datos privados) | 🔴 CRÍTICO | Fallback eliminado. Solo sincroniza si el cliente tiene sus propias credenciales. | `075ee23` |
| `generar-plan-inicial`: `guardarDietaHabitualCliente()` sin `await` — datos del onboarding podían perderse si Vercel cortaba la función | 🟠 ALTO | Añadido `await` | `075ee23` |
| `lib/deepseek.ts`: 5 llamadas a la API sin timeout — peticiones podían quedar colgadas hasta 300s | 🟠 ALTO | `AbortSignal.timeout(60_000)` en los 5 fetch calls | `075ee23` |

**Lote de recetas importado:**
- 10 recetas "recomposición Chef Healthy" → BD Supabase (`aae4fc6`)
- Quality gate: 10/10 OK, 0 críticos, 0 avisos
- Categorías: Desayuno (2), Comida (4), Cena (2), Postre (1), Merienda (1)

**Lo que Codex dejó bien (no tocar):**
- Aislamiento datos cliente-cliente correcto
- Quality gate recetas robusto
- Normalizador de alimentos sólido
- Feature dieta habitual bien diseñada

**Pendientes menores no urgentes (para Codex o próxima sesión):**
- Test scripts con email del coach hardcodeado (`ccc8890@gmail.com`) → mover a env var `NUTRICOACH_TEST_COACH_EMAIL`
- Validación alérgenos en `validar-lote-deepseek.ts` solo por regex — no cubre todos los casos de BD

---

## ✅ SESIÓN 27-05-2026 (Sesión 42) — Auditoría de seguridad + hardening

### Qué se hizo

**Auditoría completa de seguridad** disparada por aviso del Security Advisor de Supabase (`rls_disabled_in_public`). Informe completo: [`salidas/27-05-2026_auditoria-seguridad.md`](salidas/27-05-2026_auditoria-seguridad.md)

**5 problemas corregidos (commit `0152859`):**

| # | Severidad | Problema | Fix |
|---|-----------|----------|-----|
| 1 | 🔴 CRÍTICO | `recetas_auditoria` sin RLS | Migration `20260527_fix_rls_recetas_auditoria.sql` aplicada en Supabase |
| 2 | 🟠 ALTO | GET/PUT `/api/clientes/[id]` sin `getUser()` | Auth + verificación `coach_id` añadidos |
| 3 | 🟠 ALTO | Seed endpoints sin protección en producción | Guard `NODE_ENV === 'production'` → 403 |
| 4 | 🟠 ALTO | `/api/importar-receta` sin auth (SSRF potencial) | Auth check + SSRF guard (IPs privadas bloqueadas) |
| 5 | 🟡 MEDIO | Sin HTTP security headers | `X-Frame-Options`, `X-Content-Type-Options`, `Referrer-Policy`, `Permissions-Policy`, `CSP` globales en `next.config.mjs` |

**Estado actual de seguridad:**
- ✅ 0 tablas Supabase sin RLS
- ✅ Todos los endpoints de coach requieren auth explícita
- ✅ Seed/import endpoints bloqueados en producción
- ✅ SSRF guard activo en fetch de URLs externas
- ✅ Security headers HTTP en todas las respuestas

**Falso positivo confirmado:** Los endpoints `/api/cliente/[codigo]/*` del portal cliente usan `codigo_publico` UUID como token de acceso (diseño intencional, no bug).

**Pendientes de seguridad (no urgentes):**
- Rate limiting en endpoints de IA generativa (Vercel Edge o Upstash)
- Review periódico de RLS en tablas nuevas (añadir al flujo de migrations)

---

## ✅ SESIÓN 24-05-2026 (Sesión 41) — Auditoría E2E + 2 SQL migrations + arranque Fase B/C

### Qué se hizo

**Auditoría completa del estado E2E de la app** — revisión de todos los bugs y pendientes acumulados desde sesión 22 hasta 40. Resultado: la mayoría ya estaban resueltos en sesiones anteriores.

**2 SQL aplicadas en Supabase:**
| Migration | Resultado |
|-----------|-----------|
| `20260524_garmin_connect_perclient.sql` | ✅ Aplicada — CHECK ampliado + columna `credenciales_json TEXT` en `integraciones_cliente` |
| `fix_prs_por_ejercicio_v2.sql` | ✅ Aplicada — vista `prs_por_ejercicio` ahora lee `s.set_data ->> 'peso_kg'` (el set más pesado, no el primero) |

**Verificaciones de código (ya resueltos en sesiones anteriores):**
- `getSummaryLast7d` ya reconoce `garmin_connect` — query sin filtro de proveedor, `garmin_connect` en el tipo `Proveedor`
- `IntegracionesPanel` ya correcto — form credenciales (no OAuth), badge "Sync automático"
- `revisar-rapido` ya correcto — interfaz `PlanInicial` con `recetas[]`, chips púrpura DeepSeek
- BUG-T01 ya correcto — `entrenos/plantillas` filtra por `sport_modality` desde sesión 25

**Arranque Fase B/C — brainstorming iniciado:**
- Decisión: empezar por **adherencia** (Fase C) — más impacto inmediato como coach
- Siguiente paso: registro de comidas en portal (tabla `registro_comidas_dia` ya existe: id, cliente_id, plan_id, comida_id, fecha, estado, notas)
- Pendiente decidir granularidad del registro (binario / 3 estados / porcentaje) — sesión parada en esa pregunta

### ⚠️ PRÓXIMA SESIÓN — Continuación Fase C: Adherencia

**Punto exacto donde se paró el brainstorming:**
> Cuando el cliente marca una comida, ¿qué registra?
> A) Solo "completada / saltada" (binario)
> B) Completada / parcialmente / saltada + motivo opcional
> C) Completada + porcentaje de porciones

Carlos elige A, B o C → a partir de ahí se diseña el sistema completo y se implementa.

**Piezas a construir (en orden):**
1. **Portal cliente**: botón/checkbox en cada comida de `MiPlan.tsx` → llama `POST /api/cliente/[codigo]/registro-comidas`
2. **API registro**: inserta/actualiza `registro_comidas_dia` (tabla ya existe en BD)
3. **Cálculo adherencia**: `%_adherencia = comidas_completadas / comidas_totales` por semana
4. **Vista coach**: en ficha cliente (`/clientes/[id]`) — tab o sección con adherencia semanal + histórico

---

## ✅ SESIÓN 24-05-2026 (Sesión 40) — Garmin Connect por cliente + GARMIN_CREDENTIALS_KEY

### Qué se construyó

Arquitectura completa para que cada cliente vincule su propia cuenta Garmin Connect usando sus credenciales personales, cifradas con AES-256-CBC.

| Archivo | Cambio |
|---------|--------|
| `supabase/migrations/20260524_garmin_connect_perclient.sql` | CHECK ampliado para incluir `garmin_connect`; columna `credenciales_json TEXT` en `integraciones_cliente` |
| `lib/integraciones/garmin-connect-perclient.ts` | `cifrarCredenciales()`, `descifrarCredenciales()`, `verificarCredencialesGarmin()`, `syncGarminClientDays()` |
| `lib/integraciones/garmin-connect-sync.ts` | `syncGarminDay(date, gc?, displayName?)` — acepta cliente pre-autenticado opcional (per-client sync) o usa credenciales del coach (legacy) |
| `app/api/integraciones/garmin-connect/route.ts` | **NUEVO** — POST: verifica login Garmin, cifra y guarda en BD. DELETE: borra integración |
| `app/api/cron/sync-integraciones/route.ts` | Itera `integraciones_cliente` con `proveedor='garmin_connect'`, descifra credenciales, llama `syncGarminClientDays` por cliente |
| `components/PortalCliente/IntegracionesPanel.tsx` | Form email+password cuando no vinculado; muestra "Sync automático" + botón Desconectar cuando activo |

### Infraestructura

- `GARMIN_CREDENTIALS_KEY` (64 hex chars) generada y añadida a `.env.local` + Vercel Production
- Cifrado: AES-256-CBC, IV aleatorio por credencial, almacenado como `iv_hex:encrypted_hex`
- Cron horario: sincroniza hoy+ayer para todos los clientes con garmin_connect activo

### ⚠️ PENDIENTE MANUAL

| # | Tarea | Cómo |
|---|-------|------|
| 🔴 | **Aplicar SQL migration** `20260524_garmin_connect_perclient.sql` en Supabase | Dashboard → SQL Editor → ejecutar el archivo |
| 🟠 | **Google Fit**: crear proyecto en Google Cloud Console, habilitar Fitness API, crear OAuth credentials, añadir `GOOGLE_FIT_CLIENT_ID` + `GOOGLE_FIT_CLIENT_SECRET` a Vercel | El código está listo en `lib/integraciones/google-fit.ts` |

### Commits sesión 40
- `2028736` — feat: Garmin Connect por cliente + form credenciales en portal

---

## ✅ SESIÓN 24-05-2026 (Sesión 39) — Panel wellness Garmin + normalizer garmin fields

### Qué se construyó

| Archivo | Cambio |
|---------|--------|
| `lib/integraciones/types.ts` | `garmin_connect` en `Proveedor` union; 4 campos nuevos en `ResumenActividadSemanal`: `body_battery_media`, `stress_avg_media`, `training_readiness_media`, `rhr_media` |
| `lib/integraciones/normalizer.ts` | `getSummaryLast7d()` calcula los 4 nuevos campos de las filas garmin_connect; empty-state inicializado |
| `app/api/cliente/[codigo]/integraciones/route.ts` | Detecta garmin_connect en `actividad_externa_cliente` (no OAuth). Devuelve `garmin_connect: { activa, ultima_sync, datos_hoy }` separado del array integraciones OAuth |
| `app/api/cliente/[codigo]/garmin-resumen/route.ts` | **NUEVO** — devuelve últimos 7 días de garmin_connect + promedios (pasos, TDEE, RHR, HRV, body_battery, stress, training_readiness) |
| `components/PortalCliente/IntegracionesPanel.tsx` | **Reescrito** — card Garmin Connect con badge "Sync automático", datos último día (body battery gauge, training readiness gauge, estrés con label semántico, pasos, RHR, HRV, TDEE), promedios 7 días con chips, sparkline body battery 7 días, nota "datos de sueño aparecerán cuando duermas con el reloj" |

### Comportamiento Garmin Connect en UI

- Si hay datos en BD → badge verde "Sync automático", datos del último día visibles
- Body Battery: gauge de color (verde ≥70, naranja ≥40, rojo <40)
- Training Readiness: gauge igual + score /100
- Estrés: Bajo (<26), Medio (<51), Alto (<76), Muy alto (≥76)
- Sparkline: barras por día de body_battery_end, colores por valor
- No tiene botón "Conectar" (no es OAuth) — sync lo hace el cron del coach

### Nota sueño (confirmado por Carlos)
Carlos no duerme con el Garmin aún → `sueno_h` y `sueno_calidad` serán null en todos los días. El panel muestra: "Los datos de sueño aparecerán cuando duermas con el reloj puesto."

### ✅ PRODUCCIÓN 100% OPERATIVA

| Tarea | Estado |
|-------|--------|
| `GARMIN_EMAIL` en Vercel Production | ✅ Añadida sesión 39 |
| `GARMIN_PASSWORD` en Vercel Production | ✅ Añadida sesión 39 |
| `STRAVA_CLIENT_ID=250183` en Vercel | ✅ Ya estaba |
| `STRAVA_CLIENT_SECRET` en Vercel | ✅ Ya estaba |
| `STRAVA_WEBHOOK_VERIFY_TOKEN=nutricoach-webhook-2026` | ✅ Actualizado sesión 39 |
| Webhook Strava ID 348546 registrado | ✅ Ya estaba activo (`nutricoach-delta.vercel.app/api/integraciones/strava-webhook`) |
| Redeploy producción con nuevos env vars | ✅ `nutricoach-otjku4whh` — sesión 39 |

### Commits sesión 39
- `61b808f` — docs: sesión 38 CLAUDE.md
- `06e1889` — feat: Garmin Connect panel wellness + normalizer garmin fields

---

## ✅ SESIÓN 24-05-2026 (Sesión 38) — Strava OAuth real + Garmin Connect wellness sync completo

### Qué se construyó / arregló

**Bugs críticos corregidos:**

| Bug | Causa raíz | Fix |
|-----|-----------|-----|
| "This page couldn't load" al clickar tab Apps | `dashboard/route.ts` devolvía `cliente:null` por join inline Supabase fallido → `data.cliente.id` TypeError | Split en 2 queries separadas + null guard en DashboardCliente |
| `clientes.codigo_portal` no existe | Columna incorrecta en 3 rutas | Siempre buscar por `planes_nutricion.codigo_publico` |
| Strava callback redirigía a `/cliente/integraciones` | Ruta inexistente (se trataba como `[codigo]='integraciones'`) | Lookup `planes_nutricion.codigo_publico` desde `cliente_id` |
| SW cache servía HTML viejo con chunks viejos tras deploy | service worker cache-first en navegaciones | Cambiado a network-first para navegaciones, cache-first solo para `_next/static/` |

**Strava real conectado:**
- Athlete ID: `62828992` → cliente `b18d795f-d416-485b-aeca-8144f004420b` (portal `nyv4l1Vm`)
- SQL migration `20260524_integraciones_dispositivos.sql` aplicada en Supabase (índices únicos + RLS)
- 9 actividades Strava sincronizadas (25-mar → 24-may) con datos COMPLETOS:
  - Splits por km (pace + FC + zona + desnivel), potencia media/NP/max watts, cadencia
  - Mejores esfuerzos (400m, 1mi, 5K...), elevación, kilojoules, suffer_score
  - Todo en `raw_data` JSONB para análisis posterior

**Garmin Connect wellness sync (nuevo, unofficial API):**
- Paquete: `garmin-connect` npm (v1.6.2) — login con email/password, sin OAuth partner
- `lib/integraciones/garmin-connect-sync.ts` — módulo completo con `syncGarminDay()` + `persistirGarminDays()`
- `scripts/backfill-garmin-connect.mjs` — backfill configurable con `--dias N --cliente-id UUID`
- 61 días sincronizados (24-mar → 23-may) con:
  - Pasos, TDEE, BMR, calorías activas, RHR, distancia diaria
  - Body Battery (máximo, mínimo, final del día)
  - Estrés medio + porcentaje bajo/medio/alto
  - Training Readiness (score 0-100 + nivel + feedback + tiempo recuperación)
  - HRV semanal media (en ms, desde hrvWeeklyAverage / 10)
  - Sueño cuando disponible (horas totales + deep/REM/light/despertar + SpO2 + respiración)
- Cron horario actualizado para sincronizar hoy+ayer de Garmin Connect automáticamente
- Nuevas columnas en BD: `body_battery_max`, `body_battery_min`, `body_battery_end`, `stress_avg`, `training_readiness`, `vo2max`, `distancia_km`
- Portal auto-abre tab Apps cuando URL tiene `?connected=strava` (o garmin/google_fit)

**Credenciales Garmin Connect:**
- `GARMIN_EMAIL=ccc8890@gmail.com` — en `.env.local` y pendiente añadir a Vercel
- `GARMIN_PASSWORD` — en `.env.local`, pendiente añadir a Vercel Production

### ⚠️ PENDIENTE MANUAL — Próxima sesión (prioritario)

| # | Tarea | Cómo |
|---|-------|------|
| 🔴 | **Añadir GARMIN_EMAIL + GARMIN_PASSWORD a Vercel Production** | Dashboard Vercel → Settings → Environment Variables |
| 🔴 | **Registrar webhook Strava** (para push en tiempo real de nuevos entrenos) | `curl -X POST https://www.strava.com/api/v3/push_subscriptions -d "client_id=$STRAVA_CLIENT_ID&client_secret=$STRAVA_CLIENT_SECRET&callback_url=https://nutricoach-delta.vercel.app/api/integraciones/strava-webhook&verify_token=$STRAVA_WEBHOOK_VERIFY_TOKEN"` |
| 🟠 | **Usar datos integraciones en agentes IA** | `getSummaryLast7d()` en `normalizer.ts` no reconoce `proveedor='garmin_connect'` — añadir a la query |
| 🟠 | **Capa de análisis: TDEE recalibrado** | Usar `calorias_totales` real de Garmin para ajustar macro targets del plan de dieta |
| 🟠 | **Panel resumen en tab Apps del portal** | Mostrar body battery, training readiness, pasos, sueño del día (datos ya en BD, solo UI) |
| 🟡 | **Nodos N_TDEE/N_TSS/N_HRV/N_PASOS del revisor-semanal** | Leer de `actividad_externa_cliente` para calcular ajustes automáticos |
| 🟡 | **IntegracionesPanel: mostrar Garmin Connect como "sincronizado"** | Actualmente muestra botón OAuth de Garmin Health API oficial — confuso. Cambiar a "Garmin Connect activo (sync automático)" |
| 🟡 | **Sleep tracking Garmin** | La mayoría de días sin datos de sueño — verificar si el reloj registra sueño automáticamente o necesita configuración |

### Lecciones aprendidas esta sesión

1. **Supabase inline join falla silenciosamente** cuando PostgREST no detecta la FK automáticamente → siempre hacer queries separadas para tablas no directamente relacionadas
2. **`clientes` NO tiene `codigo_publico` ni `codigo_portal`** — el código público siempre está en `planes_nutricion.codigo_publico`
3. **Strava sandbox = límite 1 atleta** — si ya hay uno conectado con token manual, hay que revocar en strava.com/settings/apps antes de reconectar
4. **`garmin-connect` npm usa URL absoluta en `gc.get()`** — pasar `https://connectapi.garmin.com/...` completo
5. **Garmin daily summary tiene body battery integrado** — no hace falta endpoint separado de body battery (devuelve 404), todo está en `usersummary-service/usersummary/daily/{displayName}?calendarDate={date}`
6. **Training readiness devuelve array** (múltiples lecturas del día) — coger `[0]` = más reciente
7. **HRV direct endpoint devuelve `""`** — el HRV diario no está disponible; usar `hrvWeeklyAverage` de training readiness (dividir por 10 para obtener ms)
8. **Analizar ANTES de codificar** — esta sesión hubo 7 iteraciones antes de encontrar la causa raíz del bug del tab Apps. La próxima: testear el endpoint directamente con curl/node primero, trazar el flujo completo antes de tocar código

### Commits sesión 38
- `e8d8713` — fix: service worker network-first para navegaciones
- `fe12eda` — fix: dashboard cliente query profiles separada + null guard
- `d2b4327` — fix: strava callback redirige a /cliente/[codigo] correcto
- `083fa1c` — fix: portal auto-abre tab Apps tras OAuth
- `57cc2c8` — feat: Garmin Connect sync completo (wellness 60d) + columnas BD

---

## ✅ SESIÓN 24-05-2026 (Sesión 37) — Integraciones dispositivos fitness (Strava, Garmin, Google Fit, Whoop)

### Qué se construyó

Arquitectura completa de integraciones con apps y wearables. Todos los providers escriben en una tabla normalizada `actividad_externa_cliente` que los agentes IA leen directamente — nunca llaman a APIs externas.

**Archivos creados/modificados (29 ficheros, +3.321 líneas):**

| Archivo | Rol |
|---------|-----|
| `supabase/migrations/20260524_integraciones_dispositivos.sql` | Tablas BD + RLS (⚠️ aplicar manualmente) |
| `lib/integraciones/types.ts` | Tipos: Proveedor, IntegracionCliente, ActividadExterna, ResumenActividadSemanal, ProveedorIntegracion |
| `lib/integraciones/normalizer.ts` | `persistirActividades()` + `getSummaryLast7d()` |
| `lib/integraciones/strava.ts` | Conector Strava: OAuth2, refresh, sync 14d, webhook push, TSS = suffer_score × 0.4 |
| `lib/integraciones/garmin.ts` | Conector Garmin: wellness-api dailies, steps/rhr/sleep |
| `lib/integraciones/google-fit.ts` | Conector Google Fit: 3 data streams, timestamps nanosegundos |
| `lib/integraciones/whoop.ts` | Skeleton Whoop (pendiente partner approval) |
| `lib/integraciones/sync.ts` | `sincronizarTodosProveedores()` — excluye strava/manual (push) |
| `app/api/integraciones/strava/{connect,callback,disconnect}/route.ts` | OAuth Strava |
| `app/api/integraciones/strava-webhook/route.ts` | GET hub.challenge + POST push |
| `app/api/integraciones/garmin/{connect,callback,disconnect}/route.ts` | OAuth Garmin |
| `app/api/integraciones/google-fit/{connect,callback,disconnect}/route.ts` | OAuth Google Fit |
| `app/api/cron/sync-integraciones/route.ts` | Cron horario CRON_SECRET-protected |
| `app/api/cliente/[codigo]/integraciones/route.ts` | Estado integraciones para portal |
| `components/PortalCliente/IntegracionesPanel.tsx` | UI 4 providers + Whoop "Próximamente" |
| `components/PortalCliente/DashboardCliente.tsx` | Tab "Apps" (Smartphone icon) añadido |
| `components/PortalCliente/CheckInForm.tsx` | Sección manual pasos/kcal/HRV (colapsable) |
| `app/api/cliente/[codigo]/checkin/route.ts` | Persiste datos manuales en actividad_externa_cliente |
| `lib/agentes/types.ts` | `actividad_semanal: ResumenActividadSemanal | null` en ContextoCliente |
| `lib/agentes/executor.ts` | `getSummaryLast7d()` cargado en `cargarContextoCliente()` |
| `lib/agentes/revisor-semanal.ts` | 4 nuevos nodos árbol: N_TDEE, N_TSS, N_HRV, N_PASOS |
| `vercel.json` | Cron `sync-integraciones` cada hora añadido |

### Arquitectura

```
Strava (webhook push) ──→┐
Garmin (polling horario) ─┼→ actividad_externa_cliente (tabla normalizada)
Google Fit (polling)  ──→┤      ↓
Manual (check-in form)──→┘  getSummaryLast7d()
                                ↓
                     ContextoCliente.actividad_semanal
                                ↓
                     revisor-semanal árbol 4 nodos nuevos:
                     N_TDEE / N_TSS / N_HRV / N_PASOS
```

### Coste estimado
- Strava webhook: 0 (push, no polling)
- Garmin + Google Fit: sync horario = ~24 llamadas/día/cliente (batch de todos los activos)
- Whoop: pendiente activar

### ⚠️ PENDIENTE MANUAL — Antes del primer uso

**1. Aplicar SQL en Supabase** → Dashboard → SQL Editor → ejecutar:
`supabase/migrations/20260524_integraciones_dispositivos.sql`

**2. Variables de entorno en Vercel** (Production):
```
STRAVA_CLIENT_ID
STRAVA_CLIENT_SECRET
STRAVA_WEBHOOK_VERIFY_TOKEN    ← string secreto que tú eliges
GARMIN_CLIENT_ID
GARMIN_CLIENT_SECRET
GOOGLE_FIT_CLIENT_ID
GOOGLE_FIT_CLIENT_SECRET
```

**3. Registrar webhook Strava** (una vez, tras deploy con vars):
```bash
curl -X POST https://www.strava.com/api/v3/push_subscriptions \
  -d "client_id=$STRAVA_CLIENT_ID&client_secret=$STRAVA_CLIENT_SECRET&callback_url=https://nutricoach-delta.vercel.app/api/integraciones/strava-webhook&verify_token=$STRAVA_WEBHOOK_VERIFY_TOKEN"
```

**4. Configurar OAuth redirect URIs** en cada consola de developer:
- Strava: `https://nutricoach-delta.vercel.app/api/integraciones/strava/callback`
- Garmin: `https://nutricoach-delta.vercel.app/api/integraciones/garmin/callback`
- Google Fit: `https://nutricoach-delta.vercel.app/api/integraciones/google-fit/callback`

### Commit
`b356ea0` — feat: integraciones dispositivos

---

## ✅ SESIÓN 24-05-2026 (Sesión 36) — Sistema Multi-Agente IA Completo

### Qué se construyó

Sistema de 8 agentes IA autónomos que monitorizan todos los clientes a diario y proponen acciones al coach mediante un kanban de aprobación.

**Archivos creados/modificados:**

| Archivo | Rol |
|---------|-----|
| `lib/agentes/types.ts` | Tipos TypeScript compartidos del sistema |
| `lib/agentes/executor.ts` | Routing inteligente de modelos (Gemini/DeepSeek) |
| `lib/agentes/director.ts` | Orquestador — cron entry point |
| `lib/agentes/riesgo.ts` | Riesgo abandono nutrición (Gemini Flash, diario) |
| `lib/agentes/riesgo-entreno.ts` | Inactividad entrenamiento (Gemini Flash, diario) |
| `lib/agentes/revisor-semanal.ts` | Revisión macros/adherencia (DeepSeek V3, lunes) |
| `lib/agentes/revisor-semanal-entreno.ts` | Revisión TLS/RPE/sesiones (Gemini Flash, lunes) |
| `lib/agentes/motivacion.ts` | Mensaje motivacional semanal (Gemini Flash, lunes) |
| `lib/agentes/memoria.ts` | Aprendizaje de decisiones coach (DeepSeek V3) |
| `lib/agentes/aplicar.ts` | Motor decisiones — ejecuta acciones reales en BD |
| `app/api/agentes/ejecutar/route.ts` | Endpoint cron GET+POST con CRON_SECRET |
| `app/api/agentes/tareas/route.ts` | Kanban GET+PATCH con aplicarTarea() |
| `app/api/cliente/[codigo]/chat/leer/route.ts` | Marcar mensajes leídos (portal) |
| `app/agentes/page.tsx` | UI kanban 3 columnas + badge sidebar |
| `components/PortalCliente/MensajeCoach.tsx` | Banner mensajes coach en portal |
| `components/PortalCliente/DashboardCliente.tsx` | MensajeCoach integrado |
| `components/Sidebar.tsx` | Link /agentes + badge pendientes con polling |
| `vercel.json` | Crons: diario 7am + semanal lunes 6am |

### Coste estimado a 100 clientes: ~$1.50/mes

### Commits: `e0f8b20`, `09a6151`

---

## 0. Spec-Kit + Superpowers — Flujo de desarrollo estructurado (instalado 23-05-2026)

### Qué es

[spec-kit](https://github.com/github/spec-kit) es un toolkit de Spec-Driven Development (SDD) de GitHub. Obliga a escribir especificaciones, planes y tareas ANTES de tocar código. Instalado con integración Claude Code nativa.

[superspec](https://github.com/WangX0111/superspec) es el bridge que conecta spec-kit con las skills de obra/superpowers (brainstorming, TDD, code-review), instalado como skill local en `.claude/skills/superspec/`.

### Versiones instaladas

| Herramienta | Versión | Método |
|-------------|---------|--------|
| `specify-cli` | v0.8.13 | `uv tool install` (global) |
| `superspec` bridge | v1.0.0 | Skill local en `.claude/skills/superspec/` |

### Estructura creada

```
.specify/
├── memory/
│   └── constitution.md        ← Principios del proyecto (LEER PRIMERO)
├── templates/                 ← Templates de spec/plan/tasks
├── extensions/                ← git extension activa
└── workflows/speckit/         ← Workflow automático

specs/                         ← Una carpeta por feature
└── [nombre-feature]/
    ├── spec.md                ← Qué se construye y por qué
    ├── plan.md                ← Cómo se construye técnicamente
    └── tasks.md               ← Tareas concretas con criterios de aceptación
```

### Skills disponibles en Claude Code

| Skill | Invocación | Cuándo usar |
|-------|-----------|-------------|
| `speckit-constitution` | `/speckit-constitution` | Revisar o actualizar principios del proyecto |
| `speckit-specify` | `/speckit-specify` | Definir requisitos de una feature nueva |
| `speckit-clarify` | `/speckit-clarify` | Clarificar antes de planificar (opcional) |
| `speckit-plan` | `/speckit-plan` | Crear plan técnico desde una spec |
| `speckit-checklist` | `/speckit-checklist` | Validar completitud de una spec/plan |
| `speckit-tasks` | `/speckit-tasks` | Generar tareas accionables desde el plan |
| `speckit-analyze` | `/speckit-analyze` | Consistencia cross-artifact (spec+plan+tasks) |
| `speckit-implement` | `/speckit-implement` | Ejecutar implementación siguiendo tasks |
| `superspec` | `/superspec` | Bridge completo SDD + superpowers (brainstorm+TDD+review) |

### Flujo estándar para features nuevas

```
1. /speckit-clarify  → preguntas para desambiguar (opcional)
2. /speckit-specify  → spec.md con requisitos
3. /speckit-plan     → plan.md con diseño técnico
4. /speckit-checklist → validar calidad de la spec
5. /speckit-tasks    → tasks.md con criterios de aceptación
6. /speckit-analyze  → verificar consistencia entre artefactos
7. /speckit-implement → implementar siguiendo tasks
```

O usando el bridge completo: `/superspec` gestiona todo el ciclo con superpowers integrado.

### Comando CLI

```bash
# Ver estado de extensiones y configuración
specify extension list

# Crear spec para una nueva feature (desde el directorio nutricoach)
specify workflow run speckit

# Verificar prerrequisitos
specify check
```

### Constitution

Los principios del proyecto están en [`.specify/memory/constitution.md`](.specify/memory/constitution.md). **Leer antes de cualquier feature nueva.**

Principios clave:
- Evidencia científica obligatoria en planes IA
- Coach aprueba todo antes de llegar al cliente
- Build verde antes de merge
- Mobile-first siempre
- Quality gates documentados en la constitution

---

## 1. Regeneración de Imágenes de Recetas

### Modelo único: `gpt-image-1` (OpenAI)

- Usar exclusivamente el modelo `gpt-image-1` de OpenAI para generar imágenes de recetas.

### Clasificación de imágenes en BD (18-05-2026)

Tras regenerar 150 imágenes, se añadió columna `imagen_tipo` a la tabla `recetas`:
- valores posibles: `'propia' | 'txt2img' | 'placeholder'`
- `'propia'`: imagen real del plato (subida por coach)
- `'txt2img'`: generada por IA
- `'placeholder'`: sin imagen (icono por defecto)

### Scripts de imagen disponibles

| Script | Uso |
|--------|-----|
| [`scripts/subir-imagen-manual.mjs`](scripts/subir-imagen-manual.mjs) | Una receta concreta |
| [`scripts/regenerar-flux-masivo.mjs`](scripts/regenerar-flux-masivo.mjs) | Regenerar N recetas por IDs |
| [`scripts/piloto-regeneracion-imagenes.mjs`](scripts/piloto-regeneracion-imagenes.mjs) | Prueba 6 imágenes |
| [`scripts/capturar-y-refinar-18.mjs`](scripts/capturar-y-refinar-18.mjs) | Capturar+refinar iterativo |
| [`scripts/subir-imagenes-aprobadas.mjs`](scripts/subir-imagenes-aprobadas.mjs) | Subir imágenes locales |

## 2. Regenerar las 147 imágenes malas con estilo food blogger:

Las imágenes muestran **comida real**, preparada, en plato, con luz natural tipo food blogger. NO queremos ilustraciones, dibujos, ni collages.

### Prompt estándar txt2img
```
Real food photography of [PLATO], served on a ceramic plate, natural window lighting, shallow depth of field, wooden table surface, fresh ingredients visible, appetizing, food blogger style, 4K, shot on Sony A7 III.
```
*Prompt guardado en `scripts/regenerar-flux-masivo.mjs`*

### Lo que NO hacer nunca
1. **NO** regenerar imágenes de recetas sin antes consultar qué enfoque usar (`gpt-image-1`, flux, etc.)
2. **NO** subir imágenes desde URLs de internet sin verificar derechos
3. **NO** usar placeholders genéricos
4. **NO** tocar `imagen_tipo` al actualizar URL de imagen — la clasificación es manual del coach

## 3. Diagnóstico de Coincidencias de Imágenes

### Cómo funciona la visualización (crítico para diagnosticar)
Cuando un cliente ve una receta en el plan de nutrición, la app muestra la imagen asociada a esa receta en la BD (`recetas.imagen_url`). Si la imagen no coincide con el plato, el problema está en el matching.

### Cómo diagnosticar un match incorrecto
1. Abrir la receta en `/recetas/[id]` y ver qué imagen tiene
2. Consultar `scripts/diagnostico-completo-recetas.ts` para ver el estado global
3. Si hay 0 resultados pero sabes que hay recetas, filtrar por `imagen_tipo` en la BD

### Cómo corregir un match incorrecto en BD
```sql
UPDATE recetas SET imagen_url = 'nueva_url', imagen_tipo = 'txt2img' WHERE id = 'uuid';
```

### Cómo prevenir que vuelva a pasar
- `imagen_tipo` permite filtrar: `WHERE imagen_tipo IS NULL OR imagen_tipo = 'placeholder'`
- Las regeneraciones deben actualizar `imagen_tipo` a `'txt2img'`
- Si el coach sube una foto real, poner `imagen_tipo = 'propia'`

### 🛡️ GUARD — Productos No Comestibles (22-05-2026)
**Archivo único**: [`lib/scraping/guard-no-comestible.ts`](lib/scraping/guard-no-comestible.ts)

Este es el **ÚNICO PUNTO DE VERDAD** para detectar productos no comestibles. TODOS los entry points importan `esProductoNoComestible()` desde aquí.

**Entry points que importan del guard**:
| Entry point | Archivo |
|---|---|
| Pipeline scraping | [`lib/scraping/index.ts`](lib/scraping/index.ts) → `esNoComestible()` delega |
| Normalizador | [`lib/scraping/normalizador.ts`](lib/scraping/normalizador.ts) → `crearAlimentoSiNoExiste()` |
| API alimentos | [`app/api/alimentos/route.ts`](app/api/alimentos/route.ts) → POST inline regex reemplazado |
| Matcher recetas | [`app/api/scrape-receta/route.ts`](app/api/scrape-receta/route.ts) → `puntuarCandidato()` |

**Cobertura**: mascotas, higiene, dental, capilar, jabón/gel, desodorante, cremas, facial, labial, maquillaje, uñas, brochas, Deliplus, solar, depilación, limpieza hogar, menaje, bebés, alcohol, bebidas energéticas, electrodomésticos (vatios).

**Excepciones documentadas**: miel+dosificador, chorizo+vela, jabón+glicerina, freidora+aire, microondas, alcohol en platos (al vino, estofado, vinagre, etc.).

**Reglas**:
- NO duplicar listas en otros archivos — siempre importar del guard
- Para añadir un patrón nuevo, edit SOLO `guard-no-comestible.ts`
- Para verificar cobertura, ejecutar: `tsx scripts/limpiar-cosmeticos-bd.ts --dry-run`

### MATCH_FIXES vigentes (15-05-2026)
Los fixes aplicados en [`lib/foods-data.ts`](lib/foods-data.ts) para corregir matches incorrectos entre ingredientes de recetas y alimentos de la BD.

### Regla del algoritmo matchIngrediente (healthify/route.ts)
El algoritmo busca en este orden:
1. `nombre_original` exacto (case-insensitive)
2. `nombre` exacto (case-insensitive)
3. `nombre` contiene el ingrediente
4. fallback: fuzzy match con `trigram` de pg_trgm

## 4. Configuración del Proyecto

### Instalación
```bash
npm install
cp .env.example .env.local  # configurar claves
```

### Comandos útiles
- `npm run dev` — servidor de desarrollo
- `npm run build` — build de producción
- `npx next build` — build con diagnóstico
- `npx tsx scripts/[script]` — ejecutar scripts TypeScript
- `node scripts/[script]` — ejecutar scripts JS

### Limitaciones detectadas
- Playwright solo funciona en macOS/Linux
- DeepSeek puede rate-limit si se exceden requests concurrentes
- NCBI E-utilities: 10 req/s sin API key

## 5. Scraping de Recetas

#### [`nutricoach/app/api/scrape-receta/route.ts`](nutricoach/app/api/scrape-receta/route.ts)
- Endpoint para scrapear recetas desde URLs
- Usa `cheerio` para parsear HTML
- Extrae ingredientes, instrucciones, tiempo de cocción

## 6. Build

- `npx next build` / `npm run build`
- Build verificado sin errores (sesiones recientes)
- Next.js 16.2.4

## 7. Archivos copiados de feature/ui-estetica (worktree)

### Archivos copiados de nutricoach-ui (feature/ui-estetica)
- `DESIGN.md`
- `PLAN_ESTETICO.md`

### Archivos copiados de nutricoach-modulos (feature/modulos)
- `lib/periodizacion/` (todo)
- `lib/auto-coach.ts`
- `lib/nutricion-peri-entreno.ts`
- `lib/validacion-micronutrientes.ts`
- `components/dashboard/AutoCoachPanel.tsx`
- `components/dashboard/KBPanel.tsx`

### Scripts verificados (sin cambios necesarios)
- `lib/knowledge-base.ts`
- `lib/knowledge.ts`
- `scripts/backfill-planes-evidencia.ts`
- `scripts/analizar-uso-papers.ts`
- `scripts/diagnosticar-tags-kb.ts`
- `scripts/test-tag-bridge.ts`
- `scripts/test-e2e-bridge.ts`

### Archivos idénticos verificados (sin cambios)
No hay conflictos entre worktrees.

### Build de verificación
- Build ejecutado y verificado sin errores
- 107 páginas, 0 errores

### Notas importantes
- Los scripts de backfill y auto-entrenamiento están verificados
- La KB tiene 230 papers
- TAG_BRIDGE tiene ~95 entradas, ~500 bridge values

## 8. Comandos y Scripts Importantes

- `npx tsx scripts/ingestar-papers.ts` — Ingesta papers PubMed (14 fuentes)
- `npx tsx scripts/backfill-planes-evidencia.ts` — Backfill evidencia a planes activos
- `npx tsx scripts/analizar-uso-papers.ts` — Auto-entrenamiento (analizar uso papers)
- `npx tsx scripts/test-tag-bridge.ts` — Test cobertura TAG_BRIDGE por cliente
- `npx tsx scripts/diagnosticar-tags-kb.ts` — Diagnóstico tags en knowledge_base
- `node scripts/ejecutar-scraping.mjs` — Scraping supermercados (--mercadona, --consum, --all, etc.)

## 9. Dashboard

### Dashboard NutriCoach — Rediseño completo ✅
- Dashboard en `app/dashboard/page.tsx` — 638 líneas
- Componentes: `KBPanel`, `AutoCoachPanel`, `CheckinsPendientes`
- Analytics con gráficos: barras, stacked bars, donuts
- Acciones rápidas, estado, revisiones, competiciones

## 10. Scraping Supermercados

### Lidl scraper v4 — Híbrido Playwright + gridboxes API ✅
- Playwright obtiene ERP numbers desde la web de folletos
- Gridboxes API devuelve precios + categorías reales
- 74 productos actualizados

### Archivos clave v4
- [`lib/scraping/supermercados/lidl.ts`](lib/scraping/supermercados/lidl.ts) — Scraper híbrido
- [`lib/scraping/motores/motor-playwright.ts`](lib/scraping/motores/motor-playwright.ts) — Motor Playwright
- [`lib/scraping/helpers-scraping.mjs`](lib/scraping/helpers-scraping.mjs) — Helpers

### API gridboxes — Notas para futura referencia
- Endpoint: `https://www.lidl.es/api/v1/grid-boxes/...`
- Rate limit: ~2 req/s
- Cache: 24h

## 11. Estado de Scrapers

### Estado actual de productos por supermercado (21-05-2026)
| Supermercado | Productos | Método | Estado |
|---|---|---|---|
| Consum | 4,765 | API HTTP | ✅ (re-scrapeando) |
| Mercadona | 2,895 | API HTTP | ✅ Re-scrapeado |
| Alcampo | 38 | API Ocado | ✅ Re-scrapeado |
| Carrefour | 20 | Playwright homepage | ✅ (0 nuevos) |
| Bonpreu | 21 | Híbrido | ✅ |
| Esclat | 21 | Híbrido | ✅ |
| Eroski | 11 | Playwright | ✅ Re-scrapeado |
| Lidl | 74 | Híbrido v4 | ✅ |
| Día | ~130 | API HTTP (SSR) | ✅ |
| Hipercor | ~308 | Puppeteer | ✅ |
| El Corte Inglés | ~308 | Puppeteer (vía Hipercor) | ✅ |
| Aldi | 0 | — | ❌ |
| **Total** | **~8,672** | | |

### Pendiente para próxima sesión
1. **Día**: Investigar si hay API subyacente tras el WAF de Cloudflare
2. **Carrefour**: Investigar por qué devuelve 0 comestibles
3. **Aldi**: Nuevo scraper
4. **Consum**: Verificar que terminó el re-scrapeo

## 12. Estado KB y TAG_BRIDGE

### KB actual: 230 papers
- 14 fuentes PubMed activas (8 originales + 6 clínicas)
- TAG_BRIDGE: ~95 entradas, ~500 bridge values
- Cobertura funcional: +300-1650% por cliente (test-tag-bridge)

### Dashboard KB
- [`components/dashboard/KBPanel.tsx`](components/dashboard/KBPanel.tsx) — Panel en dashboard principal
- Muestra stats, últimas fichas, disciplinas, puentes por categoría

## 13. Sesiones de Trabajo

### ✅ SESIÓN 21-05-2026 (5ª ronda) — PORTAL CLIENTE COMPLETO: CIENCIA + ALTERNATIVAS + SEMANA 🚀

**Arquitectura ciencia-first + feedback loop cerrado**

| Fix | Archivo | Detalle |
|-----|---------|---------|
| IDs receta falsos DeepSeek | `generar-plan-inicial` | `recetasPorNombre` index + `resolverReceta()` fallback por nombre |
| Filtro estado recetas | `generar-plan-inicial` | `.eq('estado', 'aprobada').gt('kcal', 0)` + límite 8/categoría |
| Evidencia no guardada | `generar-plan-inicial` | Guardada server-side en `evidencia_cientifica` |
| `from('dietas')` inexistente | `checkin/route.ts` | Cambiado a `planes_nutricion` + columna `carbohidratos_objetivo` |
| Feedback loop check-in | `checkin/route.ts` | Periodización → `aplicarAjusteAlPlan()` → actualiza plan real |
| Aprobación coach | `periodizacion/refeed/aprobar` | Importa `aplicarAjusteAlPlan()` compartida |

**Alternativas accionables por comida**
- `GET /api/recetas/sugeridas`: filtro `tipo_plato` + fallback + límite 7 + distancia euclidiana
- `GET /api/recetas/[id]/ingredientes`: nuevo endpoint — retorna ingredientes como `AlimentoEnComida[]`
- `MiPlan.tsx`: "Ver alternativas" → 4 recetas filtradas por tipo comida → botón "Usar" → swap real de alimentos en `planLocal`

**Vista semanal Lun-Dom**
- `PlanSemanal.tsx` (nuevo): pool de 7 recetas por franja, rotación circular por día, botón ↻ por slot
- Toggle "Hoy / Semana" en MiPlan

**Bugs corregidos (auditoría)**

| # | Gravedad | Bug | Fix |
|---|----------|-----|-----|
| 1 | 🔴 CRÍTICO | `sugeridas`: `NOT IN ()` SQL inválido con pool vacío | Guard `pool.length > 0` |
| 2 | 🔴 CRÍTICO | `PlanSemanal`: `useEffect` se re-disparaba al cada swap | `useMemo(plan.comidas)` — ref estable |
| 3 | 🟠 MENOR | `sugeridas`: límite 6 impide 7 recetas distintas/semana | Límite subido a 7 |
| 4 | 🟡 MENOR | `knowledge-base.ts`: clave `sop` duplicada → TS1117 | Merge + eliminado duplicado |

**Commits**: `8a36671` (generar-plan-inicial ciencia-first) · `bb969ee` (checkin + periodización) · `e9bb370` (alternativas comida) · `62955ba` (vista semanal) · `c41a9c1` (bug fixes)

---

### ✅ SESIÓN 21-05-2026 (4ª ronda) — PENDIENTES EJECUTADOS COMPLETOS 🚀

**Ejecución completa de pendientes**:

| Tarea | Estado | Detalle |
|-------|--------|---------|
| Consum verificado | ✅ | Terminó en background (~60 min, 4.765 prod) |
| Re-backfill nuevos papers | ✅ | 11 clientes, 62 referencias |
| Auto-entrenamiento post-backfill | ✅ | 216 protocolos no usados |
| Test tag-bridge | ✅ | Laura +1700%, Sofía +900% 🚀 |
| Bug #5 — Carrefour fix | ✅ | Migrado a scraper modular [`carrefour.ts`](lib/scraping/supermercados/carrefour.ts) |
| `npx next build` | ✅ | Sin errores |
| Día investigado | ✅ | Ya resuelto vía SSR HTTP directo |

**Bug #5 — FIXED**:
- **Causa**: El scraper inline legacy usaba URLs antiguas (`/supermercado/c/alimentacion`) y navegaba cat-por-cat activando Cloudflare.
- **Fix**: Reemplazado por wrapper que ejecuta [`carrefour.ts`](lib/scraping/supermercados/carrefour.ts) vía `npx tsx`. El scraper modular extrae ~444 productos directamente del homepage con selectores actualizados (`.product-card__parent`, `catalog="food"`).

---

### ✅ SESIÓN 22-05-2026 (noche) — Sistema de tags del recetario completo 🏷️

**Objetivo**: tags automáticos por ingredientes, filtros por tipo en todas las vistas, editor manual.

| Tarea | Commits | Detalle |
|-------|---------|---------|
| Ocultar chips #tag de RecipeCardPremium | `0c79a7d` | Limpio, solo categoría pill |
| Rediseño filtros `/recetas` | `0c79a7d` | 2 filas fijas + popover avanzado, chips lima #A3E635 |
| Sub-categorías contextuales por tipo de plato | `0c79a7d` | SUBCATEGORIAS en recetas-constants.ts |
| `lib/auto-tag.ts` + `KNOWN_TAGS` | `83e1df0` | autoTagReceta() + vocabulario exportado |
| Script batch auto-etiquetado | `83e1df0` | 254/254 recetas actualizadas, 33 sin tags (legítimos) |
| Hook auto-tag en scrape-receta (nuevas) | `83e1df0` | Recetas nuevas se etiquetan al insertar |
| Tags: Donut, Yogur, Salsa añadidos | `850ff49` | 57→33 recetas sin tags |
| Sub-cats multi-categoría + filtro cross-cat | `6c532a6` | Donut en Postre+Merienda+Snack; tagFilter ignora categoría principal |
| Editor chips en `/recetas/[id]/editar` | `6c532a6` | Chips toggle vocabulario + TagInput custom |
| Autocomplete buscador `/recetas` | `635afd1` | Dropdown tags al escribir ≥2 chars, click activa filtro |
| Autocomplete buscador dietas | `6e1284f` | Chips tipo en buscador recetas del constructor |
| Fix: tag+texto combinables en dietas | `43e9cf4` | ilike + contains simultáneos, panel visible con tagReceta solo |

**Arquitectura tags**:
- `lib/auto-tag.ts` — fuente única de verdad: NAME_TAGS (por nombre de plato) + INGREDIENT_TAGS (por ingrediente). Exporta `autoTagReceta()` y `KNOWN_TAGS[]`.
- Script: `npx tsx scripts/auto-etiquetar-recetas.ts [--dry-run] [--todas]` — re-ejecutar si se añaden keywords
- Tags en BD: `recetas.tags: string[]` — array de strings capitalizados (Pollo, Arroz, Donut…)

**Comportamiento filtros**:
- Seleccionar categoría (Comida) → filtra por `r.categoria === 'Comida'`
- Seleccionar categoría + sub-tag (Merienda → Donut) → ignora categoría, muestra todos los Donuts
- Esto permite que un Donut categorizado como Postre aparezca en Merienda→Donut ✅

**Bugs corregidos esta sesión**:
| # | Bug | Fix |
|---|-----|-----|
| 1 | Placeholder "Filtrar dentro de X" pero onChange limpiaba el tag | Eliminado `setTagReceta(null)` del onChange |
| 2 | Panel resultados no aparecía con tagReceta activo + queryReceta vacío | Añadido `|| !!tagReceta` a la condición del panel |
| 3 | tag y texto no se podían combinar | useEffect unificado: aplica ambos filtros simultáneamente |

---

### ✅ SESIÓN 23-05-2026 (tarde) — Recetario Capa 1 + Portal S1 + Batch Audit

**Recetario Capa 1 — completado** (commits `e45a6ff`, `74008d7`, `54d3120`, `a18a971`):
- SQL: `comidas.receta_id` + tabla `receta_interacciones_cliente` aplicado en Supabase
- `lib/plan-recetas.ts` v2: `filtrarRecetasPorSlot` con score compuesto (calidad×0.40 + apta×0.35 + macro×0.25)
- `generar-plan-inicial`: guarda `receta_id` en comidas + fire-and-forget tracking en `receta_interacciones_cliente`
- `scripts/batch-audit-profesional.ts`: audita recetas con `score_calidad` null, con contador `[N/total]` por ítem

**Batch audit ejecutado**: 62/62 recetas auditadas — **score medio 95.1/100**, min 76, max 100, 0 errores.

**Portal cliente S1 — Pantalla bienvenida** (`da711b2`):
- `DashboardCliente.tsx`: tarjeta de bienvenida en primer acceso detectada por `localStorage`
- Lista de 3 features con iconos + botón "Empezar →" que cierra y no vuelve a aparecer

**SQL aplicado en Supabase (listo para DeepSeek S2-S5)**:
- `checkins`: +5 columnas de medidas corporales (cintura, cadera, pecho, brazo, muslo)
- `registro_comidas_dia`: nueva tabla para S3
- `chat_mensajes`: nueva tabla para S5

**Briefs DeepSeek actualizados**: S2/S3/S5 tienen nota "⚠️ YA APLICADO" en Paso 1 SQL.

**Emails** (`cbd0d8f`): asuntos personalizados (plan-listo + welcome con nombre del cliente).

---

## 🔀 Historial de Worktrees — Ya unificados en main

Todos los worktrees han sido mergeados y unificados en `main`. No hay worktrees activos.

### Comandos para futura referencia:
```bash
git worktree add -b feature/nueva-rama ../nutricoach-nueva-rama main
cd ../nutricoach-nueva-rama && code .
```

## ⚡ End Session — Cierre de jornada

```bash
# Commit en main (siempre):
git add -A && git commit -m "Sesion [FECHA]: [RESUMEN]" && git push
```

## 🧠 LECCIONES APRENDIDAS — Aciertos y Errores

### ✅ ACIERTOS
1. **Diagnóstico completo antes de tocar nada**: Ejecutar scripts de diagnóstico primero da visibilidad del estado real antes de decidir qué priorizar.
2. **Estimación de macros por reglas locales**: En vez de llamar a una IA para cada alimento (costoso y lento), crear reglas con datos reales de BEDCA. Rápido, gratuito.
3. **`--dry-run` en scripts de modificación masiva**: Los scripts nuevos incluían modo dry-run para ver qué se iba a cambiar antes de aplicar.
4. **Dos pases para metadatos**: Primero inferencia por reglas, luego segundo pase manual para remanentes.

### ❌ ERRORES
1. **Ejecutar pipeline sin preguntar**: Preguntar siempre antes de consumir APIs externas.
2. **`URL` como nombre de variable**: Sombrea constructor global. Usar `SB`, `API_URL`.
3. **Typos en variables**: `grasa` vs `grasas`. Usar `node --check` antes de ejecutar.
4. **No verificar 416 en paginación**: Manejar 416 en toda paginación con Supabase REST API.
5. **Asumir que ingredientes de recetas tienen `alimento_id` vinculado**: El primer intento de fix usó `/api/recetas/[id]/ingredientes` para obtener ingredientes con `alimento_id`, pero muchas recetas en BD solo tienen `nombre_libre` (sin vínculo a la tabla `alimentos`). El filtro `ing.alimento_id && ing.cantidad_gramos > 0` resultaba en array vacío y no se guardaba nada.
6. **No revisar sistemas/planes existentes antes de crear soluciones**: En la sesión de bugs del recetario, se asumió que no había infraestructura de precios y que "Dátiles medjool" no tendría cómo asignarle precio. Pero el sistema `mejores_precios_por_alimento` + `Precio referencia coach` + [`AdminPrecios.tsx`](components/AdminPrecios.tsx) ya existía completamente operativo. Se perdió tiempo diseñando soluciones desde cero que ya existían.

### ⚡ REGLAS PARA PRÓXIMAS SESIONES
1. Preguntar siempre antes de consumir APIs externas.
2. Probar scripts con `node --check` primero.
3. Usar `--limit N` pequeño primero.
4. NUNCA usar `URL` como nombre de variable.
5. Manejar 416 en toda paginación.
6. Siempre tener plan B.
7. Documentar en CALIENTE.
8. **Antes de crear código nuevo, revisar sistemas existentes**: Leer `CLAUDE.md`, `ESTADO_Y_PROXIMOS_PASOS.md`, `DIAGNOSTICO_FALLOS.md`, schemas SQL, vistas Supabase, y componentes UI relacionados antes de diseñar cualquier solución.
9. Verificar existencia de vistas/funciones/tablas relacionadas en Supabase antes de diseñar soluciones desde cero.
10. Consultar [`supabase_productos_vs_alimentos.sql`](supabase_productos_vs_alimentos.sql) y otros SQL de schema para conocer la arquitectura real de datos.
11. Usar `--dry-run` siempre antes de `--apply` en scripts de modificación masiva.

---

### ✅ SESIÓN 22-05-2026 — FIX: Recetas DeepSeek no se persistían en plan de dieta 🔴

**Bug crítico**: Las recetas que DeepSeek seleccionaba en `distribucion_comidas[].recetas` no se guardaban en la BD. [`crearPlan()`](app/clientes/[id]/revisar-plan/page.tsx:324) usaba `recetasPorComida[index]` (recetas sugeridas al azar por rango de kcal) en vez de las recetas reales de DeepSeek.

**Causa raíz**: La interfaz [`PlanInicial`](app/clientes/[id]/revisar-plan/page.tsx:32-44) no definía el campo `recetas` en `distribucion_comidas`, aunque [`generar-plan-inicial/route.ts`](app/api/generar-plan-inicial/route.ts:463-490) sí lo incluía en el JSON persistido.

**Fix (2 cambios)** en [`app/clientes/[id]/revisar-plan/page.tsx`](app/clientes/[id]/revisar-plan/page.tsx):

| # | Cambio | Líneas | Detalle |
|---|--------|--------|---------|
| 1 | Interfaz `PlanInicial` | 35-40 | Añadido `recetas?: { receta_id; receta_nombre; cantidad_porciones }[]` |
| 2a | Detectar plan existente | 340-355 | `crearPlan()` consulta `planes_nutricion` activo primero. Si existe (persistido por server route), redirige sin duplicar |
| 2b | Usar recetas DeepSeek | 397-490 | Persiste `plan.distribucion_comidas[].recetas`. Fallback a `recetasPorComida` solo si DeepSeek no asignó ninguna |

**Flujo corregido**:
1. `generar-plan-inicial/route.ts:648-800` ya persiste plan + comidas + alimentos en BD con recetas reales de DeepSeek
2. El frontend carga `registros_ia.respuesta_json` que contiene `distribucion_comidas[].recetas`
3. Al hacer clic "Crear plan de dieta", `crearPlan()` detecta el plan existente → `setDietaCreada({ id })` → UI muestra "Ver dieta →"
4. El coach ve las recetas que DeepSeek asignó a cada comida

**Archivo modificado**: solo [`app/clientes/[id]/revisar-plan/page.tsx`](app/clientes/[id]/revisar-plan/page.tsx) (+62 líneas efectivas)

**Auditoría de bugs (22-05-2026)**:

| # | Gravedad | Bug | Archivo | Estado |
|---|----------|-----|---------|--------|
| 1 | 🔴 CRÍTICO | `crearPlan()` usaba `recetasPorComida[idx]` (aleatorias por kcal) en vez de `distribucion_comidas[].recetas` (DeepSeek). Las recetas seleccionadas por IA nunca llegaban a la BD | [`revisar-plan/page.tsx:400-490`](app/clientes/[id]/revisar-plan/page.tsx:400-490) | ✅ FIXED |
| 2 | 🟡 MEDIO | `revisar-rapido/page.tsx` interfaz `PlanInicial` sin campo `recetas`. La UI muestra `recetasPorComida` (aleatorias) en vez de las recetas de DeepSeek | [`revisar-rapido/page.tsx:15-28`](app/clientes/[id]/revisar-rapido/page.tsx:15-28) + línea 325 | ❌ PENDIENTE |
| 3 | 🟡 MEDIO | `revisar-plan/page.tsx` UI preview muestra `recetasPorComida[idx]` (aleatorias) en vez de `comida.recetas` de DeepSeek en la card de distribución | [`revisar-plan/page.tsx:839`](app/clientes/[id]/revisar-plan/page.tsx:839) | ❌ PENDIENTE |

**Auditoría de bugs (22-05-2026) — TODOS CORREGIDOS ✅**:

| # | Gravedad | Bug | Archivo | Estado |
|---|----------|-----|---------|--------|
| 1 | 🔴 CRÍTICO | `crearPlan()` usaba `recetasPorComida[idx]` (aleatorias por kcal) en vez de `distribucion_comidas[].recetas` (DeepSeek). Las recetas seleccionadas por IA nunca llegaban a la BD | [`revisar-plan/page.tsx:400-490`](app/clientes/[id]/revisar-plan/page.tsx:400-490) | ✅ FIXED |
| 2 | 🟡 MEDIO | `revisar-rapido/page.tsx` interfaz `PlanInicial` sin campo `recetas`. UI mostraba recetas aleatorias en vez de DeepSeek | [`revisar-rapido/page.tsx:15-28`](app/clientes/[id]/revisar-rapido/page.tsx:15-28) + línea 325 | ✅ FIXED |
| 3 | 🟡 MEDIO | `revisar-plan/page.tsx` UI preview mostraba `recetasPorComida[idx]` (aleatorias) en vez de `comida.recetas` de DeepSeek | [`revisar-plan/page.tsx:839`](app/clientes/[id]/revisar-plan/page.tsx:839) | ✅ FIXED |

**Arquitectura de la solución**: Las recetas DeepSeek fluyen desde `generar-plan-inicial/route.ts:463-490` (donde se construye `distribucion_comidas[].recetas`) hasta el frontend que las lee del `respuesta_json` persistido en `registros_ia`. El fix asegura que en todos los puntos (persistencia en BD + UI preview + creación de plan) se usen las recetas reales de DeepSeek.

**Archivos modificados** (22-05-2026):
- [`app/clientes/[id]/revisar-plan/page.tsx`](app/clientes/[id]/revisar-plan/page.tsx) — Interfaz + lógica + UI (~+90 líneas)
- [`app/clientes/[id]/revisar-rapido/page.tsx`](app/clientes/[id]/revisar-rapido/page.tsx) — Interfaz + UI (~+30 líneas)

---

### ✅ SESIÓN 22-05-2026 (tarde) — FIX: Buscadores mostraban contactos del móvil 📱

**Bug**: Al escribir en cualquier buscador de la app (recetas, dietas, entrenos, alimentos), Safari/Chrome en iOS mostraba la agenda de contactos en lugar de sugerencias de búsqueda.

**Causa raíz**: Los `<input>` de búsqueda no tenían el atributo `autoComplete="off"`. Los navegadores móviles detectan placeholders como "Buscar por nombre…" y asumen que es un campo de contacto, mostrando la agenda del teléfono.

**Fix**: Añadir `autoComplete="off"` a todos los inputs de búsqueda (6 archivos):

| Archivo | Línea | Input |
|---------|-------|-------|
| [`app/recetas/page.tsx`](app/recetas/page.tsx:335) | Buscador principal de recetas |
| [`app/entrenos/page.tsx`](app/entrenos/page.tsx:130) | Buscador de planes de entreno |
| [`app/dietas/page.tsx`](app/dietas/page.tsx:67) | Buscador de dietas |
| [`app/dietas/alimentos/page.tsx`](app/dietas/alimentos/page.tsx:425) | Buscador de alimentos (OFF) |
| [`app/recetas/nueva/page.tsx`](app/recetas/nueva/page.tsx:262) | Buscador de ingredientes al crear receta |
| [`app/recetas/[id]/editar/page.tsx`](app/recetas/[id]/editar/page.tsx:463) | Buscador de ingredientes al editar receta |

**Fix adicional**: Dropdown de sugerencias de tags en [`app/recetas/page.tsx`](app/recetas/page.tsx:338) se cortaba — añadido `minWidth: 260px` al contenedor, `min-w-0` + `truncate max-w-[180px]` al chip del tag.

**Archivos modificados** (22-05-2026 tarde):
- `app/recetas/page.tsx` — `autoComplete="off"` + fix visual dropdown tags
- `app/entrenos/page.tsx` — `autoComplete="off"`
- `app/dietas/page.tsx` — `autoComplete="off"`
- `app/dietas/alimentos/page.tsx` — `autoComplete="off"`
- `app/recetas/nueva/page.tsx` — `autoComplete="off"`
- `app/recetas/[id]/editar/page.tsx` — `autoComplete="off"`

**Lección aprendida**: Todos los `<input>` con placeholder que incluya "nombre" o "buscar" deben llevar `autoComplete="off"` para evitar que Safari/Chrome móvil los confunda con campos de contacto.

---

### ✅ SESIÓN 23-05-2026 — Auditoría Ingredientes Recetario + Fix 12 Bugs 🐛🔴

**Auditoría completa de ingredientes mal vinculados en el recetario.** Se detectaron 12 bugs en 4 recetas + 1 ingrediente huérfano.

| # | Gravedad | Receta | Ingrediente | Problema | Fix |
|---|----------|--------|-------------|----------|-----|
| 1 | 🔴 CRÍTICO | Tarta de chocolate fundente | `huevos 200g` | Vinculado a "Huevos cocidos" en vez de "Huevo entero" | Re-vinculado a [`Huevo entero`](seed_alimentos.sql) |
| 2 | 🔴 CRÍTICO | Brownie de 3 chocolates | `huevo 55g` | Vinculado a "Huevos cocidos" | Re-vinculado a `Huevo entero` |
| 3 | 🔴 CRÍTICO | Shakshuka de piquillos asados | `huevos 200g` | Vinculado a "Huevos cocidos" | Re-vinculado a `Huevo entero` |
| 4 | 🔴 CRÍTICO | Revuelto cremoso de espárragos | `huevo 150g` | Vinculado a "Huevos cocidos" | Re-vinculado a `Huevo entero` |
| 5 | 🔴 CRÍTICO | Brownie de 3 chocolates | `Chocolate negro 70%` | Vinculado a "Fresas Chocolate Blanco Chocolate Negro" | Re-vinculado a [`Chocolate negro 85%`](seed_alimentos.sql) (598 kcal, 12.50 €/kg Consum) |
| 6 | 🟠 GRAVE | Brownie de 3 chocolates | `Chocolate con leche (decorar)` | Vinculado a "Leche líquida entera" | Re-vinculado a [`Chocolate con leche Milka`](seed_alimentos.sql) (540 kcal, 2 precios supermercado) |
| 7 | 🟠 GRAVE | Brownie de 3 chocolates | `Chocolate blanco` | Vinculado a "Fresas Chocolate producto" | Re-vinculado a [`Chocolate Blanco Postres`](seed_alimentos.sql) (540 kcal, 11.25 €/kg Consum) |
| 8 | 🟠 GRAVE | Brownie de 3 chocolates | `Chocolate blanco 50g (base)` | Vinculado a "Fresas Chocolate Blanco Chocolate Negro" | Re-vinculado a `Chocolate Blanco Postres` |
| 9 | 🟡 MEDIO | Dátiles rellenos de almendra y chocolate negro | `dátil medjool 60g` | `alimento_id = null` (huérfano, sin kcal ni precio) | Vinculado a [`Dátiles medjool`](seed_alimentos.sql) (277 kcal, precio ref. 19.07 €/kg creado) |
| 10 | 🟡 MEDIO | Brownie de 3 chocolates | `harina de avena 45g` | `alimento_id = null` (huérfano) | Vinculado a [`Harina de avena`](seed_alimentos.sql) |
| 11 | 🟠 GRAVE | Dulce de Leche Saludable | `Leche semidesnatada` | Vinculado a "Leche entera" | Re-vinculado a [`Leche semidesnatada`](seed_alimentos.sql) |
| 12 | 🟠 GRAVE | Dulce de Leche Saludable | `Leche desnatada` | Vinculado a "Leche entera" | Re-vinculado a [`Leche desnatada`](seed_alimentos.sql) |

**Script**: [`scripts/fix-bugs-recetario-v2.mjs`](scripts/fix-bugs-recetario-v2.mjs) — idempotente, usa `findAlimento()` dinámico via `ilike` search en runtime, modo `--dry-run` y `--apply`.

**Ejecución**: `node scripts/fix-bugs-recetario-v2.mjs --apply` ✅ — 12/12 bugs corregidos exitosamente.

**Verificación post-fix**: Todos los ingredientes corregidos muestran kcal correctas y vinculación a precios de supermercado. Para Dátiles medjool se creó precio referencia coach a 19.07 €/kg basado en "Dátiles Medjoul con hueso" de Mercadona (3.99 €/209g).

**⚠️ Lección aprendida — Siempre revisar sistemas existentes antes de crear soluciones desde cero**:
- El sistema de precios (`mejores_precios_por_alimento`, `Precio referencia coach`, `AdminPrecios.tsx`) ya existía pero NO se consultó. Se asumió incorrectamente que no había infraestructura para asignar precios a alimentos raros.
- **REGLAS para próximas sesiones**:
  1. Antes de crear código nuevo, revisar `CLAUDE.md`, `ESTADO_Y_PROXIMOS_PASOS.md`, `DIAGNOSTICO_FALLOS.md` y archivos SQL de schema para entender sistemas existentes
  2. Verificar existencia de vistas, funciones y tablas relacionadas en Supabase antes de diseñar soluciones
  3. Consultar componentes UI existentes (`AdminPrecios.tsx`, `EscandalloReceta.tsx`) antes de crear nuevos flujos de gestión
  4. Ejecutar `--dry-run` siempre antes de `--apply` en scripts de modificación masiva

---

---

### ✅ SESIÓN 23-05-2026 — Auditoría completa de recetario (12 anomalías) + FALLO #24 🕵️

**Auditoría exhaustiva** de toda la BD: 353 recetas, 2.569 ingredientes, 13.349 alimentos. 12 tipos de anomalías analizadas.

**Hallazgos reales vs falsos positivos**:

| Código | Tipo | Hallazgos | ¿Real? | Acción |
|--------|------|-----------|--------|--------|
| F01+F06 | Receta duplicada vacía (Solomillo pistachos, 0 ingredientes) | 1 | ✅ Real | Eliminada |
| F02+F12 | Alimentos duplicados por acento (sin tilde → 0kcal) | 133 | ✅ Real | Macros copiados |
| F03 | Valores imposibles (kcal>2000, prot>100) | 45 | ✅ Real (aceites/especias) | Bajo impacto |
| F04 | Macros incompletos | 113 | ⚠️ Bajo | Diferido |
| F05 | Recetas sin tags/categoría | 220/104 | ⚠️ Cosméticos | Diferido |
| F09 | Macros incoherentes | 275 | **❌ FALSO POSITIVO** | Bug en script |
| F10 | Alimentos con nombre de receta | 1.046 | ❌ Ruido (supermercado) | 0 usados en recetas |
| F11 | Ingrediente duplicado (aceite oliva x2) | 2 | ✅ Real | Fusionado 30+60=90g |
| F12 | Mismo nombre, macros distintos | 25 | ⚠️ 1 corregible | Litines Caja ✅ |

**Scripts creados**:
- [`scripts/auditar-recetario-completo.mjs`](scripts/auditar-recetario-completo.mjs) — Auditoría 12 anomalías, paginación 1000, `norm()` para normalizar nombres
- [`scripts/fix-hallazgos-auditoria.mjs`](scripts/fix-hallazgos-auditoria.mjs) — 3 fixes: receta duplicada, 133 acentos, aceite duplicado
- [`scripts/auditar-y-corregir-f09-f12.mjs`](scripts/auditar-y-corregir-f09-f12.mjs) — Fix F09 (división por porciones) + F12 (Litines Caja)

**Documentación**: [`DIAGNOSTICO_FALLOS.md`](DIAGNOSTICO_FALLOS.md) — FALLO #23 (fase 1) y FALLO #24 (fase 2 auditoría completa)

---

## 🧠 LECCIONES APRENDIDAS — Auditoría de datos (23-05-2026)

### 📌 Conocimiento crítico del schema
1. **`recetas.kcal` es POR RACIÓN, no total**. Si comparas suma de ingredientes (total receta) vs `recetas.kcal`, obtienes falsos positivos. Siempre dividir por `recetas.porciones` antes de comparar. Verificado con "Cookies de mantequilla tostada": 72.69 kcal × 32 porciones = 2.326 ≈ suma ingredientes ✅
2. **Columnas de `recetas`**: `kcal`, `proteinas`, `carbohidratos`, `grasas`, `porciones` (NO `calorias`, NO `raciones`)
3. **Columnas de `alimentos`**: `calorias`, `proteinas`, `carbohidratos`, `grasas` (por 100g)
4. **`receta_ingredientes`**: `alimento_id`, `nombre_libre`, `cantidad_gramos`

### 📌 Patrones técnicos probados
1. **Paginación Supabase (>1000 rows)**: Usar `pag(table, select, filters, pageSize)` con `.range(from, from+pageSize-1)`. El SDK de Supabase lanza 416 si pides `range(0, 999)` cuando solo hay 500 rows — eso no es error, es que `data.length < pageSize` → break.
2. **Normalización de nombres**: `norm(str)` = `.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')` → quita acentos. Útil para detectar duplicados.
3. **Detección de duplicados por acento**: Si dos alimentos tienen el mismo `norm(nombre)` pero distinto nombre exacto, y uno tiene `calorias=0` mientras el otro tiene macros reales, la variante sin acento es un error de importación.
4. **Dry-run siempre**: Todo script de modificación masiva debe tener `DRY = !process.argv.includes('--apply')` por defecto.
5. **Carga de .env.local**: Leer línea por línea, parsear `clave=valor`, quitar comillas. `createClient()` con `{ auth: { persistSession: false } }` para scripts.

### 📌 Fallos conocidos y cómo evitarlos
1. **Scraper sin normalizar acentos**: El scraper de alimentos importó productos sin normalizar. Cuando se añadió normalización, se crearon duplicados. **Solución**: Antes de insertar, `norm()` el nombre y verificar si ya existe variante.
2. **Recetas huérfanas**: La generación masiva crea registro en `recetas` pero a veces no llena `receta_ingredientes`. **Solución**: Trigger/scheduled check `SELECT r.id FROM recetas r LEFT JOIN receta_ingredientes ri ON ri.receta_id = r.id WHERE ri.id IS NULL`.
3. **Ingrediente fantasma (IA alucina)**: La IA lista ingredientes en cabecera que no aparecen en instrucciones. **Solución**: Cross-check nombre_libre vs pasos de elaboración.
4. **Mal match de ingredientes**: Alimentos con nombre de receta (ej: "Espaguetis Bolonesa") vinculados como ingredientes base. **Solución**: Blacklist de palabras recetáceas.

### 📌 Scripts de diagnóstico disponibles
| Script | Qué hace | Última ejecución |
|--------|----------|-----------------|
| [`scripts/auditar-recetario-completo.mjs`](scripts/auditar-recetario-completo.mjs) | 12 anomalías en recetas+alimentos | 23-05-2026 |
| [`scripts/fix-hallazgos-auditoria.mjs`](scripts/fix-hallazgos-auditoria.mjs) | Corrige hallazgos reales | 23-05-2026 |
| [`scripts/auditar-y-corregir-f09-f12.mjs`](scripts/auditar-y-corregir-f09-f12.mjs) | F09 corregido + F12 investigación | 23-05-2026 |
| [`scripts/diagnosticar-recetas-fallos.mjs`](scripts/diagnosticar-recetas-fallos.mjs) | 4 tipos de fallos (fase 1) | 23-05-2026 |
| [`scripts/fix-fallos-recetas.mjs`](scripts/fix-fallos-recetas.mjs) | Fase 1 fixes | 23-05-2026 |

### 📌 Outputs de diagnóstico guardados
| Archivo | Contenido |
|---------|-----------|
| [`salidas/auditoria-recetario-2026-05-23.json`](salidas/auditoria-recetario-2026-05-23.json) | Auditoría completa 12 anomalías |
| [`salidas/auditoria-f09-f12-2026-05-23.json`](salidas/auditoria-f09-f12-2026-05-23.json) | F09+F12 corregido |
| [`salidas/diagnostico-recetas-fallos.json`](salidas/diagnostico-recetas-fallos.json) | Fase 1 diagnóstico |
| [`salidas/fix-fallos-2026-05-23.json`](salidas/fix-fallos-2026-05-23.json) | Fase 1 fixes aplicados |

### 📌 Qué NO hacer
1. **NO** asumir que `kcal` en recetas es total — siempre verificar si es por ración consultando la columna `porciones`.
2. **NO** ejecutar scripts de IA/scraping sin preguntar antes.
3. **NO** re-crear sistemas que ya existen (precios, tags, etc.) — revisar CLAUDE.md y componentes existentes primero.
4. **NO** modificar BD en producción sin `--dry-run` primero.

---

## 14. ✅ 23-05-2026 — 13.385 alimentos con micronutrientes completos (100%)

### Estado final

| Métrica | Valor |
|---------|-------|
| Total alimentos | 13,385 |
| Con micronutrientes | 13,385 (**100%**) |
| Sin micronutrientes | **0** |
| Alimentos en recetas | Todos disponibles con perfil completo |

### Script clave

[`scripts/enriquecer-masivo-tanda3.ts`](scripts/enriquecer-masivo-tanda3.ts) — Procesa 5 alimentos por llamada DeepSeek, recibe respuesta en array JSON `[{index, vitamina_a_ug, ...}]`, mapea cada uno a su fila en BD.

### Estrategia

1. **Tanda 1** (prototipo): [`enriquecer-segunda-pasada.ts`](scripts/enriquecer-segunda-pasada.ts) — 25 alimentos individuales vía DeepSeek
2. **Tanda 2 — Run 1**: [`enriquecer-masivo-tanda3.ts`](scripts/enriquecer-masivo-tanda3.ts) — ~1,000 alimentos en 200 batches de 5 → cobertura 94.2%
3. **Tanda 2 — Run 2**: Mismo script — ~783 alimentos restantes en 157 batches de 5 → **100%**

### Fallback cascade

1. Batch (5 alimentos, temp 0.2)
2. Reintento batch (temp 0.5, 2º intento)
3. Procesamiento individual (1 alimento/llamada)
- **Resultado: 0 errores** en ~357 llamadas combinadas

### 24 campos poblados por alimento

| Categoría | Campos |
|-----------|--------|
| Vitaminas | `vitamina_a_ug`, `vitamina_c_mg`, `vitamina_d_ug`, `vitamina_e_mg`, `vitamina_k_ug`, `vitamina_b6_mg`, `vitamina_b12_ug`, `tiamina_mg`, `riboflavina_mg`, `niacina_mg`, `folato_ug` |
| Minerales | `calcio_mg`, `hierro_mg`, `magnesio_mg`, `fosforo_mg`, `potasio_mg`, `sodio_mg`, `zinc_mg`, `cobre_mg`, `selenio_ug` |
| Perfil lipídico | `saturados_g`, `monoinsaturados_g`, `poliinsaturados_g`, `colesterol_mg` |

### Columnas que NO existen en la tabla

NO usar nunca: `acido_folico_ug`, `acido_pantotenico_mg`, `biotina_ug`, `manganeso_mg`, `fibra_g`, `agua_g`, `azucar_g`, `azucares_anadidos_g`.

### Para alimentos nuevos

Usar [`lib/deepseek.ts`](lib/deepseek.ts:607) → `completarAlimentoConIA()` para poblar micros de un solo alimento. NO volver a ejecutar enriquecimiento masivo.

---

## 🏷️ Corrección masiva de categorías (23-05-2026)

Se ejecutó [`supabase/migrations/fix_categorias_masivo_v2.sql`](supabase/migrations/fix_categorias_masivo_v2.sql) contra producción.

### Problema raíz
[`lib/scraping/categorizador.ts`](lib/scraping/categorizador.ts:308) usa `CATEGORIAS_POR_KEYWORD` con regex `\bkeyword\b`. Cualquier alimento cuyo nombre contuviera "anchoa", "papa", "sal", "aceituna", etc. se colaba en la categoría incorrecta.

### Lo que se hizo
1. **B0**: Aceitunas de Pescados → Condimentos
2. **B1**: Categorías no alimenticias → `es_comestible = false`
3. **B2**: ~350+ alimentos re-categorizados a categorías nutricionales correctas
4. **B3**: Categorías inválidas sin mapear → `es_comestible = false`
5. **B4**: Supermercado: re-categorizar por keyword + marcar sin kcal → 0 registros restantes

### Frontend
- [`app/dietas/alimentos/page.tsx`](app/dietas/alimentos/page.tsx:160): constante `CATEGORIAS_ALFABETICO` para desplegables en orden alfabético

### Si se añaden alimentos nuevos
El categorizador automático puede colocar en categorías incorrectas si el nombre coincide con keywords de otra categoría. Revisar manualmente.

---

## 🔀 Historial de Worktrees — Ya unificados en main
