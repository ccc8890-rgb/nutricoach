# Planes de los clientes de prueba — macrociclo determinista (2026-10-10)

Generado con `scripts/planes-clientes-de-prueba.ts` a partir de los datos reales de cada cliente (solo lectura; no se ha escrito nada en la base de datos). Cada plan sale de `lib/entrenos/macrociclo.ts`: reglas y fuentes en `docs/10-10-2026_motor-fiable-rendimiento.md`. **Es una propuesta para que el coach la revise, no un plan aplicado.**

## Carlos Casanova Cordero

**Datos usados:** modalidad hibrido · nivel avanzado · edad 36 · VDOT 45 · días disponibles 5 · volumen real 89 min/sem · fuerza fija 3 · lesiones ninguna · salud Ninguna · sin prueba

**Falta (completar para afinar):**
- Competición objetivo (fecha y distancia): sin ella el plan es de mejora general de 8 semanas

**Supuestos:**
- Nivel «avanzado» tomado de la ficha del cliente (el perfil de atleta no lo tiene).

**Parámetros:** 3 salidas/sem · volumen 89 → pico 158 min · crecimiento 10 %/sem · descarga cada 4 semanas

| Sem | Fase | Min | Salidas | Tirada | % suave | Fuerza | Sesiones (día:tipo min) |
|---|---|---|---|---|---|---|---|
| 1 | base | 100 | 3 | 40 | 95 | 3 | M:rodaje 30, J:rodaje 30, S:tirada 40 |
| 2 | base | 110 | 3 | 45 | 95 | 3 | M:rodaje 35, J:rodaje 30, S:tirada 45 |
| 3 | base | 120 | 3 | 50 | 95 | 3 | M:rodaje 35, J:rodaje 35, S:tirada 50 |
| 4 ↓ | base | 85 | 3 | 25 | 95 | 3 | M:rodaje 30, J:rodaje 30, S:tirada 25 |
| 5 | construccion | 120 | 3 | 50 | 80 | 3 | M:tempo 35, J:rodaje 35, S:tirada 50 |
| 6 | construccion | 130 | 3 | 55 | 80 | 3 | M:tempo 35, J:rodaje 40, S:tirada 55 |
| 7 | construccion | 145 | 3 | 60 | 80 | 3 | M:tempo 40, J:rodaje 45, S:tirada 60 |
| 8 | construccion | 160 | 3 | 65 | 80 | 3 | M:tempo 45, J:rodaje 50, S:tirada 65 |

**Semana 1 (2026-10-12, base) en concreto:**
- Martes · Rodaje fácil (30 min): 30 min continuos a 5:40-6:08/km. Debes poder hablar frases completas.
- Jueves · Rodaje fácil (30 min): 30 min continuos a 5:40-6:08/km. Debes poder hablar frases completas.
- Sábado · Tirada larga (40 min): 40 min a 5:40-6:08/km, sin acelerar; es la sesión más larga de la semana.
- Fuerza: 3 sesión(es) (las que ya tiene en su plan).

**Semana 2 (2026-10-19, base) en concreto:**
- Martes · Rodaje fácil (35 min): 35 min continuos a 5:40-6:08/km. Debes poder hablar frases completas.
- Jueves · Rodaje fácil (30 min): 30 min continuos a 5:40-6:08/km. Debes poder hablar frases completas.
- Sábado · Tirada larga (45 min): 45 min a 5:40-6:08/km, sin acelerar; es la sesión más larga de la semana.
- Fuerza: 3 sesión(es) (las que ya tiene en su plan).

