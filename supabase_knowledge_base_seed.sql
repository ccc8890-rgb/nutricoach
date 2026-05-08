-- ============================================================
-- SEED: Knowledge Base inicial — NutriCoach
-- coach_id = NULL → fichas globales (visibles por todos los coaches)
-- Ejecutar DESPUÉS de supabase_knowledge_base.sql
-- ============================================================

INSERT INTO public.knowledge_base
  (coach_id, disciplina, categoria, tipo, nivel_evidencia, titulo, resumen, puntos_clave, fuente, tags, poblacion, condiciones, fuente_tipo, verificado)
VALUES

-- ══════════════════════════════════════════
-- HYROX
-- ══════════════════════════════════════════

(NULL, 'hyrox', 'periodizacion', 'protocolo', 'opinion_experto',
'Periodización HYROX: estructura de 12-16 semanas hacia competición',
'Un macrociclo HYROX para atleta amateur debe estructurarse en 3 bloques: base aeróbica (4-6 semanas, zona 1-2, >80% del volumen), bloque específico (4-5 semanas, introduce las 8 estaciones con carga progresiva y simulacros parciales), y pico competitivo (2-3 semanas, reducción de volumen -40%, mantener intensidad, simulacro completo 10 días antes). La semana de descarga pre-competición es crítica: bajar volumen al 50% pero mantener algún estímulo de alta intensidad para no perder agudeza neuromuscular.',
ARRAY[
  '80% del volumen en zona 1-2 (conversacional) durante la fase base',
  'Introducir estaciones HYROX en semana 5-6, comenzando por las más técnicas (SkiErg, remo)',
  'Simulacro completo 3-4 semanas antes de la carrera, no la semana previa',
  'Reducir volumen un 40% las 2 semanas previas, mantener 1-2 sesiones de intensidad',
  'El sled push/pull requiere adaptación neuromuscular específica: introducir progresivamente'
],
'Basado en metodología de coaches HYROX certificados y análisis de splits de competición 2023-2024',
ARRAY['hyrox', 'periodizacion', 'macrociclo', 'competicion', 'amateur'],
ARRAY['atletas amateur', 'principiantes hyrox', 'masters'],
ARRAY['hyrox'],
'manual', true),

(NULL, 'hyrox', 'fuerza', 'protocolo', 'opinion_experto',
'Las 8 estaciones HYROX: demandas fisiológicas y entrenamiento específico',
'HYROX combina 8 km de running con 8 estaciones de trabajo funcional. Cada estación tiene demandas específicas: SkiErg (1000m, potencia de tren superior + core), Sled Push (50m, fuerza máxima + tolerancia al lactato), Sled Pull (50m, igual que push), Burpee Broad Jump (80, coordinación + potencia + resistencia muscular local), Rowing (1000m, potencia aeróbica), Farmers Carry (200m, resistencia de agarre y core), Sandbag Lunges (100m, fuerza unilateral + resistencia), Wall Balls (100, potencia + coordinación). El punto de fallo más común en amateurs es el sled push/pull y los sandbag lunges, que requieren fuerza funcional específica que no se desarrolla corriendo.',
ARRAY[
  'SkiErg: entrenar con ergómetro de remo/ski 2x/semana, intervals 500m a ritmo carrera',
  'Sled push/pull: introducir con peso ligero, progresar con carga cada 2 semanas',
  'Burpee Broad Jump: entrenar como bloque pliométrico, no como cardio',
  'Sandbag Lunges: sustituibles por walking lunges con mochila en entrenamiento',
  'Wall Balls: el agarre del balón y la profundidad del squat determinan la eficiencia'
],
'Análisis de datos de competición HYROX World Series 2022-2024',
ARRAY['hyrox', 'estaciones', 'fuerza funcional', 'sled', 'skierg', 'sandbag'],
ARRAY['atletas hyrox', 'amateurs', 'principiantes'],
ARRAY['hyrox'],
'manual', true),

