# Elaboraciones: preparaciones base que no son recetas (diseño)

Fecha: 26-10-2026 · Estado: **borrador pendiente de aprobación de Carlos**

## Por qué

«Turbo Poolish para Pizza Rápida» aparece en el recetario como plato (categoría «Comida»). No es una receta: es una masa madre, un paso que se usa dentro de otra receta. Lo mismo pasa con aceites, mezclas de especias, aliños o marinadas. Hoy se tratan como recetas, con tres problemas:

1. Ensucian el recetario (Biblioteca, recetario del cliente, revisión).
2. Su macro y su foto se juzgan como si fueran un plato.
3. No hay vínculo real con las recetas que las usan: la pizza escribe «poolish» como texto y sus macros no incluyen el poolish.

Carlos quiere que todo esté enlazado: vale la pena porque una elaboración se reutiliza en muchas recetas.

## Estado actual (verificado en BD, 26-10-2026)

- Existe `recetas.tipo_receta = 'salsa_base'` y 14 filas lo usan (7 aprobadas, 6 en revisión, 1 poolish con categoría «Comida»). El planificador ya las excluye (`SLOT_TIPOS_PERMITIDOS`, `criterios-momento-entreno.ts`).
- `receta_salsas` («Va bien con…») existe pero tiene 0 vínculos. Es otra cosa: una sugerencia de acompañamiento, no un ingrediente.
- `receta_ingredientes` solo apunta a `alimentos` (`alimento_id`) o lleva `nombre_libre`. La usan unos 200 ficheros (editor, ficha, compra, escandallo, importadores, planificador).

## Objetivos

- Un apartado propio de **Elaboraciones** (salsas, masas y fermentos, mezclas de especias, aceites y aliños, fondos), fuera del recetario de platos.
- Que una receta pueda llevar una elaboración como **ingrediente enlazado**, con macros, coste, alérgenos y lista de la compra correctos.
- Reutilizar todo lo que ya funciona (editor, ingredientes, macros por 100 g, calidad, revisión).

## No objetivos

- No una tabla nueva ni un editor nuevo (descartado: mucho trabajo para ~14 elementos).
- No tocar cómo se planifican las dietas: las elaboraciones siguen sin ser comida.
- No migrar de golpe las recetas existentes que mencionan una elaboración: se enlazan gradualmente, con revisión.

## Anti-objetivos (fallaría aunque «funcione»)

- Que un cambio en una elaboración deje macros viejos en las recetas que la usan.
- Que el cliente vea elaboraciones mezcladas con platos, o recetas con ingredientes que no puede abrir.
- Que un ciclo (A lleva B, B lleva A) bloquee el cálculo.

## Diseño

### Fase 1 — Base: apartado Elaboraciones (sin enlazar aún)

- **Marca:** se mantiene `tipo_receta = 'salsa_base'` como la marca interna «es elaboración» (cero migración de datos, el planificador ya lo respeta). *Mi decisión:* no renombrar el valor; en pantalla se llama «Elaboración». Renombrar es posible más adelante con una migración trivial.
- **Familia = categoría (simplificado 26-10 al planificar):** no hay columna nueva. `recetas.categoria` vale `Elaboración base`, `Salsa` o `Condimento` (`Salsa` ya existe y la usan 13 de las 14). *Reparto de las 14:* base = Turbo Poolish; salsa = mayonesas, ajonesa, chimichurri, salsas de yogur/hamburguesa/cheddar; condimento = mix barbacoa, adobos, chili oil, aceites de cebollino y de hierbas. Las tres llevan `tipo_receta='salsa_base'` (marca interna de «no es plato»). `tipo_plato` no se toca: la BD solo admite Desayuno…Postre (`recetas_tipo_plato_check`).
- **Visibilidad (corregido por Carlos 26-10):** las elaboraciones son contenido para el **cliente**, no solo para el coach. No se mezclan con los platos: tienen su propia pestaña, tanto en el recetario del cliente como en el del coach. La Biblioteca de platos y «Archivo completo» las excluyen (`tipo_receta = 'salsa_base'`).
  - **Sin sub-pestaña nueva (decisión de Carlos 26-10).** Las tres familias son **categorías** más en los chips de categoría que ya existen (Desayuno · Comida · Cena · … · Elaboraciones base · Salsas · Condimentos), tanto en el recetario del cliente (Archivo completo) como en la Biblioteca del coach. `recetas.categoria` pasa a valer `Elaboración base`, `Salsa` o `Condimento` (la categoría `Salsa` ya existe; `Condimento` ya existe en el puente). Se eliminan `Acompañamiento`/`Salsa` mezcladas de `TIPOS_PLATO` del planificador solo si hace falta (a confirmar en el plan).
  - **«Todos» no las incluye:** con la categoría «Todos» (y sin filtro de categoría) la lista excluye estas tres categorías; solo aparecen al elegir su chip. Aplica a Archivo completo, Biblioteca, favoritas y búsqueda por defecto. *Mi decisión:* si el usuario escribe en el buscador, sí se buscan también en las elaboraciones, para que «poolish» se encuentre.
  - Las que están en revisión salen en «Por revisar» con etiqueta *Elaboración* (*mi decisión*: una sola cola de trabajo).
