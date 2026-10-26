# Recetario con capas, elaboraciones y técnicas (diseño)

Fecha: 26-10-2026 · Estado: **borrador pendiente de aprobación de Carlos**
Relacionado: `2026-10-26-elaboraciones-design.md` (fases 1 y 2 ya construidas: elaboraciones como categorías y como ingrediente enlazado).

## Por qué

Carlos es cocinero y quiere que el recetario sea también su **archivo de cocina**: recetas, elaboraciones base (panes, salsas, fondos, mantequillas compuestas, fermentos…) y **técnicas** (nixtamalización, curado de yema, emulsiones…), con la profundidad de un libro tipo *Modernist Cuisine*, accesible desde cualquier sitio. A la vez, el recetario es producto para clientes de nutrición, que no necesitan ese nivel de detalle.

Hoy el campo `categoria` mezcla «cuándo se come» (Desayuno, Comida…) con «qué es» (Salsa, Condimento…), la cola de revisión tiene 55 fichas de cocina de estudio mal catalogadas (Mantequilla Café de París como Snack/bebida, Brioche como Desayuno, Hollandaise como Comida) y no hay sitio para una técnica.

## Estado actual (26-10-2026)

- `recetas` (719 sin descartadas: 664 aprobadas, 55 en revisión). `categoria` = momento para platos; para las 14 elaboraciones, `Elaboración base` · `Salsa` · `Condimento`, con `tipo_receta='salsa_base'`. Una receta puede llevar una elaboración como ingrediente (`receta_ingredientes.elaboracion_id`, `recetas.peso_final_g`).
- Recetario del cliente (`RecetarioExplorador`) y Biblioteca del coach: tarjetas con foto, chips de categoría en texto mono, filtros, ficha con pestañas Ingredientes / Preparación.
- Constraints de BD: `recetas_tipo_plato_check` (solo Desayuno…Postre) y `recetas_tipo_receta_check` (completa, guarnicion, salsa_base, snack_postre, bebida, desayuno).

## Objetivos

1. **Un solo recetario visual**, el de ahora (tarjetas, chips, filtros), con un selector de **tipo**: Platos · Elaboraciones · Técnicas · Todo. Cada tipo tiene sus **familias** como chips.
2. **Capas de profundidad** dentro de la ficha: Ingredientes · Preparación (lo de hoy) → **Estudio** → **Técnica**.
3. **Dos públicos:** Carlos y otros chefs ven todo; el cliente normal ve Platos y Elaboraciones (las elaboraciones sirven para usarlas en sus recetas) con las dos primeras capas; Técnicas y las capas Estudio/Técnica quedan ocultas salvo que el coach active el **acceso profesional** de ese cliente.
4. **Clasificación pensada y automática:** cada ficha nueva (reel de Content Radar, web, manual) cae en su tipo y familia; la cola de revisión actual se reclasifica con propuesta y revisión de Carlos.
5. Las técnicas se **enlazan** con las recetas y elaboraciones que las usan («usa» y «se usa en»).

## No objetivos

- No una app aparte ni un diseño visual nuevo: se reutiliza el estilo editorial del recetario (rótulos mono, sin cajas de colores).
- No macros ni planificación para técnicas; no entran en dietas ni en la lista de la compra.
- No importar libros enteros ni contenido con derechos: las técnicas las escribe/ingiere Carlos de sus fuentes (reels, apuntes, libros propios en sus palabras).
- No tocar el planificador de dietas: sigue viendo solo platos.

## Anti-objetivos

- Que un cliente normal vea fichas de técnica o datos profesionales por error.
- Que una elaboración o una técnica entre en un plan de dieta o en una sugerencia como si fuera un plato.
- Que se pierdan los datos o los enlaces de las 664 recetas aprobadas al reclasificar.

## Diseño

### Modelo de datos

*(Decisiones mías, marcadas; Carlos las revisa.)*