(NULL, 'hyrox', 'zona2', 'estudio', 'estudio_observacional',
'Base aeróbica en HYROX: por qué el zona 2 es el diferenciador',
'Los mejores tiempos en HYROX amateur (sub-60 min mixto, sub-70 min individual) correlacionan fuertemente con una base aeróbica sólida. El running entre estaciones (8 km totales) a ritmo de competición (~5:00-5:30 min/km para amateurs) se realiza en zona 3-4, por lo que la eficiencia en zona 2 determina cuánto glucógeno se ahorra. Un atleta con umbral aeróbico alto puede correr el running a menor FC relativa, llegando a las estaciones menos fatigado. La recomendación: 3-4 sesiones/semana de zona 2 en fase base (45-75 min cada una), reducir a 2 en fase específica.',
ARRAY[
  '3-4 sesiones de zona 2 semanales en fase base (FC: 60-70% FCmax)',
  'El ritmo de carrera en zona 2 debe ser conversacional: si no puedes hablar, es demasiado rápido',
  'Progresar duración antes que intensidad: primero 45 min fácil, luego 60-75 min',
  'Combinar zona 2 corriendo y en bici/elíptica para reducir impacto articular'
],
'Análisis fisiológico basado en datos de wearables de atletas HYROX 2023',
ARRAY['zona2', 'aeróbico', 'base aeróbica', 'running', 'hyrox', 'umbral'],
ARRAY['atletas hyrox', 'amateurs'],
ARRAY['hyrox'],
'manual', true),

(NULL, 'hyrox', 'recuperacion', 'protocolo', 'opinion_experto',
'Recuperación post-HYROX: protocolo de 48-72 horas',
'HYROX genera daño muscular significativo (sled, lunges, burpees) combinado con depleción glucogénica del running. La recuperación óptima: primeras 2 horas (ventana anabólica): 40-50g proteína + 80-100g carbohidratos de rápida absorción. Día 1 post: movilidad suave, sin entrenamiento de fuerza. Día 2: cardio regenerativo zona 1 (30 min bici/natación). Día 3: puede volver el entrenamiento normal si no hay dolor muscular severo. La crioterapia o baños fríos en las primeras 24h reducen la inflamación aguda pero pueden interferir con adaptaciones si se usan crónicamente.',
ARRAY[
  'Ventana post-HYROX: 40-50g proteína + 80-100g carbos en las primeras 2 horas',
  'No entrenar fuerza las 48h siguientes a la competición o simulacro',
  'Baño frío (10-15°C, 10 min) en las primeras 6h reduce DOMS significativamente',
  'Día 2: cardio suave zona 1 activa la circulación sin generar fatiga adicional',
  'Sueño de calidad es la herramienta de recuperación más infrautilizada'
],
'Basado en protocolos de recuperación de CrossFit y deportes de resistencia',
ARRAY['recuperacion', 'hyrox', 'post-carrera', 'nutricion post', 'doms'],
ARRAY['atletas hyrox', 'amateurs', 'masters'],
ARRAY['hyrox'],
'manual', true),

-- ══════════════════════════════════════════
-- ENTRENAMIENTO HÍBRIDO
-- ══════════════════════════════════════════

