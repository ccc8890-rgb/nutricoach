# Running estructurado + envío a Garmin — diseño

Fecha: 09-10-2026 · Estado: borrador para revisión de Carlos

## Objetivo

Que las sesiones de carrera (series, tempo, rodajes, tiradas largas) tengan el detalle de un entrenador:
calentamiento, bloques de repeticiones con distancia o tiempo, **ritmo objetivo**, **recuperación entre series** y vuelta a la calma.
Y que esa sesión **aparezca ya programada en el reloj Garmin** del atleta el día que toca, para pulsar «empezar» y que el reloj guíe paso a paso.

Uso principal inmediato: Carlos entrenando él mismo. El diseño sirve igual para clientes con Garmin conectado.

## Alcance

Dentro: solo **running**. Modelo de pasos, cálculo de ritmos por VDOT, editor del coach, vista del cliente, envío y programación en Garmin, conversión de las 4 sesiones de running ya sembradas.

Fuera (después, mismo modelo): Hyrox (estaciones), ciclismo (% FTP), natación, descarga de archivo .FIT como respaldo.

## Estado actual (verificado)

- Una sesión de running = filas genéricas de `plantilla_sesion_ejercicios` / `sesion_ejercicios` (series, reps, descanso). El ritmo vive en texto libre (`notas_tecnicas`: «VDOT 45: 5:05/km»).
- `perfil_entreno_cliente.vdot` y `ftp_watts` ya existen.
- Garmin: `lib/integraciones/garmin-connect-perclient.ts` guarda credenciales y tokens OAuth cifrados por cliente (AES-256, `GARMIN_CREDENTIALS_KEY`); hoy solo se usa para leer salud.
- Librería `garmin-connect` 1.6.2: `addWorkout(IWorkoutDetail)` acepta el JSON completo de Garmin; `deleteWorkout` existe; **no hay método de programar**, pero `gc.client.post()` es público y sirve para `POST /workout-service/schedule/{workoutId}`.
- API no oficial: puede romperse si Garmin cambia algo. Se acepta el riesgo; fallo = aviso claro, sin romper nada más.

## 1. Modelo de datos

Columna nueva **`pasos jsonb`** (nullable) en `plantilla_sesiones` y `sesiones_entrenamiento`. Si es `null`, la sesión funciona como hoy (fuerza, etc.). Más `garmin_workout_id text` y `garmin_programado_fecha date` en `sesiones_entrenamiento`.

```ts
type ZonaRitmo = 'E' | 'M' | 'T' | 'I' | 'R'        // Daniels
type Paso =
  | { tipo: 'calentamiento' | 'trabajo' | 'recuperacion' | 'enfriamiento'
      duracion: { unidad: 'metros' | 'segundos'; valor: number }   // o "hasta pulsar lap" = sin duración (unidad:'lap')
      objetivo?: { tipo: 'zona'; zona: ZonaRitmo }                 // ritmo según VDOT
               | { tipo: 'ritmo'; min_seg_km: number; max_seg_km: number } // manual
               | { tipo: 'fc'; min: number; max: number }
               | { tipo: 'rpe'; valor: number }
      nota?: string }
  | { tipo: 'repetir'; veces: number; pasos: Paso[] }               // un nivel de anidado es suficiente
```

- El ritmo se guarda como **zona**, no como número: la misma plantilla vale para cualquier atleta y los tiempos salen del VDOT de cada uno. Ritmo manual disponible para forzar un valor.
- Recuperación entre series es un paso `recuperacion` (trote/andar con distancia o tiempo) dentro del `repetir`. Por eso aquí el «descanso» sí existe y tiene sentido.
- Validación al guardar (zod): `veces` 1–50, duración > 0, máx. 30 pasos, anidado máx. 2 niveles.

## 2. Ritmos (`lib/entrenos/ritmos.ts`)

