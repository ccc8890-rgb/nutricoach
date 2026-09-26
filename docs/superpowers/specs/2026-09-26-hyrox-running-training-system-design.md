# Sistema de rutinas Híbrido Hyrox + Running — diseño

Fecha: 2026-09-26
Autor: Claude (sesión con Carlos)
Alcance: Carlos como primer cliente real del sistema (dogfooding). El sistema queda reusable para otros clientes de carrera/Hyrox, pero el entregable de esta iteración es que Carlos vea su propio plan bien.

## 1. Objetivo

Carlos quiere un plan de entrenamiento propio, generado y mantenido a través de NutriCoach, que:
- Priorice Hyrox (estaciones reales) sin descuidar hipertrofia accesoria de espalda, pecho, bíceps y hombro.
- Mejore su running de cara a distancias 5K/10K/21K mediante tirada larga semanal + series entre semana + tempo, sin fecha de carrera fijada (preparación continua, no periodización hacia un pico).
- Le dé pesos/repeticiones concretos en fuerza y ritmos concretos (min/km) en carrera, no solo RPE genérico.
- Se pueda ver de forma clara y visual como cliente en tres escalas: día, semana y mes.
- Se pueda crear y mantener desde el lado coach de forma simple y profesional (generar con IA + botón para el siguiente bloque, sin calendario manual).

Nutrición queda fuera de esta iteración — se afinará en otra sesión.

## 2. Contexto — qué ya existe (no se reconstruye)

- `app/api/entrenos/proponer-plan-ciencia/route.ts`: genera un plan con DeepSeek citando papers, inyecta perfil atleta + RM/VDOT si existen + feedback de RPE reciente + protocolos por modalidad (`SPORT_PROTOCOLS`), y persiste en `planes_entrenamiento` + `sesiones_entrenamiento` + `sesion_ejercicios`, desactivando el plan anterior.
- `lib/motor-entreno.ts`: árbol de 9 decisiones que recomienda volumen/intensidad/foco a partir de `perfil_entreno_cliente`.
- `perfil_entreno_cliente` de Carlos ya existe: `sport_modality: 'hibrido'`, `dias_disponibles: 5`, `capacidad_recuperacion: 'alta'`, `respuesta_psicologica: 'competicion'`, nivel avanzado, ~65kg, sin RM/VDOT cargados.
- Cliente: `/cliente` (hoy, `SemanaEntrenoCard`), `/cliente/semana` (semana completa vía `GET /api/entrenos/semana-completa`), `/cliente/sesion/[id]` (ejecución con registro de sets, detección automática de métricas cardio por nombre de ejercicio — ya cubre "carrera", "series", etc.).
- Columnas ya existentes y sin usar que evitan migraciones:
  - `sesiones_entrenamiento.fase_bloque` (texto, actualmente siempre null).
  - `ejercicios.tipo` (fuerza/cardio/funcional/flexibilidad) — permite derivar si una sesión es híbrida o de carrera mirando qué tipo domina entre sus ejercicios.
  - `sesion_ejercicios.peso_sugerido` (texto, sin usar) — para guardar el peso estimado calculado por la IA.
  - `planes_entrenamiento.created_at` + `duracion_semanas` — suficiente para calcular en qué semana de un bloque de 4 está una fecha dada, sin campo `fecha_inicio` nuevo.

**No se necesita ninguna migración de base de datos para este diseño.**

## 3. No-objetivos (fuera de alcance esta iteración)

- Periodización hacia una fecha de carrera concreta (tapering) — se añadirá cuando Carlos fije una carrera, reusando la tabla `competiciones` ya existente en el sistema.
- Editor visual de calendario tipo drag-and-drop para el coach — Carlos prefiere generar con IA y ajustar sesiones sueltas con el editor que ya existe (`/entrenos/[id]`).
- Progresión distinta sesión a sesión dentro del mismo bloque de 4 semanas (semana 1 vs semana 4 con series/reps distintas). La app sigue repitiendo la misma plantilla semanal durante las 4 semanas del bloque (como ya hace hoy); la progresión real ocurre entre bloques. Documentado como mejora futura.
- Generalizar el flujo a otros clientes con distinta combinación deportiva — la implementación es reusable pero no se construye UI genérica de selección de "combinación de modalidades" esta vez.

## 4. Motor de generación

### 4.1 Reparto semanal (fijo, 5 días)