(NULL, 'hibrido', 'periodizacion', 'metodologia', 'opinion_experto',
'Entrenamiento híbrido: compatibilidad fuerza + resistencia (interferencia)',
'El efecto de interferencia describe la inhibición de las adaptaciones de fuerza cuando se combina con entrenamiento de resistencia en la misma sesión o día. Para minimizarlo: (1) Separar fuerza y cardio al menos 6 horas si se entrenan el mismo día, o mejor en días distintos. (2) Priorizar en el orden: primero la capacidad que más te importa mejorar. (3) El HIIT interfiere más con la fuerza que el cardio de baja intensidad (zona 2). Para HYROX, donde necesitas ambas capacidades, la secuencia óptima es: mañana fuerza, tarde cardio; o días alternos fuerza/resistencia.',
ARRAY[
  'Si entrenas fuerza y cardio el mismo día, pon la fuerza SIEMPRE primero',
  'El HIIT interfiere más con las ganancias de fuerza que el zona 2',
  'Separa al menos 6 horas entre sesión de fuerza y cardio intenso el mismo día',
  'En semanas de alto volumen, prioriza recuperación entre sesiones sobre frecuencia',
  'La proteína alta (2g/kg) mitiga parcialmente el efecto de interferencia'
],
'Wilson JM et al. (2012). Concurrent Training: A Meta-Analysis. Journal of Strength & Conditioning Research',
ARRAY['hibrido', 'interferencia', 'fuerza', 'resistencia', 'compatibilidad', 'hyrox'],
ARRAY['atletas híbridos', 'atletas hyrox', 'amateurs'],
ARRAY['hyrox', 'entrenamiento hibrido'],
'manual', true),

(NULL, 'hibrido', 'volumen', 'revision', 'revision_sistematica',
'Distribución óptima de volumen en atleta híbrido amateur',
'Para un atleta amateur con 8-10 horas semanales de entrenamiento que combina fuerza y resistencia para HYROX, la distribución recomendada es: 40-50% resistencia aeróbica (3-4 sesiones), 30-35% fuerza funcional (2-3 sesiones), 15-20% trabajo específico HYROX (estaciones, simulacros). El error más común es exceder el volumen total: más de 10-12 horas semanales sin adaptación previa lleva a sobreentrenamiento en 4-6 semanas. La progresión debe ser un 5-10% de volumen por semana como máximo.',
ARRAY[
  'Máximo 10% de aumento de volumen semanal para evitar sobreentrenamiento',
  '3-4 sesiones de resistencia + 2-3 de fuerza = estructura base para HYROX amateur',
  'Una sesión semanal de trabajo específico de estaciones es suficiente en fase base',
  'Incluir 1 día completo de descanso y 1-2 de actividad ligera por semana',
  'Monitorizar la VFC (HRV) para ajustar cargas: caída sostenida indica exceso'
],
'Schumann M & Rønnestad BR (2019). Concurrent Aerobic and Strength Training. Springer',
ARRAY['volumen', 'hibrido', 'distribución', 'frecuencia', 'hyrox', 'sobreentrenamiento'],
ARRAY['atletas híbridos', 'amateurs', 'principiantes'],
ARRAY['hyrox', 'entrenamiento hibrido'],
'manual', true),

-- ══════════════════════════════════════════
-- RUNNING
-- ══════════════════════════════════════════

(NULL, 'running', 'periodizacion', 'revision', 'revision_sistematica',
'Entrenamiento polarizado en running: modelo 80/20 de Seiler',
'El modelo polarizado de Seiler establece que los atletas de élite y recreacionales mejoran más su rendimiento distribuyendo el 80% del volumen en zona 1-2 (baja intensidad) y el 20% en zona 4-5 (alta intensidad), evitando la zona 3 (umbral). Estudios con corredores recreacionales durante 9 semanas mostraron mejoras superiores en VO2max y tiempo en pruebas de 10 km vs grupos que entrenaban más en zona 3. El error típico del corredor amateur es entrenar demasiado en zona 3 (ni fácil ni difícil), lo que genera fatiga crónica sin estímulo óptimo.',
ARRAY[
  '80% del volumen semanal debe sentirse cómodo y conversacional (zona 1-2)',
  '20% en alta intensidad: intervalos en zona 4-5 (series, fartlek, tempo corto)',
  'Evitar la zona 3 (ritmo umbral) como entrenamiento habitual: agota sin el estímulo de la alta intensidad',
  'Aplicar en HYROX: las sesiones de running fácil construyen la base; los intervalos desarrollan la potencia'
],
'Seiler KS & Kjerland GØ (2006). Quantifying training intensity distribution. Scandinavian Journal of Medicine & Science in Sports',
ARRAY['polarizado', '80/20', 'zona2', 'seiler', 'running', 'intensidad'],
ARRAY['corredores amateurs', 'atletas de fondo', 'atletas hyrox'],
ARRAY['running', 'hyrox'],
'manual', true),

