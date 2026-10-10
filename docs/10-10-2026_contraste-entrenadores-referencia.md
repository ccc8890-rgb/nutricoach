# Contraste con entrenadores de referencia — ¿vamos por el camino correcto?

10-10-2026. Compara las decisiones de nuestro motor (el que analiza lo entrenado y el que genera planes) con la metodología publicada de entrenadores humanos reconocidos y con la revisión sistemática más reciente sobre cómo entrenan los corredores de élite.

**Qué es y qué no es este contraste.** Es una comparación **documental** con métodos publicados, no una revisión a ciegas por un entrenador humano en activo. Las fuentes son páginas de reseña y resúmenes de los libros, no los libros: hay cifras de segunda mano que conviene verificar en el original antes de darlas por definitivas (se marcan con †). Una validación real exige que un entrenador humano revise decisiones del motor sobre atletas concretos; el protocolo propuesto está al final.

## 1. Qué dicen los entrenadores

| Referencia | Lo esencial (con números) |
|---|---|
| **Jack Daniels** (VDOT) | Cinco intensidades: E 65-79 % del pulso máximo, M 80-90 %, T 88-92 %, I 98-100 %, R por encima del VO₂máx. Topes semanales: T ≤ 10 % del kilometraje, I ≤ 8 %, R ≤ 5 %; M < 20 %. Tirada larga ≤ 25 % del kilometraje y ≤ 2 h 30 min. Cuatro fases de ~6 semanas (base, calidad temprana, calidad de transición, calidad final); en sus planes avanzados, 3 días de calidad por semana sobre 40-70 millas semanales. Vuelta tras parón (6-28 días): la mitad de los días perdidos al 50 % del volumen y la otra mitad al 75 %, todo fácil †. |
| **Pete Pfitzinger** (maratón) | Planes por kilometraje máximo (55, 70, 85, 105 millas/semana), con la base previa al 75-80 % del máximo. Carrera aeróbica general al 70-81 % del pulso máximo (15-25 % más lenta que el ritmo de maratón), tirada larga al 65-78 %, umbral al 82-91 %, intervalos de 3-5 min al 93-95 %. Tirada de hasta 20 millas, medias tiradas de 11-12 millas entre semana, semanas de descarga y 3 semanas de reducción previa a la carrera. |
| **Matt Fitzgerald** (80/20) | 80 % del tiempo a baja intensidad y 20 % a media-alta. Prescripción por tiempo, no por kilómetros. Semana de recuperación cada 3 semanas, un día de descanso fijo, planes de nivel 1 a 3 (de ~30-40 a ~70 millas/semana). |
| **Brad Hudson** (adaptativo) | Un enfoque «receptivo y evolutivo» antes que formulaico: la sesión se ajusta al estado y al rendimiento actuales del atleta. Su mayor influencia es Canova. |
| **Renato Canova** (maratón) | Periodización en base, específica, precompetitiva y reducción; el bloque especial trabaja a ~90 % y ~110 % del ritmo de maratón. Calidad antes que cantidad †. |
| **Hal Higdon** (principiantes) | Media maratón novel de 12 semanas: 4 carreras, 2 sesiones de cruzado, 1 de fuerza y 2 días libres; la tirada más larga es de 10 millas (no se corre la distancia de la prueba antes del día). |
| **Casado et al. 2022** (revisión sistemática, 10 estudios) | Los corredores de fondo de élite siguen sobre todo un reparto **piramidal** (maratonianos) y los de 1.500 m uno **polarizado**; se recomienda periodización tradicional con base duro-fácil y paso de piramidal en la preparación a polarizado en el periodo competitivo. |

## 2. Matriz de concordancia

✓ coincide · ◐ coincide en parte · ✗ difería (corregido) · – no cubierto todavía

