# Motor de rendimiento fiable — cómo funciona y cómo se extiende

Objetivo: que el coach solo tenga que aprobar o retocar. La IA no decide por sí sola; decide un motor comprobable.

## Tres capas

1. **Motor de reglas** (`lib/rendimiento/reglas.ts`, determinista). Decide QUÉ proponer. Cada regla tiene condición explícita, cifras calculadas, estudios por DOI, riesgo, métrica objetivo y prioridad. Misma entrada, misma salida.
2. **IA** (`lib/agentes/analisis-rendimiento.ts`). Escribe el resumen y las lecturas y puede añadir como máximo 2 decisiones nuevas. Pasa por las **vallas** (`guardas.ts`): descarta lo que sube carga con una alerta de sobrecarga o a menos de 14 días de una carrera, lo que duplica una regla del motor, lo que trae valores vacíos, y quita la métrica objetivo que no encaja con el tipo de sesión. Si la IA falla, el análisis sale igualmente con lo del motor.
3. **Pruebas** (`scripts/*.test.ts` y `scripts/backtest-reglas.ts`). Atletas sintéticos con resultado esperado y reproducción sobre el historial real.

## Qué ve el coach de cada decisión
Origen (motor o IA), riesgo, fiabilidad (calculada, con sus motivos), si es «segura», y los estudios con enlace al DOI. La fiabilidad NO es la confianza que declara el modelo: sale de la cantidad de datos, la calidad de los estudios y si la situación se repite (`calcularFiabilidad`). «Segura» = regla del motor + riesgo bajo + fiabilidad ≥ 0,6.

## Reglas actuales
`sobrecarga` · `tapering` · `reparto_suave` · `deriva_alta` · `ejecucion_lenta` · `fuerza` · `fuerza_sin_registro` · `monotonia` · `pulso_reposo` · `progresion`. El motor no propone nada de entrenamiento con menos de 6 carreras con pulso en 6 semanas (`MIN_CARRERAS`).

## Cómo añadir una regla (lista obligatoria)
1. Escribirla en `evaluarReglas` con condición, cifras en el texto y `dois` de estudios que ya estén en la base (constante `DOI`). Sin DOI en la base, queda «criterio de entrenador (sin cita)» y no puede ser «segura».
2. Si necesita un dato nuevo, añadirlo a `EstadoAtleta` (`estado.ts`) con ventana temporal (un dato de hace meses no describe al atleta de hoy: así falló la deriva).
3. Añadir un caso en `scripts/reglas.test.ts` que la dispare y otro que NO la dispare, y asegurarse de que el test de integridad la ejercita.
4. Pasar `npx tsx scripts/backtest-reglas.ts` y mirar que no dispara sin sentido sobre el historial real.
5. Si es de riesgo medio o alto, nunca marcarla como segura.

## Estudios
Solo se cargan con `scripts/cargar-papers-entrenamiento.ts` (DOI + comprobación de que el título coincide + abstract real). Solo se pueden citar estudios con DOI. Las entradas antiguas sin verificar no aportan texto al análisis. Depuración reversible: `scripts/depurar-kb-entrenamiento-2026-10-10.ts`.

## Fallos detectados al construirlo (y por qué existen las pruebas)
- La alerta «demasiada intensidad» usaba zonas por % de pulso máximo (74 % «duro») y contradecía al reparto por umbral (12 % duro). Retirada de las alertas.
- La deriva media usaba carreras de hace meses. Ahora solo cuentan las de las últimas 6 semanas.
- Direcciones («sube/baja») puestas en métricas que ya tienen sentido propio.
- La IA atribuía a autores lo que decía un estudio distinto, ataba métricas que no encajaban y citaba estudios sin DOI verificable.

## Límites conocidos
- Las propuestas del motor son texto para el coach; solo las de la IA con `pasos` se pueden aplicar al plan y al reloj desde la pantalla.
- Probado con un solo atleta real (Carlos). Antes de ofrecerlo a clientes hay que pasar el backtest con sus datos.
- La fiabilidad es una estimación transparente, no una probabilidad de acierto.