**De dónde sale cada regla:**
- [estudio] Volumen: sube como máximo ~10 % por semana, nunca más de un 30 % de golpe — Nielsen 2014 (saltos de más del 30 % se asocian a más lesiones). La cifra del 5-10 % es criterio de prudencia, no del estudio.
- [libro] Semana de descarga cada 4 semanas (−30 %) — Fitzgerald (80/20: cada 3 semanas), Pfitzinger, Daniels. La cifra exacta del −30 % es práctica habitual, no de un estudio.
- [estudio] La mayor parte del tiempo en intensidad suave; la calidad se limita (≤ 2 sesiones, nunca seguidas ni el día antes de la tirada) — Casado et al. 2022 (revisión sistemática, corredores de élite: reparto piramidal/polarizado). Los límites por sesión son criterio de entrenador.
- [libro] Tirada larga con tope por prueba y por peso sobre la semana (≤ 150 min en general) — Daniels (≤ 25 % del kilometraje y ≤ 2 h 30 min; cifras de segunda mano †). Con pocas salidas se tolera más peso.
- [libro] Trabajo intenso por sesión ≤ ~12 % del volumen semanal y ≤ 40 min — Daniels (tempo ≤ 10 %, intervalos ≤ 8 % del kilometraje semanal; †).
- [estudio] Fuerza: 2 sesiones por semana (1 en la reducción, ninguna la semana de la carrera) — Blagrove 2018 y Balsalobre 2016 (fuerza y economía de carrera).

## Marcos Rodríguez

**Datos usados:** modalidad hibrido · nivel intermedio · edad 28 · VDOT n/d · días disponibles 6 · volumen real n/d min/sem · fuerza fija 3 · lesiones ninguna · salud Ninguna · sin prueba

**Falta (completar para afinar):**
- VDOT o tiempo reciente de 5K/10K (los ritmos del plan salen de aquí)
- Competición objetivo (fecha y distancia): sin ella el plan es de mejora general de 8 semanas
- Datos de carrera del reloj (últimas semanas): el volumen de partida es una suposición por nivel

**Supuestos:**
- Sin volumen real en el reloj: se parte de 120 min/semana (supuesto para nivel intermedio).

**Parámetros:** 4 salidas/sem · volumen 120 → pico 190 min · crecimiento 8 %/sem · descarga cada 4 semanas

| Sem | Fase | Min | Salidas | Tirada | % suave | Fuerza | Sesiones (día:tipo min) |
|---|---|---|---|---|---|---|---|
| 1 | base | 120 | 4 | 40 | 95 | 3 | M:rodaje 30, J:rodaje 30, V:rodaje 25, S:tirada 35 |
| 2 | base | 120 | 4 | 40 | 95 | 3 | M:rodaje 30, J:rodaje 30, V:rodaje 25, S:tirada 35 |
| 3 | base | 130 | 4 | 45 | 95 | 3 | M:rodaje 30, J:rodaje 30, V:rodaje 25, S:tirada 45 |
| 4 ↓ | base | 90 | 4 | 25 | 95 | 3 | M:rodaje 25, J:rodaje 20, V:rodaje 20, S:tirada 25 |
| 5 | construccion | 130 | 4 | 45 | 80 | 3 | M:tempo 35, J:series 35, V:rodaje 20, S:tirada 40 |
| 6 | construccion | 140 | 4 | 50 | 80 | 3 | M:tempo 35, J:series 35, V:rodaje 20, S:tirada 50 |
| 7 | construccion | 150 | 4 | 50 | 80 | 3 | M:tempo 35, J:series 35, V:rodaje 30, S:tirada 50 |
| 8 | construccion | 165 | 4 | 55 | 80 | 3 | M:tempo 40, J:series 35, V:rodaje 35, S:tirada 55 |

**Semana 1 (2026-10-12, base) en concreto:**
- Martes · Rodaje fácil (30 min): 30 min continuos a ritmo a fijar con un test o una carrera reciente (sin VDOT). Debes poder hablar frases completas.
- Jueves · Rodaje fácil (30 min): 30 min continuos a ritmo a fijar con un test o una carrera reciente (sin VDOT). Debes poder hablar frases completas.
- Viernes · Rodaje fácil (25 min): 25 min continuos a ritmo a fijar con un test o una carrera reciente (sin VDOT). Debes poder hablar frases completas.
- Sábado · Tirada larga (35 min): 35 min a ritmo a fijar con un test o una carrera reciente (sin VDOT), sin acelerar; es la sesión más larga de la semana.
- Fuerza: 3 sesión(es) (las que ya tiene en su plan).