(NULL, 'running', 'intensidad', 'protocolo', 'rct',
'Zonas de entrenamiento por FC: delimitación y uso práctico',
'Las 5 zonas de entrenamiento por frecuencia cardíaca permiten estructurar los estímulos. Zona 1 (<65% FCmax): regenerativa, recuperación activa. Zona 2 (65-75%): aeróbico base, oxidación de grasas, construye mitocondrias. Zona 3 (75-85%): umbral aeróbico, sostenible 60-90 min, no óptima como base de entrenamiento. Zona 4 (85-92%): umbral anaeróbico, sostenible 20-40 min, mejora VO2max. Zona 5 (>92%): neuromuscular y VO2max, series cortas. Para HYROX, el running de competición sucede en zona 3-4, lo que hace crítico desarrollar zona 2 para que zona 3-4 sea más eficiente.',
ARRAY[
  'FCmax estimada = 220 - edad (aproximación; usar test de campo para mayor precisión)',
  'Zona 2 es el mayor activo metabólico a largo plazo: construye capacidad aeróbica base',
  'Para HYROX, entrena zona 2 en base y zona 4 en específico para simular running de carrera',
  'Usar monitor de FC en cada sesión: el running fácil se vuelve difícil con calor o fatiga'
],
'Skinner JS & McLellan TH (1980). Transition from aerobic to anaerobic metabolism. Research Quarterly for Exercise and Sport',
ARRAY['zonas FC', 'frecuencia cardiaca', 'zona2', 'zona4', 'running', 'intensidad'],
ARRAY['corredores', 'atletas hyrox', 'amateurs'],
ARRAY['running', 'hyrox'],
'manual', true),

(NULL, 'running', 'volumen', 'meta_analisis', 'meta_analisis',
'Progresión segura de kilometraje: regla del 10% y evidencia actual',
'La regla clásica del 10% (no aumentar el volumen semanal más de un 10%) tiene soporte moderado en la literatura. Una revisión de 2014 (Buist et al.) encontró que aumentos de hasta un 25% en semanas puntuales no incrementan la tasa de lesión si la base previa es sólida. Sin embargo, para principiantes o retorno tras descanso, el 10% sigue siendo el marco más seguro. El factor de riesgo más determinante no es el aumento semanal puntual sino la carga acumulada en las últimas 4 semanas (ACWR: Acute:Chronic Workload Ratio). Un ACWR >1.5 multiplica x2-3 el riesgo de lesión.',
ARRAY[
  'No aumentar más del 10% de volumen semanal si eres principiante o vuelves de descanso',
  'El ACWR (carga aguda/crónica) es mejor predictor de lesión que el aumento puntual',
  'ACWR óptimo: entre 0.8 y 1.3. Por encima de 1.5 hay riesgo elevado de lesión',
  'Incluir una semana de descarga (-20-30% volumen) cada 3-4 semanas de carga'
],
'Gabbett TJ (2016). The training-injury prevention paradox. British Journal of Sports Medicine',
ARRAY['volumen', 'progresion', 'lesiones', 'running', 'kilometraje', 'ACWR'],
ARRAY['corredores amateurs', 'principiantes'],
ARRAY['running', 'lesion'],
'manual', true),

-- ══════════════════════════════════════════
-- FUERZA
-- ══════════════════════════════════════════

