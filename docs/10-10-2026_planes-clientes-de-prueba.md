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

## Marcos Rodríguez

**Datos usados:** modalidad hibrido · nivel intermedio · edad 28 · VDOT n/d · días disponibles 6 · volumen real n/d min/sem · fuerza fija 3 · lesiones ninguna · salud Ninguna · sin prueba

**Falta (completar para afinar):**
- VDOT o tiempo reciente de 5K/10K (los ritmos del plan salen de aquí)
- Competición objetivo (fecha y distancia): sin ella el plan es de mejora general de 8 semanas
- Datos de carrera del reloj (últimas 4 semanas): el volumen de partida es una suposición por nivel

**Supuestos:**
- Sin volumen real en el reloj: se parte de 150 min/semana (supuesto para nivel intermedio).

**Parámetros:** 4 salidas/sem · volumen 150 → pico 238 min · crecimiento 8 %/sem · descarga cada 4 semanas

| Sem | Fase | Min | Salidas | Tirada | % suave | Fuerza | Sesiones (día:tipo min) |
|---|---|---|---|---|---|---|---|
| 1 | base | 160 | 4 | 55 | 95 | 3 | M:rodaje 35, J:rodaje 35, V:rodaje 35, S:tirada 55 |
| 2 | base | 175 | 4 | 60 | 95 | 3 | M:rodaje 40, J:rodaje 40, V:rodaje 40, S:tirada 55 |
| 3 | base | 190 | 4 | 65 | 95 | 3 | M:rodaje 45, J:rodaje 40, V:rodaje 40, S:tirada 65 |
| 4 ↓ | base | 130 | 4 | 40 | 95 | 3 | M:rodaje 30, J:rodaje 30, V:rodaje 30, S:tirada 40 |
| 5 | construccion | 190 | 4 | 65 | 80 | 3 | M:tempo 45, J:series 40, V:rodaje 40, S:tirada 65 |
| 6 | construccion | 205 | 4 | 70 | 80 | 3 | M:tempo 45, J:series 45, V:rodaje 45, S:tirada 70 |
| 7 | construccion | 220 | 4 | 75 | 80 | 3 | M:tempo 50, J:series 50, V:rodaje 45, S:tirada 75 |
| 8 | construccion | 240 | 4 | 80 | 80 | 3 | M:tempo 55, J:series 55, V:rodaje 50, S:tirada 80 |

## Andrés López

**Datos usados:** modalidad gym_fuerza · nivel intermedio · edad 45 · VDOT n/d · días disponibles 4 · volumen real n/d min/sem · fuerza fija 2 · lesiones ninguna · salud dislipidemia: colesterol LDL 168 mg/dL, HDL 38 mg/dL, triglicéridos 210 mg/dL. Sin medicación (cambio dieta + 3 meses revisión). TA 130/85 (normal-alta). Sin diabetes. · sin prueba

> ⚠️ Su modalidad registrada es **gym_fuerza**, no carrera: este plan de carrera es solo orientativo y solo tiene sentido si quiere correr de verdad.

**Falta (completar para afinar):**
- VDOT o tiempo reciente de 5K/10K (los ritmos del plan salen de aquí)
- Competición objetivo (fecha y distancia): sin ella el plan es de mejora general de 8 semanas
- Datos de carrera del reloj (últimas 4 semanas): el volumen de partida es una suposición por nivel

**Supuestos:**
- Sin volumen real en el reloj: se parte de 150 min/semana (supuesto para nivel intermedio).

**Avisos del planificador:**
- Tensión arterial en el límite alto (normal-alta): no limita el plan, pero conviene controlarla con su médico; ante mareo, dolor de cabeza fuerte o palpitaciones se para.

**Parámetros:** 3 salidas/sem · volumen 150 → pico 238 min · crecimiento 8 %/sem · descarga cada 4 semanas

| Sem | Fase | Min | Salidas | Tirada | % suave | Fuerza | Sesiones (día:tipo min) |
|---|---|---|---|---|---|---|---|
| 1 | base | 160 | 3 | 65 | 95 | 2 | M:rodaje 50, J:rodaje 45, S:tirada 65 |
| 2 | base | 175 | 3 | 75 | 95 | 2 | M:rodaje 50, J:rodaje 50, S:tirada 75 |
| 3 | base | 190 | 3 | 80 | 95 | 2 | M:rodaje 55, J:rodaje 55, S:tirada 80 |
| 4 ↓ | base | 130 | 3 | 40 | 95 | 2 | M:rodaje 45, J:rodaje 45, S:tirada 40 |
| 5 | construccion | 190 | 3 | 80 | 80 | 2 | M:tempo 55, J:rodaje 55, S:tirada 80 |
| 6 | construccion | 205 | 3 | 85 | 80 | 2 | M:tempo 55, J:rodaje 65, S:tirada 85 |
| 7 | construccion | 220 | 3 | 90 | 80 | 2 | M:tempo 60, J:rodaje 70, S:tirada 90 |
| 8 | construccion | 240 | 3 | 90 | 80 | 2 | M:tempo 65, J:rodaje 85, S:tirada 90 |

## Natalia González