**Semana 2 (2026-10-19, base) en concreto:**
- Martes · Rodaje fácil (30 min): 30 min continuos a ritmo a fijar con un test o una carrera reciente (sin VDOT). Debes poder hablar frases completas.
- Jueves · Rodaje fácil (30 min): 30 min continuos a ritmo a fijar con un test o una carrera reciente (sin VDOT). Debes poder hablar frases completas.
- Viernes · Rodaje fácil (25 min): 25 min continuos a ritmo a fijar con un test o una carrera reciente (sin VDOT). Debes poder hablar frases completas.
- Sábado · Tirada larga (35 min): 35 min a ritmo a fijar con un test o una carrera reciente (sin VDOT), sin acelerar; es la sesión más larga de la semana.
- Fuerza: 3 sesión(es) (las que ya tiene en su plan).

**De dónde sale cada regla:**
- [estudio] Volumen: sube como máximo ~8 % por semana, nunca más de un 30 % de golpe — Nielsen 2014 (saltos de más del 30 % se asocian a más lesiones). La cifra del 5-10 % es criterio de prudencia, no del estudio.
- [libro] Semana de descarga cada 4 semanas (−30 %) — Fitzgerald (80/20: cada 3 semanas), Pfitzinger, Daniels. La cifra exacta del −30 % es práctica habitual, no de un estudio.
- [estudio] La mayor parte del tiempo en intensidad suave; la calidad se limita (≤ 2 sesiones, nunca seguidas ni el día antes de la tirada) — Casado et al. 2022 (revisión sistemática, corredores de élite: reparto piramidal/polarizado). Los límites por sesión son criterio de entrenador.
- [libro] Tirada larga con tope por prueba y por peso sobre la semana (≤ 150 min en general) — Daniels (≤ 25 % del kilometraje y ≤ 2 h 30 min; cifras de segunda mano †). Con pocas salidas se tolera más peso.
- [libro] Trabajo intenso por sesión ≤ ~12 % del volumen semanal y ≤ 40 min — Daniels (tempo ≤ 10 %, intervalos ≤ 8 % del kilometraje semanal; †).
- [estudio] Fuerza: 2 sesiones por semana (1 en la reducción, ninguna la semana de la carrera) — Blagrove 2018 y Balsalobre 2016 (fuerza y economía de carrera).
- [criterio] Sin datos del reloj: volumen de partida estimado por nivel y 2 semanas sin subir — Supuesto declarado: se corrige con lo que haga de verdad en las primeras semanas.

## Andrés López

**Datos usados:** modalidad gym_fuerza · nivel intermedio · edad 45 · VDOT n/d · días disponibles 4 · volumen real n/d min/sem · fuerza fija 2 · lesiones ninguna · salud dislipidemia: colesterol LDL 168 mg/dL, HDL 38 mg/dL, triglicéridos 210 mg/dL. Sin medicación (cambio dieta + 3 meses revisión). TA 130/85 (normal-alta). Sin diabetes. · sin prueba

> ⚠️ Su modalidad registrada es **gym_fuerza**, no carrera: este plan de carrera es solo orientativo y solo tiene sentido si quiere correr de verdad.

**Falta (completar para afinar):**
- VDOT o tiempo reciente de 5K/10K (los ritmos del plan salen de aquí)
- Competición objetivo (fecha y distancia): sin ella el plan es de mejora general de 8 semanas
- Datos de carrera del reloj (últimas semanas): el volumen de partida es una suposición por nivel

**Supuestos:**
- Sin volumen real en el reloj: se parte de 120 min/semana (supuesto para nivel intermedio).

**Avisos del planificador:**
- Tensión arterial en el límite alto (normal-alta): no limita el plan, pero conviene controlarla con su médico; ante mareo, dolor de cabeza fuerte o palpitaciones se para.

**Parámetros:** 3 salidas/sem · volumen 120 → pico 190 min · crecimiento 8 %/sem · descarga cada 4 semanas

