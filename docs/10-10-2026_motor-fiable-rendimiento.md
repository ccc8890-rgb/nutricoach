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

---

# Auditoría profunda (10-10-2026, tarde)

Se revisó el motor capa por capa: datos de entrada, ciencia de cada regla, adaptación al atleta, etiquetas de evidencia, validaciones y la IA. Resultado: 9 fallos corregidos y una lista de límites que siguen abiertos.

## Fallos encontrados y corregidos
1. **La deriva cardiaca estaba inflada por el calentamiento.** En 34 de 39 carreras de 30+ min de Carlos el pulso de la 1ª vuelta era >12 ppm menor que el resto, y la deriva media bajaba con la duración (14,5 % en 30-40 min frente a 6,1 % en 75+). Ahora se excluyen los 10 primeros minutos y se exigen 30 min útiles. Con el método corregido la deriva de Carlos es 0,6-6 % (últimas 6 semanas: 3 %): **la conclusión anterior de que «los rodajes van demasiado fuertes» era una exageración.** La propuesta de reparto sigue en pie, pero se presenta como optimización y baja de prioridad cuando la deriva es baja.
2. **Las etiquetas de evidencia estaban infladas.** Revisiones narrativas (Seiler 2010, Jamnick, Rønnestad, Barnes, Moore, Buchheit I y II, Mujika 2003) estaban marcadas como «revisión sistemática». Corregidas en la base (copia en `salidas/10-10-2026_copia-niveles-kb.json`) y en el cargador. La fiabilidad pasa a ponderar los dos mejores estudios, no solo el mejor.
3. **El motor ignoraba el perfil del atleta.** Ahora lee nivel, días disponibles, lesiones, restricciones y capacidad de recuperación: sin días no propone fuerza; con lesiones declaradas la fuerza es riesgo «alto» y no se propone subir volumen; con recuperación baja o principiante no hay progresión (y el principiante recibe la pauta de alternar caminar y correr).
4. **Tapering único de 14 días.** Ahora usa la tabla del proyecto por disciplina (5K/10K 7 días, media 10, maratón y ultra 14) y una reducción según la duración de la prueba, avisando de que en pruebas cortas las cifras son orientativas.
5. **No había regla para volver de un parón.** Añadida: 50-70 % del volumen, solo suave, +10 %/semana (cifras marcadas como criterio de entrenador); suprime reparto, fuerza y progresión.
6. **La progresión podía proponerse con señales de fatiga** (salto semanal, pulso en reposo alto, monotonía). Ahora las respeta.
7. **El validador de cambios de sesión era permisivo**: admitía +40 % de volumen y no miraba los ritmos contra el VDOT. Ahora: tope +25 %, no se aprieta el ritmo más de 10 s/km de golpe, y los ritmos de trabajo deben caber entre el de repeticiones (R) y el fácil (E) +25 %.
8. **La IA escribía ritmos sin que nadie los validara.** Ahora cualquier ritmo m:ss de su texto se comprueba contra el VDOT; si es imposible, se descarta la decisión.
9. **El prompt tenía dos atribuciones imprecisas** (separar sesiones ≥6 h presentado como cifra de Wilson 2012; umbrales de TrainingPeaks presentados como validados). Corregidas, con el ACWR descrito como termómetro. Y se le ordena no dramatizar lo que el motor presenta como optimización.

También: cada DOI de las reglas se verifica contra la base (`scripts/verificar-doi-reglas.ts`, 15/15 presentes); se cargaron 3 estudios que faltaban (consenso de sobreentrenamiento ECSS/ACSM 2013, consenso COI de carga 2017, desentrenamiento parte II).

## Comprobado sin hallazgo
- **Calidad del pulso de Carlos:** sin señal de «cadence lock» (27 % de carreras con pulso ≈ cadencia, lo esperable por azar) y FC máx coherentes (188-194).
- **Orden de las cifras:** el reparto suave/medio/duro se calcula con el umbral personal medido por Garmin (176 ppm), no con las zonas del reloj por % del máximo.

## Límites que siguen abiertos (no tomar el motor como más de lo que es)
1. **Validado con un solo atleta real** (Carlos) y con atletas sintéticos. No hay contraste a ciegas con un entrenador humano ni resultados de clientes.
2. **Depende del pulso de umbral que mide Garmin.** Sin él, el reparto no se calcula (el motor se calla, no inventa). No hay estimación de respaldo: decisión pendiente.
3. **Umbrales de carga de TrainingPeaks** (subida de forma >8, frescura <-30) pensados para atletas con más forma acumulada: menos sensibles en corredores con poca carga base.
4. **No hay reglas todavía para** HRV y sueño (faltan datos de noche), calor y altitud, tiempo objetivo frente a marca prevista, ni detector automático de pulso mal medido (se comprobó a mano para Carlos).
5. **Las propuestas del motor son texto para el coach**; solo las decisiones de la IA con pasos se aplican al plan y al reloj desde la pantalla.
6. **La IA puede equivocarse en texto libre** de formas que las vallas no contemplan; por eso sus decisiones salen siempre «revisar», con riesgo medio y fiabilidad baja.
7. **La fiabilidad es una estimación transparente con pesos elegidos por criterio**, aún sin calibrar contra resultados reales (el seguimiento de 4 semanas es lo que permitirá calibrarla).
8. **No se ha auditado el motor que GENERA planes nuevos** (`proponer-plan-ciencia`, `generar-plan-inicial`, plantillas). Este documento audita el motor que analiza y ajusta el entrenamiento ya hecho.
