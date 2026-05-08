-- ============================================================
-- SEED: Ejercicios base - VERSIÓN EXTENDIDA
-- Incluye: gimnasio, fuerza, HYROX, running, ciclismo, natación, triatlón
-- Basado en literatura científica actual (2020-2025)
-- ============================================================
--
-- REFERENCIAS:
-- • Schoenfeld (2010, 2021) — hipertrofia, selección de ejercicios
-- • Israetel / RP — selección de ejercicios por grupo muscular
-- • Contreras (2023) — HYROX training methodology
-- • Daniels (2014) — Running formula, periodización
-- • Friel (2021) — Triathlon training bible
-- • Coggan (2023) — Training and racing with a power meter
-- ============================================================

-- LIMPIEZA: Si ya existen ejercicios personalizados, no los duplicamos.
-- Los ejercicios base se insertan con una sentencia INSERT masiva.

insert into public.ejercicios (nombre, grupo_muscular, tipo, descripcion) values

-- ══════════════════════════════════════════════════════════════
-- PECHO (GYM)
-- ══════════════════════════════════════════════════════════════
('Press banca plano', 'Pecho', 'fuerza', 'Ejercicio compuesto para pecho. Tumbado en banco, bajar la barra al pecho y empujar.'),
('Press banca inclinado', 'Pecho', 'fuerza', 'Igual que el press plano pero con el banco a 30-45 grados, enfatiza la parte superior del pecho.'),
('Press banca declinado', 'Pecho', 'fuerza', 'Banco declinado para enfatizar la parte inferior del pecho.'),
('Press inclinado con mancuernas', 'Pecho', 'fuerza', 'Press de pecho con mancuernas en banco inclinado 30-45°, mayor rango de movimiento que con barra.'),
('Press con mancuernas plano', 'Pecho', 'fuerza', 'Press de pecho con mancuernas en banco plano, mayor activación de estabilizadores.'),
('Aperturas con mancuernas', 'Pecho', 'fuerza', 'Tumbado en banco, abrir los brazos con mancuernas describiendo un arco.'),
('Aperturas en polea alta', 'Pecho', 'fuerza', 'Cruces de polea desde posición alta para énfasis en pecho inferior.'),
('Aperturas en polea baja', 'Pecho', 'fuerza', 'Cruces de polea desde posición baja para énfasis en pecho superior.'),
('Crossover en polea', 'Pecho', 'fuerza', 'Cruce de poleas para aislar el pecho.'),
('Fondos en paralelas', 'Pecho', 'fuerza', 'Con el torso inclinado hacia adelante para enfatizar pecho.'),
('Pullover con mancuerna', 'Pecho', 'fuerza', 'Tumbado en banco, llevar la mancuerna desde detrás de la cabeza hasta el pecho.'),
('Press en máquina', 'Pecho', 'fuerza', 'Press de pecho en máquina guiada, ideal para estabilidad y altos volúmenes.'),
('Pec deck', 'Pecho', 'fuerza', 'En máquina de pectorales, juntar los codos frente al pecho.'),
('Flexiones', 'Pecho', 'fuerza', 'Ejercicio de peso corporal. Cuerpo recto, bajar el pecho al suelo y empujar.'),
('Flexiones diamante', 'Pecho', 'fuerza', 'Flexiones con manos juntas formando un diamante, enfatiza tríceps y pecho interno.'),
('Flexiones declinadas', 'Pecho', 'fuerza', 'Flexiones con pies elevados, enfatiza pecho superior.'),
('Press con mancuernas en banco negativo', 'Pecho', 'fuerza', 'Press declinado con mancuernas, énfasis en pecho inferior.'),
('Contracción de pecho en polea', 'Pecho', 'fuerza', 'Ejercicio de aislamiento en polea, contracción máxima del pectoral.'),