| Sem | Fase | Min | Salidas | Tirada | % suave | Fuerza | Sesiones (día:tipo min) |
|---|---|---|---|---|---|---|---|
| 1 | base | 120 | 3 | 50 | 95 | 2 | M:rodaje 35, J:rodaje 35, S:tirada 50 |
| 2 | base | 120 | 3 | 50 | 95 | 2 | M:rodaje 35, J:rodaje 35, S:tirada 50 |
| 3 | base | 130 | 3 | 55 | 95 | 2 | M:rodaje 40, J:rodaje 35, S:tirada 55 |
| 4 ↓ | base | 90 | 3 | 25 | 95 | 2 | M:rodaje 30, J:rodaje 30, S:tirada 30 |
| 5 | construccion | 130 | 3 | 55 | 80 | 2 | M:tempo 35, J:rodaje 40, S:tirada 55 |
| 6 | construccion | 140 | 3 | 60 | 80 | 2 | M:tempo 40, J:rodaje 40, S:tirada 60 |
| 7 | construccion | 150 | 3 | 65 | 80 | 2 | M:tempo 40, J:rodaje 45, S:tirada 65 |
| 8 | construccion | 165 | 3 | 70 | 80 | 2 | M:tempo 45, J:rodaje 50, S:tirada 70 |

**Semana 1 (2026-10-12, base) en concreto:**
- Martes · Rodaje fácil (35 min): 35 min continuos a ritmo a fijar con un test o una carrera reciente (sin VDOT). Debes poder hablar frases completas.
- Jueves · Rodaje fácil (35 min): 35 min continuos a ritmo a fijar con un test o una carrera reciente (sin VDOT). Debes poder hablar frases completas.
- Sábado · Tirada larga (50 min): 50 min a ritmo a fijar con un test o una carrera reciente (sin VDOT), sin acelerar; es la sesión más larga de la semana.
- Fuerza: 2 sesión(es) (las que ya tiene en su plan).

**Semana 2 (2026-10-19, base) en concreto:**
- Martes · Rodaje fácil (35 min): 35 min continuos a ritmo a fijar con un test o una carrera reciente (sin VDOT). Debes poder hablar frases completas.
- Jueves · Rodaje fácil (35 min): 35 min continuos a ritmo a fijar con un test o una carrera reciente (sin VDOT). Debes poder hablar frases completas.
- Sábado · Tirada larga (50 min): 50 min a ritmo a fijar con un test o una carrera reciente (sin VDOT), sin acelerar; es la sesión más larga de la semana.
- Fuerza: 2 sesión(es) (las que ya tiene en su plan).

**De dónde sale cada regla:**
- [estudio] Volumen: sube como máximo ~8 % por semana, nunca más de un 30 % de golpe — Nielsen 2014 (saltos de más del 30 % se asocian a más lesiones). La cifra del 5-10 % es criterio de prudencia, no del estudio.
- [libro] Semana de descarga cada 4 semanas (−30 %) — Fitzgerald (80/20: cada 3 semanas), Pfitzinger, Daniels. La cifra exacta del −30 % es práctica habitual, no de un estudio.
- [estudio] La mayor parte del tiempo en intensidad suave; la calidad se limita (≤ 2 sesiones, nunca seguidas ni el día antes de la tirada) — Casado et al. 2022 (revisión sistemática, corredores de élite: reparto piramidal/polarizado). Los límites por sesión son criterio de entrenador.
- [libro] Tirada larga con tope por prueba y por peso sobre la semana (≤ 150 min en general) — Daniels (≤ 25 % del kilometraje y ≤ 2 h 30 min; cifras de segunda mano †). Con pocas salidas se tolera más peso.
- [libro] Trabajo intenso por sesión ≤ ~12 % del volumen semanal y ≤ 40 min — Daniels (tempo ≤ 10 %, intervalos ≤ 8 % del kilometraje semanal; †).
- [estudio] Fuerza: 2 sesiones por semana (1 en la reducción, ninguna la semana de la carrera) — Blagrove 2018 y Balsalobre 2016 (fuerza y economía de carrera).
- [criterio] Sin datos del reloj: volumen de partida estimado por nivel y 2 semanas sin subir — Supuesto declarado: se corrige con lo que haga de verdad en las primeras semanas.

## Natalia González

**Datos usados:** modalidad running · nivel intermedio · edad 34 · VDOT n/d · días disponibles 6 · volumen real n/d min/sem · fuerza fija 2 · lesiones ninguna · salud anemia ferropénica leve (ferritina 11 ng/mL, Hb 11.8 g/dL). En tratamiento con hierro bisglicinate 25mg/día. Vegana estricta 6 años. Sin otras patologías. VitB12 en rango (suplementada). VitD 32 ng/mL (rango bajo-normal). · prueba running_maraton el 2026-12-06

