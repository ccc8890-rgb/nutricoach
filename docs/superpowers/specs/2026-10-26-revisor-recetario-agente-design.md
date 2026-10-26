# Agente revisor del recetario (diseño)

Fecha: 26-10-2026 · Estado: **borrador pendiente de aprobación de Carlos**
Relacionado: `2026-10-26-recetario-capas-y-tecnicas-design.md` (tipo y familia ya construidos) y la regla permanente «la IA siempre supervisada por Claude / el coach no revisa multitud de análisis».

## Por qué

Carlos mete fichas constantemente (reels de Content Radar, webs, a mano) y todas pasan por «Por revisar». Hoy hay 51 en la cola. Revisarlas a mano es lo que le quita tiempo: comprobar tipo y familia, ingredientes mal enlazados, cantidades inventadas, raciones, macros, redacción. Ya se hace parte de esto con scripts sueltos y con Claude en sesión (p. ej. contrastar los Ñoquis con fotogramas del reel). Quiere **un agente potente que lo haga bien y solo, y que a él le quede la decisión final**, con la autonomía creciendo a medida que demuestre acierto.

## Objetivos

1. Un **revisor** que, para cada ficha en revisión, emita un **veredicto con motivos**: `lista` (se puede aprobar) · `revisar` (dudas concretas) · `corregir` (errores claros), y la clasificación propuesta (tipo y familia).
2. **Aplicar solo correcciones seguras** (con copia y rastro) y dejar el resto como sugerencias.
3. **Medir su acierto frente a Carlos** (cuando aprueba o rechaza, se guarda si coincide con el veredicto) para decidir cuánta autonomía darle.
4. **Coste bajo control:** tope por ejecución y por día, no revisar dos veces lo mismo, medir tokens reales.

## No objetivos

- No aprueba solo en las primeras fases (la aprobación sigue siendo de Carlos).
- No toca fichas ya aprobadas salvo petición explícita.
- No genera recetas nuevas ni fotos, ni reescribe el texto de las recetas (solo señala y sugiere).
- No sustituye al control de calidad determinista existente (`profesional.ts`, bloqueantes): lo complementa.

## Anti-objetivos

- Que una corrección del agente empeore un dato (una familia mal puesta, macros recalculados mal).
- Que gaste sin control (bucles, reintentos, volver a revisar fichas sin cambios).
- Que pise decisiones de Carlos (si ya rechazó o corrigió algo, no lo vuelve a proponer igual).
- Que se fíe de lo que dice el modelo sin validarlo: toda salida se valida con esquema y reglas del proyecto antes de usarse.

## Diseño

### Qué revisa (por ficha)

Entrada, toda desde la base de datos (no hay texto del vídeo guardado: 0 de las 51 fichas en revisión tienen `raw_scrape`): nombre, descripción, tipo/familia/categoría actuales, ingredientes con gramos y alimento vinculado (con sus macros por 100 g), pasos, consejos, raciones, macros calculados, etiquetas, origen (URL/autor) y los **mismos hallazgos deterministas** que ya calcula el control de calidad. Prompt de sistema con las reglas del proyecto (familias válidas, `tipo_plato` permitido, cantidades de la receta entera, lo que significa cada veredicto).

Juicios que se le piden:
1. **Tipo y familia** leyendo ingredientes y pasos, no solo el nombre (detecta lo que el clasificador por palabras clave no ve).
2. **Coherencia interna:** el nombre y los pasos dicen lo mismo que los ingredientes; ingredientes citados en los pasos que faltan en la lista y al revés; cantidades implausibles para el tipo de plato; raciones que no cuadran con las kcal; ingredientes enlazados a un alimento que no corresponde.
3. **Macros y raciones** plausibles para esa receta.
4. **Alérgenos y etiquetas** coherentes con los ingredientes.
5. **Redacción:** pasos claros, sin vocabulario deportivo ni afirmaciones de salud añadidas.

### Salida (JSON validado)

`{ tipo_contenido, familia, confianza (0-1), veredicto: 'lista'|'revisar'|'corregir', resumen, hallazgos: [{ campo, gravedad: 'alta'|'media'|'baja', descripcion, sugerencia }], correcciones: [{ campo, valor, segura: boolean }] }`.