-- ══════════════════════════════════════════════════════════════
-- ESPALDA (GYM)
-- ══════════════════════════════════════════════════════════════
('Dominadas', 'Espalda', 'fuerza', 'Colgado de la barra, subir el cuerpo hasta que la barbilla supere la barra.'),
('Dominadas supinas', 'Espalda', 'fuerza', 'Dominadas con agarre supino (palmas hacia ti), mayor activación de bíceps.'),
('Dominadas neutras', 'Espalda', 'fuerza', 'Dominadas con agarre neutral (palmas enfrentadas), mejor rango de movimiento.'),
('Dominadas lastradas', 'Espalda', 'fuerza', 'Dominadas con peso adicional mediante cinturón lastrado.'),
('Jalón al pecho en polea', 'Espalda', 'fuerza', 'Tirar de la barra desde la polea alta hacia el pecho.'),
('Jalón tras nuca', 'Espalda', 'fuerza', 'Jalón en polea alta llevando la barra detrás de la nuca.'),
('Jalón en V', 'Espalda', 'fuerza', 'Jalón al pecho con agarre en V para activación dorsal media.'),
('Remo con barra', 'Espalda', 'fuerza', 'Con el torso inclinado, tirar de la barra hacia el abdomen.'),
('Remo con mancuerna', 'Espalda', 'fuerza', 'Remo unilateral apoyando una rodilla en el banco.'),
('Remo en polea baja', 'Espalda', 'fuerza', 'Tirar del cable hacia el abdomen sentado.'),
('Remo en máquina', 'Espalda', 'fuerza', 'Remo en máquina de dorsales, movimiento guiado.'),
('Remo con barra T', 'Espalda', 'fuerza', 'Remo con barra anclada en el suelo, agarre estrecho o ancho.'),
('Remo Pendlay', 'Espalda', 'fuerza', 'Remo con barra desde el suelo cada repetición, torso paralelo al suelo.'),
('Peso muerto', 'Espalda', 'fuerza', 'Ejercicio compuesto. Levantar la barra del suelo manteniendo la espalda recta.'),
('Peso muerto rumano', 'Espalda', 'fuerza', 'Variante del peso muerto enfocada en isquiotibiales y espalda baja.'),
('Peso muerto sumo', 'Piernas', 'fuerza', 'Variante del peso muerto con mayor apertura de piernas.'),
('Peso muerto con mancuernas', 'Espalda', 'fuerza', 'Peso muerto realizado con mancuernas, mayor rango de movimiento.'),
('Hiperextensiones', 'Espalda', 'fuerza', 'En el banco romano, extender la espalda para trabajar los erectores.'),
('Hiperextensiones inversas', 'Espalda', 'fuerza', 'En banco romano, elevar las piernas hacia atrás trabajando espalda baja y glúteos.'),
('Pull-ups con agarre ancho', 'Espalda', 'fuerza', 'Dominadas con agarre muy ancho para máxima activación dorsal.'),
('Face pull en polea', 'Hombros', 'fuerza', 'Tirar del cable hacia la cara para trabajar el deltoides posterior y manguito rotador.'),
('Encogimientos de hombros (shrugs)', 'Trapecios', 'fuerza', 'Elevar los hombros hacia las orejas con barra o mancuernas.'),
('Encogimientos traseros', 'Trapecios', 'fuerza', 'Elevar los hombros con barra detrás de la espalda.'),
('Remo al mentón', 'Trapecios', 'fuerza', 'Elevar la barra hacia el mentón, trabaja trapecios y deltoides.'),

-- ══════════════════════════════════════════════════════════════
-- HOMBROS (GYM)
-- ══════════════════════════════════════════════════════════════
('Press militar con barra', 'Hombros', 'fuerza', 'Empujar la barra desde los hombros hacia arriba de pie o sentado.'),
('Press con mancuernas (hombros)', 'Hombros', 'fuerza', 'Press de hombros con mancuernas, sentado o de pie.'),
('Press Arnold', 'Hombros', 'fuerza', 'Press de hombros con rotación: empezar con mancuernas al pecho y rotar hacia afuera.'),
('Press en máquina de hombros', 'Hombros', 'fuerza', 'Press de hombros en máquina, movimiento guiado.'),
('Press con barra tras nuca', 'Hombros', 'fuerza', 'Press militar llevando la barra tras la nuca (solo con buena movilidad).'),
('Elevaciones laterales', 'Hombros', 'fuerza', 'Elevar los brazos lateralmente hasta la altura de los hombros.'),
('Elevaciones laterales inclinado', 'Hombros', 'fuerza', 'Inclinado hacia adelante, elevar los brazos lateralmente para deltoides posterior.'),
('Elevaciones frontales', 'Hombros', 'fuerza', 'Elevar los brazos hacia adelante hasta la altura de los hombros.'),
('Elevaciones frontales con barra', 'Hombros', 'fuerza', 'Elevar la barra hacia adelante hasta la altura de los hombros.'),
('Pájaro o elevaciones posteriores', 'Hombros', 'fuerza', 'Inclinado, elevar los brazos lateralmente para trabajar el deltoides posterior.'),
('Pájaro en máquina', 'Hombros', 'fuerza', 'En máquina de deltoides posterior, abrir los brazos hacia atrás.'),
('Face pull con cuerda', 'Hombros', 'fuerza', 'Tirar de la cuerda hacia la cara desde polea alta, énfasis en deltoides posterior.'),
('Press de hombros unilateral', 'Hombros', 'fuerza', 'Press con mancuerna de un brazo para corregir desbalances.'),
('Elevaciones laterales en polea', 'Hombros', 'fuerza', 'Elevación lateral con cable para tensión constante en todo el rango.'),
('Y-T-W levantamientos', 'Hombros', 'fuerza', 'Tumbado prono, elevar brazos formando Y, T y W para salud del hombro.'),

-- ══════════════════════════════════════════════════════════════
-- BÍCEPS (GYM)
-- ══════════════════════════════════════════════════════════════
('Curl con barra', 'Bíceps', 'fuerza', 'Curl de bíceps con barra recta o EZ.'),
('Curl con barra EZ', 'Bíceps', 'fuerza', 'Curl de bíceps con barra EZ, más ergonómico para muñecas.'),
('Curl con mancuernas', 'Bíceps', 'fuerza', 'Curl alterno o simultáneo con mancuernas.'),
('Curl martillo', 'Bíceps', 'fuerza', 'Curl con agarre neutro, trabaja el braquial y braquiorradial.'),
('Curl en polea baja', 'Bíceps', 'fuerza', 'Curl de bíceps en polea baja para tensión constante.'),
('Curl concentrado', 'Bíceps', 'fuerza', 'Sentado, apoyar el codo en el muslo y hacer el curl.'),
('Curl inclinado', 'Bíceps', 'fuerza', 'Tumbado en banco inclinado, curl con mancuernas para estiramiento máximo.'),
('Curl predicador', 'Bíceps', 'fuerza', 'En banco predicador, curl con barra EZ aislando el bíceps.'),
('Curl en polea alta', 'Bíceps', 'fuerza', 'Curl de bíceps en polea alta (con el cuerpo inclinado hacia atrás).'),
('Curl inverso', 'Bíceps', 'fuerza', 'Curl con agarre prono, trabaja braquiorradial y antebrazo.'),
('Curl con agarre martillo en polea', 'Bíceps', 'fuerza', 'Curl con cuerda en polea baja con agarre neutro.'),
('Curl 21', 'Bíceps', 'fuerza', '21 reps parciales: 7 inferior + 7 superior + 7 completas.'),

