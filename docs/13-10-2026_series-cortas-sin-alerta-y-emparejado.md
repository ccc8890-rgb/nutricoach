# Series cortas sin alerta de ritmo + emparejado por workout_id (13-10-2026)

**Estado: EN PRUEBA.** Carlos lo está probando en el reloj (Forerunner 965) para ver qué le va mejor. Si no convence, se revierte (ver abajo).

## Por qué
En series de 400-500 m el reloj usa un ritmo suavizado que tarda 5-15 s en asentarse: la alerta de «fuera de ritmo» salta tarde y mal, y Carlos tenía que acelerar/frenar a ciegas. En calle además el GPS rebota; en pista y cinta cambia la precisión (ver «Contexto»).

## Qué cambia (2 commits independientes, en main)
| Commit | Archivo | Efecto |
|---|---|---|
| `6698561` | `lib/integraciones/garmin-workouts-formato.ts` | Pasos de **trabajo** de ≤ 600 m o ≤ 150 s se envían a Garmin **sin objetivo de ritmo** (`no.target`). El objetivo va en la descripción del paso: «Objetivo 4:15/km (2:07 los 500 m)». Rodajes, tempos y tiradas no cambian (siguen con `pace.zone` o pulso). |
| `bd6e1a0` | `lib/rendimiento/cumplimiento.ts`, `lib/rendimiento/ejecucion.ts` | `emparejarEntreno` recibe `workoutId` opcional: si el entreno realizado trae `raw.workout_id` igual al `garmin_workout_id` de la sesión, gana sobre cualquier otro criterio. Sin id, sigue como antes (fecha ±1 día, prefiere el que tiene vueltas ACTIVE y más duración). |

Verificado: `tsc`, `garmin-workouts-formato.test.ts`, `garmin-auto.test.ts`, `pasos.test.ts` y prueba con 5×500 m (series `no.target`, tempo `pace.zone`). **No visto aún en el reloj.**

## Cómo volver atrás
- **Solo las alertas:** en `garmin-workouts-formato.ts`, `SERIES_CORTAS_SIN_ALERTA = true` → `false`. Umbrales: `SERIE_CORTA_METROS` (600) y `SERIE_CORTA_SEGUNDOS` (150).
- **Todo:** `git revert bd6e1a0 6698561` y push. **Ojo, reenvío:** la huella (`huellaPasos`, `lib/entrenos/garmin-auto.ts`) se calcula con pasos, VDOT, techo de pulso y nombre, NO con el formato enviado. Este cambio (y su reversión) no se aplica solo a lo ya programado en el reloj: solo a sesiones nuevas o cuyos pasos cambien. Para aplicarlo (o deshacerlo) en lo ya programado, usar «Reenviar a Garmin» del calendario del coach (`/api/entrenos/planes/[id]/garmin-reenviar`).
- Ajustar solo el umbral (p. ej. 400 m) en vez de revertir si el problema son los 600 m.

## Contexto aprendido (no cambia código)
- Cinta: el reloj estima ritmo/distancia con acelerómetro; guiarse por la velocidad de la cinta y calibrar con la distancia real al terminar. En la app `treadmill_running` ya se excluye de VDOT, deriva y técnica.
- Pista: perfil «Correr en pista» del 965 (`track_running`, la app ya lo cuenta como carrera). El entreno se envía como `running`; no se sabe si el 965 lo ofrece dentro del perfil de pista: **probarlo antes de la sesión**.
- Garmin puede descartar el objetivo de ritmo de entrenos externos si falta el ritmo umbral configurado en el reloj (foros intervals.icu y Garmin).
- Sensores: banda de pecho (Polar H10 o similar de ~30 €) para pulso fiable; footpod (Stryd / Garmin Running Dynamics Pod) para ritmo exacto en cinta; la banda no corrige el GPS.

## Pendiente / ideas
- Ver en el reloj cómo sale la descripción del paso y si compensa mantener la alerta en series > 600 m.
- Aviso de tiempo objetivo por 100 m en el texto del paso; revisar alertas de voz del reloj.
- El emparejado por id solo ayuda con el entreno vigente: el `garmin_workout_id` de semanas pasadas se sobrescribe.

## Auditoría de fallos (13-10-2026)
- **Corregido:** el cambio no reenviaba lo ya programado (huella sin el formato): documentado, hay que usar «Reenviar a Garmin».
- **Corregido:** una serie corta con zona suave (E) habría perdido su objetivo de pulso; ahora la zona E queda fuera.
- **Aceptado:** el emparejado por id solo sirve para el entreno vigente; seguridad: sin rutas ni claves nuevas, solo lógica pura y una columna ya existente (`garmin_workout_id`).
