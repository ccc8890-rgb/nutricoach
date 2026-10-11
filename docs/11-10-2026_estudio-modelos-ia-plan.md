# 11-10-2026 — Estudio de modelos de IA para generar planes de entrenamiento

Herramientas: `scripts/benchmark-modelos-plan.ts` (mismo caso, mismo prompt, mismos validadores; solo cambia el modelo; no escribe en la BD) y `lib/entrenos/evaluar-plan-ia.ts` (puntuación objetiva). Resultados crudos en `salidas/benchmark-modelos/<fecha>/` (carpeta ignorada por git). `generarPlanEntrenoIA` acepta ahora un `proveedor` opcional (por defecto sigue siendo `deepseek-chat`).

Casos: Carlos (híbrido Hyrox + running), Natalia (maratón), Marcos (híbrido, Hyrox Madrid), Andrés (fuerza, LDL alto). 4 casos × 5 modelos.

## Resultado

| Modelo | Media (obj.) | Fallos | Tiempo medio | Tokens de salida | Notas |
|---|---|---|---|---|---|
| deepseek-chat (el de hoy) | 96 | 0/4 | 22 s | 3,5-4,6 k | Rápido y correcto; notas más escuetas; día de pierna muy cargado en Carlos |
| deepseek-v4-pro | 74 | **1/4** (JSON no válido, Marcos) | 76 s | 8,8-10,6 k | Progresiones muy detalladas y cita interferencia (Wilson 2012, Schumann & Rønnestad 2019); obedece mejor el esqueleto; poco fiable en formato |
| gpt-5.5 (OpenAI) | 94 | 0/4 | 67 s | 5,8-8,9 k | Mejor razonamiento de coach (interferencia, carga de pierna medida, notas con el porqué); casi nunca cita autores |
| gemini-2.5-pro | 0 | 4/4 | — | — | Retirado para cuentas nuevas (404) |
| gemini-3.1-pro | 0 | 4/4 | — | — | Sin cuota con la clave actual (429, sin facturación) |

Claude no se pudo probar: no hay clave de API de Anthropic en el proyecto.

## Qué enseña
1. **El andamio determinista manda más que el modelo.** Los tres modelos que respondieron copiaron la misma estructura de carrera (35/50/60 min) del esqueleto. La puntuación objetiva se satura (92-100): diferencia poco. La calidad que importa (razonar interferencia fuerza-carrera, medir la carga de la sesión, justificar) solo se ve leyendo los planes.
2. **Lectura de un entrenador (sesión de pierna de Carlos):** deepseek-chat mete sentadilla 5×5 + peso muerto rumano 4×6 + zancadas búlgaras + sled push + 4×400 m (demasiada carga de pierna en un día); gpt-5.5 baja a sentadilla 5×4 + sled push + carrera + remo y lo razona; v4-pro es el más específico en la progresión semanal.
3. **Fiabilidad:** v4-pro falló un JSON (truncado o mal cerrado tras ~100 s) → hace falta reintento. Hoy no hay ninguno.
4. **Citas:** el prompt solo inyecta 5 papers genéricos y casi nadie los cita (0-3). La evidencia dirigida es una mejora pendiente independiente del modelo.
5. **El estudio cazó un fallo del sistema:** en Marcos, DeepSeek y GPT-5.5 dejaron una híbrida con carrera el día antes de la tirada y el reparto determinista no lo evitaba. Corregido (`conCarrera` en `repartirHibridas`, penalización 500; test).
6. En Natalia, deepseek-chat y gpt-5.5 añadieron calidad fuera del esqueleto (aviso `fuera_de_esqueleto_calidad`); v4-pro obedeció.

## Recomendación (pendiente de decidir con Carlos)
- El modelo se elige por tarea: **gpt-5.5 para el informe del caso y el plan** (razona mejor, 0 fallos), con **deepseek-v4-pro o deepseek-chat como respaldo** si falla o se agota el saldo, y **todo pasando por los validadores y un bucle de corrección** (la IA corrige hasta 3 veces lo que el validador marque).
- Añadir reintento de JSON y comparar también con Claude (hace falta clave de API de Anthropic) y con otros casos (nutrición).
- Coste en dólares no medido (solo tokens); el plan se genera una vez por bloque, así que el coste por plan es pequeño frente a su valor.