**Falta (completar para afinar):**
- VDOT o tiempo reciente de 5K/10K (los ritmos del plan salen de aquí)
- Datos de carrera del reloj (últimas semanas): el volumen de partida es una suposición por nivel

**Supuestos:**
- La prueba (Maratón Valencia, 2026-12-06) viene del onboarding: no está registrada en Competiciones.
- Sin volumen real en el reloj: se parte de 120 min/semana (supuesto para nivel intermedio).

**Avisos del planificador:**
- Anemia o déficit de hierro: se limita la calidad (sin series, solo tempo suave y progresivos), se sube el reparto suave y se pide que el médico confirme cuándo puede aumentar la intensidad. El volumen solo puede subir un 3 % por semana hasta normalizar la ferritina.
- En el tiempo disponible el volumen solo puede llegar a ~139 min/semana (lo habitual para esta prueba y nivel es ~390): el objetivo realista es llegar bien, no el volumen típico de un plan completo.

**Parámetros:** 4 salidas/sem · volumen 120 → pico 139 min · crecimiento 3 %/sem · descarga cada 4 semanas

| Sem | Fase | Min | Salidas | Tirada | % suave | Fuerza | Sesiones (día:tipo min) |
|---|---|---|---|---|---|---|---|
| 1 | base | 120 | 4 | 40 | 95 | 2 | M:rodaje 30, J:rodaje 30, V:rodaje 25, S:tirada 35 |
| 2 | base | 120 | 4 | 40 | 95 | 2 | M:rodaje 30, J:rodaje 30, V:rodaje 25, S:tirada 35 |
| 3 | construccion | 125 | 4 | 45 | 85 | 2 | M:tempo 35, J:rodaje 25, V:rodaje 20, S:tirada 45 |
| 4 ↓ | construccion | 85 | 4 | 25 | 95 | 2 | M:rodaje 20, J:rodaje 20, V:rodaje 20, S:tirada 25 |
| 5 | construccion | 125 | 4 | 45 | 85 | 2 | M:tempo 35, J:rodaje 25, V:rodaje 20, S:tirada 45 |
| 6 | especifica | 125 | 4 | 45 | 83 | 2 | M:ritmo_carrera 35, J:rodaje 25, V:rodaje 20, S:tirada 45 |
| 7 | tapering | 70 | 3 | 25 | 95 | 2 | M:rodaje 25, J:rodaje 20, S:tirada 25 |
| 8 | carrera | 45 | 2 | 25 | 95 | 0 | L:tirada 25, V:rodaje 20 |

**Semana 1 (2026-10-12, base) en concreto:**
- Martes · Rodaje fácil (30 min): 30 min continuos a ritmo a fijar con un test o una carrera reciente (sin VDOT). Debes poder hablar frases completas.
- Jueves · Rodaje fácil (30 min): 30 min continuos a ritmo a fijar con un test o una carrera reciente (sin VDOT). Debes poder hablar frases completas.
- Viernes · Rodaje fácil (25 min): 25 min continuos a ritmo a fijar con un test o una carrera reciente (sin VDOT). Debes poder hablar frases completas.
- Sábado · Tirada larga (35 min): 35 min a ritmo a fijar con un test o una carrera reciente (sin VDOT), sin acelerar; es la sesión más larga de la semana.
- Fuerza: 2 sesión(es) (las que ya tiene en su plan).

**Semana 2 (2026-10-19, base) en concreto:**
- Martes · Rodaje fácil (30 min): 30 min continuos a ritmo a fijar con un test o una carrera reciente (sin VDOT). Debes poder hablar frases completas.
- Jueves · Rodaje fácil (30 min): 30 min continuos a ritmo a fijar con un test o una carrera reciente (sin VDOT). Debes poder hablar frases completas.
- Viernes · Rodaje fácil (25 min): 25 min continuos a ritmo a fijar con un test o una carrera reciente (sin VDOT). Debes poder hablar frases completas.
- Sábado · Tirada larga (35 min): 35 min a ritmo a fijar con un test o una carrera reciente (sin VDOT), sin acelerar; es la sesión más larga de la semana.
- Fuerza: 2 sesión(es) (las que ya tiene en su plan).

