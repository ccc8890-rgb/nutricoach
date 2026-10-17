# Recetario unificado: un solo sitio para analizar y mejorar las recetas

Fecha: 17-10-2026 · Autor de la petición: Carlos (coach y dueño de NutriCoach)

## Intención

Hoy el trabajo sobre el recetario está repartido en tres sitios del menú del coach (Recetario, Revisión, Control) y algunas pantallas ni siquiera están en el menú. Carlos no sabe dónde ir para mejorar el recetario y se le pasan recetas con fallos, tanto propias como reportadas por clientes. Quiere **un solo apartado, lógico e intuitivo, desde el que analizar y mejorar el recetario de forma potente y sencilla**, y que el recetario final contenga solo recetas operativas.

## Estado actual (verificado en el código el 17-10-2026)

- Menú (`components/Sidebar.tsx`): Recetario = Recetas (`/recetas`), Alimentos, Revisión (`/recetas/revisar`). Compra y costes = Lista compra, Precios. **Control** = Cobertura de recetas (`/recetas/cobertura`), Coste de recetas (`/precios/escandallo`), Rentabilidad por cliente (`/precios/rentabilidad`).
- Revisión (`app/recetas/(revision)/`) es un espacio con cabecera y dos pestañas: Recetas por aprobar e Imágenes.
- Auditoría de ingredientes (`/recetas/auditoria`) no está en el menú; solo se llega desde un botón dentro de Recetas. Cobertura también tiene botones sueltos en Recetas e Imágenes.
- Flujo «Corregir» ya existente: marca aspectos (título, textos, pasos, ingredientes, gramos, raciones/kcal, foto) + nota → etiqueta `Corregir`, pestaña «Para corregir», evento `correccion_solicitada` en `recetas_auditoria`. La IA las rehace solo cuando Carlos pide «pasa las correcciones» (`scripts/correcciones.ts`). **Solo se aplica a recetas en `en_revision` o `borrador`**, no a las aprobadas.
- El estado `descartada` ya existe (`/api/recetas/[id]/estado`).

## Objetivos

1. **Un único espacio «Revisión»** con todo el análisis del recetario, organizado por intención:
   - *Mejorar lo que hay:* Por aprobar, Imágenes, Auditoría de ingredientes y la nueva cola **Reportadas**.
   - *Completar lo que falta:* Cobertura (huecos por momento, objetivo y disciplina, con los briefs de qué recetas buscar o crear).
2. **Control desaparece del menú.** Coste de recetas y Rentabilidad por cliente pasan a **Compra y costes** (la rentabilidad por cliente es suposición mía: va ahí por ser dinero).
3. **Recetas = recetario final operativo**, para consultar y editar. Los botones sueltos hacia auditoría y cobertura se quitan: ese camino pasa por Revisión.
4. **Reportar problema desde cada receta aprobada** (por fallos que Carlos vea o que reporte un cliente).
5. **Edición en el sitio** de cambios menores dentro de la receta.
6. **Triaje eficiente** de las muchas recetas con fallos hoy: clasificar, mejorar o eliminar, y avanzar rápido.

## Decisiones tomadas por Carlos

- Coste de recetas va a Compra y costes.
- Revisión es el espacio único de análisis: revisar, mejorar, eliminar y cobertura estratégica.
- Cada receta del recetario final tiene un selector para mandarla a revisión indicando qué falla (foto, título, ingredientes, etc.) y marcarla para que la IA la revise y rehaga.
- **Mientras una receta aprobada está reportada, sale del recetario operativo** (el cliente no la ve y el planificador no la usa) hasta que se arregla. «Así tenemos solo lo operativo.»
- Eliminar es posible cuando no merece arreglo.

## Mi diseño (cosas que he decidido yo; Carlos puede cambiarlas)