-- ══════════════════════════════════════════════════════════════
-- TRÍCEPS (GYM)
-- ══════════════════════════════════════════════════════════════
('Press francés', 'Tríceps', 'fuerza', 'Tumbado, bajar la barra hacia la frente y extender.'),
('Press francés con mancuernas', 'Tríceps', 'fuerza', 'Press francés realizado con mancuernas, uno o dos brazos.'),
('Extensión en polea alta', 'Tríceps', 'fuerza', 'Tirar hacia abajo del cable con agarre en cuerda o barra.'),
('Extensión en polea con cuerda', 'Tríceps', 'fuerza', 'Jalar la cuerda hacia abajo y separar al final para máxima contracción.'),
('Extensión en polea inversa', 'Tríceps', 'fuerza', 'Agarrar la polea por detrás, jalar hacia abajo con agarre prono.'),
('Patada de tríceps', 'Tríceps', 'fuerza', 'Inclinado, extender el brazo hacia atrás con mancuerna.'),
('Fondos en banco', 'Tríceps', 'fuerza', 'Apoyado en banco, bajar el cuerpo flexionando los codos.'),
('Extensión con mancuerna sobre la cabeza', 'Tríceps', 'fuerza', 'Elevar la mancuerna sobre la cabeza y extender el codo.'),
('Press banca agarre cerrado', 'Tríceps', 'fuerza', 'Press banca con manos juntas, énfasis en tríceps.'),
('Extensión tumbado con barra', 'Tríceps', 'fuerza', 'Skull crusher con barra EZ tumbado.'),
('Extensión unilateral en polea', 'Tríceps', 'fuerza', 'Extensión de tríceps a un brazo en polea para corregir desbalances.'),
('Pushdown con barra V', 'Tríceps', 'fuerza', 'Jalón hacia abajo con barra V en polea alta.'),

-- ══════════════════════════════════════════════════════════════
-- PIERNAS: CUÁDRICEPS (GYM)
-- ══════════════════════════════════════════════════════════════
('Sentadilla con barra', 'Piernas', 'fuerza', 'El rey de los ejercicios. Barra en trapecios, descender hasta que los muslos queden paralelos.'),
('Sentadilla frontal', 'Piernas', 'fuerza', 'Barra en la parte frontal de los hombros, mayor activación del cuádriceps.'),
('Sentadilla con pausa', 'Piernas', 'fuerza', 'Sentadilla con barra haciendo pausa de 2-3 segundos en la posición inferior.'),
('Sentadilla búlgara', 'Piernas', 'fuerza', 'Pie trasero elevado en banco, descender con el pie adelantado.'),
('Sentadilla goblet', 'Piernas', 'fuerza', 'Sentadilla sosteniendo una mancuerna o kettlebell contra el pecho.'),
('Prensa de piernas', 'Piernas', 'fuerza', 'En la máquina de prensa, empujar la plataforma con los pies.'),
('Prensa de piernas unilateral', 'Piernas', 'fuerza', 'Prensa a una pierna para corregir desbalances.'),
('Prensa inclinada', 'Piernas', 'fuerza', 'Prensa de piernas con el asiento inclinado 45°.'),
('Extensión de cuádriceps', 'Cuádriceps', 'fuerza', 'En máquina, extender la pierna para trabajar los cuádriceps.'),
('Extensión unilateral', 'Cuádriceps', 'fuerza', 'Extensión de cuádriceps a una pierna.'),
('Zancadas con mancuernas', 'Piernas', 'fuerza', 'Paso largo adelante bajando la rodilla trasera al suelo.'),
('Zancadas con barra', 'Piernas', 'fuerza', 'Zancadas con barra en los trapecios.'),
('Zancadas inversas', 'Piernas', 'fuerza', 'Paso largo hacia atrás, menor estrés en la rodilla.'),
('Zancadas laterales', 'Piernas', 'fuerza', 'Paso lateral amplio, trabaja aductores y glúteo medio.'),
('Zancadas caminando', 'Piernas', 'fuerza', 'Zancadas alternas hacia adelante en movimiento.'),
('Sentadilla split búlgara', 'Piernas', 'fuerza', 'Variante de sentadilla búlgara con el pie más adelantado.'),
('Step-ups', 'Piernas', 'fuerza', 'Subir a un cajón alternando piernas, con mancuernas o barra.'),
('Sentadilla hack', 'Piernas', 'fuerza', 'En máquina hack, sentadilla con el torso fijo.'),

