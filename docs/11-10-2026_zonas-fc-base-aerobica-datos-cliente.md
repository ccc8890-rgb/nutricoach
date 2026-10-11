# 11-10-2026 (noche) — Zonas de pulso, base aeróbica, leyendas y pestaña «Datos» del cliente

Commits (main): `7145ba6`, `78c8864`, `94c6eec`, `683508a`, `f3ef116`, `864cda4`. Sin migraciones de BD.

## 1. Ritmos y leyenda de la sesión (`components/training/PasosSesion.tsx`, `lib/entrenos/pasos.ts`)
- Cada paso muestra ritmo + nombre de zona: «Trabajo 20:00 @ 4:38/km (umbral)».
- Leyenda al final solo con las zonas que usa la sesión: nombre, pulso (si se conoce), RPE y para qué sirve. Textos en `ZONAS_RITMO`. `zonasUsadas()` decide cuáles salen.
- Sin VDOT: el paso sigue diciendo «zona I» (lo exige `scripts/pasos.test.ts`).

## 2. Zonas de pulso y envío a Garmin (`lib/entrenos/zonas-fc.ts`)
- `zonasFcDesde({fcUmbral, fcMax})`: E = techo del 90 % del umbral y 79 % del máximo (el más estricto; Carlos: 153 ppm), M 93-97 %, T 97-102 %, I ≥100 % del umbral. R sin pulso.
- Garmin: los pasos de zona **E** van con objetivo de pulso (rango min-techo); M/T/I/R siguen por ritmo (±3 %). Sin datos de pulso todo igual que antes.
- `huellaPasos(pasos, vdot, techoFcE)`: la huella incluye el techo E solo si se conoce, así que las sesiones ya enviadas se reenvían solas con el formato nuevo (cron `enviar-garmin`, respetando `MAX_ENVIOS`). Cron y `enviarSesionAGarmin` calculan la huella igual; si se cambia uno, cambiar el otro.
- `/api/cliente/sesion/[id]` devuelve `fc` junto a `ritmos` (lo usan coach y cliente).

## 3. Base aeróbica (`lib/rendimiento/base-aerobica.ts`, `components/rendimiento/BaseAerobica.tsx`)
- Solo rodajes suaves: carrera continua al aire libre ≥25 min, pulso medio ≤ techo E, sin patrón de series.
- Ritmo al pulso de referencia = 1000 / (EF·fcRef/60). Ventanas de 28 días (reciente) vs 28 anteriores, medianas, mínimo 3 rodajes por ventana. ±2 % de eficiencia = estable (ruido).
- Está en Rendimiento → Running → Forma física, arriba. Test: `scripts/base-aerobica.test.ts`.
- **Dato real de Carlos:** 19 rodajes suaves en total pero no hay 3 en cada ventana: sus rodajes suelen superar los 153 ppm. Saldrá cuando el techo de pulso del reloj haga efecto.

## 4. Leyendas «Cómo leerlo» del panel del coach (`components/rendimiento/ayudas.ts`)
- `Bloque` acepta `ayuda="clave"` y pinta un desplegable cerrado (qué mide, cómo leerlo, «Ojo»). 15 análisis cubiertos. Un solo sitio de textos.

## 5. Pestaña «Datos» del cliente (`/cliente?tab=datos`)
- Menú inferior: Hoy · Dieta · Entreno · Recetas · **Datos**. **Ajustes** se abre pulsando el avatar (iniciales) de la cabecera; dentro hay «‹ Hoy».
- API `GET /api/cliente/[codigo]/datos` (guard `autorizarAccesoPlan`: cliente propietario o su coach). Lógica pura en `lib/rendimiento/datos-cliente.ts` (test `scripts/datos-cliente.test.ts`). UI en `components/PortalCliente/DatosCliente.tsx`.
- Secciones: Recuperación (Training Readiness de Garmin, rango habitual = media ± 1 DE a 30 días, solo con ≥14 días), Sueño (solo con ≥3 noches en 14 días), Entrenamiento, Base aeróbica (solo con datos), Cuerpo (peso). Sin reloj: invitación a conectarlo en Ajustes.
- **Límites de datos:** HRV de Garmin llega como una media semanal constante (51,1 ms): se muestra como cifra, sin gráfica. Sueño: 2 de 30 noches. `training_recovery_time_h` trae valores incoherentes: no se usa. Solo se traducen los 4 códigos de `training_readiness_feedback` vistos; otro código = sin frase.
- Sin tarjetas vacías y sin consejos automáticos al cliente.

## Auditoría de cierre
- `tsc` limpio, `npm run build` OK, tests de pasos, garmin-auto, garmin-workouts-formato, base-aerobica, datos-cliente, ritmos, rendimiento, estado, guardas, reglas y motor en verde.
- Ruta nueva con autenticación y comprobación de propietario; sin secretos en el código; sin tablas nuevas.
- **No visto en navegador ni en el reloj.**

## Pendiente
1. Ver `/cliente?tab=datos` en Vercel con Carlos y comprobar el menú de 5 botones y el avatar a 390 px.
2. Comprobar que el reloj recibe rodajes con techo de pulso (Garmin Connect → entreno programado) tras el reenvío del cron.
3. Adherencia a la dieta en «Datos»; HRV nocturno y sueño cuando haya noches; puntuación propia de recuperación solo con datos validados.
4. Acabado visual de Datos, avatar y menú: Codex.
5. Pendiente de decidir: mostrar las leyendas del coach también en la ficha del cliente si Carlos lo quiere.

---

# Adenda (11-10-2026, noche) — El motor detecta planes por debajo de la carga real

