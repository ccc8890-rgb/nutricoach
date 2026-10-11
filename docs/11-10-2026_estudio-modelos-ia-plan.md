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

---

# Ronda 2 (11-10-2026, noche) — Uso real de los estudios y Claude incluido

**Cambio:** el plan ya no recibe 5 papers genéricos sin clave. `estudiosParaPlan` (lib/rendimiento/evidencia.ts) elige hasta 16 estudios con DOI de la base según el caso (modalidad, objetivo, nivel, lesiones, edad, sexo; ej. entrenamiento concurrente e Hyrox en híbridos) con claves K#. El JSON del plan lleva `decisiones_clave` (6-10: intensidad/volumen, progresión y descarga, interferencia, individualización, selección) con `tipo` («estudio» o «criterio_entrenador») y `evidencia: [K#]`. `resolverEvidenciaPlan` (lib/entrenos/evidencia-plan.ts) convierte las claves en estudios reales, descarta las inventadas y detecta «Autor año» en el texto libre que no esté en la lista ofrecida. El coach lo ve en «Por qué este plan» (PropuestaPlanEntreno). Test: `scripts/evidencia-plan.test.ts` (en `verificar:motor`).

**Claude:** no hay clave de API de Anthropic en ningún sitio (se buscó en .env, Vercel, shell y ~/.claude); Claude Code va con la suscripción. En el banco de pruebas se llama por la CLI (`claude -p`, sin herramientas ni CLAUDE.md), solo para estudiar; en producción haría falta clave de API. Coste equivalente medido de Opus: ~0,2 USD por plan.

| Modelo | Casos OK | Decisiones con estudio (media) | Estudios distintos citados | Claves inventadas | Autores no verificables | Nota |
|---|---|---|---|---|---|---|
| deepseek-chat | 4/4 | 5,2 | 8,5 | 0 | 0 | 22-25 s; alguna cita forzada (p. ej. un metaanálisis de maratón para justificar la carrera tras estación) |
| deepseek-v4-pro | **1/4** | 3 | 6 | 0 | 0 | 3 de 4 con JSON inválido o cortado (100-114 s): no fiable así |
| gpt-5.5 | 4/4 | 5,5 | 11,8 | 0 | 0 | 70-90 s; notas más largas (143 caracteres de media) |
| claude-opus (CLI) | 4/4 | 5,8 | 11,2 | 0 | 0 | ~105 s; personaliza con los datos (CTL, fatiga, reparto de intensidad) |
| claude-sonnet (CLI) | 0/1 | — | — | — | — | Se colgó 16 min (CLI); sin resultado |

**Lectura:** con la evidencia dirigida los tres modelos que responden citan estudios reales y relevantes (concurrent training, distribución de intensidad, prevención de lesiones) y ninguno inventa. Antes citaban 0-3. La decisión de «carrera tras la estación» (Hyrox) queda sin estudio porque la base apenas tiene papers de Hyrox: se marca como criterio de entrenador, sin inventar. **Límite:** el sistema verifica que el estudio existe y es de la lista, no que respalde esa decisión concreta (relevancia): hace falta un paso de auditoría (otro modelo o el coach).

---

# Ronda 3 (11-10-2026, noche) — Enrutador de modelos por tarea, Claude por API y bucle de corrección

Decisión de Carlos: quiere los mejores modelos, está dispuesto a meter saldo en la API de Claude y combinar con GPT según la tarea; plan y dieta potentes, con regeneración y bloques nuevos con el tiempo.

**Hecho**
- `lib/ia/anthropic.ts`: Claude con el SDK oficial (`@anthropic-ai/sdk`), `claude-opus-5-5`, razonamiento adaptativo, esfuerzo alto, streaming y respaldo automático ante rechazos de seguridad (`fallbacks: 'default'`, beta `server-side-fallback-2026-07-01`). Lee `ANTHROPIC_API_KEY`.
- `lib/ia/enrutador.ts` (`llamarIA(tarea, …)`): rutas por tarea con respaldos, saltando proveedores sin clave, con error, sin tiempo o con JSON inválido. Por defecto: plan_entreno y plan_dieta = Opus 5.5 → GPT-5.5 → DeepSeek; auditoria = GPT-5.5 → Sonnet 5.5 → DeepSeek (otra familia que la que genera); analisis_rendimiento = Sonnet 5.5 → GPT-5.5 → DeepSeek; texto_barato = DeepSeek. Cambiable con `IA_RUTA_<TAREA>=proveedor:modelo,…` sin tocar código. Test: `scripts/enrutador-ia.test.ts`.
- `generarPlanEntrenoIA` usa el enrutador por defecto y tiene **bucle de corrección** (`lib/entrenos/reparar-plan.ts`): si el plan incumple reglas del motor (volumen, esqueleto, nº de sesiones, citas inventadas, <5 decisiones), se le devuelve a la IA con los problemas, una vez y solo si queda tiempo; se acepta la versión corregida solo si tiene menos problemas. Queda anotado en `plan._correccion`. Rutas interactivas a `maxDuration = 300`.
- Prueba real (sin clave de Anthropic todavía): Carlos, 83 s, **GPT-5.5**, 100 pts, 9 decisiones (6 con estudio, 14 estudios distintos), 0 correcciones necesarias. El camino de corrección no se ha ejercitado en una ejecución real (el plan salió limpio): solo está probado en sus piezas puras.

**Pendiente**
1. Poner `ANTHROPIC_API_KEY` en `.env.local` y en Vercel (Production) y probar con `npx tsx scripts/probar-plan-enrutado.ts`.
2. Dietas (`generar-plan-inicial`, `lib/deepseek.ts`) siguen con DeepSeek: pasarlas al enrutador con el mismo método (estudios dirigidos + bucle de corrección con sus validadores) y estudiarlas con un banco de pruebas propio.
3. Auditoría de relevancia de citas con un segundo modelo (ruta `auditoria`).
4. Generación en segundo plano (una petición de 90-200 s es mala experiencia): cola + aviso al terminar.
5. Coste: Opus 5.5 ≈ 4/20 USD por millón de tokens de entrada/salida (≈0,2 USD por plan medido por la CLI); medir el real con `uso` cuando haya clave.