- **`recetas.tipo_contenido`** (`'plato'` | `'elaboracion'`, no nulo, por defecto `'plato'`): fuente de verdad del tipo. Las 14 elaboraciones actuales y las que Carlos apruebe como tales pasan a `'elaboracion'`. `tipo_receta='salsa_base'` se mantiene como marca interna para el planificador (se rellena a la vez), así que nada existente se rompe.
- **`recetas.familia`** (texto, lista cerrada por tipo en `lib/recetas-constants.ts`): *Platos:* Entrantes · Sopas y cremas · Verduras y ensaladas · Arroces y cereales · Pastas · Carnes · Pescados · Huevos · Bocadillos y bowls · Desayunos y meriendas · Postres · Guarniciones. *Elaboraciones:* Panes y masas · Salsas · Condimentos y mezclas · Fondos y caldos · Grasas aromáticas · Mantequillas compuestas · Cremas y rellenos · Fermentos y curados. `categoria` sigue siendo «cuándo se come» para platos (la usa el planificador); en elaboraciones queda con el valor único `Elaboración` y la familia ocupa su lugar. Los chips de categoría de la fase 1 (Elaboración base · Salsa · Condimento) se sustituyen por familias.
- **`recetas.estudio`** (jsonb, opcional): capa Estudio. Claves: `rendimiento {cantidad, unidad}`, `tiempo_activo_min`, `tiempo_total_min`, `mise_en_place`, `porcionado`, `conservacion {ambiente_h, nevera_dias, congelador_meses, notas}`, `variantes`, `origen` (cocina/país), `nivel`, `equipo`. Los campos que ya existen como columna (`tiempo_prep_min`, `dificultad`, `peso_final_g`) no se duplican. Coste y alérgenos salen de lo ya calculado.
- **Tabla `tecnicas`** (aparte de `recetas`; *mi decisión*: una técnica no tiene ingredientes ni macros y `recetas` está cableada a ambos en ~200 puntos): `id, coach_id, nombre, familia, descripcion, principio, parametros (jsonb: temperatura, tiempo_activo_min, tiempo_total_min, proporciones, nivel, equipo), pasos, errores_tipicos, variantes, seguridad, origen, imagen_url, url_origen, autor_original, estado (en_revision|aprobada|descartada), tags, created_at`. Familias: Calor y cocción · Cortes · Emulsiones, espumas y geles · Masas y panificación · Fermentación y curado · Baja temperatura y vacío · Ahumado · Conservación · Pastelería base · Maíz y cereales.
- **Enlaces:** `receta_tecnicas (receta_id, tecnica_id, orden)` y `tecnica_tecnicas` solo si hace falta más adelante. «Usa» y «Se usa en» se leen de aquí.
- **Acceso profesional:** `clientes.acceso_profesional boolean not null default false` (mismo patrón que `ver_video_recetas`). Los usuarios con rol coach siempre ven todo.

### Interfaz

- **Selector de tipo** sobre los chips: `PLATOS · ELABORACIONES · TÉCNICAS · TODO`. Los chips de familia cambian con el tipo. Por defecto Platos (en cliente sin acceso profesional no aparece «Técnicas» ni «Todo»; sí «Elaboraciones»).
- **Tarjetas** como hoy; el dato secundario depende del tipo: kcal (plato), rendimiento + conservación (elaboración), nivel + tiempo (técnica).
- **Ficha:** pestañas `Ingredientes · Preparación · Estudio · Técnica`. Estudio y Técnica solo con acceso profesional/coach. Una ficha de técnica tiene sus propias capas (Principio · Paso a paso · Parámetros · Errores · Variantes · Se usa en).
- **Cola de revisión:** los tres tipos entran por la misma cola «Por revisar», con etiqueta de tipo. Convertir una ficha de tipo se hace desde el editor (cambiar «Tipo»/«Familia»).
- **Búsqueda única** que cubre los tres tipos (con sinónimos y sin tildes, como hoy); «Todo» muestra una etiqueta de tipo en cada tarjeta.

### Entrada y clasificación

- **Content Radar y webs:** el clasificador (palabras clave + extractor de IA) devuelve tipo y familia; elaboraciones y técnicas entran siempre en revisión. Los reels que enseñan un procedimiento sin receta cerrada (p. ej. nixtamalización) se proponen como técnica.
- **Reclasificar lo existente:** script con simulación y copia que **propone** tipo y familia para las 55 de la cola y las 14 elaboraciones, y las candidatas entre las 664 aprobadas (sin tocarlas hasta que Carlos las revise).

### Fases (planes aparte)

1. **Modelo y recetario:** `tipo_contenido`, `familia`, selector de tipo y chips por familia (coach y cliente), reclasificación de la cola. *Es lo urgente: desbloquea las 55 de la cola.*
2. **Capa Estudio** (`estudio` jsonb, editor, ficha, escalado de cantidades).
3. **Técnicas:** tabla, editor, ficha, enlaces, ingesta desde Radar.
4. **Acceso profesional** por cliente (ajuste en la ficha del cliente, filtrado en todas las lecturas).
5. **Pendientes ya anotados:** alérgenos/Halal por elaboración, enlazar recetas existentes a elaboraciones.

## Decisiones mías (a revisar)

1. Técnicas en tabla aparte; elaboraciones en `recetas`.
2. Tipo y familia como dos columnas nuevas; `categoria` sigue siendo el momento del día para platos.
3. Capa Estudio como un jsonb, no una docena de columnas.
4. El cliente normal ve elaboraciones pero no técnicas ni capas profesionales; el coach lo activa por cliente.
5. Fase 1 primero, porque la cola de revisión lo necesita ya.

## Pendiente del builder

- Lista de familias definitiva y sinónimos para el clasificador (parte de ella la afinará Carlos al revisar la cola).
- Cómo migrar los chips de la fase 1 sin romper las URLs `?cat=` guardadas (redirigir a tipo/familia).
- Si «Todo» incluye técnicas en el buscador del cliente con acceso profesional.