Funciones puras, con tests:
- `ritmosDesdeVdot(vdot): Record<ZonaRitmo, number>` (seg/km) con las fórmulas de Daniels (velocidad como % de VO2 → ritmo). Valores de control: VDOT 45 → T ≈ 5:00–5:10/km, I ≈ 4:20/km (coinciden con las notas actuales de las plantillas).
- `resumenSesion(pasos, ritmos)`: distancia total, duración total estimada, lista legible («5 × 1000 m @ 4:20 / 400 m trote»).
- Si el atleta no tiene VDOT: la UI pide el dato (o un tiempo reciente de 5K/10K para calcularlo) antes de mostrar ritmos concretos; las zonas siguen visibles sin números.

## 3. Pantallas

- **Coach / Carlos (editor)**: en la sesión de running, editor de pasos (añadir calentamiento, bloque «repetir N ×», recuperación, vuelta a la calma), con plantillas rápidas («Series», «Tempo», «Rodaje», «Tirada larga»). Muestra ritmos reales del atleta y totales.
- **Cliente / Carlos (ejecución)**: la sesión se ve como escalera de pasos con distancia, ritmo y recuperación. Botón **«Enviar a Garmin»** y estado («Programado en tu Garmin para el sáb 10-10»).
- Fuerza: sin cambios (el descanso ya se oculta, commit `b690f13`).

## 4. Envío a Garmin (`lib/integraciones/garmin-workouts.ts`)

- `pasosAGarmin(nombre, pasos, ritmos)`: construye el JSON de workout de Garmin (`sportType: running`, `ExecutableStepDTO` con `stepType` warmup/interval/recovery/cooldown, `endCondition` distancia o tiempo, `targetType: pace.zone` con rango en m/s ±~3 % alrededor del ritmo objetivo; `RepeatGroupDTO` para los `repetir`).
- `enviarSesionAGarmin(clienteId, sesionId, fecha?)`: descifra la conexión del cliente, `addWorkout`, y si hay fecha `client.post('/workout-service/schedule/{id}', { date })`. Guarda `garmin_workout_id` y fecha.
- Reenviar = borra el workout anterior (`deleteWorkout`) y crea el nuevo; nunca duplica.
- Endpoint `POST /api/entrenos/sesiones/[id]/garmin` (auth: coach del cliente o el propio cliente; reutiliza `autorizarAccesoPlan`). Rate limit como el resto de endpoints de integraciones.
- Errores traducidos: sin conexión Garmin, sesión caducada (re-login con credenciales guardadas), Garmin rechaza el formato (se muestra el motivo).
- Automático opcional (fase posterior a la primera entrega): al activar «enviar mis sesiones de la semana», programa las de los próximos 7 días.

## 5. Migración de lo existente

Script `scripts/convertir-running-a-pasos.ts` (simula por defecto, `--apply` escribe) que convierte las 4 sesiones de «Running — Fondo Intermedio (VDOT 40-50)» a pasos reales:
Long Run (75' E), Umbral (15' E + 25' T + 6×100 m R con 60" + 10' E), VO2max (15' E + 5×1000 m I con 400 m trote + 4×100 m R + 10' E), Easy + strides. Las filas de ejercicio antiguas se conservan hasta verificar.

## 6. Pruebas y verificación

- Tests unitarios: Daniels (valores de control), `resumenSesion`, `pasosAGarmin` (snapshot del JSON), validación zod.
- Prueba real con la cuenta Garmin de Carlos: enviar «Series 5×1000» y comprobar que aparece en Garmin Connect y en el reloj tras sincronizar; reenviar y comprobar que no duplica; borrar.
- Comprobación visual en navegador (handoff con Carlos).

## Riesgos

| Riesgo | Mitigación |
|---|---|
| API no oficial de Garmin cambia o bloquea | Errores claros; el entreno sigue visible en la app; respaldo .FIT como fase posterior |
| Login con email/contraseña puede pedir MFA | Se usan los tokens OAuth guardados; si caducan, aviso para reconectar |
| Ritmos mal calculados | Tests con valores de control + ritmo manual para forzar |
| Sesiones ya empezadas con el modelo antiguo | `pasos` es nullable; lo antiguo sigue funcionando |

## Orden de entrega (cada paso se puede probar solo)

1. Ritmos + modelo + validación (sin UI).
2. Migración de las 4 sesiones + vista de pasos en cliente.
3. Envío y programación en Garmin (primera prueba real con Carlos).
4. Editor del coach.
5. Programación automática de la semana.