-- ══════════════════════════════════════════════════════════════
-- PIERNAS: ISQUIOTIBIALES Y GLÚTEOS (GYM)
-- ══════════════════════════════════════════════════════════════
('Curl femoral tumbado', 'Isquiotibiales', 'fuerza', 'En máquina, flexionar la pierna hacia los glúteos.'),
('Curl femoral sentado', 'Isquiotibiales', 'fuerza', 'Variante del curl femoral en posición sentada.'),
('Curl femoral tumbado unilateral', 'Isquiotibiales', 'fuerza', 'Curl femoral a una pierna para trabajo unilateral.'),
('Peso muerto rumano', 'Espalda', 'fuerza', 'Variante del peso muerto enfocada en isquiotibiales y espalda baja.'),
('Peso muerto rumano unilateral', 'Isquiotibiales', 'fuerza', 'Peso muerto rumano a una pierna con mancuerna.'),
('Hip thrust', 'Glúteos', 'fuerza', 'Apoyado en banco, empujar la barra hacia arriba con los glúteos.'),
('Hip thrust unilateral', 'Glúteos', 'fuerza', 'Hip thrust a una pierna con mancuerna.'),
('Puente de glúteos', 'Glúteos', 'fuerza', 'Tumbado, elevar la cadera contrayendo glúteos.'),
('Puente de glúteos a una pierna', 'Glúteos', 'fuerza', 'Puente de glúteos elevando una pierna.'),
('Patada de glúteo en polea', 'Glúteos', 'fuerza', 'De pie, tirar del cable hacia atrás con la pierna.'),
('Patada de glúteo en máquina', 'Glúteos', 'fuerza', 'En máquina de glúteos, empujar hacia atrás.'),
('Abducción de cadera en máquina', 'Glúteos', 'fuerza', 'En máquina de abductores, abrir las piernas contra resistencia.'),
('Abducción de cadera en polea', 'Glúteos', 'fuerza', 'De pie, abrir la pierna lateralmente contra el cable.'),
('Aducción de cadera en máquina', 'Aductores', 'fuerza', 'En máquina de aductores, juntar las piernas contra resistencia.'),
('Good mornings', 'Isquiotibiales', 'fuerza', 'Con barra en trapecios, flexionar el torso hacia adelante manteniendo la espalda recta.'),
('Nordic curls', 'Isquiotibiales', 'fuerza', 'Ejercicio excéntrico para isquiotibiales, con ayuda de un compañero o anclaje.'),

-- ══════════════════════════════════════════════════════════════
-- GEMELOS Y SÓLEO (GYM)
-- ══════════════════════════════════════════════════════════════
('Gemelos de pie', 'Gemelos', 'fuerza', 'En máquina o con mancuerna, elevar los talones.'),
('Gemelos sentado', 'Gemelos', 'fuerza', 'En máquina de gemelos sentado, elevar los talones.'),
('Gemelos en prensa', 'Gemelos', 'fuerza', 'En prensa de piernas, empujar con las puntas de los pies.'),
('Gemelos a una pierna', 'Gemelos', 'fuerza', 'Elevación de talones a una pierna con mancuerna.'),
('Saltos en punta de pies', 'Gemelos', 'fuerza', 'Saltos explosivos usando solo las puntas de los pies.'),

-- ══════════════════════════════════════════════════════════════
-- CORE Y ABDOMEN (GYM)
-- ══════════════════════════════════════════════════════════════
('Crunch abdominal', 'Core', 'fuerza', 'Elevar el torso desde el suelo contrayendo el abdomen.'),
('Crunch en polea', 'Core', 'fuerza', 'Flexión del torso con ayuda de la polea alta.'),
('Crunch invertido', 'Core', 'fuerza', 'Tumbado, elevar las piernas flexionadas llevando las rodillas al pecho.'),
('Crunch con cable', 'Core', 'fuerza', 'De rodillas, flexionar el torso tirando de la polea alta.'),
('Plancha', 'Core', 'funcional', 'Posición de plancha mantenida, trabajando el core completo.'),
('Plancha lateral', 'Core', 'funcional', 'Plancha sobre el antebrazo lateral.'),
('Plancha con elevación de pierna', 'Core', 'funcional', 'Plancha alternando elevación de piernas.'),
('Rueda abdominal', 'Core', 'fuerza', 'Con la rueda, extender los brazos desde la posición de rodillas.'),
('Rueda abdominal de pie', 'Core', 'fuerza', 'Con la rueda, extender desde posición de pie (avanzado).'),
('Elevación de piernas tumbado', 'Core', 'fuerza', 'Tumbado, elevar las piernas rectas hasta 90 grados.'),
('Elevación de piernas colgado', 'Core', 'fuerza', 'Colgado de una barra, elevar las piernas rectas hasta paralelo.'),
('Elevación de rodillas colgado', 'Core', 'fuerza', 'Colgado, elevar las rodillas al pecho.'),
('Mountain climbers', 'Core', 'funcional', 'En posición de plancha, llevar las rodillas al pecho alternando.'),
('Russian twist', 'Core', 'funcional', 'Sentado con el torso inclinado, rotar el tronco de lado a lado.'),
('Russian twist con mancuerna', 'Core', 'fuerza', 'Russian twist sosteniendo una mancuerna o disco.'),
('Pallof press', 'Core', 'fuerza', 'De pie, empujar el cable hacia adelante resistiendo la rotación.'),
('Pallof press con rotación', 'Core', 'fuerza', 'Pallof press añadiendo rotación controlada del torso.'),
('V-ups', 'Core', 'fuerza', 'Tumbado, elevar piernas y torso simultáneamente formando una V.'),
('Ab wheel rollouts', 'Core', 'fuerza', 'Con rueda abdominal, extender y contraer desde rodillas.'),
('Dead bug', 'Core', 'funcional', 'Tumbado, extender brazo y pierna opuestos manteniendo el core firme.'),
('Giro ruso con disco', 'Core', 'fuerza', 'Sentado, rotar el torso de lado a lado con un disco.'),
('Flexión lateral con mancuerna', 'Core', 'fuerza', 'De pie, inclinarse lateralmente sosteniendo una mancuerna.'),