- **Reportar** reutiliza el selector de aspectos y la nota del flujo «Corregir», más un campo de **origen** (lo vi yo / lo reportó un cliente). Al reportar, la receta pasa a `en_revision` con la etiqueta `Corregir` y se registra el evento en `recetas_auditoria`.
- **Reportadas** es una pestaña nueva en Revisión (o el filtro «Para corregir» ampliado) con cada receta y tres salidas: **rehacer con IA** (sigue siendo bajo demanda, nunca autónoma: la IA no escribe sola en la base de datos), **arreglar a mano** o **eliminar**. Orden por defecto: clientes primero, luego por número de aspectos marcados.
- **Eliminar = descartar** (`estado = descartada`), reversible. No se borra de la base de datos.
- **Volver al recetario:** una receta arreglada vuelve por el flujo normal de aprobar (con su quality gate), no automáticamente.
- **Edición en el sitio** limitada a campos sin efecto en los macros (nombre, descripción, raciones solo si el flujo existente ya recalcula, tiempos, etiquetas, categoría). Ingredientes y gramos siguen en el editor completo, porque recalculan calorías y son donde se rompe.
- **Contador** de pendientes en el menú: suma por aprobar + reportadas.
- **Rutas actuales** (`/recetas/cobertura`, `/recetas/auditoria`, `/precios/escandallo`, `/precios/rentabilidad`) siguen funcionando para no romper enlaces; solo cambia dónde se llega a ellas.

## Decisión de Carlos tras la revisión del constructor

- **Las recetas con fallos que ya existen entran una a una.** «Reportadas» empieza vacía. Nada sale del recetario sin que Carlos lo decida. El recetario permite marcar varias recetas y reportarlas de golpe. Revisión muestra una lista de **candidatas sugeridas** (a partir del control de calidad y la auditoría de ingredientes) para enviarlas por lotes, pero **no se envían solas**. Motivo: ya faltan recetas veganas, cenas ligeras y pre/post entreno; retirar muchas de golpe empobrecería los planes.

## Aclaraciones tras la revisión del constructor (mis decisiones)

- **«Rehacer con IA» no es un botón que escriba en la base de datos.** Marca la receta como «lista para rehacer» y la IA la rehace solo cuando Carlos diga «pasa las correcciones» (flujo actual de `scripts/correcciones.ts`: Claude lee, valida y luego escribe). La pantalla muestra estado y contador, sin ruta nueva de IA. Esto respeta la regla permanente «la IA siempre supervisada».
- **Sacar del circuito = estado `en_revision` + etiqueta `Corregir`.** El constructor debe **auditar y, si hace falta, parchear** todos los caminos que leen recetas (portal del cliente, recetario del cliente, `sugeridas`, alternativas/intercambios, planificador, bandeja de Contenido, lista de la compra) para confirmar que ninguno deja pasar una receta que no sea `aprobada`.
- **Planes ya montados que contienen una receta retirada:** no se tocan solos. Al reportar, el diálogo muestra en cuántos planes activos está la receta, para que Carlos decida a mano. Aviso en la ficha del cliente afectado queda como mejora opcional.

## Fuera de alcance

- Rediseño visual del sistema (lo lleva Codex; aquí solo estructura y navegación).
- Cambiar el motor de calidad, el importador de Content Radar o la lógica de cobertura.
- Reportar desde el portal del cliente (el cliente avisa y Carlos lo registra; un botón para el cliente sería un proyecto aparte).
- Borrado definitivo de recetas.

## Anti-objetivos (sería un fracaso aunque funcione)

- Que quede otro rincón del menú donde analizar recetas.
- Que una receta reportada siga llegando a un cliente o al planificador.
- Que la IA modifique recetas sin que Carlos lo pida.
- Que reportar una receta tarde más que unos pocos toques.

## Restricciones

- Reglas existentes del repo: estado de pantalla que deba sobrevivir a abrir un detalle va en la URL (`useEstadoUrl`); rutas nuevas con Supabase en servidor usan `createServiceSupabase`/`createApiSupabase`; todo endpoint comprueba rol coach; nada de cachés de API.
- Carlos no es desarrollador: la pantalla debe explicarse sola.
- Se prueba en producción tras push a main (hábito de Carlos); sin migraciones de BD si se puede evitar.

## Para el constructor (a tu criterio)

- Nombres exactos de pestañas y agrupación visual del bloque «Mejorar / Completar».
- Cómo gestionar planes de clientes que ya incluyen una receta que se retira (ver pregunta abierta si procede).
- Detalles de la edición en el sitio y la ubicación del botón en la ficha.
