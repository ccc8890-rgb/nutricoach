# Contraste de las reglas del macrociclo con estudios y entrenadores (10-10-2026, noche)

Se buscó respaldo real para cada regla que hasta ahora era «criterio». **Qué es verificable y qué no** se marca en cada fila: ✅ leído en la fuente original (PubMed/PMC), 🟡 solo resumen secundario (web, blog, reseña del libro), ❌ no se encontró evidencia.

## Veredicto por regla

| Regla del motor | Qué dicen las fuentes | Veredicto | Qué se hizo |
|---|---|---|---|
| **Volumen semanal +5-10 %/semana** («regla del 10 %») | Buist 2008, ensayo con 532 principiantes: un programa graduado (+10,5 %/sem) frente a uno rápido (+23,7 %/sem) dio las mismas lesiones (20,3 % vs 20,8 %) ✅. Frandsen 2025 (5.205 corredores): los cambios semanales de volumen **no** se asociaron a lesiones ✅. | **No está validada.** Se mantiene solo como prudencia | Pasa a `criterio` en los fundamentos, con las dos fuentes que la matizan |
| **Límite de la sesión más larga** | Frandsen 2025, Br J Sports Med, DOI 10.1136/bjsports-2024-109380 ✅: una sesión que supera en >10 % la más larga de los 30 días previos aumenta las lesiones (10-30 %: HR 1,64; 30-100 %: 1,52; >100 %: 2,28); el ACWR no predijo lesiones. Observacional, mide distancia (no tiempo), 78 % hombres, usuarios de Garmin | **Es la evidencia más sólida que hemos encontrado para progresar.** Antes no estaba en el motor | **Implementada**: ninguna sesión supera en más del 10 % la más larga de los últimos 30 días (real del reloj, o supuesta y declarada si no hay dato) |
| **Reducción previa (tapering)** | Bosquet 2007 (metaanálisis): lo mejor es 2 semanas con una bajada exponencial del volumen del 41-60 %, sin cambiar intensidad ni frecuencia; 8-14 días ✅ (resumen secundario del abstract; ya estaba en la base de estudios) | **Confirmada** | Sin cambios |
| **Fuerza 2 sesiones/semana** | Blagrove 2018, Sports Med, DOI 10.1007/s40279-017-0835-7: 24 estudios, la fuerza mejora la economía de carrera un 2-8 % ✅ (abstract); la recomendación de 2-3 sesiones/semana viene de un resumen secundario 🟡 | **Respaldada**, la frecuencia exacta sin verificar en el texto (el PMC bloqueó la lectura) | Sin cambios |
| **Híbrido: 3 fuerza + 3 carrera** | Brandt 2025, Frontiers in Physiology, DOI 10.3389/fphys.2025.1519240 ✅: en 11 aficionados el tiempo de Hyrox se asocia a VO₂máx (ρ −0,71), volumen de entrenamiento de resistencia (ρ −0,68) y grasa corporal (ρ 0,67); la fuerza de agarre y la masa muscular no. Recomiendan 1:1 o 1:2 fuerza:resistencia y mucho volumen de carrera | **Coherente** (3:3 = 1:1), pero n = 11 y correlacional: es una pista, no una prueba | Estudio añadido al cargador; sin cambios en el plan |
| **Descarga cada 3-4 semanas (−30 %)** | No se encontró ningún estudio en corredores; solo práctica de entrenadores (Fitzgerald, Pfitzinger, Higdon) y artículos divulgativos ❌ | **Criterio de entrenador, sin evidencia directa** | Se declara como `libro`, con la cifra del −30 % como práctica habitual |
| **Calidad: tempo ≤ 10 %, intervalos ≤ 8 %, tirada ≤ 25-30 % y ≤ 150 min** | Daniels' Running Formula 🟡 (varias reseñas coinciden: fácil/larga ≤ el menor de 25 % del kilometraje o 150 min; umbral ≤ 10 % o 60 min; intervalos ≤ 8 %; repeticiones ≤ 5 %; tirada ≤ 30 % si corre < 40 millas/semana) | **Confirmado por fuentes secundarias**, no por el libro | Marcado `libro †` |
| **Tirada en maratón ≤ 150 min** | Hansons: máx. 16 millas (~2 h 15) y ≤ 25-30 % del kilometraje 🟡; Daniels: 20 millas ≈ 3 h 🟡; Pfitzinger hasta 20 millas | **Nuestro tope es más conservador que Pfitzinger y coincide con Hansons/Daniels** | Sin cambios |
| **Retorno tras parón** | Mujika & Padilla / Coyle 🟡: el VO₂máx baja un 5-7 % en 2-3 semanas y hasta ~18 % tras 8-10 semanas parado; la tabla de Daniels (50 %/75 %) es de libro 🟡 | **La pérdida está documentada; la tabla de retorno es de libro** | Sin cambios; se declara |
| **Principiantes e irregulares** | Estudio de un programa tipo «Couch to 5K» (Int J Environ Res Public Health 2023, DOI 10.3390/ijerph20176682) ✅: solo el 27,3 % lo completa; 19 % se lesionó; una lesión previa multiplica el riesgo (OR 7,56); el abandono se relaciona con la lesión y con un diseño progresivo rígido | **Apoya partir de poco, ser flexible y vigilar lesiones previas.** No da cifras de progresión | Documentado; falta el modo «hábito» (ver abajo) |
| **Ultra: tirada hasta 210 min** | Solo artículos de entrenadores (Koop, etc.): rendimientos decrecientes por encima de 4-5 h y uso de tiradas consecutivas 🟡 | **Sin evidencia sólida; criterio** | Sin cambios; se declara |
| **Reparto de intensidad (mayoría suave)** | Casado 2022 (IJSPP, revisión sistemática de 10 estudios, corredores de élite) ✅; Stöggl & Sperlich 2014 (el entrenamiento polarizado dio la mayor mejora de VO₂pico +11,7 %) ✅ en abstract | **Respaldada** (los estudios son de atletas entrenados; en principiantes la evidencia es menor) | Sin cambios |

