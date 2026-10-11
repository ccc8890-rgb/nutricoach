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
| 15 | Con las sesiones limitadas por la regla de la sesión más larga, el planificador añadía una 4.ª salida aunque se hubieran pedido 3 (el protocolo híbrido fija 3) | El número de salidas pedido se trataba como una preferencia | `macrociclo.test.ts` (nunca más salidas de las pedidas) |
| 16 | Una búsqueda en PubMed por palabra sola («tapering») devolvió otro estudio (deportes de equipo, 2021) | La comprobación de título era demasiado laxa | `scripts/cargar-papers-entrenamiento.ts`: exigir el título exacto y **revisar la simulación antes de `--apply`** |
| 17 | `proponer-plan-ciencia` solo comprobaba que hubiera sesión: cualquier usuario podía generar planes de cualquier cliente | La ruta no comprobaba que el cliente fuera del coach | Comprobación 401/403 con `autorizarCoachCliente` (probada sin sesión: 401) |
| 18 | El generador desactivaba el plan activo antes de tener el nuevo completo: un fallo a mitad dejaba al cliente sin plan | Se desactivaba primero y se insertaba después | `guardar-plan.test.ts` (el nuevo nace inactivo y solo se activa al final; limpieza si falla) |
| 19 | Ejercicios propuestos por la IA sin equivalente en la biblioteca se omitían en silencio | `continue` sin aviso | `guardar-plan.test.ts` (`ejerciciosOmitidos`) y mensaje al aprobar |
| 20 | Se acumulaban tareas pendientes repetidas del mismo tipo para un cliente (dos análisis de rendimiento casi iguales) | Cada ejecución del agente o del botón creaba una nueva sin retirar la anterior | `tareas-unicas.test.ts` (la nueva sustituye a las anteriores del mismo cliente y tipo; no toca otros clientes, tipos ni lo ya decidido) y `limpiar-tareas-duplicadas.ts` |
| 21 | Nada preparaba el siguiente bloque: había que acordarse de pulsar el botón | No existía ningún automatismo | Cron `proponer-bloques` + `planificar-con-ia.test.ts` (`debeProponerAutomaticamente`: solo si toca, sin otra pendiente y con 7 días de enfriamiento) |
| 22 | El plan híbrido de Carlos (11-10) tenía series en fase base cuando el esqueleto calculado preveía 0 calidad | El prompt del protocolo híbrido fijaba «tirada + series + tempo» a mano y chocaba con el esqueleto del macrociclo (dos fuentes de verdad) | El protocolo híbrido se construye con las sesiones del esqueleto (`generar-plan-ia.ts`); `reparto-semana.test.ts` |
| 23 | La fase base quitaba la calidad aunque el atleta ya la hiciera (Carlos corre series desde hace semanas) | `nCalidad` en base solo dependía del nivel y las salidas | `EntradaMacro.calidadHabitual` (reloj: ≥ 5 % del tiempo duro): la base conserva 1 sesión salvo principiante, prudencia, lesión o salud (`reparto-semana.test.ts`) |
| 24 | 6 sesiones en 6 días con 5 disponibles, y pierna el viernes antes de la tirada del sábado | La IA decidía el día de cada sesión y nadie lo revisaba | `lib/entrenos/reparto-semana.ts`: las de carrera toman los días del esqueleto y las híbridas se colocan con reglas fijas (pierna lejos de tirada/calidad, 48 h entre piernas, días disponibles, descanso); `validarRepartoSemana` avisa si aun así algo no cuadra |
| 25 | Las 3 híbridas llevaban pierna (sentadillas + estaciones), imposible de repartir sin cargar la tirada | El prompt no limitaba la pierna | Prompt: solo UNA híbrida con pierna pesada; el reparto sitúa esa lejos de tirada y calidad |

## Límites que siguen abiertos (no son errores resueltos)
- Las cifras del macrociclo son criterio de entrenador apoyado en libros y en pocos estudios; cada regla lleva su origen en `fundamentos` (estudio / libro / criterio). Ninguna se ha contrastado con un entrenador humano.
- El plan solo contempla la parte de carrera; las estaciones de Hyrox y la fuerza se respetan como sesiones fijas, no se planifican.
- Si un atleta ejecuta sistemáticamente menos de lo planificado, el plan baja con él (sigue lo real); no hay todavía una alerta que lo diga («volumen en descenso 4 semanas»).
- Clientes que empiezan o son inconsistentes: el motor parte de una estimación baja y la corrige con lo que hagan, pero no existe un modo específico de «construir el hábito» (frecuencia antes que volumen).
