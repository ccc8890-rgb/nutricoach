# Errores conocidos del motor de rendimiento y de planes de carrera

Cada error que se ha encontrado queda aquí con su causa y el test que lo vigila. **Antes de dar por bueno cualquier cambio en el motor: `npm run verificar:motor`** (tests, tipos, eslint, simulación de evolución y comprobación de los estudios citados). Si falla, no se sube.

Regla de trabajo: cuando aparezca un error nuevo, primero se escribe el test que lo reproduce, luego se corrige, y se añade una fila aquí.

| # | Error (qué pasaba) | Causa | Test que lo vigila |
|---|---|---|---|
| 1 | La deriva cardiaca salía inflada y se decía que los rodajes eran «demasiado fuertes» | Se contaba el calentamiento (el pulso sube solo al entrar en calor) | `deriva.test.ts` (calentamiento excluido) |
| 2 | Estudios narrativos etiquetados como revisiones sistemáticas inflaban la fiabilidad | Nivel de evidencia asignado a mano | `evidencia.test.ts`, `scripts/cargar-papers-entrenamiento.ts` (comprueba título en PubMed) |
| 3 | DOI de Meeusen 2013 incorrecto; Casado 2022 con DOI inexistente | Datos copiados sin verificar | `scripts/verificar-doi-reglas.ts` (dentro de `verificar:motor`) |
| 4 | La IA inventaba ritmos de entrenamiento | No se le daban los del VDOT | `guardas.test.ts`, `validar-plan-carrera.test.ts` |
| 5 | El plan generado pedía 154 min/semana a quien corre 89 | El generador no recibía el volumen real | `validar-plan-carrera.test.ts` (salto de volumen) |
| 6 | El detector de salud activaba diabetes/hipertensión con «Sin diabetes» o «TA normal-alta» | No entendía negaciones; la tensión se decidía por palabras | `macrociclo.test.ts` (banderasSalud) |
| 7 | El plan acababa una semana antes de la semana de la prueba | La cuadrícula de semanas empezaba en el lunes pasado y no incluía la semana de la carrera | `macrociclo.test.ts` (semana de la carrera al final, sin sesión el día antes) |
| 8 | Con anemia el aviso decía «no subir la carga» y el plan subía un 40 % | Aviso y cálculo eran independientes | `macrociclo.test.ts` (anemia: +3 %/semana y 1 calidad) |
| 9 | Tempo de 105 min con 3 salidas | Todo el volumen intenso caía en una sola sesión | `macrociclo.test.ts` (calidad ≤ 90 min) |
| 10 | «Maratón Valencia» (texto libre) se trataba como prueba corta, sin reducción larga | Disciplina desconocida → valor por defecto silencioso | `macro-desde-cliente.test.ts` (disciplinaCanonica) y `macrociclo.test.ts` (aviso «no reconocido») |
| 11 | Con 40 min/semana reales se suponían 150 | Un dato real bajo se descartaba como «no fiable» | `macrociclo.test.ts` y simulación de evolución |
| 12 | Tras una enfermedad o parón el plan saltaba (+144 %, +281 %) o perdía el protocolo de retorno | La media de 4 semanas incluía los ceros y el parón no se detectaba tras volver | `macro-desde-cliente.test.ts` (analizarVolumen) y simulación |
| 13 | La semana de la carrera llevaba tanto volumen como la anterior (175 min más la prueba) | Se calculaba como un porcentaje del volumen de reducción | `macrociclo.test.ts` |
| 14 | A un principiante sin datos se le suponían 90 min/semana | Suposición alta por nivel | `macrociclo.test.ts` (45 min y 2 semanas de calibración sin subir) |

## Límites que siguen abiertos (no son errores resueltos)
- Las cifras del macrociclo son criterio de entrenador apoyado en libros y en pocos estudios; cada regla lleva su origen en `fundamentos` (estudio / libro / criterio). Ninguna se ha contrastado con un entrenador humano.
- El plan solo contempla la parte de carrera; las estaciones de Hyrox y la fuerza se respetan como sesiones fijas, no se planifican.
- Si un atleta ejecuta sistemáticamente menos de lo planificado, el plan baja con él (sigue lo real); no hay todavía una alerta que lo diga («volumen en descenso 4 semanas»).
- Clientes que empiezan o son inconsistentes: el motor parte de una estimación baja y la corrige con lo que hagan, pero no existe un modo específico de «construir el hábito» (frecuencia antes que volumen).