## Qué cambió en el motor por esto
1. Nueva regla basada en Frandsen 2025 (la sesión más larga). Hace que el volumen total dependa también de cuánto puede alargarse cada sesión: cuando limita, el plan lo dice («Volumen limitado por el número de salidas y la progresión de la sesión más larga»).
2. Si el atleta o su protocolo fija el número de salidas (p. ej. 3 en el híbrido), es un límite firme: antes el planificador podía añadir una cuarta salida para llegar al volumen.
3. Los fundamentos distinguen ahora **estudio / libro / criterio** con las fuentes que realmente respaldan o matizan cada regla (el «Nielsen 2014: más del 30 % → lesiones» ya no se presenta como respaldo del 5-10 % semanal).

## Lo que sigue sin respaldo (honesto)
- Nada de esto se ha contrastado con un entrenador humano en activo; los entrenadores consultados son sus libros y resúmenes de terceros.
- No hay estudios sobre semanas de descarga en corredores ni sobre cuánto debe crecer el volumen a la semana.
- Frandsen 2025 mide distancia y no tiempo; usamos minutos como aproximación. Y es observacional: asociación, no causalidad.
- El respaldo para clientes que empiezan o son irregulares es débil: hay datos de abandono y lesión, pero ningún estudio dice cuántos minutos a la semana debe hacer cada tipo de principiante.

## Fuentes
- Frandsen JSB et al. *How much running is too much? Identifying high-risk running sessions in a 5200-person cohort study.* Br J Sports Med 2025. DOI 10.1136/bjsports-2024-109380 — https://pmc.ncbi.nlm.nih.gov/articles/PMC12421110
- Buist I et al. *No effect of a graded training program on the number of running-related injuries in novice runners.* Am J Sports Med 2008. DOI 10.1177/0363546507307505
- Bosquet L et al. *Effects of tapering on performance: a meta-analysis.* Med Sci Sports Exerc 2007 (resumen: https://coachsci.sdsu.edu/csa/vol131/bosquet.htm)
- Blagrove RC, Howatson G, Hayes PR. *Effects of strength training on the physiological determinants of middle- and long-distance running performance: a systematic review.* Sports Med 2018. DOI 10.1007/s40279-017-0835-7 — https://pmc.ncbi.nlm.nih.gov/articles/PMC5889786/
- Brandt T et al. *Acute physiological responses and performance determinants in Hyrox.* Front Physiol 2025. DOI 10.3389/fphys.2025.1519240 — https://pmc.ncbi.nlm.nih.gov/articles/PMC11994925/
- *«Couch-to-5k or Couch to Ouch to Couch!?»* Int J Environ Res Public Health 2023. DOI 10.3390/ijerph20176682 — https://www.ncbi.nlm.nih.gov/pmc/articles/PMC10487403/
- Casado A et al. 2022, Int J Sports Physiol Perform — https://pubmed.ncbi.nlm.nih.gov/35418513/ ; Stöggl & Sperlich 2014 — https://pmc.ncbi.nlm.nih.gov/articles/PMC3912323/
- Daniels (reseñas): https://runningwithrock.com/training-explained-jack-daniels-running-formula/ ; Hansons/Pfitzinger/Daniels (comparativa): https://runningwithrock.com/pfitz-vs-jack-daniels-marathon/ ; Higdon Novice 1: https://www.trainingpeaks.com/training-plans/running/marathon/tp-139218/hal-higdon-marathon-novice-1