-- ══════════════════════════════════════════════════════════════
-- ATRAPES Y TRAPECIOS
-- ══════════════════════════════════════════════════════════════
('Encogimiento de hombros con barra', 'Trapecios', 'fuerza', 'Elevar los hombros hacia arriba con barra.'),
('Encogimiento con mancuernas', 'Trapecios', 'fuerza', 'Elevar los hombros hacia arriba con mancuernas.'),
('Encogimiento trasero con barra', 'Trapecios', 'fuerza', 'Elevar los hombros con barra detrás de la espalda.'),
('Remo al mentón con barra', 'Trapecios', 'fuerza', 'Elevar la barra hacia el mentón, trabajando trapecios superiores.'),
('Remo al mentón con cuerda', 'Trapecios', 'fuerza', 'Remo al mentón en polea baja con cuerda.'),
('Face pull con énfasis en trapecios', 'Trapecios', 'fuerza', 'Face pull con agarre más amplio activando trapecios medios.'),

-- ══════════════════════════════════════════════════════════════
-- ANTEBRAZOS
-- ══════════════════════════════════════════════════════════════
('Curl de muñeca con barra', 'Antebrazos', 'fuerza', 'Antebrazos apoyados, flexión de muñeca con barra.'),
('Curl de muñeca inverso', 'Antebrazos', 'fuerza', 'Extensión de muñeca con barra para antebrazos posteriores.'),
('Curl de muñeca con mancuerna', 'Antebrazos', 'fuerza', 'Flexión de muñeca unilateral con mancuerna.'),
('Agarré de pinza', 'Antebrazos', 'fuerza', 'Sostener un disco con los dedos el máximo tiempo posible.'),
('Colgada muerta', 'Antebrazos', 'fuerza', 'Colgarse de una barra el máximo tiempo posible.'),
('Caminata del granjero', 'Antebrazos', 'funcional', 'Caminar sosteniendo mancuernas pesadas a los lados.'),
('Caminata del granjero unilateral', 'Antebrazos', 'funcional', 'Caminar con una sola mancuerna pesada, trabajando core y antebrazo.'),

-- ══════════════════════════════════════════════════════════════
-- EJERCICIOS COMPUESTOS Y OLÍMPICOS
-- ══════════════════════════════════════════════════════════════
('Clean', 'Cuerpo completo', 'fuerza', 'Levantar la barra desde el suelo hasta los hombros en un movimiento explosivo.'),
('Power clean', 'Cuerpo completo', 'fuerza', 'Variante del clean sin recibir en sentadilla completa.'),
('Snatch', 'Cuerpo completo', 'fuerza', 'Levantar la barra desde el suelo hasta arriba de la cabeza en un solo movimiento.'),
('Power snatch', 'Cuerpo completo', 'fuerza', 'Variante del snatch sin recibir en sentadilla.'),
('Jerk', 'Cuerpo completo', 'fuerza', 'Empujar la barra desde los hombros hacia arriba usando piernas.'),
('Clean and jerk', 'Cuerpo completo', 'fuerza', 'Combinación de clean + jerk, movimiento olímpico completo.'),
('Push press', 'Cuerpo completo', 'fuerza', 'Press militar con ayuda de piernas, movimiento explosivo.'),
('Push jerk', 'Cuerpo completo', 'fuerza', 'Jerk sin hacer split, empuje vertical.'),
('Split jerk', 'Cuerpo completo', 'fuerza', 'Jerk con apertura de piernas hacia adelante y atrás.'),
('Cargada con mancuerna', 'Cuerpo completo', 'fuerza', 'Clean con mancuerna, excelente para entrenamiento unilateral.'),
('Snatch con mancuerna', 'Cuerpo completo', 'fuerza', 'Snatch con mancuerna, alternativa más accesible.'),
('Kettlebell swing', 'Cuerpo completo', 'funcional', 'Balanceo de kettlebell desde entre las piernas hasta la altura del pecho.'),
('Kettlebell clean', 'Cuerpo completo', 'funcional', 'Clean con kettlebell, movimiento explosivo de cadera.'),
('Kettlebell snatch', 'Cuerpo completo', 'funcional', 'Snatch con kettlebell, balanceo hasta arriba.'),
('Turkish get-up', 'Cuerpo completo', 'funcional', 'Desde tumbado hasta de pie sosteniendo kettlebell sobre la cabeza.'),

