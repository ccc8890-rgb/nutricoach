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
