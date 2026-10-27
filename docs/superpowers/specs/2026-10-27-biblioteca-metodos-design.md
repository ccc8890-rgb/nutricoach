# Biblioteca de métodos del coach (diseño)

Fecha: 27-10-2026 · Estado: **borrador pendiente de aprobación de Carlos**
Relacionado: motor de lectura de dietas/entrenos (idea 27-10 en `NUTRICION/CLAUDE.md`), circuito de revisión del recetario (`2026-10-26-revisor-recetario-agente-design.md`), `lib/entrenos/generar-plan-ia.ts` (citas K#), Content Radar.

## Por qué

Carlos ve a diario en Instagram, webs y PDFs sesiones, métodos y consejos de otros entrenadores que le sirven para programar. Hoy Content Radar deja en Notion un resumen suelto («Gym training» / «Running training») que no se puede filtrar, no se puede convertir en una sesión y la IA no ve. Quiere **una base de datos de cosas interesantes**, bien clasificada, de la que pueda:

1. consultar mientras programa,
2. **mandar una o varias sesiones a clientes** (y a plantillas),
3. y que **la IA también la tenga como recurso** al programar, si lo cree necesario.

## Objetivos

1. Una biblioteca propia dentro del coach, con tres tipos de ficha, clasificación corta y fija y un circuito de revisión como el del recetario.
2. Captura fácil: compartir un reel a Content Radar, pegar un enlace/texto o subir un PDF/Excel (con el motor de lectura).
3. «Usar»: de una ficha de sesión a una plantilla de entreno en borrador y de ahí a un cliente (también en lote).
4. La IA de planificación puede consultar las fichas aprobadas como **inspiración citada**, con menos peso que la ciencia y las reglas de seguridad.
5. Trazabilidad: saber de qué ficha salió cada plantilla o plan y cuánto se usa cada ficha.

## No objetivos

- No es un repositorio de papers: la ciencia sigue en `knowledge_base`.
- No guarda vídeos ni texto ajeno copiado; guarda estructura y resumen propios + autor + enlace.
- No se publica a clientes con la autoría de otro ni se ofrece a otros coaches.
- No hay ingesta masiva automática: solo entra lo que Carlos captura.
- Dietas/recetas de terceros siguen su flujo actual (recetario); esto es entreno (y principios de entreno).
- TrainingPeaks queda fuera de esta versión (sin investigar su alcance).

## Anti-objetivos (sería un fracaso aunque funcione)

- Que acabe siendo un cajón de 500 fichas sin revisar.
- Que la IA aplique un método dudoso a un cliente sin que Carlos lo vea.
- Que una ficha mal extraída (ejercicios inventados, series erróneas) llegue a un cliente.
- Que obligue a Carlos a revisar muchas cosas: el circuito debe ser rápido y con el agente de por medio.

## Qué guarda (modelo)

Tabla nueva `metodos` (Supabase, por coach, RLS como el resto):

| Campo | Notas |
|---|---|
| `tipo` | `sesion` · `principio` · `tecnica` (solo estos tres) |
| `titulo`, `resumen` | resumen propio, corto |
| `modalidad` | fuerza/hipertrofia · running · hyrox · funcional · bici · natación · movilidad · pliometría (una obligatoria) |
| `objetivo`, `nivel`, `material[]`, `duracion_min` | sacados por la extracción; editables |
| `estructura` (jsonb) | solo en `sesion`: bloques → ejercicios (ver abajo) |
| `autor`, `plataforma`, `url_origen` | procedencia obligatoria |
| `miniatura_url`, `video_url` | miniatura del vídeo (Cloudinary, como las recetas) y enlace al reel/vídeo original; **no se guarda el archivo de vídeo** (ver decisiones) |
| `disponible_ia` | boolean, por defecto `false`; solo Carlos lo activa, y solo en fichas aprobadas |
| `confianza` | `anecdotico` · `experto` · `respaldado` (con estudio; enlaza a `knowledge_base` si procede) |
| `estado` | `en_revision` · `con_agente` · `aprobada` · `descartada` (mismo circuito que recetas) |
| `notas_coach`, `tags[]` | notas de Carlos; tags pocos y de un vocabulario controlado |
| `huella` | autor+url normalizados, para detectar duplicados |

`estructura` de una sesión: lista de bloques `{ tipo: uno de BLOQUES_SESION (movilidad|calentamiento|pliometria|principal|accesorios|vuelta_calma, de `lib/training/session-blocks.ts`, para que luego convierta 1:1 a plantilla), ejercicios: [{ texto_original, ejercicio_id|null, series, reps|duracion, pausa, intensidad, nota }] }`. El `ejercicio_id` sale de `matchEjercicio`; si no casa queda `null` y se marca (nunca se inventa un ejercicio del catálogo).

Tabla `metodos_usos` (`metodo_id`, `uso`: plantilla|cliente|plan_ia, `ref_id`, `fecha`) para trazabilidad y para ordenar por «más usado».

Historial de revisión: mismo patrón que `recetas_revision_eventos`.

## Captura y extracción

- **Reel (Content Radar):** los temas de entreno pasan a un `workout_extractor.py` (análogo a `recipe_extractor.py`). Lee pie + transcripción y, si falta la rutina, **fotogramas** (en reels de entreno la rutina suele salir solo en pantalla, como pasó con las recetas). Escribe en Notion (nota como hoy) y crea la ficha en `metodos` como `en_revision`.
- **Enlace, texto pegado, PDF, Excel:** desde la biblioteca, botón «Añadir». Usa el motor de lectura de planes (pieza compartida con la importación de otras plataformas).
- **Control de calidad previo a guardar:** si no se leen ejercicios con series/reps, no se crea como `sesion`: se guarda como `principio` o se descarta con motivo. Ejercicios no casados se muestran marcados.
- Duplicados: por `huella` y por similitud de título; se avisa, no se crean dos.

## Revisión (anti-caos)

Misma idea que el recetario: bandeja «Por revisar» con acciones rápidas (guardar · descartar · editar), y el agente revisor opcional (coherencia de series/reps, ejercicios sin casar, modalidad/nivel). El agente **nunca aprueba**. Lo descartado se archiva. Contador visible de pendientes; sin tope de ingesta pero sin aprobación no entra en la IA ni en «Usar».

## Cómo se usa

1. **Consultar:** filtros por tipo, modalidad, objetivo, nivel, material, duración, autor, confianza; búsqueda por texto sin tildes.
2. **Usar como base (sesión):** crea una **plantilla de entreno en borrador** (`plantillas_entrenamiento` con `origen = 'metodo'` y referencia a la ficha) que sigue los flujos actuales de revisión/edición y de «asignar a cliente / poner en una fecha del calendario». Selección múltiple → varias plantillas o sesiones de una semana. Los ejercicios sin casar bloquean el paso hasta resolverlos.
3. **Principios y técnicas:** no se convierten en sesión; se consultan, se adjuntan como nota a una sesión/plantilla y, si procede, enlazan a la futura biblioteca de ejercicios con vídeo.

## La IA como usuaria de la biblioteca

Reutiliza el mecanismo que ya existe para los estudios en `generar-plan-ia.ts` (claves `[K#]`, solo se puede citar lo ofrecido, las citas inventadas se detectan en `evidencia-plan.ts`):

- Al planificar, se seleccionan hasta ~5 fichas **aprobadas** relevantes por modalidad/nivel/objetivo y se ofrecen con clave `[M#]`, marcadas como **«referencia de otros entrenadores, inspiración, no norma»**.
- Las reglas de seguridad, coherencia (`coherencia-plan`, `validar-plan-carrera`), la ciencia y los datos del atleta **mandan siempre** sobre un método.
- El plan devuelve «inspirado en: M2, M5» solo si de verdad se apoyó; se resuelve a fichas reales; claves inexistentes se descartan y se registran.
- En la propuesta que revisa Carlos se muestra «Inspirado en: [método] de [autor]» con enlace a la ficha. Se registra en `metodos_usos`.
- Coste: lo ofrecido va acotado en tokens (resumen + puntos clave, no la estructura entera salvo pedirla).
- **Decisión de Carlos (27-10): control máximo al principio.** Cada ficha lleva `disponible_ia` (por defecto **apagado**): la IA solo ve las fichas aprobadas **y** marcadas por Carlos una a una. Además hay un interruptor general en Ajustes («Permitir que la IA use mi biblioteca») para cortarlo todo de golpe. Cuando se vea cómo funciona, se podrá relajar (p. ej. marcar por lotes o por autor).

## Derechos y datos

Se guarda resumen/estructura reescritos con nuestras palabras, autor y enlace; no se almacena el vídeo ni se copia texto íntegro. Es de uso interno del coach. Antes de enseñar algo a un cliente se muestra como sesión del plan, no como «método de X».

## Fases propuestas

1. **Base:** tabla, biblioteca en el coach (listado, filtros, ficha, editar), alta manual por texto/enlace, circuito de revisión.
2. **Captura desde Content Radar:** `workout_extractor.py`, fotogramas, ficha en `en_revision`.
3. **Usar:** ficha → plantilla borrador → cliente/fecha, también en lote; `metodos_usos`.
4. **IA:** claves `[M#]` en `generar-plan-ia.ts`, «inspirado en», interruptor.
5. **Motor de lectura PDF/Excel** alimenta el alta (compartido con la importación de otras plataformas).
6. Más adelante: agente revisor de fichas, TrainingPeaks, vídeo/foto de ejercicio.

## Decisiones tomadas por mí (a revisar)

- Tabla propia en Supabase y Notion solo como bandeja de captura (el coach necesita verla en la app y convertirla).
- Tres tipos de ficha y modalidad obligatoria; vocabulario de tags controlado.
- Empezar por fuerza/hipertrofia, Hyrox/funcional y running; bici y natación entran en el modelo desde el principio pero se pulen después.
- Sin ingesta masiva: solo lo que Carlos captura.
- La IA usa como máximo ~5 fichas, con peso menor que la ciencia. **Decidido por Carlos:** solo las aprobadas y marcadas `disponible_ia` una a una, interruptor general en Ajustes.
- La biblioteca también sirve de **repositorio visual de entrenos y vídeos para revisar** (decisión de Carlos): cada ficha muestra miniatura y enlace al original, y la vista de lista permite recorrerlas rápido (miniatura, título, modalidad, autor, estado). Guardo miniatura + enlace, no el vídeo (peso, derechos y enlaces que caducan); si Carlos quiere conservar el archivo, es una decisión aparte con su coste de almacenamiento.
- Reutilizar `matchEjercicio` y el circuito de revisión del recetario en vez de crear uno nuevo.

## Preguntas abiertas

- Resuelta (Carlos, 27-10): la IA solo ve fichas aprobadas marcadas una a una.
- Para Carlos: ¿quiere ver en la ficha qué clientes han recibido esa sesión? (la trazabilidad lo permite; no sé si le aporta).
- Para Carlos: ¿le basta con miniatura + enlace al vídeo, o quiere guardar también el archivo de vídeo? (mi propuesta: solo enlace; los reels pueden desaparecer, pero guardar vídeos ajenos tiene peso y derechos).
- Para el constructor: confirmar el esquema real de `plantillas_entrenamiento` y de `calendario_entreno_ajustes` antes de definir «Usar como base».
- Para el constructor: tamaño de la muestra para calibrar el extractor (5–10 reels reales de entreno con rutina en pantalla, en pie y hablada).