**De dónde sale cada regla:**
- [estudio] Volumen: sube como máximo ~3 % por semana, nunca más de un 30 % de golpe — Nielsen 2014 (saltos de más del 30 % se asocian a más lesiones). La cifra del 5-10 % es criterio de prudencia, no del estudio.
- [libro] Semana de descarga cada 4 semanas (−30 %) — Fitzgerald (80/20: cada 3 semanas), Pfitzinger, Daniels. La cifra exacta del −30 % es práctica habitual, no de un estudio.
- [estudio] La mayor parte del tiempo en intensidad suave; la calidad se limita (≤ 2 sesiones, nunca seguidas ni el día antes de la tirada) — Casado et al. 2022 (revisión sistemática, corredores de élite: reparto piramidal/polarizado). Los límites por sesión son criterio de entrenador.
- [libro] Tirada larga con tope por prueba y por peso sobre la semana (≤ 150 min en general) — Daniels (≤ 25 % del kilometraje y ≤ 2 h 30 min; cifras de segunda mano †). Con pocas salidas se tolera más peso.
- [libro] Trabajo intenso por sesión ≤ ~12 % del volumen semanal y ≤ 40 min — Daniels (tempo ≤ 10 %, intervalos ≤ 8 % del kilometraje semanal; †).
- [estudio] Reducción previa a la prueba (2 semanas en pruebas largas, 1 en cortas; semana de la carrera lo más ligera) — Mujika & Padilla 2003 y Bosquet 2007 (reducir volumen ~40-60 % manteniendo la intensidad). Pfitzinger usa 3 semanas en maratón.
- [estudio] Fuerza: 2 sesiones por semana (1 en la reducción, ninguna la semana de la carrera) — Blagrove 2018 y Balsalobre 2016 (fuerza y economía de carrera).
- [criterio] Anemia / déficit de hierro: volumen +3 %/semana y 1 sesión de calidad — Prudencia: no hay una cifra publicada para esto; el médico decide cuándo subir.
- [criterio] Sin datos del reloj: volumen de partida estimado por nivel y 2 semanas sin subir — Supuesto declarado: se corrige con lo que haga de verdad en las primeras semanas.

## Laura Vidal

**Datos usados:** modalidad n/d · nivel avanzado · edad 31 · VDOT n/d · días disponibles n/d · volumen real n/d min/sem · fuerza fija 0 · lesiones ninguna · salud Ninguna · prueba trail_largo el 2026-11-15

**Falta (completar para afinar):**
- Perfil de atleta (días disponibles, lesiones, recuperación, VDOT)
- VDOT o tiempo reciente de 5K/10K (los ritmos del plan salen de aquí)
- Datos de carrera del reloj (últimas semanas): el volumen de partida es una suposición por nivel

**Supuestos:**
- Nivel «avanzado» tomado de la ficha del cliente (el perfil de atleta no lo tiene).
- Sin volumen real en el reloj: se parte de 200 min/semana (supuesto para nivel avanzado).

**Avisos del planificador:**
- En el tiempo disponible el volumen solo puede llegar a ~266 min/semana (lo habitual para esta prueba y nivel es ~600): el objetivo realista es llegar bien, no el volumen típico de un plan completo.

**Parámetros:** 5 salidas/sem · volumen 200 → pico 266 min · crecimiento 10 %/sem · descarga cada 4 semanas

| Sem | Fase | Min | Salidas | Tirada | % suave | Fuerza | Sesiones (día:tipo min) |
|---|---|---|---|---|---|---|---|
| 1 | construccion | 200 | 5 | 55 | 80 | 2 | L:rodaje 35, M:tempo 40, J:series 40, V:rodaje 30, S:tirada 55 |
| 2 | construccion | 200 | 5 | 55 | 80 | 2 | L:rodaje 35, M:tempo 40, J:series 40, V:rodaje 30, S:tirada 55 |
| 3 | especifica | 220 | 5 | 60 | 78 | 2 | L:rodaje 30, M:ritmo_carrera 50, J:tempo 50, V:rodaje 30, S:tirada 60 |
| 4 | tapering | 130 | 5 | 35 | 80 | 1 | L:rodaje 20, M:series 35, J:rodaje 20, V:rodaje 20, S:tirada 35 |
| 5 | carrera | 55 | 2 | 30 | 95 | 0 | L:tirada 30, V:rodaje 25 |