(NULL, 'fuerza', 'fuerza', 'meta_analisis', 'meta_analisis',
'Frecuencia de entrenamiento de fuerza: 2 vs 3 sesiones semanales',
'Una meta-análisis de 2016 (Ralston et al.) con 25 estudios concluyó que entrenar cada grupo muscular 2 veces por semana es superior a 1 vez en ganancias de fuerza e hipertrofia. La diferencia entre 2 y 3 veces es marginal cuando el volumen total semanal se iguala. Para un atleta que combina fuerza con resistencia (HYROX), 2 sesiones de fuerza por semana con 10-16 series por grupo muscular son suficientes para mantener y ganar fuerza sin comprometer la recuperación. Más de 3 sesiones de fuerza + running interfieren negativamente si no se gestiona la recuperación.',
ARRAY[
  'Entrenar cada grupo muscular 2 veces por semana es el mínimo efectivo',
  'El volumen total (series x semana) importa más que la frecuencia cuando el volumen se iguala',
  '10-16 series por grupo muscular por semana para hipertrofia y mantenimiento de fuerza',
  'Para HYROX: 2 sesiones de fuerza/semana son suficientes, priorizando piernas y core'
],
'Ralston GW et al. (2017). The Effect of Weekly Set Volume on Strength Gain. Journal of Strength and Conditioning Research',
ARRAY['frecuencia', 'fuerza', 'hipertrofia', 'volumen', 'series'],
ARRAY['atletas de fuerza', 'atletas híbridos', 'amateurs'],
ARRAY['hyrox', 'entrenamiento hibrido'],
'manual', true),

(NULL, 'fuerza', 'intensidad', 'revision', 'revision_sistematica',
'RPE y RIR: autorregulación del entrenamiento de fuerza',
'El RPE (Rate of Perceived Exertion) en escala 1-10 y el RIR (Repetitions in Reserve) son herramientas de autorregulación que permiten ajustar la carga real en cada sesión en lugar de seguir porcentajes fijos de 1RM. RIR 2-3 (quedan 2-3 reps en el tanque) equivale a RPE 7-8 y es el rango óptimo para hipertrofia con baja fatiga acumulada. RIR 0-1 (al fallo o cerca) es efectivo pero genera más fatiga: reservar para sets finales. Para atletas que combinan fuerza y resistencia, entrenar con RIR 2-3 permite mayor volumen total y mejor recuperación que el entrenamiento al fallo.',
ARRAY[
  'RPE 7-8 / RIR 2-3: zona óptima para hipertrofia con buena recuperación',
  'Evitar el fallo muscular en la mayoría de series si también haces running',
  'Ajusta el peso si el RPE percibido no coincide con el planificado (fatiga, calor, sueño)',
  'Usar RIR en lugar de % de 1RM: más adaptable a variaciones del día'
],
'Zourdos MC et al. (2016). Novel Resistance Training-Specific RPE Scale. Journal of Strength and Conditioning Research',
ARRAY['RPE', 'RIR', 'autorregulacion', 'fuerza', 'intensidad', 'fallo muscular'],
ARRAY['atletas de fuerza', 'atletas híbridos'],
ARRAY['hyrox', 'entrenamiento hibrido'],
'manual', true),

-- ══════════════════════════════════════════
-- NUTRICIÓN DEPORTIVA
-- ══════════════════════════════════════════

(NULL, 'nutricion', 'proteina', 'meta_analisis', 'meta_analisis',
'Proteína en atletas: dosis óptima y distribución diaria',
'Una meta-análisis de Morton et al. (2018) con 49 estudios y 1800 participantes concluyó que el umbral de proteína para maximizar la síntesis proteica muscular es de 1.62 g/kg/día en promedio, con el límite superior de confianza en 2.2 g/kg/día. Para atletas que combinan fuerza y resistencia (como HYROX), la recomendación práctica es 1.8-2.2 g/kg/día. La distribución importa tanto como el total: 4 tomas de 0.3-0.4 g/kg cada 3-4 horas maximiza la síntesis muscular vs 2 tomas grandes. El leucine threshold (~2-3g de leucina por toma) activa el mTOR y es el trigger de la síntesis proteica.',
ARRAY[
  '1.8-2.2 g/kg/día de proteína para atletas que combinan fuerza y resistencia',
  'Distribuir en 4 tomas de 0.3-0.4 g/kg: no toda la proteína en 1-2 comidas grandes',
  'Cada toma debe contener al menos 2-3g de leucina para activar síntesis muscular',
  'Post-entrenamiento: 30-40g de proteína en la primera hora (especialmente si es fuerza)',
  'Fuentes de alta calidad: huevo, pollo, pescado, proteína de suero, legumbres + cereal'
],
'Morton RW et al. (2018). A systematic review, meta-analysis and meta-regression of the effect of protein supplementation. British Journal of Sports Medicine',
ARRAY['proteina', 'leucina', 'sintesis muscular', 'mTOR', 'nutricion deportiva', 'recuperacion'],
ARRAY['atletas de fuerza', 'atletas híbridos', 'corredores', 'atletas hyrox'],
ARRAY['hyrox', 'running', 'entrenamiento hibrido'],
'manual', true),

