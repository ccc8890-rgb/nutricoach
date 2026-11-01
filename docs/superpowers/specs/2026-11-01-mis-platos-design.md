# Mis platos — platos propios del cliente con foto (diseño)

Fecha: 01-11-2026 · Origen: conversación con Carlos tras estudiar apps del sector (Trainerize, Everfit, Nutrium…).

## Intención y por qué

El cliente come cada día platos que no están en el recetario. Hoy el coach no los ve y no puede cuadrarlos con la dieta. Con «Mis platos» el cliente hace una foto de lo que come habitualmente, la IA propone nombre, ingredientes con gramos, pasos y kcal/macros, y el cliente lo retoca. El coach lo revisa a fondo, ajusta cantidades y, si le sirve, lo usa en la dieta de ese cliente. Así el plan se construye sobre lo que el cliente realmente come y le gusta.

Carlos es el primer cliente de prueba (usa sus propios platos de diario).

## Objetivos

- El cliente hace foto → recibe de inmediato una ficha completa **marcada «estimado»** (como las apps de foto y macros) y puede **editarla** antes de enviarla.
- El coach recibe una bandeja de platos pendientes, corrige y aprueba (o devuelve con nota).
- El plato aprobado aparece en **«En tu plan»** y en el **recetario del cliente** con una marca «Mi plato». Solo lo ven ese cliente y su coach.
- Foto original siempre guardada; una versión «limpia» con IA es opcional y se muestra al lado.
- El coach puede meter el plato en la dieta del cliente con la ración ajustada.

## No-objetivos (esta fase)

- Pasar el plato al recetario general o a otros clientes (fase 2: botón «Pasar al recetario general» que copia a `recetas` en `en_revision`).
- Modo «solo calcular» sin revisión del coach (fase 3, si el sistema demuestra ser fiable).
- Diario de comidas por foto (registrar lo que se come cada día). Esto es una biblioteca de platos habituales, no un registro diario.

## Anti-objetivos (sería un fracaso aunque funcione)

- **Que un plato de un cliente sea visible para otro cliente o aparezca en el recetario, buscador o planificador general.**
- Que la IA presente cifras como definitivas. Hasta que el coach apruebe, todo es «estimado».
- Que la foto limpia con IA sustituya o deforme el plato (no se retoca desde cero ni se inventan elementos; si el resultado es dudoso se muestra la original).
- Que un plato sin aprobar entre en la dieta o en el cálculo de macros del plan.

## Decisiones de Carlos

- Revisión del coach **obligatoria antes** de entrar en dieta/recetario (de momento).
- El cliente ve la ficha completa estimada desde el primer momento, y puede retocarla.
- Ubicación: dentro de «En tu plan» y en el recetario del cliente, con marca identificativa; visibilidad solo para ese cliente y su coach.
- Si al coach le gusta, más adelante puede pasarlo al recetario general o a otros clientes.

## Decisiones mías (a confirmar al leer)

1. **Tabla propia, no `recetas`.** El recetario filtra por `estado='aprobada'` en decenas de rutas con service role y sin noción de propietario (`recetario`, `sugeridas`, planificador, compra…). Meter platos privados ahí arriesga fugas. Se crean `platos_cliente` y `platos_cliente_ingredientes` (mismos nombres de campos que `receta_ingredientes`: `alimento_id`, `nombre_libre`, `cantidad_g`), y las vistas del cliente los mezclan explícitamente. La fase 2 copia a `recetas`.
2. Estados: `borrador` (cliente editando) → `pendiente` (enviado) → `aprobado` | `devuelto` (con nota del coach).
3. Visión para detectar plato/ingredientes: tarea nueva `plato_foto` en el enrutador de IA (`lib/ia/enrutador.ts`), Claude Sonnet primero, GPT de respaldo (ambos con visión). Salida JSON validada; los ingredientes se enlazan a `alimentos` con el matcher existente y las macros se calculan desde ahí (no las inventa el modelo).
4. Foto limpia: opcional, con el modelo de imágenes de OpenAI, **que hoy no tiene saldo**. Hasta recargar, solo se guarda la original y la función funciona sin la limpia. Foto original en Cloudinary (carpeta propia), como las fotos de progreso.
5. Límites: máx. N análisis por cliente y día (valor inicial: 10) para controlar coste.
6. Rutas con comprobación de propiedad (`autorizarAccesoPlan` / coach del cliente), 401 sin sesión, y test que falle si alguna lectura de platos no filtra por `cliente_id`.
7. Las kcal/macros de un plato **no aprobado** nunca suman en el plan, la compra ni el cálculo de la dieta.

## Pantallas (borrador, ver maquetas en `.superpowers/brainstorm/`)

- Cliente: botón «Añadir mi plato» (cámara/galería, nota, tipo de comida) → ficha estimada editable (nombre, ingredientes con gramos, pasos, foto original/limpia) → «Enviar al coach». Lista con estados.
- Cliente: aprobados en «En tu plan» y recetario, con marca «Mi plato».
- Coach: bandeja «Platos del cliente» dentro de la cola de revisión del recetario, y lista por cliente en su ficha. Editar gramos, ver macros reales y encaje con el objetivo, aprobar / devolver con nota / «Añadir a su dieta».

## Qué se deja al constructor

Estilo visual (sistema editorial actual), nombres exactos de rutas, esquema de prompts, formato de la marca «Mi plato», y cómo reutilizar el editor de ingredientes y el matcher existentes.

## Cómo comprobar que funciona

Carlos sube 3-5 platos reales suyos. Se mide: acierto del plato detectado, error de kcal frente a la revisión del coach, y que ningún otro cliente de prueba (hay 10) los vea nunca.

## Decisiones añadidas tras la revisión del constructor (calls mías, marcadas)

- **Dieta (mi call):** «Añadir a su dieta» no usa `recetas`: convierte el plato aprobado en una comida del plan con sus ingredientes como `comida_alimentos` (alimentos con gramos, como las comidas que ya genera la IA). Así no hace falta FK nueva ni tocar `recetas`, y las macros del plan salen de los gramos aprobados.
- **Editar tras aprobar (mi call):** un plato aprobado no se edita en sitio. Si el cliente lo modifica, vuelve a `pendiente`; mientras tanto siguen valiendo las cifras aprobadas (en plan y recetario) hasta que el coach apruebe la nueva versión. Un `devuelto` se corrige y se reenvía directo a `pendiente`.
- **Ingredientes sin enlace (mi call):** la línea queda marcada «sin datos» y no suma macros; el plato muestra aviso de que las cifras están incompletas. No se crean alimentos automáticamente. El coach debe resolver o quitar esas líneas antes de aprobar (el aprobar se bloquea si quedan).
- **Borradores (mi call):** se guardan en servidor (foto + análisis de IA), solo visibles para el cliente; el coach solo ve `pendiente` en adelante. Borradores sin enviar se limpian a los 30 días, con su foto.
- **Decidido por Carlos:** un plato aprobado que el coach aún no ha metido en la dieta se ve solo en el recetario del cliente con la marca «Mi plato». «En tu plan» muestra únicamente lo que el coach ha mandado y validado (platos añadidos a la dieta).
