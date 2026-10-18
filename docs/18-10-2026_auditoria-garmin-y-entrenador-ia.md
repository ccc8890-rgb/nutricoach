# 18-10-2026 — Auditoría Garmin → análisis → plan, y botones del Entrenador IA

## Estado medido (BD real, cliente Carlos `04cc53b3`)
- **Sincronización Garmin OK:** `ultima_sync` del día, 70 días seguidos (10-08 → 18-10), 116 entrenos con pulso/TSS, crons `enviar-garmin`/`avisos-rendimiento`/`proponer-bloques` en verde.
- **Huecos de hardware (no del sistema):** sueño 2/70 noches (probablemente reloj sin modo sueño), HRV = media semanal repetida (51,1), fuerza/híbridas sin registrar desde 03-2025. Strava: 403 (se reconectará con Premium, decisión de Carlos 18-10).
- **Cómo cambia el plan:** nada solo. Aprobar un análisis solo deja constancia (`aplicar.ts`); el plan cambia únicamente si el coach pulsa un botón de una decisión. Agentes antiguos de readiness/riesgo/revisión siguen apagados (`AGENTES_ENTRENO_ANTIGUOS_ACTIVOS = false`).

## Cambios (commits `e37c909`, `12ade42`, `8faafc7`, `bdeeccb`)
1. **Aviso `recuperacion_baja`** (`lib/rendimiento/alertas.ts`): preparación de Garmin ≤ 30 dos días seguidos → alerta alta → tarea `alerta_rendimiento` (cron `avisos-rendimiento`, 1 vez cada 7 días).
2. **Estrés -1** de Garmin (sentinela «sin dato») ya no se guarda; limpiadas 2 filas.
3. **Emparejado de sesiones** (`emparejarSesiones` en `cumplimiento.ts`, usado por `ejecucion.ts`): id del reloj → mismo día → ±1 día → cualquier día de esa semana (≥15 min), sin reutilizar un entreno y usando la duración prevista para distinguir tirada de rodaje. Estado `otro_dia` con la fecha real.
4. **Entrenador IA en pasos** (`components/rendimiento/AnalisisIA.tsx`): 1 Qué está pasando · 2 Qué propone cambiar (grupo «Se aplican con un botón» / «Para hacer tú en el plan») · 3 Preguntas · 4 Valora el análisis.
5. **Decisiones aplicables:** `completarCambio` (`analisis-rendimiento.ts`) pide aparte a la IA los pasos exactos o las fechas de mover cuando la propuesta no los trae; se valida con `validarPasos` / `evaluarMover`. Las generales del motor siguen sin botón.
6. **Mover sesión de día** (`lib/rendimiento/mover-sesion.ts`, rama `mover` de `aplicar-decision.ts`): usa `calendario_entreno_ajustes` (solo esa fecha), deshacer = devolverla a su día, refresca Garmin con el cron del cliente (`?cliente=` sin `forzar`, ya no anota en `cron_ejecuciones`).

7. **Fuerza en Garmin** (`lib/rendimiento/deportes.ts`): cuentan como fuerza `strength_training`, `hiit`, `cardio`, `indoor_cardio`, `fitness_equipment`, `functional_training`, `crossfit`, `cross_training` (antes solo las dos primeras, y las híbridas grabadas como Cardio quedaban en «otros»). Test en `scripts/deportes.test.ts`.
8. **Avisos al mover** (`ES_EXIGENTE` en `mover-sesion.ts`, `vistaPreviaMover`): si la sesión movida es exigente, avisa de otra exigente el mismo día, el anterior o el siguiente. No bloquea el botón.

## Verificación
`tsc`, ESLint, `verificar:motor` 63/63, `scripts/rendimiento.test.ts` (incluye emparejado semanal). Ida y vuelta real de mover/deshacer en el plan de Carlos (ajustes vuelven a 3). Análisis real generado: las 2 decisiones de la IA salen con botón.

## Sin comprobar
- Envío real a Garmin tras mover (en local falta `CRON_SECRET`; el cron diario 06:15 lo reintenta).
- Aspecto en pantalla del bloque nuevo (390 px y oscuro).
- Mover no cambia la dieta de ese día (la dieta sigue la plantilla semanal).

## Lecciones
- Un `sed -i` de macOS necesita `-i ''`; y los scripts de prueba fuera del repo no resuelven `node_modules` (ponerlos en `scripts/_tmp-*` y borrarlos).
- Insertar una tarea de prueba en `agente_tareas` exige `agente`, `prioridad`, `razonamiento`, `fuentes`.
- Una decisión de la IA puede quedar obsoleta si se regenera el plan después: validar contra el calendario real al aplicar (hecho para mover y pasos).
- Hay un script de otra sesión (`scripts/` de clientes ficticios) con una contraseña de prueba en claro (`TestNutri2026!`); es de clientes ficticios, pero conviene pasarla a variable de entorno.

## Pendiente
Ver el bloque en pantalla; comprobar el reloj tras el primer «mover»; avisos de recuperación (primer disparo previsto 19-10 ~09:44 local); grabar la próxima híbrida en el reloj como Fuerza o HIIT y comprobar en la BD que llega al día siguiente; reconectar Strava con Premium.