(NULL, 'nutricion', 'hidratacion', 'guia_clinica', 'revision_sistematica',
'Hidratación en competición y entrenamiento de resistencia',
'La deshidratación del 2% del peso corporal reduce el rendimiento aeróbico un 10-20% y deteriora la función cognitiva. En HYROX (60-90 min de esfuerzo), la pérdida de sudor oscila entre 0.8 y 1.5L/hora dependiendo de la temperatura y la intensidad. Protocolo pre-competición: 500ml de agua 2 horas antes + 250ml 30 min antes. Durante: si dura <60 min no es crítico beber, si dura >60 min beber 150-200ml cada 15-20 min. El sodio (300-500mg por hora) previene la hiponatremia en esfuerzos prolongados. Bebidas isotónicas son superiores al agua sola a partir de 60-90 min de esfuerzo.',
ARRAY[
  'Beber al menos 500ml de agua 2 horas antes de la competición',
  'En esfuerzos >60 min: 150-200ml cada 15-20 minutos durante el ejercicio',
  'Añadir sodio (bebida isotónica o sal) en esfuerzos >90 min para evitar hiponatremia',
  'Test de sudor: pesar antes y después (diferencia = pérdida de fluidos a reponer)',
  'Orina amarillo pálido = bien hidratado; amarillo oscuro = beber más'
],
'Sawka MN et al. (2007). American College of Sports Medicine position stand on exercise and fluid replacement. Medicine & Science in Sports & Exercise',
ARRAY['hidratacion', 'sodio', 'isotonica', 'competicion', 'deshidratacion', 'hyrox'],
ARRAY['atletas de resistencia', 'atletas hyrox', 'corredores'],
ARRAY['hyrox', 'running'],
'manual', true),

(NULL, 'nutricion', 'metabolismo', 'meta_analisis', 'meta_analisis',
'Carbohidratos perientrino: timing y cantidad para rendimiento',
'Los carbohidratos son el sustrato principal para esfuerzos de alta intensidad (zona 3-5). Para sesiones de entrenamiento de >60-75 min o competiciones como HYROX, la ingesta de carbohidratos pre y durante el ejercicio mejora el rendimiento. Pre-entreno (2-3 horas antes): 1-3g/kg de CHO de índice glucémico moderado-bajo. Pre-entreno inmediato (30-60 min antes): 0.5-1g/kg si no hubo comida previa. Durante HYROX: si dura <75 min, no es crítico; si dura más, 30-60g/hora. Post-entreno (primeras 2 horas): 1-1.5g/kg para resintetizar glucógeno, especialmente si hay otro entrenamiento en <8 horas.',
ARRAY[
  '2-3 horas antes: 1-3g/kg de carbohidratos (avena, arroz, patata)',
  'Inmediatamente antes (<30 min): solo si no comiste antes, y con CHO de rápida absorción',
  'Durante HYROX: si dura >75 min, 30-60g/hora (gel energético o isotónica con CHO)',
  'Post-entreno: 1-1.5g/kg de CHO + proteína para maximizar recuperación',
  'No entrenar en déficit de glucógeno si el objetivo es rendimiento máximo en la sesión'
],
'Burke LM et al. (2011). Carbohydrates for training and competition. Journal of Sports Sciences',
ARRAY['carbohidratos', 'glucogeno', 'timing', 'pre-entreno', 'post-entreno', 'rendimiento'],
ARRAY['atletas de resistencia', 'atletas hyrox', 'corredores'],
ARRAY['hyrox', 'running'],
'manual', true),