| Aspecto | Referencia | Motor de análisis | Generador de planes | Estado |
|---|---|---|---|---|
| La mayor parte del tiempo es suave | Todos; Casado 2022 | Regla de reparto (75-80 % suave) | Prompt corregido | ✓ |
| Reparto piramidal o polarizado, no solo polarizado | Casado 2022 | El texto ya menciona ambos; la regla pide mayoría suave, sin imponer polarizado | Prompt corregido | ✓ (antes el prompt decía solo 80/20) |
| Definición de «fácil» por pulso | Daniels ≤ 79 % del máx.; Pfitzinger 70-81 % | Usamos < 90 % del umbral (la definición más generosa) y se contrasta con Daniels en el aviso | Ritmos de Daniels por VDOT | ✓ la conclusión se mantiene con cualquier definición |
| Ritmos de entreno a partir del VDOT | Daniels | VDOT y recalibración | **Ahora se calculan con VDOT y se inyectan al prompt** (antes los inventaba la IA) | ✗ → ✓ |
| Calidad nunca en días consecutivos; 2 de calidad con ≤ 4 salidas, 3 con 5+ | Daniels, Pfitzinger, Casado | – (no se evalúa sobre lo entrenado) | **Validador de plan** | ◐ |
| Tirada larga ≤ 2 h 30 y ≤ ~25-30 % del volumen (hasta 50 % con 3-4 salidas) | Daniels; práctica de planes populares | **Regla nueva** | **Validador de plan** | ✗ → ✓ |
| Semana de descarga cada 3-4 semanas | Fitzgerald (3), Pfitzinger, Daniels | **Regla nueva** (proactiva); la de sobrecarga era solo reactiva | Descarga en cada bloque de 4 semanas | ✗ → ✓ |
| Subida de volumen gradual | Hudson, Daniels; Nielsen 2014 (saltos > 30 %) | Regla de progresión conservadora | **Validador: aviso > 20 %, error > 30 %** sobre lo que corre de verdad | ✓ |
| Vuelta tras parón | Daniels † | **Fórmula de Daniels hasta 4 semanas; más allá, reconstrucción** (antes, un porcentaje genérico) | Aviso en el prompt si vuelve de un parón | ✗ → ✓ |
| Reducción previa a la carrera | Pfitzinger 3 semanas (maratón); Bosquet 2007: óptimo ~2 semanas y −41-60 % de volumen | Ventana por disciplina (7/10/14 días) | – | ◐ la literatura da 2 semanas como óptimo, la práctica de Pfitzinger llega a 3 |
| Ajustar al estado actual (adaptativo) | Hudson | Regla de ejecución lenta + recalibración + el coach decide | El plan se genera sobre el volumen real del reloj | ✓ |
| Topes de Daniels por intensidad (T 10 %, I 8 %, R 5 %) | Daniels | – | – | – pensado para 40+ km/semana; con poco volumen manda el reparto por tiempo |
| Periodización hacia una carrera objetivo con fases (Daniels 4 fases, Canova) | Daniels, Canova | Simulador del plan hacia carrera (existente, sin auditar aquí) | **Planificador determinista `lib/entrenos/macrociclo.ts`**: fases base / construcción / específica / reducción / semana de carrera, descarga cada 3-4 semanas, tirada con tope por prueba, calidad ≤ 2 y nunca seguida; su semana 1 se inyecta al generador como estructura obligatoria y el validador avisa si la IA se aparta | ◐ (implementado y probado con 400 perfiles aleatorios; no contrastado por un entrenador humano) |
| Trabajo de técnica, cuestas y progresivos | Daniels, Pfitzinger, Hudson | – | – | – |

## 3. Qué dicen tus datos frente a ese marco

- **Tiempo realmente fácil** (últimas 4 semanas): **18 %** con el techo de Daniels (≤ 152 ppm), **29 %** con el de Pfitzinger (≤ 156 ppm), **36 %** con nuestra definición (< 158 ppm). Referencia: ~75-80 %. Con cualquiera de las definiciones estás muy por debajo.
- **Deriva cardiaca** (sin los 10 primeros minutos): ~3 %, es decir, tu cuerpo tolera bien esos ritmos. Por eso el motor lo presenta como oportunidad de optimizar y no como un problema.
- **Tirada larga**: 69 min frente a 89 min de carrera semanal de media → pesa un 78 % del tiempo de carrera con ~3,5 salidas por semana (referencia: hasta ~50 %).
- **Tu plan actual** («Descarga»): 154 min de carrera por semana frente a los 89 que corres de media (+73 %). Es el hallazgo del validador de planes: o el plan es más ambicioso de lo que haces, o hay un problema de adherencia. Conviene decidir cuál.

