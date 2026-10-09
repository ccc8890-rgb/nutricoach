# Panel de rendimiento y entrenador IA (09-10-2026)

Ficha del cliente → Entrenamiento → **Rendimiento**. Para el coach; el atleta no lo ve.

## Qué hay

| Bloque | Qué hace | Código |
|---|---|---|
| Entrenos | Un registro por entreno de Garmin: ritmo, pulso, zonas, carga, mejores parciales y **vueltas** | tabla `entrenos_realizados`, `lib/rendimiento/garmin-entrenos.ts` |
| Carga (TSS) | Mayor de ritmo (GAP vs umbral Garmin) y pulso (tiempo en zonas). En cinta solo pulso | `lib/rendimiento/carga.ts` |
| Forma/fatiga/frescura | CTL 42 d, ATL 7 d, TSB, subida de forma, monotonía de Foster | `lib/rendimiento/pmc.ts` |
| Alertas | Reglas deterministas (subida rápida, fatiga, llegar cansado, monotonía, salto semanal, pulso en reposo, exceso de zonas altas) | `lib/rendimiento/alertas.ts` |
| Plan vs realizado | Empareja cada sesión con su entreno y evalúa repetición a repetición (o como bloque) | `cumplimiento.ts`, `ejecucion.ts` |
| Entrenador IA | Análisis semanal (DeepSeek) con alertas, ejecución y decisiones previas del coach. Tipo de tarea `analisis_rendimiento` | `lib/agentes/analisis-rendimiento.ts` |
| Aplicar cambios | Pasos nuevos propuestos por la IA, con barandillas, vista previa y deshacer | `aplicar-decision.ts`, `cambio-sesion.ts` |
| VDOT | Estimación con esfuerzos reales; solo propone subir; historial | `vdot.ts`, `zonas.ts`, `perfil_entreno_cliente.vdot_historial` |
| Simulador de objetivo | Viabilidad, fases, carga semanal, sesiones clave con pasos | `plan-objetivo.ts`, `plan-cliente.ts` |
| Aplicar semana | Lleva una semana del simulador al plan activo y al reloj; deshacer | `aplicar-semana.ts`, `perfil_entreno_cliente.plan_objetivo_log` |

## Cómo se alimenta

- `syncGarminClientDays` (cron diario `/api/cron/sync-integraciones`) trae resumen diario, los últimos 20 entrenos y las vueltas de 10 entrenos sin ellas.
- Histórico: `npx tsx --env-file=.env.local scripts/rendimiento-backfill.ts <cliente_id> 300` (idempotente; recalcula el TSS con los umbrales actuales).
- Análisis: cron `/api/cron/analisis-rendimiento` los lunes 07:30 UTC (máx. 15 atletas y 240 s por pasada). A mano: botón «Nuevo análisis».

## Reglas que no se rompen

1. **La IA propone, el coach decide.** Aprobar un análisis no toca el plan ni escribe al atleta (`aplicar.ts` solo deja constancia). Aplicar un cambio es un botón aparte, con confirmación.
2. Todo cambio de pasos pasa por `validarCambioPasos`: ritmos 2:30–8:00/km, rango ≤ 40 s/km, volumen entre el 40 % y el 140 % de la sesión actual, sesión del plan activo del atleta.
3. El navegador nunca envía pasos: el servidor recalcula el plan o lee la propuesta guardada.
4. El VDOT solo sube con evidencia (nunca baja por falta de pruebas) y no salta más de 6 puntos.
5. No guardar un objetivo inventado como competición: altera la periodización de nutrición.

## Cómo deshacer

- Cambio de la IA o semana del plan: botón «Deshacer» (restaura pasos y nombres; reenvía al reloj).
- VDOT: el historial guarda el valor anterior; se cambia a mano en `perfil_entreno_cliente.vdot`.
- Migraciones (aditivas): `20261009170000_entrenos_realizados`, `…180000_entrenos_vueltas`, `…190000_vdot_historial`, `…200000_plan_objetivo_log`.

## Límites conocidos

- Garmin no da HRV nocturno ni sueño a Carlos (reloj sin llevar de noche): sin gráfica de HRV hasta que haya datos.
- Fuerza/Hyrox pesan poco en la carga (pulso bajo en gimnasio); falta corrección por esfuerzo percibido.
- Strava conectado pero solo por webhook, sin histórico: el panel va solo con Garmin.
- `hoy` se calcula en UTC: entre las 00:00 y las 02:00 de Valencia puede ser el día anterior.
- Las zonas de pulso son las de Garmin (% del pulso máximo): un rodaje suave con calor puede caer en Z4.
- El planificador es solo de running (sin estaciones de Hyrox ni fuerza).

## Pruebas

`npx tsx scripts/rendimiento.test.ts` (carga, PMC, alertas, cumplimiento, barandillas, VDOT, plan-objetivo, aplicar semana) y `scripts/analisis-rendimiento.test.ts`. En el conjunto completo fallan 2 tests **que ya fallaban antes**: `agente-recetario-pro` y `cliente-visual-system` (portal del cliente).