**Problema:** todas las guardas solo vigilaban pasarse (salto >20-30 %, «REGLA DURA ≤ +20 %»). Nada detectaba un plan que se queda corto. El plan Base de Carlos sumaba 97 min/17 km de carrera por semana frente a 150-165 min/28-30 km reales, con una tirada de 40 min frente a 77. Causa de fondo: el motor partía de la **media de 4 semanas (89 min)**, hundida por viajes y vacaciones, y solo ignoraba semanas en cero.

**Qué se hizo (commit `af65df8`)**
- `lib/entrenos/capacidad.ts`: capacidad demostrada = mayor entre la media de 4 semanas y el **80 % de la mejor semana reciente** (Carlos: 133 min). Criterio de entrenador, no de un estudio.
- `macro-desde-cliente.ts`: el volumen de partida del macrociclo usa esa capacidad (no en principiantes, con lesión/restricción ni con parón). Se declara en `supuestos`.
- `lib/entrenos/plan-vs-realidad.ts`: `resumenPlanCarrera` (suma de las sesiones con pasos) y `brechaPlanCapacidad` (plan <85 % de la capacidad o tirada <75 % de la más larga reciente).
- `estado.ts`: `capacidadCarreraSemana` y `planCarrera`. `reglas.ts`: regla **`plan_corto`** (propuesta de riesgo medio, DOI Mujika 2000 sobre desentrenamiento; solo con datos, sin parón, descarga, lesiones, fatiga ni principiante, y con competición a >21 días).
- `validar-plan-carrera.ts`: hallazgos `plan_por_debajo_realidad` y `tirada_por_debajo_realidad` (no se avisa con `planConservador`: retorno, descarga, lesión o principiante).
- `generar-plan-ia.ts`: la «REGLA DURA» ahora es de **dos lados** (90-120 % de la capacidad) y le dice a la IA que no baje de su carga real; `contexto.ts` añade la línea «PLAN FRENTE A SU CARGA REAL» al análisis.
- Test `scripts/plan-vs-realidad.test.ts` (incluido en `npm run verificar:motor`, 44/44).

**Plan de Carlos aplicado (datos en BD, sin migración):** Series 45 min (4×1000 m I, 8,8 km) · Rodaje 40 min (6,8 km, con techo de pulso) · Tirada 65 min (11 km) = **150 min/26,6 km por semana** (antes 97/17). Copia de lo anterior en `salidas/11-10-2026_backup-sesiones-running-carlos.json` (carpeta ignorada por git). Garmin las reenvía solo (cambia la huella).
- **Progresión:** dentro de un bloque la plantilla semanal es fija; la progresión va **entre bloques**. El motor calcula S1 145 → S2 160 → S3 175 → S4 descarga 125 min (≈ +10 %/semana). El siguiente bloque partirá de lo que corra de verdad.
- Series: el motor limita el trabajo intenso a ~8 % del volumen (Daniels), lo que da series muy cortas (3×3'); en Carlos se dejó 4×1000 m porque ya hizo 48 min / 9 km de series tempo el 08-10. Decidir si ese tope se relaja para atletas avanzados con poco kilometraje.

**Pendiente**
1. **Hyrox con carrera dentro** (bloques estación + 500 m de cinta) en las sesiones híbridas: hoy son solo gimnasio. Cabe como ejercicios con distancia; el reloj no los guiará.
2. Mostrar la brecha «plan vs carga real» en el panel del coach (hoy sale en las propuestas del motor, en el análisis IA y en el validador).
3. Revisar el tope de series (8 %) para avanzados.
4. Fuerza/híbridas: no existe aún el equivalente de «capacidad» para fuerza (0 sesiones registradas en Garmin).

## Adenda 2 (11-10-2026, noche) — Los dos lados, Hyrox con carrera y cruces entre sesiones

- **Plan por encima:** `brechaPlanCapacidad` devuelve también `planExcesivo` (>125 % de la capacidad) y la regla `plan_excesivo` propone bajar (riesgo bajo, DOI Nielsen 2014). El test cazó un fallo: `plan_corto` saltaba también con un plan excesivo; ahora solo con `planCorto` o `tiradaCorta`.
- **Validador:** `salto_volumen` y `subida_volumen` se miden contra la capacidad (si se conoce) y no contra la media de 4 semanas; si no, un plan correcto (150 min) habría salido como «+78 %».
- **Hyrox con carrera dentro:** las 3 híbridas de Carlos llevan ahora «Carrera continua» tras la estación (Pierna: 4×500 m tras el sled push; SkiErg: 5×400 m; Sled pull/farmer: 3×500 m), a ritmo de maratón, como ejercicios con distancia (no van al Garmin; si luego se puede, se estudia). Copia anterior en `salidas/11-10-2026_backup-sesiones-hibridas-carlos.json`. El prompt del protocolo híbrido pide ese bloque en cada híbrida y aclara que no cuenta como sesión de carrera ni cambia el esqueleto.
- **Cruces entre sesiones (revisión de semana, `validarRepartoSemana`):** ya existían pierna antes de tirada/calidad, mismo día y 48 h entre piernas; añadidos `carrera_comprometida_antes_tirada` y `sin_dia_de_descanso`. La semana de Carlos (Mar series · Mié pierna · Jue superior + rodaje · Sáb tirada · Dom superior; descanso lunes y viernes) pasa la auditoría sin hallazgos.
- Series: el tope del tiempo a ritmo I sube del 8 % al 12 % del volumen en avanzados (`TOPE_INTERVALOS`, criterio de entrenador).
- Pendiente: poder llevar las híbridas de Hyrox al Garmin (probar HIIT / Cardio-Conditioning o app de Connect IQ); si no, queda como sesión registrada a mano.