- **Entrada por Content Radar (requisito de Carlos):** una elaboración que entra por el puente debe caer en su categoría, no como Comida o Snack. Hoy `inferir_tipos` (`Content-Radar/scripts/receta_calidad.py`) ya detecta `salsa_base` por el nombre, pero fuerza `tipo_plato = "Comida"` y la `categoria` la decide el extractor LLM (`recipe_extractor.py`), así que acaba en Comida. Cambios: (1) el extractor puede devolver `categoria` ∈ {Elaboración base, Salsa, Condimento}, con instrucciones y ejemplos (poolish, masa madre, fondo → base; mayonesa, pesto → salsa; mix de especias, adobo → condimento); (2) `inferir_tipos` devuelve también la familia y fija `categoria` y `tipo_receta='salsa_base'`, ampliando palabras clave (poolish, masa madre, fondo, caldo base, adobo, mix, sazonador, rub); (3) si el LLM y las palabras clave discrepan, manda la elaboración (criterio conservador: es mejor una elaboración en revisión que un plato falso en el planificador); (4) las elaboraciones entran siempre en `en_revision`.
  - El mismo clasificador debe aplicarse al importador de webs (`importar-lote-verificado.ts`) y a `lib/recetas/tipo-receta.ts` (ya tiene `poolish`), para que haya una sola regla.
  - La ficha reutiliza la de receta, sin los bloques que no aplican (raciones por comida, «Apta para» de plato).
- **Alta y cambio de tipo:** sin botón especial: elegir una de las tres categorías en el editor de la receta la convierte en elaboración (el guardado fija `tipo_receta='salsa_base'`); elegir otra categoría la devuelve a plato. Primer uso: reclasificar las 14 actuales (script con simulación y copia).

### Fase 2 — Enlace como ingrediente (plan aparte)

- **Macros por 100 g y rendimiento:** una elaboración se usa por gramos, no por ración. Columna `recetas.peso_final_g` (opcional): si falta, la suma de los ingredientes; si se informa, manda (la masa pierde agua al cocinar). kcal por 100 g = kcal totales / `peso_final_g`.

- `receta_ingredientes.elaboracion_id uuid null → recetas(id)`. En cada fila, solo uno de `alimento_id`, `elaboracion_id` o `nombre_libre`. `check` en BD.
- **Macros de la fila** = macros por 100 g de la elaboración × gramos / 100. El cálculo central de macros de receta se amplía con este caso.
- **Anti-ciclos:** al guardar se comprueba que la elaboración no se contiene a sí misma por ninguna rama. Profundidad máxima 2 (*mi decisión*; basta para fondos y masas).
- **Propagación:** al guardar o aprobar una elaboración se recalculan las recetas que la usan (en la ruta de guardado, no con trigger de BD). Se registra en `recetas_auditoria`.
- **Herencia:** alérgenos/intolerancias, Halal y coste de la receta incluyen los de sus elaboraciones.
- **Lista de la compra y escandallo:** la elaboración se expande a sus alimentos base (cantidad proporcional), para que la compra sume correctamente.
- **Editor:** el buscador de ingredientes ofrece alimentos y elaboraciones (con distintivo). En la ficha, la elaboración es un enlace que abre su ficha; en la app cliente se muestra como ingrediente con «ver preparación».
- **«Va bien con…» (`receta_salsas`)** se mantiene como sugerencia opcional, independiente del enlace de ingrediente.

### Fase 3 — Enlazar lo existente (gradual)

- Script que **propone** vínculos (por ejemplo, receta con «poolish» en el texto de ingredientes → Turbo Poolish) con revisión de Carlos, nunca automático. Mismo criterio que el resto del motor: IA o heurística propone, se valida antes de escribir, copia de seguridad previa.

## Decisiones mías (a revisar)

1. Mantener `salsa_base` como marca interna y llamarlo «Elaboración» solo en pantalla.
2. `familia_elaboracion` como columna de texto, no tabla.
3. Profundidad máxima de anidación: 2.
4. Propagación en código, no con triggers.
5. Fase 1 se entrega y se usa antes de empezar la 2.

## Pendiente del builder

- Revisar los ~200 ficheros que tocan `receta_ingredientes` para decidir cuáles necesitan conocer `elaboracion_id` (lista en el plan, no aquí).
- Decidir si las elaboraciones heredan el flujo de aprobación de recetas (*propuesta:* sí, mismo flujo y calidad, sin foto obligatoria).
- Foto: no obligatoria en elaboraciones.
