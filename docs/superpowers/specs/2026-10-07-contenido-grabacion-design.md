# Contenido: ideas, tandas de grabación y publicación

Fecha: 07-10-2026 · Estado: borrador pendiente de revisión de Carlos

## Objetivo

Carlos usa NutriCoach para ordenar su propia dieta y entreno (es su propio cliente de prueba) y para hacer crecer su cuenta de Instagram. Necesita:

- Tener las recetas correctas en el recetario, para comprar bien y cocinar.
- Elegir cada semana varias recetas del recetario (muchas coincidirán con su dieta de la semana), agruparlas en un día de grabación y saber qué comprar.
- Apuntar ideas nuevas (vistas en Instagram o TikTok, o suyas) y seguirlas hasta publicarlas.

Éxito: abrir un día de grabación y ver sus recetas, la compra consolidada y el orden de cocinado; y ver de un vistazo qué hay grabado y sin publicar.

## Alcance

Herramienta del coach. No aparece en el portal cliente. Apartado propio **Contenido** en el menú del coach, independiente de cualquier cliente. El vínculo con la dieta es opcional por pieza.

Fuera de la primera versión: conexión directa con Instagram, guion o shot list, métricas de publicaciones.

## Principios

- **El recetario es el único sitio donde viven las recetas.** Contenido solo organiza qué grabar y cuándo; no duplica recetas.
- Una idea con enlace entra al recetario por el camino actual (Content Radar → `BridgeNutriCoach`), sin camino nuevo.
- Una idea solo con nota no crea receta; se convierte en receta por el flujo normal al documentarla.
- Nada en Contenido depende de que Content Radar funcione. Si falla la extracción, la idea queda como nota con su enlace.

## Modelo de datos

Tabla nueva `piezas_contenido`, fuente de verdad del estado de contenido:

- `id`, `coach_id`
- `receta_id` (opcional, referencia a `recetas`)
- `plan_id` (opcional, referencia a `planes_nutricion`: "entra en la dieta de…", Carlos por defecto)
- `titulo`, `enlace_referencia`, `notas`
- `estado`: `idea` → `documentada` → `para_grabar` → `grabada` → `editada` → `programada` → `publicada`
- `fecha_grabacion`, `fecha_publicacion`
- `created_at`, `updated_at`

Reglas:

- Una receta puede tener varias piezas (reel, carrusel, regrabación).
- RLS activado y acceso solo con service role; toda ruta verifica sesión y rol coach (mismo patrón que `comidas_planificadas`).
- La migración copia a piezas las recetas con `recetas.contenido_estado` (`para_grabar` → `para_grabar`, `grabada` → `grabada`).
- `recetas.contenido_estado` se mantiene sin tocar en esta fase; se retira más adelante.

## Pantallas

### Día de grabación (prioridad)

- Se elige un día y las recetas de la tanda (desde piezas en `para_grabar`, desde el tablero o desde "mi dieta de la semana").
- **Desde mi dieta de la semana:** selector que lista las recetas de la semana del plan de Carlos (comidas actuales y `comidas_planificadas`) para añadirlas a la tanda de un clic.
- **Compra consolidada** de la tanda: ingredientes agregados por alimento, agrupados por categoría, con las recetas que los usan, coste por supermercado y marca "ya lo tengo".
- **Orden de cocinado** sugerido según el tiempo de preparación de cada receta (lo más largo o con horno/reposo primero).
- **Resumen:** tiempo total, número de recetas y cuántas entran en la dieta esa semana.
- **"Colocar en mi dieta":** reparte las recetas de la tanda en las comidas del día de grabación y siguientes, usando `comidas_planificadas`.

### Bandeja de ideas

- Entrada rápida: enlace, nota o ambos (pensada para móvil).
- Con enlace: se lanza Content Radar; si extrae, la pieza se enlaza a la receta creada. Si falla, queda como nota con el enlace.
- Cada idea muestra qué le falta (sin extraer, sin ingredientes, sin macros).
- Paso a `documentada` cuando la receta enlazada está completa y verificada.

### Tablero

Columnas por estado, tarjetas arrastrables con la foto de la receta. Filtros: entra en dieta / plato de prueba.

### Calendario semanal

Días de grabación y de publicación, con dieta y entreno en pequeño para evitar tandas en días de competición o doble sesión.

## Código

- `lib/contenido/`: estados y transiciones, cálculo de tanda (orden de cocinado, resumen).
- `lib/lista-compra/`: extraer `agregarIngredientes` de `app/api/lista-compra/semanal/route.ts` para compartirla. La ruta semanal importa la función sin cambiar su comportamiento. La tanda la alimenta con recetas (`receta_ingredientes` × porciones) en lugar de un plan.
- `app/api/contenido/...`: piezas, tanda, colocar en dieta.
- `app/contenido/...`: las pantallas; nueva entrada en `components/Sidebar.tsx`.
- `components/clientes/SemanaDietaPlanner.tsx`: el icono de vídeo escribe en piezas.

## Orden de construcción (cada paso desplegable)

1. Migración, estados, API de piezas y vínculo del icono del planificador.
2. Bandeja de ideas con entrada rápida.
3. Día de grabación: compra consolidada, orden de cocinado, "desde mi dieta".
4. Colocar la tanda en la dieta.
5. Tablero y calendario.

## Pruebas

- Unitarias: transiciones de estado, orden de cocinado, agregación de compra de varias recetas.
- Verificación contra Supabase real con service role (RLS puede devolver listas vacías sin error).
- Prueba en producción con recetas reales de Carlos.
- La migración SQL se aplica con confirmación de Carlos; no se aplica sola al hacer push.

## Riesgos

- El puente Content Radar → NutriCoach no se ha probado con datos reales (pendiente #1). Mitigado: Contenido no depende de la extracción.
- Los dos mecanismos de estado (`contenido_estado` y piezas) conviven un tiempo; el planificador pasa a escribir solo en piezas para evitar divergencia.
