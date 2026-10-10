# Investigación: cómo estiman, estudian y progresan a los atletas las apps pro

10-10-2026 · Para decidir qué añadir al panel de Rendimiento de NutriCoach.
Lo marcado con (*) es conocimiento general de ciencia del deporte, no verificado en esta búsqueda.

## 1. Cómo funciona cada una

### TrainingPeaks (la referencia del coach)
- **Una sola unidad de carga: TSS.** Combina duración e intensidad respecto al umbral del atleta. 100 TSS = 1 hora en el umbral. En carrera, 111 TSS por hora al ritmo/pulso de umbral.
- **Gráfico de gestión de rendimiento (PMC):** CTL = forma (media exponencial de ~42 días de TSS), ATL = fatiga (~7 días), TSB = CTL − ATL = frescura. TSB positivo = fresco; negativo = acumulando fatiga, que es necesario para adaptarse.
- **Cumplimiento (compliance):** compara lo planificado con lo hecho por TSS, duración o distancia, y colorea cada día: verde dentro del ±20 %, amarillo hasta el ±50 %, naranja más allá, rojo si no se hizo.
- **Panel del coach:** cada atleta tiene su dashboard con gráficos configurables (fecha, tipo): carga completada vs planificada, duración, distancia. Hay además un plan anual (ATP) que reparte semanas por fases hacia las carreras.
- **Idea clave:** el coach no mira una app llena de números, mira **tres cosas**: cumple el plan, cuánta forma lleva, cuánta fatiga arrastra.

### Garmin / Firstbeat
- **Carga aguda** (suma ponderada de EPOC de los últimos días) frente a rango óptimo individual. **Ratio de carga** aguda/crónica: bajo <0,8, óptimo 0,8-1,4, alto 1,5-1,9, muy alto ≥2,0.
- **Foco de carga:** reparte la carga en tres categorías (aeróbico bajo, aeróbico alto, anaeróbico) y dice cuál falta. Necesita 7 días para estimar y 4 semanas para objetivos detallados.
- **Preparación para entrenar (Training Readiness, 1-100):** mezcla seis factores: sueño de anoche, tiempo de recuperación, estado de HRV, carga aguda, historial de sueño de 3 noches e historial de estrés de 3 días.
- **Sugerencias diarias:** para darlas necesita una estimación de VO₂max. Se adaptan solas a cómo entrenas, a la recuperación y al VO₂max.

### COROS (EvoLab / Training Hub)
- **Base Fitness** (carga de 6 semanas, exponencial), **Load Impact** (7 días) y **Training Load Ratio** = Impact / Base. Valor bajo: puede asumir más intensidad. Valor alto: riesgo de sobrecarga.
- **Running Fitness / Index:** puntuación tipo rendimiento de maratón, con habilidades separadas (resistencia, umbral, velocidad, sprint) y zonas de ritmo por cada una.
- Es esencialmente el mismo modelo que TrainingPeaks con otros nombres, más una capa de «para qué eres bueno».

### Runna (planes adaptativos para corredores)
- **Parte de un solo tiempo estimado** del corredor y lo aplica a todas las distancias; ese tiempo fija los ritmos de cada sesión.
- **La adaptación viene casi solo de los ritmos registrados** en series y tempo: si **repetidamente** se quedan cortos o se superan, cambia los objetivos. **Una sola sesión no basta**, hace falta patrón, y descarta repeticiones que «parecen erróneas».
- No usa el pulso, ni el RPE, ni las sesiones saltadas para ajustar. Extras: «No me siento al 100 %» (el atleta avisa) y ajuste por calor.
- No publica su algoritmo, así que no se sabe qué es regla fija y qué aprende.

### Intervals.icu y herramientas de coaches
- Mismo trío forma/fatiga/frescura, estimación **automática** de umbrales a partir de esfuerzos máximos para mantener las zonas al día, comparación de curvas entre temporadas y sincronización de bienestar (HRV, pulso en reposo) cada hora. El coach organiza a los atletas con etiquetas y ve una vista de grupo.

## 2. Qué dice la evidencia (importante para no sobre-interpretar)

- **El ratio agudo:crónico (ACWR) no predice lesiones.** Hay una crítica fuerte (Impellizzeri y otros): los periodos de 7/28 días son arbitrarios, el ratio puede ser un artefacto estadístico y un ensayo aleatorizado con 482 futbolistas no mostró menos lesiones al gestionarlo. Sirve como **termómetro de cómo ha cambiado la carga**, no como alarma de lesión. Conviene mostrarlo así.
- **Distribución polarizada / 80-20:** alrededor del 80 % del tiempo fácil y 15-20 % duro, casi nada en el umbral. En un ensayo con 48 atletas (9 semanas) la polarizada mejoró más el VO₂ pico y el tiempo hasta el agotamiento que la centrada en umbral, y un metaanálisis de 2024 (17 estudios, 437 atletas) da una ventaja pequeña pero significativa.
- (*) **«Regla del 10 %» de subida semanal:** tiene poco apoyo; lo razonable es subir de forma gradual y descargar cada 3-4 semanas. Una rampa de forma de unos 5-8 puntos de CTL por semana suele considerarse sostenible; por encima de ~8 conviene vigilar (es el umbral que ya usamos).
- (*) **Banister (modelo forma-fatiga):** es el fundamento de CTL/ATL/TSB; funciona bien como resumen, pero los parámetros (42 y 7 días) son promedios y varían por atleta.
- (*) **VDOT de Daniels:** estima el nivel desde un tiempo de carrera y da los ritmos de cada tipo de sesión; es lo que usamos.