| Día | Tipo | Contenido |
|---|---|---|
| 3 días (p.ej. L/X/V) | Híbrido | 1-2 estaciones Hyrox reales (SkiErg, sled push/pull, burpee broad jumps, farmers carry, wall balls, row) + bloque de fuerza/hipertrofia accesoria. La hipertrofia accesoria rota entre los 3 días para cubrir espalda, pecho, bíceps y hombro a lo largo de la semana (no los 3 días iguales). |
| 1 día (fin de semana) | Carrera — tirada larga | Rodaje continuo a ritmo aeróbico (Z2), duración progresiva dentro del bloque. |
| 1 día (entre semana) | Carrera — series o tempo | Alterna según el foco del bloque: series (intervalos) en bloques Base/Resistencia orientados a velocidad, tempo en bloques orientados a umbral. Definido explícitamente en el prompt según `fase_bloque`. |

### 4.2 Bloques de 4 semanas (sin fecha de carrera)

Rotación fija: **Base → Fuerza → Resistencia → Deload → (vuelve a Base)**.

- Cada bloque es un `planes_entrenamiento` nuevo con `duracion_semanas: 4`, `activo: true` (se desactiva el anterior, como ya hace `proponer-plan-ciencia`).
- Todas las `sesiones_entrenamiento` de ese plan se guardan con `fase_bloque` = nombre del bloque.
- El foco de cada bloque ajusta el prompt de generación:
  - **Base**: volumen moderado, técnica, aeróbico dominante en carrera, cargas moderadas en híbrido.
  - **Fuerza**: más carga/menos reps en accesorios, estaciones Hyrox con más peso relativo, carrera se mantiene en mantenimiento (Z2 + 1 sesión de series corta).
  - **Resistencia**: más volumen/densidad en estaciones (simulacros tipo "1km + estación"), tempo run gana peso sobre series.
  - **Deload**: -30/40% volumen general, mantiene frecuencia pero baja intensidad, sin PRs ni series intensas.

### 4.3 Pesos, repeticiones y ritmos concretos

Sin RM/VDOT reales, la IA debe:
- Estimar 1RM aproximados a partir de nivel (`avanzado`), peso corporal (~65kg) y objetivo (`rendimiento`), usando heurísticas estándar de fuerza relativa razonables para un atleta híbrido (no un powerlifter puro).
- Escribir el peso estimado en `sesion_ejercicios.peso_sugerido` (ej. `"70kg"`) y las repeticiones en `repeticiones` (ej. `"8-10"`), no solo RPE.
- Para carrera, estimar un ritmo en min/km por tipo de sesión (Z2 / umbral / series) a partir del nivel declarado, y escribirlo en `notas` o `repeticiones` según corresponda (ej. `repeticiones: "6x800m"`, `notas: "Ritmo objetivo ~4:15/km, recuperación trote 2min"`).
- Instrucción explícita en el prompt: estos valores son un punto de partida conservador — el sistema ya tiene un bucle de autoajuste por RPE (`ajusteRpe` en `proponer-plan-ciencia`, ya implementado) que sube o baja carga en el siguiente bloque según el RPE medio registrado.

### 4.4 Cambios de código (motor)

- `app/api/entrenos/proponer-plan-ciencia/route.ts`:
  - Nuevo modo/protocolo combinado (no reemplaza los protocolos existentes de una sola modalidad, que otros clientes puedan seguir usando): cuando `perfil.sport_modality === 'hibrido'` y hay foco Hyrox+Running, construir un prompt que combine `SPORT_PROTOCOLS.hyrox` + `SPORT_PROTOCOLS.running` con el reparto de días de la sección 4.1, en vez de aplicar un único protocolo a las 5 sesiones.
  - Nuevo parámetro `fase_bloque_objetivo` (Base/Fuerza/Resistencia/Deload) que el caller pasa explícitamente; se inyecta en el prompt y se persiste en cada `sesiones_entrenamiento.fase_bloque` al guardar.
  - Al guardar `sesion_ejercicios`, mapear el peso estimado de la IA a la columna `peso_sugerido` (hoy no se usa esa columna al persistir).
  - Formato JSON de salida de la IA: añadir campos `tipo_sesion: "hibrido" | "carrera"` y `peso_estimado_kg` (opcional) por ejercicio, y `ritmo_objetivo` por sesión de carrera — solo aditivo, no rompe el formato ya usado por otros clientes.

## 5. Vistas del cliente

Reutilizan los mismos datos ya persistidos; ninguna vista nueva introduce lógica de negocio duplicada.