## 4. Cambios hechos tras el contraste
- El prompt de running del generador ya no atribuye a Daniels cifras que no son suyas, reconoce el reparto piramidal y sustituye «+10 % máximo» por la evidencia real (saltos > 30 % → más lesiones).
- El generador recibe el volumen real del reloj y los **ritmos calculados con el VDOT**, y su plan pasa por un **validador determinista** (calidad, días consecutivos, tirada larga, salto de volumen, ritmos fuera de zona). Los avisos se muestran al coach.
- Reglas nuevas en el motor de análisis: tirada larga, descarga programada y vuelta tras parón con la fórmula de Daniels.
- Cargado el estudio real de Casado 2022 (la entrada antigua con ese nombre tenía un DOI inexistente).

## 5. Lo que sigue sin cubrirse
1. **Macrociclo por fases (hecho el 10-10 por la noche, con límites):** `lib/entrenos/macrociclo.ts` calcula todas las semanas hasta la prueba con los datos reales del cliente (nivel, edad, VDOT, volumen del reloj, días, lesiones, salud, parón, fuerza fija, prueba). Es un modelo de reglas de criterio (crecimiento 5-10 %/semana según prudencia, descarga −30 %, reducción de 2 semanas en pruebas largas con la semana de la carrera como última, tirada tope 75-210 min según prueba, calidad con trabajo ≤ ~12 % del volumen) inspirado en Daniels, Pfitzinger y Fitzgerald; **las cifras concretas no son de un libro concreto** y no se han contrastado con un entrenador humano. No cubre aún: Hansons (fatiga acumulada), Magness, Canova (bloques específicos), periodización por ultra (Koop) ni la progresión de la calidad semana a semana (tipo de sesión sí, volumen de trabajo no).
2. **Los topes de Daniels por intensidad y la calidad en días consecutivos no se comprueban sobre lo entrenado**, solo en los planes generados.
3. **Técnica, cuestas y progresivos** no se prescriben ni se evalúan.
4. **Reducción previa a la carrera**: la ventana de 14 días para el maratón es el óptimo de la literatura, pero el entrenador de referencia (Pfitzinger) usa 3 semanas.
5. Las cifras marcadas † salen de resúmenes de los libros y no están verificadas en el original.

## 6. Cómo validar con entrenadores humanos de verdad (propuesta)
1. Elegir 2-3 entrenadores de running con trayectoria comprobable (ideal: certificados y con corredores populares y de nivel alto).
2. Darles, sin decirles cuál es cuál, 8-10 situaciones reales anonimizadas (datos de reloj + plan) y pedirles qué cambiarían, y mezclar las decisiones del motor con las suyas.
3. Medir la **concordancia por tipo de decisión** (reparto, carga, descarga, retorno, tapering), no solo el acuerdo global, y anotar dónde discrepan y por qué.
4. Repetir cada trimestre y cada vez que se cambien reglas.

## Fuentes
- [Daniels: intensidades y topes](https://www.coachray.nz/2023/05/03/jack-daniels-running-intensity/) · [Daniels: fases y calidad](https://runningwithrock.com/review-jack-daniels-5k-10k-training-plan/) · [Daniels: periodización](https://coachray.nz/2021/10/11/jack-daniels-phd-formulaic-approach-to-periodisation) · [Daniels: parón (resumen secundario)](https://www.goodreads.com/notes/20762026-daniels-running-formula/77147819-adrian-gonzalez)
- [Pfitzinger: estructura y ritmos](https://runningwithrock.com/pfitz-marathon-training-explained/)
- [Fitzgerald: 80/20](https://runningwithrock.com/80-20-marathon-training-plans/)
- [Hudson: enfoque adaptativo](https://www.goodreads.com/author_blog_posts/8964666-last-lap-with-brad-hudson-the-marathon-whisperer)
- [Canova: bloques especiales](https://runnersconnect.net/?p=66269)
- [Higdon: media maratón novel](https://www.trainingpeaks.com/training-plans/running/half-marathon/tp-139213/hal-higdon-1-2-marathon-novice-1)
- [Casado et al. 2022 (PubMed)](https://pubmed.ncbi.nlm.nih.gov/35418513/)