-- ══════════════════════════════════════════════════════════════
-- EJERCICIOS FUNCIONALES / HIIT
-- ══════════════════════════════════════════════════════════════
('Burpees', 'Cardio', 'funcional', 'Ejercicio completo: sentadilla, plancha, flexión, salto.'),
('Burpees con salto vertical', 'Cuerpo completo', 'funcional', 'Burpee terminando con un salto vertical máximo.'),
('Burpees con flexión', 'Cuerpo completo', 'funcional', 'Burpee completo incluyendo flexión de pecho.'),
('Saltar la comba', 'Cardio', 'cardio', 'Salto de cuerda continuo o con variaciones.'),
('Battle ropes', 'Cardio', 'funcional', 'Ondular las cuerdas pesadas en diferentes patrones.'),
('Battle ropes - slams', 'Cuerpo completo', 'funcional', 'Golpear las cuerdas contra el suelo con ambas manos.'),
('Battle ropes - circles', 'Hombros', 'funcional', 'Movimientos circulares con las cuerdas.'),
('Box jumps', 'Piernas', 'funcional', 'Saltar sobre un cajón desde posición de pie.'),
('Box jumps con peso', 'Piernas', 'funcional', 'Saltos a cajón sosteniendo mancuernas o chaleco.'),
('Step-downs', 'Piernas', 'funcional', 'Bajar controladamente de un cajón, excéntrico para cuádriceps.'),
('Lateral jumps', 'Piernas', 'funcional', 'Saltos laterales sobre un obstáculo bajo.'),
('Broad jumps', 'Piernas', 'funcional', 'Saltos horizontales máximos desde parado.'),
('Thrusters', 'Cuerpo completo', 'funcional', 'Combinación de sentadilla frontal + press de hombros.'),
('Wall balls', 'Cuerpo completo', 'funcional', 'Sentadilla frontal lanzando un balón medicinal contra la pared.'),
('Medicine ball slams', 'Cuerpo completo', 'funcional', 'Elevar el balón medicinal y golpearlo contra el suelo.'),
('Medicine ball rotacional', 'Core', 'funcional', 'Lanzamiento rotacional del balón medicinal contra la pared.'),
('Kettlebell clean and press', 'Cuerpo completo', 'funcional', 'Clean + press con kettlebell en un movimiento fluido.'),
('Kettlebell windmill', 'Core', 'funcional', 'Con kettlebell sobre la cabeza, inclinarse lateralmente tocando el suelo.'),
('Sled push', 'Cuerpo completo', 'funcional', 'Empujar el trineo lastrado hacia adelante.'),
('Sled pull', 'Cuerpo completo', 'funcional', 'Tirar del trineo lastrado hacia atrás o caminando.'),
('Sled drag lateral', 'Piernas', 'funcional', 'Arrastrar el trineo lateralmente.'),
('Sandbag clean', 'Cuerpo completo', 'funcional', 'Levantar el sandbag desde el suelo hasta el pecho.'),
('Sandbag squat', 'Piernas', 'funcional', 'Sentadilla sosteniendo el sandbag contra el pecho.'),
('Sandbag shoulder', 'Cuerpo completo', 'funcional', 'Llevar el sandbag desde el suelo hasta el hombro.'),
('Sandbag lunge', 'Piernas', 'funcional', 'Zancadas sosteniendo el sandbag.'),
('Farmer''s carry', 'Antebrazos', 'funcional', 'Caminar sosteniendo mancuernas o kettlebells pesadas.'),
('Suitcase carry', 'Core', 'funcional', 'Caminar sosteniendo un peso en un solo lado.'),
('Overhead carry', 'Hombros', 'funcional', 'Caminar con un peso sobre la cabeza.'),
('Rope climb', 'Cuerpo completo', 'funcional', 'Trepar por una cuerda usando brazos y piernas.'),

-- ══════════════════════════════════════════════════════════════
-- HYROX — ESTACIONES ESPECÍFICAS
-- Basado en el manual oficial HYROX y metodología de entrenamiento
-- ══════════════════════════════════════════════════════════════
('SkiErg', 'Cardio', 'cardio', 'Máquina de esquí de fondo, tirar con brazos y core. Movimiento coordinado.'),
('SkiErg sprint', 'Cardio', 'cardio', 'SkiErg a máxima intensidad durante 30-60 segundos.'),
('SkiErg endurance', 'Cardio', 'cardio', 'SkiErg a ritmo constante durante 3-10 minutos.'),
('Sled push pesado', 'Cuerpo completo', 'funcional', 'Empujar el trineo con peso progresivo, torso inclinado y zancadas cortas.'),
('Sled push velocidad', 'Piernas', 'funcional', 'Empujar el trineo con peso ligero a máxima velocidad.'),
('Sled pull pesado', 'Cuerpo completo', 'funcional', 'Tirar del trineo hacia atrás caminando, brazos extendidos.'),
('Sled pull velocidad', 'Cuerpo completo', 'funcional', 'Tirar del trineo ligero a máxima velocidad.'),
('Burpee broad jumps', 'Cuerpo completo', 'funcional', 'Burpee seguido de un salto horizontal máximo. Estación clave de HYROX.'),
('Burpee broad jumps ritmo', 'Cuerpo completo', 'funcional', 'Burpee broad jumps a ritmo de competición, 10-15 repeticiones.'),
('Remo ergómetro sprint', 'Cardio', 'cardio', 'Remo a máxima potencia durante 250-500m.'),
('Remo ergómetro endurance', 'Cardio', 'cardio', 'Remo a ritmo constante durante 1-2km.'),
('Farmer''s carry pesado', 'Cuerpo completo', 'funcional', 'Caminata del granjero con mancuernas muy pesadas (32-48kg cada una).'),
('Farmer''s carry velocidad', 'Cuerpo completo', 'funcional', 'Caminata del granjero con peso moderado a máxima velocidad.'),
('Sandbag lunges', 'Piernas', 'funcional', 'Zancadas sosteniendo un sandbag sobre los hombros (10-30kg).'),
('Sandbag walking lunges', 'Piernas', 'funcional', 'Zancadas caminando con sandbag. Estación clave de HYROX.'),
('Wall balls hyrox', 'Cuerpo completo', 'funcional', 'Wall balls con balón de 6-9kg para competición HYROX.'),
('Wall balls a ritmo', 'Cuerpo completo', 'funcional', 'Wall balls manteniendo ritmo constante de 20-30 repeticiones.'),
('Pista de esquí ergómetro', 'Cardio', 'cardio', 'Simulación de esquí: intervalos de 500m en SkiErg.'),
('HYROX transición simulación', 'Cuerpo completo', 'funcional', 'Simular la transición entre estación y carrera de 1km.'),
('Carrera + SkiErg combinado', 'Cardio', 'cardio', '1km carrera + 500m SkiErg, simulación HYROX.'),

