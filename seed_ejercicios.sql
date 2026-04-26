-- ============================================================
-- SEED: Ejercicios base
-- Ejecutar DESPUÉS del schema principal
-- ============================================================

insert into public.ejercicios (nombre, grupo_muscular, tipo, descripcion) values
-- PECHO
('Press banca plano', 'Pecho', 'fuerza', 'Ejercicio compuesto para pecho. Tumbado en banco, bajar la barra al pecho y empujar.'),
('Press banca inclinado', 'Pecho', 'fuerza', 'Igual que el press plano pero con el banco a 30-45 grados, enfatiza la parte superior del pecho.'),
('Press banca declinado', 'Pecho', 'fuerza', 'Banco declinado para enfatizar la parte inferior del pecho.'),
('Aperturas con mancuernas', 'Pecho', 'fuerza', 'Tumbado en banco, abrir los brazos con mancuernas describiendo un arco.'),
('Fondos en paralelas', 'Pecho', 'fuerza', 'Con el torso inclinado hacia adelante para enfatizar pecho.'),
('Crossover en polea', 'Pecho', 'fuerza', 'Cruce de poleas para aislar el pecho.'),
('Press con mancuernas', 'Pecho', 'fuerza', 'Similar al press banca pero con mancuernas, mayor rango de movimiento.'),

-- ESPALDA
('Dominadas', 'Espalda', 'fuerza', 'Colgado de la barra, subir el cuerpo hasta que la barbilla supere la barra.'),
('Jalón al pecho en polea', 'Espalda', 'fuerza', 'Tirar de la barra desde la polea alta hacia el pecho.'),
('Remo con barra', 'Espalda', 'fuerza', 'Con el torso inclinado, tirar de la barra hacia el abdomen.'),
('Remo con mancuerna', 'Espalda', 'fuerza', 'Remo unilateral apoyando una rodilla en el banco.'),
('Remo en polea baja', 'Espalda', 'fuerza', 'Tirar del cable hacia el abdomen sentado.'),
('Peso muerto', 'Espalda', 'fuerza', 'Ejercicio compuesto. Levantar la barra del suelo manteniendo la espalda recta.'),
('Peso muerto rumano', 'Espalda', 'fuerza', 'Variante del peso muerto enfocada en isquiotibiales y espalda baja.'),
('Hiperextensiones', 'Espalda', 'fuerza', 'En el banco romano, extender la espalda para trabajar los erectores.'),

-- HOMBROS
('Press militar con barra', 'Hombros', 'fuerza', 'Empujar la barra desde los hombros hacia arriba de pie o sentado.'),
('Press con mancuernas (hombros)', 'Hombros', 'fuerza', 'Press de hombros con mancuernas, sentado o de pie.'),
('Elevaciones laterales', 'Hombros', 'fuerza', 'Elevar los brazos lateralmente hasta la altura de los hombros.'),
('Elevaciones frontales', 'Hombros', 'fuerza', 'Elevar los brazos hacia adelante hasta la altura de los hombros.'),
('Pájaro o elevaciones posteriores', 'Hombros', 'fuerza', 'Inclinado, elevar los brazos lateralmente para trabajar el deltoides posterior.'),
('Face pull en polea', 'Hombros', 'fuerza', 'Tirar del cable hacia la cara para trabajar el deltoides posterior y manguito rotador.'),

-- BÍCEPS
('Curl con barra', 'Bíceps', 'fuerza', 'Curl de bíceps con barra straight o EZ.'),
('Curl con mancuernas', 'Bíceps', 'fuerza', 'Curl alterno o simultáneo con mancuernas.'),
('Curl martillo', 'Bíceps', 'fuerza', 'Curl con agarre neutro, trabaja el braquial y braquiorradial.'),
('Curl en polea baja', 'Bíceps', 'fuerza', 'Curl de bíceps en polea baja para tensión constante.'),
('Curl concentrado', 'Bíceps', 'fuerza', 'Sentado, apoyar el codo en el muslo y hacer el curl.'),