**Semana 1 (2026-10-12, construccion) en concreto:**
- Lunes · Rodaje fácil (35 min): 35 min continuos a ritmo a fijar con un test o una carrera reciente (sin VDOT). Debes poder hablar frases completas.
- Martes · Tempo (40 min): 10' fáciles + 24' continuos a ritmo umbral (sin VDOT: a sensaciones, 7-8/10) + 6' fáciles.
- Jueves · Series (40 min): 10' fáciles + 5 × 3' a ritmo de 5 km (sin VDOT: 8-9/10) con 3' de trote suave entre repeticiones + 6' fáciles (el tiempo exacto depende de las pausas).
- Viernes · Rodaje fácil (30 min): 30 min continuos a ritmo a fijar con un test o una carrera reciente (sin VDOT). Debes poder hablar frases completas.
- Sábado · Tirada larga (55 min): 55 min a ritmo a fijar con un test o una carrera reciente (sin VDOT), sin acelerar; es la sesión más larga de la semana.
- Fuerza: 2 sesión(es) (las que ya tiene en su plan).

**Semana 2 (2026-10-19, construccion) en concreto:**
- Lunes · Rodaje fácil (35 min): 35 min continuos a ritmo a fijar con un test o una carrera reciente (sin VDOT). Debes poder hablar frases completas.
- Martes · Tempo (40 min): 10' fáciles + 24' continuos a ritmo umbral (sin VDOT: a sensaciones, 7-8/10) + 6' fáciles.
- Jueves · Series (40 min): 10' fáciles + 5 × 3' a ritmo de 5 km (sin VDOT: 8-9/10) con 3' de trote suave entre repeticiones + 6' fáciles (el tiempo exacto depende de las pausas).
- Viernes · Rodaje fácil (30 min): 30 min continuos a ritmo a fijar con un test o una carrera reciente (sin VDOT). Debes poder hablar frases completas.
- Sábado · Tirada larga (55 min): 55 min a ritmo a fijar con un test o una carrera reciente (sin VDOT), sin acelerar; es la sesión más larga de la semana.
- Fuerza: 2 sesión(es) (las que ya tiene en su plan).

**De dónde sale cada regla:**
- [estudio] Volumen: sube como máximo ~10 % por semana, nunca más de un 30 % de golpe — Nielsen 2014 (saltos de más del 30 % se asocian a más lesiones). La cifra del 5-10 % es criterio de prudencia, no del estudio.
- [libro] Semana de descarga cada 4 semanas (−30 %) — Fitzgerald (80/20: cada 3 semanas), Pfitzinger, Daniels. La cifra exacta del −30 % es práctica habitual, no de un estudio.
- [estudio] La mayor parte del tiempo en intensidad suave; la calidad se limita (≤ 2 sesiones, nunca seguidas ni el día antes de la tirada) — Casado et al. 2022 (revisión sistemática, corredores de élite: reparto piramidal/polarizado). Los límites por sesión son criterio de entrenador.
- [libro] Tirada larga con tope por prueba y por peso sobre la semana (≤ 150 min en general) — Daniels (≤ 25 % del kilometraje y ≤ 2 h 30 min; cifras de segunda mano †). Con pocas salidas se tolera más peso.
- [libro] Trabajo intenso por sesión ≤ ~12 % del volumen semanal y ≤ 40 min — Daniels (tempo ≤ 10 %, intervalos ≤ 8 % del kilometraje semanal; †).
- [estudio] Reducción previa a la prueba (2 semanas en pruebas largas, 1 en cortas; semana de la carrera lo más ligera) — Mujika & Padilla 2003 y Bosquet 2007 (reducir volumen ~40-60 % manteniendo la intensidad). Pfitzinger usa 3 semanas en maratón.
- [estudio] Fuerza: 2 sesiones por semana (1 en la reducción, ninguna la semana de la carrera) — Blagrove 2018 y Balsalobre 2016 (fuerza y economía de carrera).
- [criterio] Sin datos del reloj: volumen de partida estimado por nivel y 2 semanas sin subir — Supuesto declarado: se corrige con lo que haga de verdad en las primeras semanas.
