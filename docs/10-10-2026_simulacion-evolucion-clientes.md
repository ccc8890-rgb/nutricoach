# Simulación de la evolución de atletas sintéticos (2026-10-10)

Generado con `scripts/simular-evolucion-clientes.ts`; no toca la base de datos. Cada semana el motor se recalcula con lo que el atleta **realmente corrió** (media de las 4 últimas semanas completas; parón si lleva ≥ 2 semanas sin correr). La adherencia, los parones y los techos de tiempo son inventados para provocar situaciones: sirve para ver si el motor reacciona con sentido, no para validar resultados deportivos.

## A · Principiante 10K

Corre poco, sin VDOT, 10K en 12 semanas, adherencia normal.

| Sem | Fase | Planeado | Ejecutado | Media 4 sem previas |
|---|---|---|---|---|
| 1 | base | 65 | 54 | 60 |
| 2 | base | 65 | 51 | 59 |
| 3 | base | 60 | 55 | 56 |
| 4 | base | 60 | 50 | 55 |
| 5 | base | 55 | 0 | 53 |
| 6 | base | 55 | 48 | 52 |
| 7 | base | 55 | 42 | 51 |
| 8 | construccion | 50 | 44 | 47 |
| 9 | construccion | 50 | 40 | 45 |
| 10 | construccion | 50 | 50 | 44 |
| 11 | construccion | 50 | 50 | 44 |
| 12 | carrera | 45 | 45 | 46 |

**Sin incidencias.**

## B · Media maratón intermedio

VDOT 42, 150 min/sem, media maratón en 14 semanas, adherencia alta con un parón de 2 semanas.

| Sem | Fase | Planeado | Ejecutado | Media 4 sem previas |
|---|---|---|---|---|
| 1 | base | 160 | 141 | 150 |
| 2 | base | 160 | 133 | 148 |
| 3 | base | 155 | 151 | 144 |
| 4 | base | 155 | 135 | 144 |
| 5 | base | 150 | 137 | 140 |
| 6 | base | 150 | 122 | 139 |
| 7 | base | 145 | 0 | 136 |
| 8 | base | 140 | 0 | 131 |
| 9 | retorno | 70 | 65 | 136 |
| 10 | retorno | 70 | 59 | 136 |
| 11 | retorno | 70 | 70 | 136 |
| 12 | construccion | 70 | 70 | 65 |
| 13 | construccion | 70 | 70 | 66 |
| 14 | carrera | 45 | 43 | 67 |

**Sin incidencias.**

## C · Maratón avanzado

VDOT 52, 300 min/sem, maratón en 16 semanas, muy constante, techo de tiempo 400 min/sem.

| Sem | Fase | Planeado | Ejecutado | Media 4 sem previas |
|---|---|---|---|---|
| 1 | base | 330 | 305 | 300 |
| 2 | base | 330 | 289 | 301 |
| 3 | base | 330 | 330 | 299 |
| 4 | base | 335 | 307 | 306 |
| 5 | base | 340 | 327 | 308 |
| 6 | base | 345 | 296 | 313 |
| 7 | base | 345 | 340 | 315 |
| 8 | base | 350 | 310 | 318 |
| 9 | base | 350 | 350 | 318 |
| 10 | base | 355 | 355 | 324 |
| 11 | construccion | 375 | 375 | 339 |
| 12 | construccion | 385 | 385 | 348 |
| 13 | construccion | 405 | 400 | 366 |
| 14 | construccion | 415 | 400 | 379 |
| 15 | tapering | 215 | 215 | 390 |
| 16 | carrera | 175 | 154 | 350 |

**Sin incidencias.**

## D · Veterano con rodilla

55 años, rodilla delicada, 10K en 10 semanas, adherencia irregular.

| Sem | Fase | Planeado | Ejecutado | Media 4 sem previas |
|---|---|---|---|---|
| 1 | base | 95 | 70 | 90 |
| 2 | base | 90 | 63 | 85 |
| 3 | base | 80 | 65 | 78 |
| 4 | base | 75 | 0 | 72 |
| 5 | base | 70 | 51 | 66 |
| 6 | construccion | 65 | 50 | 60 |
| 7 | construccion | 60 | 41 | 55 |
| 8 | construccion | 50 | 39 | 47 |
| 9 | construccion | 45 | 0 | 45 |
| 10 | carrera | 45 | 32 | 43 |

**Sin incidencias.**

## E · Running + Hyrox

Híbrido: 3 sesiones de fuerza fijas, 3 de carrera, Hyrox en 10 semanas, VDOT 45.

| Sem | Fase | Planeado | Ejecutado | Media 4 sem previas |
|---|---|---|---|---|
| 1 | base | 100 | 83 | 89 |
| 2 | base | 95 | 75 | 88 |
| 3 | base | 90 | 83 | 84 |
| 4 | base | 90 | 74 | 83 |
| 5 | base | 85 | 74 | 79 |
| 6 | construccion | 85 | 0 | 77 |
| 7 | construccion | 85 | 66 | 77 |
| 8 | construccion | 80 | 71 | 71 |
| 9 | construccion | 75 | 60 | 70 |
| 10 | carrera | 45 | 45 | 66 |

**Sin incidencias.**

## F · Vuelve de parón

10 semanas sin correr, quiere un 10K en 12 semanas.

| Sem | Fase | Planeado | Ejecutado | Media 4 sem previas |
|---|---|---|---|---|
| 1 | retorno | 60 | 50 | — |
| 2 | base | 55 | 43 | 50 |
| 3 | base | 50 | 46 | 47 |
| 4 | base | 50 | 41 | 46 |
| 5 | base | 50 | 43 | 45 |
| 6 | base | 50 | 39 | 43 |
| 7 | base | 50 | 44 | 42 |
| 8 | construccion | 50 | 40 | 42 |
| 9 | construccion | 50 | 50 | 42 |
| 10 | construccion | 50 | 50 | 43 |
| 11 | construccion | 50 | 50 | 46 |
| 12 | carrera | 45 | 40 | 48 |

**Sin incidencias.**