Validación antes de usar nada: esquema estricto, `familia` dentro de las listas válidas de su tipo, solo campos permitidos en `correcciones` (`tipo_contenido`, `familia`, `categoria`, `tags`), valores dentro de los dominios válidos. Si no valida, se descarta y se registra el fallo; no se reintenta más de una vez.

### Qué aplica solo y qué no

- **Aplica** (solo fichas `en_revision`): tipo y familia cuando la `confianza` ≥ 0,85 y la corrección está marcada `segura`; deja etiqueta `Revisada por el agente`. Con copia previa (`salidas/` con hora) y el valor anterior en el registro.
- **No aplica nunca:** cambios de ingredientes, cantidades, pasos, raciones, macros o estado. Eso queda como hallazgo/sugerencia para Carlos (o para el motor de correcciones existente, supervisado).
- **Nunca aprueba** en las fases 1-3.

### Dónde se guarda

Tabla nueva `revisiones_agente`: `id, receta_id, modelo, tokens_entrada, tokens_salida, veredicto, confianza, resumen, hallazgos (jsonb), correcciones (jsonb), aplicadas (jsonb), hash_ficha, decision_coach (null | 'aprobada' | 'descartada' | 'corregida'), created_at`. `hash_ficha` es un hash del contenido revisado: si no cambia, no se vuelve a revisar. `decision_coach` se rellena cuando Carlos aprueba o descarta la ficha (en la ruta de cambio de estado), y de ahí sale el **porcentaje de acuerdo**.

### Interfaz

En la cola «Por revisar», cada ficha muestra una línea del agente: «Agente: lista» / «Agente: revisar (3)» con los hallazgos desplegables y un botón «Aplicar correcciones sugeridas» cuando haya. Un ajuste de filtro «Solo las que el agente da por listas» para aprobar rápido. Una tarjeta de resumen (acuerdo con Carlos, coste acumulado) en Ajustes → Estado del sistema.

### Modelos y coste

- Nueva tarea en el enrutador: `revision_receta`. Por defecto `[Claude Sonnet, GPT, DeepSeek]` (calidad/coste), cambiable con `IA_RUTA_REVISION_RECETA`; Opus solo bajo petición para casos difíciles.
- El enrutador ya devuelve los tokens usados; se guardan por ficha. **Tope por ejecución y por día** (`--presupuesto`, por defecto 1 €/día, configurable); al llegar al tope se detiene y avisa. Si falta saldo, avisa y reintenta en la siguiente pasada (patrón de `corregir-marcadas.mjs`).
- Estimación (mía, a verificar con las 10 primeras): 0,01-0,05 € por ficha con Sonnet o GPT, ≈ 0,5-2,5 € para las 51 de hoy, y menos de 0,5 €/día en régimen normal.

### Fases (por prioridad)

1. **Núcleo:** tabla, revisor sobre la ficha en BD, validación, script bajo demanda (`revisar-cola.ts --limite=10`), informe en la cola. Se prueba con 10 fichas y se mide coste y acierto.
2. **Automático:** enganchar a la pasada de 6 h para fichas nuevas en revisión (con presupuesto), correcciones seguras aplicadas, métrica de acuerdo con Carlos.
3. **Contraste con la fuente:** guardar en el origen (Content Radar) el texto del reel/web (pie, transcripción) en `recetas.fuente_texto` y dárselo al revisor para cazar cantidades e ingredientes inventados; fotogramas solo bajo demanda (más caro).
4. **Autonomía gradual:** aprobación automática de fichas `lista` con confianza alta solo cuando el acuerdo con Carlos sea ≥ 90 % en al menos 30 fichas, siempre reversible y con rastro.

## Decisiones mías (a revisar)

1. Sonnet por defecto (Opus bajo petición): mejor relación calidad/coste para revisar fichas.
2. Sin fuente de vídeo en la fase 1: se limita a lo que está en la BD; el contraste con el reel llega en la fase 3.
3. Tope de 1 €/día por defecto.
4. La autonomía sube por métricas de acuerdo, no por fecha.
5. Solo clasificación se aplica sola; todo lo demás es sugerencia.

## Pendiente del builder

- Redactar el prompt de sistema y el esquema concreto y probarlos con ejemplos reales de la cola (incluidos casos malos conocidos).
- Dónde dispara la métrica de acuerdo (ruta de estado y botones «Aprobar y siguiente»).
- Si el informe del agente aparece también en la ficha de la receta, no solo en la cola.