**Datos usados:** modalidad running · nivel intermedio · edad 34 · VDOT n/d · días disponibles 6 · volumen real n/d min/sem · fuerza fija 2 · lesiones ninguna · salud anemia ferropénica leve (ferritina 11 ng/mL, Hb 11.8 g/dL). En tratamiento con hierro bisglicinate 25mg/día. Vegana estricta 6 años. Sin otras patologías. VitB12 en rango (suplementada). VitD 32 ng/mL (rango bajo-normal). · prueba running_maraton el 2026-12-06

**Falta (completar para afinar):**
- VDOT o tiempo reciente de 5K/10K (los ritmos del plan salen de aquí)
- Datos de carrera del reloj (últimas 4 semanas): el volumen de partida es una suposición por nivel

**Supuestos:**
- La prueba (Maratón Valencia, 2026-12-06) viene del onboarding: no está registrada en Competiciones.
- Sin volumen real en el reloj: se parte de 150 min/semana (supuesto para nivel intermedio).

**Avisos del planificador:**
- Anemia o déficit de hierro: se limita la calidad (sin series, solo tempo suave y progresivos), se sube el reparto suave y se pide que el médico confirme cuándo puede aumentar la intensidad. El volumen solo puede subir un 3 % por semana hasta normalizar la ferritina.
- En el tiempo disponible el volumen solo puede llegar a ~174 min/semana (lo habitual para esta prueba y nivel es ~390): el objetivo realista es llegar bien, no el volumen típico de un plan completo.

**Parámetros:** 4 salidas/sem · volumen 150 → pico 174 min · crecimiento 3 %/sem · descarga cada 4 semanas

| Sem | Fase | Min | Salidas | Tirada | % suave | Fuerza | Sesiones (día:tipo min) |
|---|---|---|---|---|---|---|---|
| 1 | base | 155 | 4 | 55 | 95 | 2 | M:rodaje 35, J:rodaje 35, V:rodaje 35, S:tirada 50 |
| 2 | base | 160 | 4 | 55 | 95 | 2 | M:rodaje 35, J:rodaje 35, V:rodaje 35, S:tirada 55 |
| 3 | construccion | 165 | 4 | 55 | 85 | 2 | M:tempo 40, J:rodaje 35, V:rodaje 35, S:tirada 55 |
| 4 ↓ | construccion | 115 | 4 | 35 | 88 | 2 | M:tempo 35, J:rodaje 25, V:rodaje 20, S:tirada 35 |
| 5 | construccion | 165 | 4 | 55 | 85 | 2 | M:tempo 40, J:rodaje 35, V:rodaje 35, S:tirada 55 |
| 6 | especifica | 170 | 4 | 60 | 83 | 2 | M:ritmo_carrera 40, J:rodaje 35, V:rodaje 35, S:tirada 60 |
| 7 | tapering | 95 | 4 | 30 | 95 | 2 | M:rodaje 25, J:rodaje 25, V:rodaje 20, S:tirada 25 |
| 8 | carrera | 55 | 2 | 30 | 95 | 0 | L:tirada 30, V:rodaje 25 |

## Laura Vidal

**Datos usados:** modalidad n/d · nivel avanzado · edad 31 · VDOT n/d · días disponibles n/d · volumen real n/d min/sem · fuerza fija 0 · lesiones ninguna · salud Ninguna · prueba trail_largo el 2026-11-15

**Falta (completar para afinar):**
- Perfil de atleta (días disponibles, lesiones, recuperación, VDOT)
- VDOT o tiempo reciente de 5K/10K (los ritmos del plan salen de aquí)
- Datos de carrera del reloj (últimas 4 semanas): el volumen de partida es una suposición por nivel

**Supuestos:**
- Nivel «avanzado» tomado de la ficha del cliente (el perfil de atleta no lo tiene).
- Sin volumen real en el reloj: se parte de 240 min/semana (supuesto para nivel avanzado).

**Avisos del planificador:**
- En el tiempo disponible el volumen solo puede llegar a ~319 min/semana (lo habitual para esta prueba y nivel es ~600): el objetivo realista es llegar bien, no el volumen típico de un plan completo.

**Parámetros:** 5 salidas/sem · volumen 240 → pico 319 min · crecimiento 10 %/sem · descarga cada 4 semanas

| Sem | Fase | Min | Salidas | Tirada | % suave | Fuerza | Sesiones (día:tipo min) |
|---|---|---|---|---|---|---|---|
| 1 | construccion | 265 | 5 | 75 | 80 | 2 | L:rodaje 40, M:tempo 55, J:series 55, V:rodaje 40, S:tirada 75 |
| 2 | construccion | 290 | 5 | 80 | 80 | 2 | L:rodaje 45, M:tempo 60, J:series 60, V:rodaje 45, S:tirada 80 |
| 3 | especifica | 320 | 5 | 90 | 78 | 2 | L:rodaje 40, M:ritmo_carrera 75, J:tempo 75, V:rodaje 40, S:tirada 90 |
| 4 | tapering | 190 | 5 | 55 | 80 | 1 | L:rodaje 30, M:series 50, J:rodaje 30, V:rodaje 25, S:tirada 55 |
| 5 | carrera | 110 | 3 | 45 | 95 | 0 | L:tirada 45, X:rodaje 35, V:rodaje 30 |