### 5.1 Hoy (`/cliente`, `SemanaEntrenoCard`) — ya existe
- Añadir un pill con el nombre del bloque activo (ej. "Bloque: Fuerza · Semana 2/4"), calculado en el backend de la API que ya alimenta el componente (`GET /api/entrenos/sesiones-plan`), leyendo `fase_bloque` de las sesiones del plan y calculando la semana con `plan.created_at`.

### 5.2 Semana (`/cliente/semana`) — ya existe
- Mismo pill de bloque/semana en el header (ya tiene una sección de resumen donde encaja).
- Icono distinto por sesión (🏋️ híbrido / 🏃 carrera), derivado en `GET /api/entrenos/semana-completa`: para cada sesión, mirar el `tipo` mayoritario de sus `ejercicios` vinculados (vía `ejercicios.tipo`) y clasificar como `'hibrido'` si predomina fuerza/funcional, `'carrera'` si predomina cardio.

### 5.3 Mes — nueva página `/cliente/mes`
- Calendario grid (semanas como filas, L-D como columnas), un punto de color/icono por día (híbrido, carrera, descanso, completado — mismos colores que ya usa `/cliente/semana`).
- Cada fila de semana lleva una etiqueta lateral con el bloque/fase de esa semana.
- Si el mes incluye semanas de un bloque aún no generado (el bloque activo termina antes de fin de mes y no se ha generado el siguiente), esas celdas se muestran atenuadas con el texto "Bloque siguiente pendiente de generar" en vez de vacías sin explicación.
- Nueva API `GET /api/entrenos/mes-completo?year=YYYY&month=MM`: mismo patrón de auth y de cálculo que `semana-completa`, pero itera todas las semanas que caen dentro del mes solicitado, repite la plantilla semanal del plan activo en cada una (igual que hace hoy `semana-completa` para "esta semana"), y devuelve además el nombre del bloque por semana.
- Enlace "Ver mes completo →" añadido en `/cliente/semana` (ya tiene un patrón de navegación con `replace` establecido en el proyecto — se sigue esa convención).

## 6. Lado coach

Sin editor de calendario. Panel mínimo en la ficha de Carlos como cliente (`/clientes/[id]`, pestaña de entrenamiento donde ya vive `PlantillaEntrenoSelector`/generación IA):

- Botón **"Generar plan Híbrido Hyrox + Running"** — visible si no hay plan activo con este enfoque. Llama a `proponer-plan-ciencia` con `fase_bloque_objetivo: 'Base'` (primer bloque siempre empieza en Base).
- Cuando el plan activo esté a ≤3 días de terminar sus 4 semanas (calculado igual que en las vistas de cliente), aparece **"Generar siguiente bloque: [Fuerza/Resistencia/Deload/Base]"** con el siguiente foco de la rotación ya resuelto (no hay que elegirlo a mano).
- Para tocar algo suelto de una sesión concreta (cambiar un ejercicio, ajustar reps), se usa el editor de sesiones que ya existe — no se toca ese flujo.

## 7. Verificación

- `npx tsc --noEmit` y `npm run build` limpios tras cada cambio.
- Generar un plan real (bloque Base) para Carlos y confirmar en Supabase: `fase_bloque` poblado en las 5 sesiones, `peso_sugerido` y ritmos presentes, reparto 3 híbrido + 2 carrera correcto, hipertrofia accesoria (espalda/pecho/bíceps/hombro) presente entre las 3 sesiones híbridas.
- Verificar en el portal cliente real (no solo Playwright): `/cliente` (pill de bloque), `/cliente/semana` (iconos + pill), `/cliente/mes` (grid completo, celdas futuras si aplica).
- Confirmar que otros clientes con modalidad no-híbrida (ej. Sofía FODMAP, Laura vegana) siguen generando planes igual que antes — el nuevo protocolo combinado solo se activa cuando `sport_modality === 'hibrido'`.

## 8. Mejoras futuras (fuera de esta iteración, documentadas para no perderlas)

- Periodización real hacia una fecha de carrera cuando Carlos fije una (usar tabla `competiciones` ya existente + lógica de tapering).
- Progresión intra-bloque (variar reps/series semana a semana dentro de las 4 semanas, no solo repetir la misma semana tipo).
- Generalizar el selector de "combinación de modalidades" para que cualquier coach pueda montar un híbrido a medida desde la UI, en vez de que el combo Hyrox+Running esté especial-cased en el prompt.