(NULL, 'nutricion', 'composicion_corporal', 'revision', 'revision_sistematica',
'Déficit calórico en atletas: rendimiento vs pérdida de grasa',
'En atletas que entrenan para rendimiento, un déficit calórico agresivo (>500 kcal/día) compromete la síntesis proteica, la recuperación, el sistema inmune y el rendimiento. El déficit óptimo para perder grasa sin sacrificar músculo ni rendimiento es de 200-400 kcal/día, con proteína alta (2-2.4 g/kg). Para HYROX, perder grasa durante la preparación es compatible si el déficit es moderado y se mantiene la proteína. Las fases de máxima especificidad (últimas 4-6 semanas) no son el momento para restricción calórica: priorizar rendimiento sobre composición corporal.',
ARRAY[
  'Déficit máximo recomendado para atletas: 300-500 kcal/día para preservar músculo',
  'Proteína alta (2-2.4 g/kg) es obligatoria en déficit para proteger masa muscular',
  'No restringir calorías las últimas 4-6 semanas antes de una competición',
  'Pérdida de peso excesiva (>1 kg/semana) en atletas indica pérdida de músculo y glucógeno',
  'Periodizar la ingesta calórica: más calorías los días de entrenamiento duro, menos en descanso'
],
'Mountjoy M et al. (2018). Relative Energy Deficiency in Sport (RED-S). British Journal of Sports Medicine',
ARRAY['deficit calorico', 'composicion corporal', 'perdida grasa', 'RED-S', 'rendimiento', 'proteina'],
ARRAY['atletas de resistencia', 'atletas hyrox', 'mujeres deportistas'],
ARRAY['hyrox', 'running', 'composicion corporal'],
'manual', true),

(NULL, 'nutricion', 'suplementacion', 'meta_analisis', 'meta_analisis',
'Suplementos con evidencia sólida en atletas de resistencia y fuerza',
'Solo 4 suplementos tienen evidencia Nivel A (respaldada por múltiples RCTs) para mejorar el rendimiento deportivo: (1) Creatina monohidrato: 3-5g/día mejora la fuerza, potencia y resistencia muscular. Especialmente útil para las estaciones de fuerza en HYROX. (2) Cafeína: 3-6mg/kg 45-60 min antes mejora el rendimiento aeróbico y reduce la percepción de esfuerzo. (3) Beta-alanina: 3.2-6.4g/día en dosis divididas tampona el lactato, útil en esfuerzos de 1-4 min (estaciones HYROX). (4) Bicarbonato sódico: 0.3g/kg pre-ejercicio, tamponador extracelular, incómodo digestivamente.',
ARRAY[
  'Creatina: 3-5g/día, sin fase de carga necesaria, tomar siempre (no solo pre-entreno)',
  'Cafeína: 3-6mg/kg (200-400mg típico) 45-60 min antes del entreno o competición',
  'Beta-alanina: 3.2g/día en dosis divididas (el picor es inofensivo, se reduce con dosis divididas)',
  'El resto de suplementos (BCAAs, glutamina, HMB) tienen evidencia débil o nula en atletas bien nutridos',
  'Vitamina D3: 2000-4000 UI/día si hay déficit (muy común en España de octubre a marzo)'
],
'Maughan RJ et al. (2018). IOC Consensus Statement on Dietary Supplements. British Journal of Sports Medicine',
ARRAY['creatina', 'cafeina', 'beta-alanina', 'suplementos', 'evidencia', 'rendimiento'],
ARRAY['atletas de fuerza', 'atletas de resistencia', 'atletas hyrox'],
ARRAY['hyrox', 'running', 'entrenamiento hibrido'],
'manual', true),