-- TRÍCEPS
('Press francés', 'Tríceps', 'fuerza', 'Tumbado, bajar la barra hacia la frente y extender.'),
('Extensión en polea alta', 'Tríceps', 'fuerza', 'Tirar hacia abajo del cable con agarre en cuerda o barra.'),
('Patada de tríceps', 'Tríceps', 'fuerza', 'Inclinado, extender el brazo hacia atrás con mancuerna.'),
('Fondos en banco', 'Tríceps', 'fuerza', 'Apoyado en banco, bajar el cuerpo flexionando los codos.'),
('Extensión con mancuerna sobre la cabeza', 'Tríceps', 'fuerza', 'Elevar la mancuerna sobre la cabeza y extender el codo.'),

-- PIERNAS
('Sentadilla con barra', 'Piernas', 'fuerza', 'El rey de los ejercicios. Barra en trapecios, descender hasta que los muslos queden paralelos.'),
('Sentadilla frontal', 'Piernas', 'fuerza', 'Barra en la parte frontal de los hombros, mayor activación del cuádriceps.'),
('Prensa de piernas', 'Piernas', 'fuerza', 'En la máquina de prensa, empujar la plataforma con los pies.'),
('Extensión de cuádriceps', 'Cuádriceps', 'fuerza', 'En máquina, extender la pierna para trabajar los cuádriceps.'),
('Curl femoral tumbado', 'Isquiotibiales', 'fuerza', 'En máquina, flexionar la pierna hacia los glúteos.'),
('Curl femoral sentado', 'Isquiotibiales', 'fuerza', 'Variante del curl femoral en posición sentada.'),
('Peso muerto sumo', 'Piernas', 'fuerza', 'Variante del peso muerto con mayor apertura de piernas.'),
('Zancadas con mancuernas', 'Piernas', 'fuerza', 'Paso largo adelante bajando la rodilla trasera al suelo.'),
('Zancadas con barra', 'Piernas', 'fuerza', 'Zancadas con barra en los trapecios.'),
('Sentadilla búlgara', 'Piernas', 'fuerza', 'Pie trasero elevado en banco, descender con el pie adelantado.'),
('Hip thrust', 'Glúteos', 'fuerza', 'Apoyado en banco, empujar la barra hacia arriba con los glúteos.'),
('Patada de glúteo en polea', 'Glúteos', 'fuerza', 'De pie, tirar del cable hacia atrás con la pierna.'),
('Gemelos de pie', 'Gemelos', 'fuerza', 'En máquina o con mancuerna, elevar los talones.'),
('Gemelos sentado', 'Gemelos', 'fuerza', 'En máquina de gemelos sentado, elevar los talones.'),

-- CORE/ABDOMEN
('Crunch abdominal', 'Core', 'fuerza', 'Elevar el torso desde el suelo contrayendo el abdomen.'),
('Plancha', 'Core', 'funcional', 'Posición de plancha mantenida, trabajando el core completo.'),
('Plancha lateral', 'Core', 'funcional', 'Plancha sobre el antebrazo lateral.'),
('Rueda abdominal', 'Core', 'fuerza', 'Con la rueda, extender los brazos desde la posición de rodillas.'),
('Elevación de piernas tumbado', 'Core', 'fuerza', 'Tumbado, elevar las piernas rectas hasta 90 grados.'),
('Crunch en polea', 'Core', 'fuerza', 'Flexión del torso con ayuda de la polea alta.'),
('Mountain climbers', 'Core', 'funcional', 'En posición de plancha, llevar las rodillas al pecho alternando.'),
('Russian twist', 'Core', 'funcional', 'Sentado con el torso inclinado, rotar el tronco de lado a lado.'),

-- CARDIO
('Carrera continua', 'Cardio', 'cardio', 'Correr a ritmo constante y moderado.'),
('HIIT en cinta', 'Cardio', 'cardio', 'Intervalos de alta intensidad en cinta: sprint / trote alternados.'),
('Bicicleta estática', 'Cardio', 'cardio', 'Pedalear en bicicleta estática a intensidad moderada o alta.'),
('Elíptica', 'Cardio', 'cardio', 'Ejercicio cardiovascular de bajo impacto en máquina elíptica.'),
('Remo ergómetro', 'Cardio', 'cardio', 'Remar en la máquina de remo, ejercicio total body.'),
('Burpees', 'Cardio', 'funcional', 'Ejercicio completo: sentadilla, plancha, flexión, salto.'),
('Saltar la comba', 'Cardio', 'cardio', 'Salto de cuerda continuo o con variaciones.'),
('Battle ropes', 'Cardio', 'funcional', 'Ondular las cuerdas pesadas en diferentes patrones.');