-- ══════════════════════════════════════════════════════════════
-- RUNNING — EJERCICIOS ESPECÍFICOS
-- Basado en Daniels (2014), Fitzgerald (2021)
-- ══════════════════════════════════════════════════════════════
('Carrera continua', 'Cardio', 'cardio', 'Correr a ritmo constante y moderado. Zona 2.'),
('Carrera suave de recuperación', 'Cardio', 'cardio', 'Trote muy suave para recuperación activa, ritmo conversacional.'),
('Carrera tempo', 'Cardio', 'cardio', 'Ritmo cómodamente duro, entre 15K y media maratón. 20-40 minutos.'),
('Carrera umbral', 'Cardio', 'cardio', 'Ritmo de umbral láctico (10K-15K). Intervalos de 5-20 min.'),
('Intervalos 400m', 'Cardio', 'cardio', '400m a ritmo rápido (5K-3K) con recuperación completa.'),
('Intervalos 800m', 'Cardio', 'cardio', '800m a ritmo 5K-3K con recuperación de 2-3 min.'),
('Intervalos 1km', 'Cardio', 'cardio', '1km a ritmo 5K-10K con recuperación de 2-3 min.'),
('Intervalos 1.200m', 'Cardio', 'cardio', '1.200m a ritmo 5K con recuperación de 3-4 min.'),
('Intervalos 1.600m', 'Cardio', 'cardio', '1.600m (1 milla) a ritmo 5K-10K.'),
('Fartlek', 'Cardio', 'cardio', 'Cambios de ritmo aleatorios o estructurados. Sprint + trote.'),
('Fartlek progresivo', 'Cardio', 'cardio', 'Fartlek donde los periodos rápidos se alargan progresivamente.'),
('Cuestas cortas', 'Cardio', 'cardio', 'Repeticiones en cuesta de 100-200m a máxima velocidad.'),
('Cuestas largas', 'Cardio', 'cardio', 'Repeticiones en cuesta de 400-800m a ritmo 5K-10K.'),
('Progression run', 'Cardio', 'cardio', 'Carrera que empieza suave y termina a ritmo tempo o umbral.'),
('Carrera larga', 'Cardio', 'cardio', 'Carrera a ritmo suave de larga duración (60-180 min).'),
('Carrera larga con ritmo', 'Cardio', 'cardio', 'Carrera larga con los últimos 20-30 min a ritmo de competición.'),
('Strides', 'Cardio', 'cardio', 'Aceleraciones cortas de 80-100m a ritmo rápido, buena técnica.'),
('Carrera de recuperación', 'Cardio', 'cardio', '20-30 min de trote muy suave post-entreno intenso.'),
('Intervalos en descenso', 'Cardio', 'cardio', 'Serie de intervalos donde el ritmo aumenta progresivamente.'),
('Carrera a ritmo de 5K', 'Cardio', 'cardio', 'Carrera sostenida a ritmo de 5K.'),
('Carrera a ritmo de 10K', 'Cardio', 'cardio', 'Carrera sostenida a ritmo de 10K.'),
('Carrera a ritmo de media maratón', 'Cardio', 'cardio', 'Carrera sostenida a ritmo de media maratón.'),
('Trote de calentamiento', 'Cardio', 'cardio', '10-15 min de trote suave para preparar el cuerpo.'),
('Vuelta a la calma', 'Cardio', 'cardio', '10 min de trote suave para bajar pulsaciones.'),
('Carrera en cinta inclinada', 'Cardio', 'cardio', 'Carrera en cinta con inclinación del 2-6%.'),