-- ══════════════════════════════════════════
-- RECUPERACIÓN Y GESTIÓN DE CARGA
-- ══════════════════════════════════════════

(NULL, 'recuperacion', 'recuperacion', 'revision', 'revision_sistematica',
'HRV (variabilidad de la frecuencia cardíaca) como marcador de recuperación',
'La VFC o HRV mide la variabilidad entre latidos en reposo y refleja el estado del sistema nervioso autónomo. Una HRV alta indica buena recuperación y preparación para el esfuerzo; una HRV baja sostenida indica acumulación de fatiga o sobreentrenamiento. Para usar HRV: medir cada mañana al despertar (en supino, 5 min, misma hora). Una caída del 15-20% respecto a la media personal es señal de bajar intensidad ese día. Apps como HRV4Training o Polar H10 permiten seguimiento diario. En bloques de alta carga de HYROX, la HRV puede guiar la autorregulación: días de baja HRV = entrenamiento suave; días de HRV alta = sesiones exigentes.',
ARRAY[
  'Medir HRV cada mañana al despertar, antes de levantarse, durante 5 minutos',
  'Caída del 15-20% respecto a tu media = señal de reducir intensidad ese día',
  'Tendencia descendente durante 5-7 días = sobreentrenamiento: tomar 2-3 días de descanso',
  'Apps recomendadas: HRV4Training (no necesita dispositivo), Elite HRV, Polar Flow',
  'El alcohol y el sueño de mala calidad reducen la HRV incluso sin entrenamiento'
],
'Plews DJ et al. (2013). Training adaptation and HRV. International Journal of Sports Physiology and Performance',
ARRAY['HRV', 'variabilidad FC', 'recuperacion', 'sobreentrenamiento', 'autorregulacion'],
ARRAY['atletas de resistencia', 'atletas híbridos', 'atletas hyrox'],
ARRAY['hyrox', 'running', 'entrenamiento hibrido'],
'manual', true),

(NULL, 'recuperacion', 'recuperacion', 'meta_analisis', 'meta_analisis',
'Sueño y rendimiento deportivo: el suplemento más infravalorado',
'Una revisión de Vitale et al. (2019) concluyó que dormir menos de 7 horas reduce el rendimiento de resistencia hasta un 11% y el de fuerza hasta un 20%. En atletas, el sueño es el periodo principal de síntesis proteica y liberación de hormona de crecimiento. La privación crónica de sueño (<6h) eleva el cortisol, reduce la testosterona y aumenta el riesgo de lesión. Para optimizar el sueño: temperatura del dormitorio 17-20°C, oscuridad total, sin pantallas 1h antes, hora de acostarse consistente. La siesta de 20-30 min entre sesiones dobles mejora el rendimiento en la segunda sesión.',
ARRAY[
  'Menos de 7h de sueño reduce el rendimiento aeróbico un 10-11%',
  'El sueño es cuando ocurre la mayoría de la síntesis proteica y recuperación muscular',
  'Temperatura del dormitorio: 17-20°C es el rango óptimo para la calidad del sueño',
  'Siesta de 20-30 min (no más) mejora el rendimiento si hay doble sesión',
  'Priorizar horas de sueño antes de añadir más suplementos o volumen de entrenamiento'
],
'Vitale KC et al. (2019). Sleep Hygiene for Optimizing Recovery in Athletes. International Journal of Sports Medicine',
ARRAY['sueño', 'recuperacion', 'rendimiento', 'hormona crecimiento', 'cortisol'],
ARRAY['atletas de resistencia', 'atletas de fuerza', 'atletas hyrox', 'amateurs'],
ARRAY['hyrox', 'running', 'entrenamiento hibrido'],
'manual', true);

SELECT COUNT(*) AS fichas_insertadas FROM public.knowledge_base WHERE coach_id IS NULL;
