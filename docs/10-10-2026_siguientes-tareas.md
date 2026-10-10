# Siguientes tareas — cierre del 10-10-2026

Orden pensado con Carlos. **La prioridad 1 es simplificar la pestaña Entrenamiento.**

## Prioridad 1 — Simplificar la pestaña Entrenamiento (menos duplicados, menos trabajo de revisión)

**Idea de Carlos:** «Nos fiamos de la IA; el coach no tiene que revisar multitud de análisis. Si quiere revisar y aprender de ellos, que pueda, pero no por obligación.»

**Qué hay hoy** (inventariado el 10-10-2026): para un mismo atleta la IA genera **8 tipos de tarea** sobre el entrenamiento y los muestra en **3 sitios distintos**.

| Tipo de tarea | Lo crea | Dónde se ve |
|---|---|---|
| `analisis_rendimiento` | `lib/agentes/analisis-rendimiento.ts` (lunes 07:30 UTC y botón) | Rendimiento → Análisis IA |
| `alerta_rendimiento` | `lib/rendimiento/avisos.ts` (diario) | Tarjeta IA del dashboard |
| `revision_semanal_entreno` | `revisor-semanal-entreno.ts` (lunes) | Decisiones de IA pendientes |
| `alerta_riesgo_entreno` | `riesgo-entreno.ts` (diario) | Decisiones de IA pendientes |
| `alerta_readiness`, `ajuste_nutricion_carga`, `actualizacion_plan` | `supercoach-engine.ts` | Decisiones de IA pendientes |
| `training_brain` | `training-brain.ts` | Decisiones de IA pendientes |
| `plan_entreno_ia` (nuevo) | «Planificar con IA» y cron `proponer-bloques` | Decisiones de IA pendientes |

Superficies: **Decisiones de IA pendientes** (`DecisionesIACliente`), **Panel IA / Training OS** (`TrainingCoachPanel`, plegado) y **Rendimiento** (`PanelRendimiento` + `AnalisisIA`), además de `/agentes` y `/entrenos/brain-ia` a nivel global.

**Problemas conocidos:** varios agentes dicen casi lo mismo (p. ej. riesgo, readiness y análisis de rendimiento sobre la misma fatiga); el Training OS y los análisis se solapan; el coach tiene que decidir sobre cada tarjeta aunque la IA tenga alta fiabilidad.

**Puntos de partida para el diseño** (no son decisiones; hay que brainstormearlos):
1. **Un solo «informe del entrenador IA» por atleta y semana** que consolide análisis, alertas, riesgo y readiness, en lugar de ocho tipos sueltos.
2. **Lo seguro se aplica solo y se puede deshacer; el coach solo ve las excepciones** (riesgo medio o alto, fiabilidad baja, algo que cambia el plan). El motor ya calcula `segura` y `fiabilidad` por decisión.
3. **Historial de IA opcional** (plegado) para quien quiera revisar y enseñar al sistema, sin que sea una obligación.
4. Una sola superficie en la ficha en lugar de tres.
5. Mantener lo ya conseguido: una sola pendiente por cliente y tipo, el aprendizaje de «Me sirve / No encaja» y la trazabilidad (estudio / libro / criterio).

**Cuidado:** la regla de seguridad del proyecto es que la IA no cambia planes de clientes sin supervisión. «Aplicar solo lo seguro» exige decidir con Carlos qué se puede aplicar sin su visto bueno y con qué garantías de deshacer.

## Otras tareas, por orden

| # | Tarea | Contexto |
|---|---|---|
| 2 | **Probar el registro de las híbridas en Garmin** (una como HIIT, otra como Cardio/Conditioning) y ajustar cómo las cuenta el sistema | Hoy 0 sesiones de fuerza vistas en 45 días. Ver `project_hibridas_registro_garmin_pendiente` en memoria |
| 3 | **Investigar apps de Hyrox para Garmin (Connect IQ)** | Mirar qué datos dejan en Garmin Connect y si el sistema podría leerlos |
| 4 | **18-10: primer «siguiente bloque» automático** | El cron `proponer-bloques` debería dejar la propuesta; es la primera prueba real del generador con el esqueleto del macrociclo |
| 5 | Probar «Planificar con IA» en modo «siguiente bloque» con un cliente de prueba (Marcos o Natalia) | No se pudo probar con Carlos todavía |
| 6 | Que `fuerza_sin_registro` cuente también lo registrado en la app (opcional) | Alternativa a registrar todo en el reloj |
| 7 | Enviar las híbridas al reloj como entrenos de Conditioning con sus estaciones | Idea futura; Garmin no tiene SkiErg ni perfil Hyrox |
| 8 | **Limpiar y dejar definitivos los clientes de prueba** | Marcos, Andrés, Natalia, Laura: completar datos (Natalia sin competición registrada, Laura sin perfil, VDOT) o retirarlos |
| 9 | Acabado visual de «Planificar con IA», la tarjeta de propuesta y la etiqueta «Reemplazada» | De Codex |
| 10 | Modo «hábito» para clientes que empiezan o son irregulares; alerta de volumen en descenso sostenido | Pendientes del motor (ver `errores-conocidos-motor.md`) |
| 11 | Revisión del motor por un entrenador humano en activo | Ninguna regla está contrastada así todavía |
| 12 | Menores diferidos de la revisión: índice único para evitar dos propuestas simultáneas; refrescar el botón tras aprobar o rechazar; ocultar «Editar» en propuestas de plan | Ver `docs/superpowers/plans/2026-10-10-planificar-con-ia.md` |
| 13 | Pendientes de rendimiento anteriores: migración `20261009210000_entrenos_rpe.sql` sin aplicar; pregunta de RPE en Entreno → Hoy; modelo Hyrox; HRV y sueño | Detalle en `CLAUDE.md` |

## Qué se hizo el 10-10-2026 (resumen)
- **Motor de planes:** macrociclo determinista con datos reales del cliente, ritmos de Daniels desde el VDOT, fundamentos por regla (estudio / libro / criterio), regla de la sesión más larga (+10 %), calibración sin datos, planes de los clientes de prueba y simulación de evolución. Verificación única `npm run verificar:motor` (36 comprobaciones) y registro de 21 errores conocidos con su test.
- **Contraste con fuentes:** la «regla del 10 % semanal» no está validada; la evidencia útil es Frandsen 2025. Tres estudios nuevos cargados (Frandsen 2025, Brandt 2025 de Hyrox y Couch-to-5K 2023).
- **«Planificar con IA»:** un solo botón que decide el modo y deja una propuesta aprobable; guardado seguro del plan; ruta con comprobación de coach.
- **Una sola tarea pendiente** por cliente y tipo, con limpieza, y cron diario que prepara el siguiente bloque.