-- ══════════════════════════════════════════════════════════════
-- CICLISMO — EJERCICIOS ESPECÍFICOS
-- Basado en Coggan & Allen (2023), Carmichael (2021)
-- ══════════════════════════════════════════════════════════════
('Bicicleta estática', 'Cardio', 'cardio', 'Pedalear en bicicleta estática a intensidad moderada o alta.'),
('Rodillo base', 'Cardio', 'cardio', 'Pedalear en rodillo a ritmo suave, 60-90 min zona 2.'),
('Rodillo tempo', 'Cardio', 'cardio', 'Pedalear en rodillo a ritmo tempo (zona 3-4) durante 20-40 min.'),
('Sweet spot training', 'Cardio', 'cardio', 'Entre zona 3 y 4, 88-95% FTP. 3-5 series de 8-12 min.'),
('Intervalos sobre-under', 'Cardio', 'cardio', 'Alternar 3 min sobre FTP + 3 min justo bajo FTP.'),
('Intervalos largos (FTP)', 'Cardio', 'cardio', '3-5 series de 8-12 min a 100-105% FTP.'),
('Intervalos cortos (VO2max)', 'Cardio', 'cardio', '4-6 series de 3-5 min a 110-120% FTP.'),
('Esprints en bicicleta', 'Cardio', 'cardio', 'Esprints máximos de 15-30 segundos con recuperación completa.'),
('Cadencia drills', 'Cardio', 'cardio', 'Pedalear a cadencia alta (110-130 rpm) manteniendo potencia baja.'),
('Fuerza-resistencia', 'Cardio', 'cardio', 'Pedalear a baja cadencia (50-60 rpm) con alta resistencia.'),
('Rodillo recuperación', 'Cardio', 'cardio', '30-45 min de pedaleo suave para recuperación activa.'),
('Cuestas en bicicleta', 'Cardio', 'cardio', 'Repeticiones en subida de 4-10 min a ritmo sostenido.'),
('Cuestas cortas en bici', 'Cardio', 'cardio', 'Esprints en subida de 30-60 segundos máxima potencia.'),
('Contrarreloj simulación', 'Cardio', 'cardio', '20-40 min a ritmo constante de contrarreloj (100% FTP).'),
('Pedaleo a una pierna', 'Cardio', 'cardio', 'Pedalear con una pierna para mejorar técnica de pedaleo.'),
('Test FTP', 'Cardio', 'cardio', 'Test de 20 minutos a máxima potencia sostenida para calcular FTP.'),

-- ══════════════════════════════════════════════════════════════
-- NATACIÓN — EJERCICIOS ESPECÍFICOS
-- Basado en Madsen (2022), TriDot methodology
-- ══════════════════════════════════════════════════════════════
('Natación crol', 'Cardio', 'cardio', 'Natación a estilo crol, técnica y ritmo constante.'),
('Natación crol técnica', 'Cardio', 'cardio', 'Ejercicios de técnica de crol: respiración, braceo, patada.'),
('Series de crol 50m', 'Cardio', 'cardio', 'Repeticiones de 50m a ritmo de competición.'),
('Series de crol 100m', 'Cardio', 'cardio', 'Repeticiones de 100m a ritmo sostenido.'),
('Series de crol 200m', 'Cardio', 'cardio', 'Series de 200m para desarrollar resistencia aeróbica.'),
('Series de crol 400m', 'Cardio', 'cardio', 'Series de 400m para umbral aeróbico en natación.'),
('Patada con tabla', 'Cardio', 'cardio', 'Patada de crol usando tabla de flotación, piernas exclusivamente.'),
('Pull buoy', 'Cardio', 'cardio', 'Brazada de crol usando pull buoy entre piernas, brazos exclusivamente.'),
('Tirón con palas', 'Cardio', 'cardio', 'Brazada con palas para aumentar fuerza de tirón.'),
('Intervalos de natación', 'Cardio', 'cardio', 'Series de nado con descanso controlado.'),
('Natación a ritmo de competición', 'Cardio', 'cardio', 'Nado sostenido al ritmo objetivo de competición.'),
('Aguas abiertas simulación', 'Cardio', 'cardio', 'Nado continuo en piscina simulando condiciones de aguas abiertas.'),
('Bilateral breathing drills', 'Cardio', 'cardio', 'Ejercicios de respiración bilateral cada 3-5 brazadas.'),
('Drill de codo alto', 'Cardio', 'cardio', 'Ejercicio de técnica: recuperación con codo alto.'),
('Fist drill', 'Cardio', 'cardio', 'Nadar con puños cerrados para mejorar el agarre con el antebrazo.'),
('Sighting drills', 'Cardio', 'cardio', 'Ejercicios de avistamiento para aguas abiertas.'),

-- ══════════════════════════════════════════════════════════════
-- EJERCICIOS DE FLEXIBILIDAD Y MOVILIDAD
-- ══════════════════════════════════════════════════════════════
('Estiramiento de isquiotibiales', 'Isquiotibiales', 'flexibilidad', 'Estiramiento de la cadena posterior.'),
('Estiramiento de cuádriceps', 'Cuádriceps', 'flexibilidad', 'Estiramiento del cuádriceps de pie.'),
('Estiramiento de pectorales', 'Pecho', 'flexibilidad', 'Estiramiento en marco de puerta para pectorales.'),
('Estiramiento de espalda', 'Espalda', 'flexibilidad', 'Estiramiento de dorsales y espalda media.'),
('Movilidad de cadera', 'Cadera', 'flexibilidad', 'Círculos de cadera y apertura de caderas.'),
('Movilidad de hombro', 'Hombros', 'flexibilidad', 'Círculos de hombro, apertura torácica.'),
('Foam rolling espalda', 'Espalda', 'flexibilidad', 'Automasaje con foam roller para espalda.'),
('Foam rolling piernas', 'Piernas', 'flexibilidad', 'Automasaje con foam roller para piernas.'),
('Apertura torácica', 'Pecho', 'flexibilidad', 'Apertura del pecho y movilidad torácica.'),
('Estiramiento de psoas', 'Cadera', 'flexibilidad', 'Estiramiento del psoas ilíaco en posición de zancada.'),
('Yoga flow', 'Cuerpo completo', 'flexibilidad', 'Secuencia de yoga para flexibilidad general.'),
('Mobility warm-up', 'Cuerpo completo', 'flexibilidad', 'Rutina de movilidad completa pre-entreno.'),
('Estiramiento global', 'Cuerpo completo', 'flexibilidad', 'Rutina de estiramientos post-entreno para todos los grupos.');