## 3. Cómo estiman al atleta y cómo fijan los siguientes entrenos

| Pregunta | TrainingPeaks / COROS | Garmin | Runna |
|---|---|---|---|
| ¿Qué nivel tiene? | Umbral de pulso/ritmo que fija el coach o la plataforma | VO₂max estimado por el reloj | Un tiempo que da el atleta |
| ¿Cuánta carga ha hecho? | TSS → CTL/ATL | EPOC → carga aguda/crónica | Ritmos de las sesiones clave |
| ¿Cómo sabe si está listo? | TSB y compliance | Training Readiness (HRV, sueño, estrés) | Aviso manual del atleta |
| ¿Cómo fija el siguiente entreno? | El coach, con el plan anual | Sugerencia diaria por VO₂max y recuperación | Sube/baja ritmos si hay patrón repetido |
| ¿Cómo progresa? | Rampa de CTL planificada por fases | Foco de carga que pide lo que falta | Plan por semanas hacia la fecha de carrera |

**Patrón común:** (1) un nivel estimado, (2) una medida de carga, (3) una señal de «¿llega bien?» y (4) una regla que **solo cambia objetivos cuando hay un patrón**, no por una sesión suelta.

## 4. Dónde estamos nosotros (panel actual)

Ya lo tenemos, y a nivel de las apps pro: CTL/ATL/TSB, rampa semanal, monotonía, carga por semana, **plan vs realizado por repetición** (más fino que el compliance de TrainingPeaks), VDOT y zonas, simulador de plan hacia una carrera, entrenador IA supervisado que aprende del coach, eficiencia aeróbica, deriva cardiaca y técnica normalizada por ritmo.

Lo que **no** tenemos y las apps sí:

1. **Distribución de intensidad (80/20):** con `tiempo_zona_fc` ya guardado se puede calcular qué % del tiempo va en fácil, umbral y duro. Con los datos de Carlos probablemente salga demasiado tiempo en zona 3-4 (rodajes a ~5:30 con ~160 ppm).
2. **Ratio de carga agudo/crónico**, mostrado como termómetro (no como predictor de lesión) y con la nota de evidencia.
3. **Cumplimiento semanal en semáforo**, con los cortes de TrainingPeaks (±20 % / ±50 %) sobre la carga y los km planificados.
4. **Proyección de la forma:** «si sigues el plan, tu CTL llegará a X el día de la carrera y tu frescura será Y», con el plan y el simulador que ya existen.
5. **Predictor de tiempos** (5K/10K/media/maratón) a partir del VDOT, con la fecha de la última recalibración.
6. **Ajuste por patrón** al estilo Runna: si en 3 sesiones clave seguidas las repeticiones salen más lentas o más rápidas que el rango, proponer cambiar el VDOT/ritmos. El entrenador IA ya hace algo parecido, pero sin una regla visible y auditable.
7. **«No me siento al 100 %»** en el portal del cliente, que avisa al coach y baja la carga esa semana.
8. **Preparación diaria combinada** (sueño + HRV + pulso en reposo + carga): bloqueada hasta tener noches con el reloj.

## 5. Recomendación de orden

1. Distribución de intensidad (80/20) en la pestaña «Forma física»: es lo que más probablemente cambie cómo entrena Carlos.
2. Cumplimiento semanal en semáforo + ratio de carga como termómetro, en «Carga y recuperación».
3. Predictor de tiempos y proyección de forma hacia la carrera, en «Plan y ejecución».
4. Regla visible de ajuste por patrón (con aprobación del coach) y botón «No me siento al 100 %».
5. Preparación diaria combinada cuando haya datos de noche.

## Fuentes
- [TrainingPeaks: Performance Management Chart](https://www.trainingpeaks.com/learn/articles/what-is-the-performance-management-chart/)
- [TrainingPeaks: guía para coaches y compliance](https://help.trainingpeaks.com/hc/en-us/articles/231470308-TrainingPeaks-Coach-User-Guide) · [dashboard del coach](https://www.trainingpeaks.com/blog/the-top-7-dashboard-charts-for-coaches/)
- [Garmin: carga aguda](https://www8.garmin.com/manuals-apac/webhelp/forerunner970/EN-SG/GUID-5EC24965-C82C-4FEA-8647-313C08B6F7C7-6714.html) · [ratio de carga](https://www8.garmin.com/manuals-apac/webhelp/forerunner965/EN-SG/GUID-4535C8CD-357C-4673-8EBB-F1BCBE878158-2712.html) · [Training Readiness](https://www8.garmin.com/manuals/webhelp/GUID-31D23DBB-57C2-4DF7-A0C9-8D1A00AB4BE7/EN-US/GUID-C21BE0C8-A08E-4DA1-B6C6-2E0E2DDDB372.html)
- [COROS: training load](https://coros.com/stories/coros-coaches/c/training-load) · [Running Fitness](https://au.coros.com/stories/coros-metrics/c/introducing-running-fitness)
- [Runna: cómo se adapta (the5krunner)](https://the5krunner.com/2026/09/28/is-runna-ai/)
- [ACWR: no es un predictor de lesión (SimpliFaster)](https://simplifaster.com/articles/acwr-high-performance-tool/) · [PMC7534938](https://pmc.ncbi.nlm.nih.gov/articles/PMC7534938/)
- [Entrenamiento polarizado / 80-20 (Seiler)](https://getfitcraft.com/science/polarized-training-research)
- [Intervals.icu](https://intervals.icu)
