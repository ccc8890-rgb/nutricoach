/**
 * Script para insertar fichas de knowledge_base desde el SQL seed
 * usando la REST API de Supabase (service_role key).
 *
 * USO: node scripts/seed-knowledge.mjs
 *
 * REQUISITO: Las variables SUPABASE_SERVICE_ROLE_KEY y NEXT_PUBLIC_SUPABASE_URL
 * deben estar definidas en .env.local
 */
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL

if (!SERVICE_KEY) throw new Error('Falta SUPABASE_SERVICE_ROLE_KEY en .env.local')
if (!SUPABASE_URL) throw new Error('Falta NEXT_PUBLIC_SUPABASE_URL en .env.local')

const HEADERS = {
    'Content-Type': 'application/json',
    'apiKey': SERVICE_KEY,
    'Authorization': `Bearer ${SERVICE_KEY}`,
    'Prefer': 'return=minimal,resolution=merge-duplicates',
}

const fichas = [
    // HYROX
    {
        coach_id: null, disciplina: 'hyrox', categoria: 'periodizacion', tipo: 'protocolo', nivel_evidencia: 'opinion_experto',
        titulo: 'Periodización HYROX: estructura de 12-16 semanas hacia competición',
        resumen: 'Un macrociclo HYROX para atleta amateur debe estructurarse en 3 bloques: base aeróbica (4-6 semanas, zona 1-2, >80% del volumen), bloque específico (4-5 semanas, introduce las 8 estaciones con carga progresiva y simulacros parciales), y pico competitivo (2-3 semanas, reducción de volumen -40%, mantener intensidad, simulacro completo 10 días antes). La semana de descarga pre-competición es crítica: bajar volumen al 50% pero mantener algún estímulo de alta intensidad para no perder agudeza neuromuscular.',
        puntos_clave: ['80% del volumen en zona 1-2 (conversacional) durante la fase base', 'Introducir estaciones HYROX en semana 5-6, comenzando por las más técnicas (SkiErg, remo)', 'Simulacro completo 3-4 semanas antes de la carrera, no la semana previa', 'Reducir volumen un 40% las 2 semanas previas, mantener 1-2 sesiones de intensidad', 'El sled push/pull requiere adaptación neuromuscular específica: introducir progresivamente'],
        fuente: 'Basado en metodología de coaches HYROX certificados y análisis de splits de competición 2023-2024',
        tags: ['hyrox', 'periodizacion', 'macrociclo', 'competicion', 'amateur'],
        poblacion: ['atletas amateur', 'principiantes hyrox', 'masters'],
        condiciones: ['hyrox'], fuente_tipo: 'manual', verificado: true
    },
    {
        coach_id: null, disciplina: 'hyrox', categoria: 'fuerza', tipo: 'protocolo', nivel_evidencia: 'opinion_experto',
        titulo: 'Las 8 estaciones HYROX: demandas fisiológicas y entrenamiento específico',
        resumen: 'HYROX combina 8 km de running con 8 estaciones de trabajo funcional. Cada estación tiene demandas específicas: SkiErg (1000m, potencia de tren superior + core), Sled Push (50m, fuerza máxima + tolerancia al lactato), Sled Pull (50m, igual que push), Burpee Broad Jump (80, coordinación + potencia + resistencia muscular local), Rowing (1000m, potencia aeróbica), Farmers Carry (200m, resistencia de agarre y core), Sandbag Lunges (100m, fuerza unilateral + resistencia), Wall Balls (100, potencia + coordinación). El punto de fallo más común en amateurs es el sled push/pull y los sandbag lunges, que requieren fuerza funcional específica que no se desarrolla corriendo.',
        puntos_clave: ['SkiErg: entrenar con ergómetro de remo/ski 2x/semana, intervals 500m a ritmo carrera', 'Sled push/pull: introducir con peso ligero, progresar con carga cada 2 semanas', 'Burpee Broad Jump: entrenar como bloque pliométrico, no como cardio', 'Sandbag Lunges: sustituibles por walking lunges con mochila en entrenamiento', 'Wall Balls: el agarre del balón y la profundidad del squat determinan la eficiencia'],
        fuente: 'Análisis de datos de competición HYROX World Series 2022-2024',
        tags: ['hyrox', 'estaciones', 'fuerza funcional', 'sled', 'skierg', 'sandbag'],
        poblacion: ['atletas hyrox', 'amateurs', 'principiantes'],
        condiciones: ['hyrox'], fuente_tipo: 'manual', verificado: true
    },
    {
        coach_id: null, disciplina: 'hyrox', categoria: 'zona2', tipo: 'estudio', nivel_evidencia: 'estudio_observacional',
        titulo: 'Base aeróbica en HYROX: por qué el zona 2 es el diferenciador',
        resumen: 'Los mejores tiempos en HYROX amateur (sub-60 min mixto, sub-70 min individual) correlacionan fuertemente con una base aeróbica sólida. El running entre estaciones (8 km totales) a ritmo de competición (~5:00-5:30 min/km para amateurs) se realiza en zona 3-4, por lo que la eficiencia en zona 2 determina cuánto glucógeno se ahorra. Un atleta con umbral aeróbico alto puede correr el running a menor FC relativa, llegando a las estaciones menos fatigado. La recomendación: 3-4 sesiones/semana de zona 2 en fase base (45-75 min cada una), reducir a 2 en fase específica.',
        puntos_clave: ['3-4 sesiones de zona 2 semanales en fase base (FC: 60-70% FCmax)', 'El ritmo de carrera en zona 2 debe ser conversacional: si no puedes hablar, es demasiado rápido', 'Progresar duración antes que intensidad: primero 45 min fácil, luego 60-75 min', 'Combinar zona 2 corriendo y en bici/elíptica para reducir impacto articular'],
        fuente: 'Análisis fisiológico basado en datos de wearables de atletas HYROX 2023',
        tags: ['zona2', 'aeróbico', 'base aeróbica', 'running', 'hyrox', 'umbral'],
        poblacion: ['atletas hyrox', 'amateurs'],
        condiciones: ['hyrox'], fuente_tipo: 'manual', verificado: true
    },
    {
        coach_id: null, disciplina: 'hyrox', categoria: 'recuperacion', tipo: 'protocolo', nivel_evidencia: 'opinion_experto',
        titulo: 'Recuperación post-HYROX: protocolo de 48-72 horas',
        resumen: 'HYROX genera daño muscular significativo (sled, lunges, burpees) combinado con depleción glucogénica del running. La recuperación óptima: primeras 2 horas (ventana anabólica): 40-50g proteína + 80-100g carbohidratos de rápida absorción. Día 1 post: movilidad suave, sin entrenamiento de fuerza. Día 2: cardio regenerativo zona 1 (30 min bici/natación). Día 3: puede volver el entrenamiento normal si no hay dolor muscular severo. La crioterapia o baños fríos en las primeras 24h reducen la inflamación aguda pero pueden interferir con adaptaciones si se usan crónicamente.',
        puntos_clave: ['Ventana post-HYROX: 40-50g proteína + 80-100g carbos en las primeras 2 horas', 'No entrenar fuerza las 48h siguientes a la competición o simulacro', 'Baño frío (10-15°C, 10 min) en las primeras 6h reduce DOMS significativamente', 'Día 2: cardio suave zona 1 activa la circulación sin generar fatiga adicional', 'Sueño de calidad es la herramienta de recuperación más infrautilizada'],
        fuente: 'Basado en protocolos de recuperación de CrossFit y deportes de resistencia',
        tags: ['recuperacion', 'hyrox', 'post-carrera', 'nutricion post', 'doms'],
        poblacion: ['atletas hyrox', 'amateurs', 'masters'],
        condiciones: ['hyrox'], fuente_tipo: 'manual', verificado: true
    },
    // ENTRENAMIENTO HÍBRIDO
    {
        coach_id: null, disciplina: 'hibrido', categoria: 'periodizacion', tipo: 'metodologia', nivel_evidencia: 'opinion_experto',
        titulo: 'Entrenamiento híbrido: compatibilidad fuerza + resistencia (interferencia)',
        resumen: 'El efecto de interferencia describe la inhibición de las adaptaciones de fuerza cuando se combina con entrenamiento de resistencia en la misma sesión o día. Para minimizarlo: (1) Separar fuerza y cardio al menos 6 horas si se entrenan el mismo día, o mejor en días distintos. (2) Priorizar en el orden: primero la capacidad que más te importa mejorar. (3) El HIIT interfiere más con la fuerza que el cardio de baja intensidad (zona 2). Para HYROX, donde necesitas ambas capacidades, la secuencia óptima es: mañana fuerza, tarde cardio; o días alternos fuerza/resistencia.',
        puntos_clave: ['Si entrenas fuerza y cardio el mismo día, pon la fuerza SIEMPRE primero', 'El HIIT interfiere más con las ganancias de fuerza que el zona 2', 'Separa al menos 6 horas entre sesión de fuerza y cardio intenso el mismo día', 'En semanas de alto volumen, prioriza recuperación entre sesiones sobre frecuencia', 'La proteína alta (2g/kg) mitiga parcialmente el efecto de interferencia'],
        fuente: 'Wilson JM et al. (2012). Concurrent Training: A Meta-Analysis. Journal of Strength & Conditioning Research',
        tags: ['hibrido', 'interferencia', 'fuerza', 'resistencia', 'compatibilidad', 'hyrox'],
        poblacion: ['atletas híbridos', 'atletas hyrox', 'amateurs'],
        condiciones: ['hyrox', 'entrenamiento hibrido'], fuente_tipo: 'manual', verificado: true
    },
    {
        coach_id: null, disciplina: 'hibrido', categoria: 'volumen', tipo: 'revision', nivel_evidencia: 'revision_sistematica',
        titulo: 'Distribución óptima de volumen en atleta híbrido amateur',
        resumen: 'Para un atleta amateur con 8-10 horas semanales de entrenamiento que combina fuerza y resistencia para HYROX, la distribución recomendada es: 40-50% resistencia aeróbica (3-4 sesiones), 30-35% fuerza funcional (2-3 sesiones), 15-20% trabajo específico HYROX (estaciones, simulacros). El error más común es exceder el volumen total: más de 10-12 horas semanales sin adaptación previa lleva a sobreentrenamiento en 4-6 semanas. La progresión debe ser un 5-10% de volumen por semana como máximo.',
        puntos_clave: ['Máximo 10% de aumento de volumen semanal para evitar sobreentrenamiento', '3-4 sesiones de resistencia + 2-3 de fuerza = estructura base para HYROX amateur', 'Una sesión semanal de trabajo específico de estaciones es suficiente en fase base', 'Incluir 1 día completo de descanso y 1-2 de actividad ligera por semana', 'Monitorizar la VFC (HRV) para ajustar cargas: caída sostenida indica exceso'],
        fuente: 'Schumann M & Rønnestad BR (2019). Concurrent Aerobic and Strength Training. Springer',
        tags: ['volumen', 'hibrido', 'distribución', 'frecuencia', 'hyrox', 'sobreentrenamiento'],
        poblacion: ['atletas híbridos', 'amateurs', 'principiantes'],
        condiciones: ['hyrox', 'entrenamiento hibrido'], fuente_tipo: 'manual', verificado: true
    },
    // RUNNING
    {
        coach_id: null, disciplina: 'running', categoria: 'periodizacion', tipo: 'revision', nivel_evidencia: 'revision_sistematica',
        titulo: 'Entrenamiento polarizado en running: modelo 80/20 de Seiler',
        resumen: 'El modelo polarizado de Seiler establece que los atletas de élite y recreacionales mejoran más su rendimiento distribuyendo el 80% del volumen en zona 1-2 (baja intensidad) y el 20% en zona 4-5 (alta intensidad), evitando la zona 3 (umbral). Estudios con corredores recreacionales durante 9 semanas mostraron mejoras superiores en VO2max y tiempo en pruebas de 10 km vs grupos que entrenaban más en zona 3. El error típico del corredor amateur es entrenar demasiado en zona 3 (ni fácil ni difícil), lo que genera fatiga crónica sin estímulo óptimo.',
        puntos_clave: ['80% del volumen semanal debe sentirse cómodo y conversacional (zona 1-2)', '20% en alta intensidad: intervalos en zona 4-5 (series, fartlek, tempo corto)', 'Evitar la zona 3 (ritmo umbral) como entrenamiento habitual: agota sin el estímulo de la alta intensidad', 'Aplicar en HYROX: las sesiones de running fácil construyen la base; los intervalos desarrollan la potencia'],
        fuente: 'Seiler KS & Kjerland GØ (2006). Quantifying training intensity distribution. Scandinavian Journal of Medicine & Science in Sports',
        tags: ['polarizado', '80/20', 'zona2', 'seiler', 'running', 'intensidad'],
        poblacion: ['corredores amateurs', 'atletas de fondo', 'atletas hyrox'],
        condiciones: ['running', 'hyrox'], fuente_tipo: 'manual', verificado: true
    },
    {
        coach_id: null, disciplina: 'running', categoria: 'intensidad', tipo: 'protocolo', nivel_evidencia: 'rct',
        titulo: 'Zonas de entrenamiento por FC: delimitación y uso práctico',
        resumen: 'Las 5 zonas de entrenamiento por frecuencia cardíaca permiten estructurar los estímulos. Zona 1 (<65% FCmax): regenerativa, recuperación activa. Zona 2 (65-75%): aeróbico base, oxidación de grasas, construye mitocondrias. Zona 3 (75-85%): umbral aeróbico, sostenible 60-90 min, no óptima como base. Zona 4 (85-92%): umbral anaeróbico, sostenible 20-40 min, mejora VO2max. Zona 5 (>92%): neuromuscular y VO2max. Para HYROX, el running de competición sucede en zona 3-4, lo que hace crítico desarrollar zona 2 para que zona 3-4 sea más eficiente.',
        puntos_clave: ['FCmax estimada = 220 - edad (aproximación; usar test de campo para mayor precisión)', 'Zona 2 es el mayor activo metabólico a largo plazo: construye capacidad aeróbica base', 'Para HYROX, entrena zona 2 en base y zona 4 en específico para simular running de carrera', 'Usar monitor de FC en cada sesión: el running fácil se vuelve difícil con calor o fatiga'],
        fuente: 'Skinner JS & McLellan TH (1980). Transition from aerobic to anaerobic metabolism. Research Quarterly for Exercise and Sport',
        tags: ['zonas FC', 'frecuencia cardiaca', 'zona2', 'zona4', 'running', 'intensidad'],
        poblacion: ['corredores', 'atletas hyrox', 'amateurs'],
        condiciones: ['running', 'hyrox'], fuente_tipo: 'manual', verificado: true
    },
    {
        coach_id: null, disciplina: 'running', categoria: 'volumen', tipo: 'meta_analisis', nivel_evidencia: 'meta_analisis',
        titulo: 'Progresión segura de kilometraje: regla del 10% y evidencia actual',
        resumen: 'La regla clásica del 10% tiene soporte moderado en la literatura. Aumentos de hasta un 25% en semanas puntuales no incrementan la tasa de lesión si la base previa es sólida. Sin embargo, para principiantes o retorno tras descanso, el 10% sigue siendo el marco más seguro. El factor de riesgo más determinante no es el aumento semanal puntual sino la carga acumulada en las últimas 4 semanas (ACWR: Acute:Chronic Workload Ratio). Un ACWR >1.5 multiplica x2-3 el riesgo de lesión.',
        puntos_clave: ['No aumentar más del 10% de volumen semanal si eres principiante o vuelves de descanso', 'El ACWR (carga aguda/crónica) es mejor predictor de lesión que el aumento puntual', 'ACWR óptimo: entre 0.8 y 1.3. Por encima de 1.5 hay riesgo elevado de lesión', 'Incluir una semana de descarga (-20-30% volumen) cada 3-4 semanas de carga'],
        fuente: 'Gabbett TJ (2016). The training-injury prevention paradox. British Journal of Sports Medicine',
        tags: ['volumen', 'progresion', 'lesiones', 'running', 'kilometraje', 'ACWR'],
        poblacion: ['corredores amateurs', 'principiantes'],
        condiciones: ['running', 'lesion'], fuente_tipo: 'manual', verificado: true
    },
    // FUERZA
    {
        coach_id: null, disciplina: 'fuerza', categoria: 'fuerza', tipo: 'meta_analisis', nivel_evidencia: 'meta_analisis',
        titulo: 'Frecuencia de entrenamiento de fuerza: 2 vs 3 sesiones semanales',
        resumen: 'Una meta-análisis de 2016 (Ralston et al.) con 25 estudios concluyó que entrenar cada grupo muscular 2 veces por semana es superior a 1 vez en ganancias de fuerza e hipertrofia. La diferencia entre 2 y 3 veces es marginal cuando el volumen total semanal se iguala. Para un atleta que combina fuerza con resistencia, 2 sesiones de fuerza por semana con 10-16 series por grupo muscular son suficientes para mantener y ganar fuerza sin comprometer la recuperación.',
        puntos_clave: ['Entrenar cada grupo muscular 2 veces por semana es el mínimo efectivo', 'El volumen total (series x semana) importa más que la frecuencia cuando el volumen se iguala', '10-16 series por grupo muscular por semana para hipertrofia y mantenimiento de fuerza', 'Para HYROX: 2 sesiones de fuerza/semana son suficientes, priorizando piernas y core'],
        fuente: 'Ralston GW et al. (2017). The Effect of Weekly Set Volume on Strength Gain. Journal of Strength and Conditioning Research',
        tags: ['frecuencia', 'fuerza', 'hipertrofia', 'volumen', 'series'],
        poblacion: ['atletas de fuerza', 'atletas híbridos', 'amateurs'],
        condiciones: ['hyrox', 'entrenamiento hibrido'], fuente_tipo: 'manual', verificado: true
    },
    {
        coach_id: null, disciplina: 'fuerza', categoria: 'intensidad', tipo: 'revision', nivel_evidencia: 'revision_sistematica',
        titulo: 'RPE y RIR: autorregulación del entrenamiento de fuerza',
        resumen: 'El RPE (1-10) y el RIR (Repetitions in Reserve) son herramientas de autorregulación. RIR 2-3 (RPE 7-8) es el rango óptimo para hipertrofia con baja fatiga acumulada. RIR 0-1 (al fallo) es efectivo pero genera más fatiga. Para atletas que combinan fuerza y resistencia, entrenar con RIR 2-3 permite mayor volumen total y mejor recuperación que el entrenamiento al fallo.',
        puntos_clave: ['RPE 7-8 / RIR 2-3: zona óptima para hipertrofia con buena recuperación', 'Evitar el fallo muscular en la mayoría de series si también haces running', 'Ajusta el peso si el RPE percibido no coincide con el planificado (fatiga, calor, sueño)', 'Usar RIR en lugar de % de 1RM: más adaptable a variaciones del día'],
        fuente: 'Zourdos MC et al. (2016). Novel Resistance Training-Specific RPE Scale. JSCR',
        tags: ['RPE', 'RIR', 'autorregulacion', 'fuerza', 'intensidad', 'fallo muscular'],
        poblacion: ['atletas de fuerza', 'atletas híbridos'],
        condiciones: ['hyrox', 'entrenamiento hibrido'], fuente_tipo: 'manual', verificado: true
    },
    // NUTRICIÓN DEPORTIVA
    {
        coach_id: null, disciplina: 'nutricion', categoria: 'proteina', tipo: 'meta_analisis', nivel_evidencia: 'meta_analisis',
        titulo: 'Proteína en atletas: dosis óptima y distribución diaria',
        resumen: 'Una meta-análisis de Morton et al. (2018) con 49 estudios y 1800 participantes concluyó que el umbral de proteína para maximizar la síntesis proteica muscular es de 1.62 g/kg/día en promedio, con el límite superior en 2.2 g/kg/día. Para atletas que combinan fuerza y resistencia, la recomendación práctica es 1.8-2.2 g/kg/día. La distribución importa tanto como el total: 4 tomas de 0.3-0.4 g/kg cada 3-4 horas maximiza la síntesis muscular.',
        puntos_clave: ['1.8-2.2 g/kg/día de proteína para atletas que combinan fuerza y resistencia', 'Distribuir en 4 tomas de 0.3-0.4 g/kg', 'Cada toma debe contener al menos 2-3g de leucina para activar síntesis muscular', 'Post-entrenamiento: 30-40g de proteína en la primera hora', 'Fuentes de alta calidad: huevo, pollo, pescado, proteína de suero, legumbres + cereal'],
        fuente: 'Morton RW et al. (2018). A systematic review, meta-analysis and meta-regression of the effect of protein supplementation. BJSM',
        tags: ['proteina', 'leucina', 'sintesis muscular', 'mTOR', 'nutricion deportiva', 'recuperacion'],
        poblacion: ['atletas de fuerza', 'atletas híbridos', 'corredores', 'atletas hyrox'],
        condiciones: ['hyrox', 'running', 'entrenamiento hibrido'], fuente_tipo: 'manual', verificado: true
    },
    {
        coach_id: null, disciplina: 'nutricion', categoria: 'hidratacion', tipo: 'guia_clinica', nivel_evidencia: 'revision_sistematica',
        titulo: 'Hidratación en competición y entrenamiento de resistencia',
        resumen: 'La deshidratación del 2% del peso corporal reduce el rendimiento aeróbico un 10-20%. En HYROX, la pérdida de sudor oscila entre 0.8 y 1.5L/hora. Protocolo: 500ml 2h antes + 250ml 30 min antes. Durante: 150-200ml cada 15-20 min si >60 min. Sodio (300-500mg/hora) previene hiponatremia.',
        puntos_clave: ['Beber al menos 500ml de agua 2 horas antes de la competición', 'En esfuerzos >60 min: 150-200ml cada 15-20 minutos', 'Añadir sodio (bebida isotónica o sal) en esfuerzos >90 min', 'Test de sudor: pesar antes y después', 'Orina amarillo pálido = bien hidratado'],
        fuente: 'Sawka MN et al. (2007). ACSM position stand on exercise and fluid replacement. MSSE',
        tags: ['hidratacion', 'sodio', 'isotonica', 'competicion', 'deshidratacion', 'hyrox'],
        poblacion: ['atletas de resistencia', 'atletas hyrox', 'corredores'],
        condiciones: ['hyrox', 'running'], fuente_tipo: 'manual', verificado: true
    },
    {
        coach_id: null, disciplina: 'nutricion', categoria: 'metabolismo', tipo: 'meta_analisis', nivel_evidencia: 'meta_analisis',
        titulo: 'Carbohidratos perientreno: timing y cantidad para rendimiento',
        resumen: 'Los carbohidratos son el sustrato principal para esfuerzos de alta intensidad (zona 3-5). Pre-entreno (2-3h antes): 1-3g/kg CHO índice glucémico moderado-bajo. Post-entreno (primeras 2h): 1-1.5g/kg para resintetizar glucógeno. Durante HYROX: si dura >75 min, 30-60g/hora.',
        puntos_clave: ['2-3 horas antes: 1-3g/kg de carbohidratos (avena, arroz, patata)', 'Inmediatamente antes (<30 min): solo si no comiste antes', 'Durante HYROX >75 min: 30-60g/hora (gel o isotónica)', 'Post-entreno: 1-1.5g/kg de CHO + proteína', 'No entrenar en déficit de glucógeno si buscas rendimiento máximo'],
        fuente: 'Burke LM et al. (2011). Carbohydrates for training and competition. Journal of Sports Sciences',
        tags: ['carbohidratos', 'glucogeno', 'timing', 'pre-entreno', 'post-entreno', 'rendimiento'],
        poblacion: ['atletas de resistencia', 'atletas hyrox', 'corredores'],
        condiciones: ['hyrox', 'running'], fuente_tipo: 'manual', verificado: true
    },
    {
        coach_id: null, disciplina: 'nutricion', categoria: 'composicion_corporal', tipo: 'revision', nivel_evidencia: 'revision_sistematica',
        titulo: 'Déficit calórico en atletas: rendimiento vs pérdida de grasa',
        resumen: 'Un déficit calórico agresivo (>500 kcal/día) compromete la síntesis proteica, recuperación, sistema inmune y rendimiento. El déficit óptimo para perder grasa sin sacrificar músculo es 200-400 kcal/día con proteína alta (2-2.4 g/kg).',
        puntos_clave: ['Déficit máximo para atletas: 300-500 kcal/día', 'Proteína alta (2-2.4 g/kg) obligatoria en déficit', 'No restringir calorías últimas 4-6 semanas pre-competición', 'Pérdida excesiva (>1 kg/semana) indica pérdida de músculo', 'Periodizar ingesta: más calorías días duros, menos en descanso'],
        fuente: 'Mountjoy M et al. (2018). RED-S. BJSM',
        tags: ['deficit calorico', 'composicion corporal', 'perdida grasa', 'RED-S', 'rendimiento', 'proteina'],
        poblacion: ['atletas de resistencia', 'atletas hyrox', 'mujeres deportistas'],
        condiciones: ['hyrox', 'running', 'composicion corporal'], fuente_tipo: 'manual', verificado: true
    },
    {
        coach_id: null, disciplina: 'nutricion', categoria: 'suplementacion', tipo: 'meta_analisis', nivel_evidencia: 'meta_analisis',
        titulo: 'Suplementos con evidencia sólida en atletas de resistencia y fuerza',
        resumen: 'Solo 4 suplementos tienen evidencia Nivel A: (1) Creatina 3-5g/día, (2) Cafeína 3-6mg/kg, (3) Beta-alanina 3.2-6.4g/día, (4) Bicarbonato sódico 0.3g/kg.',
        puntos_clave: ['Creatina: 3-5g/día, sin fase de carga, tomar siempre', 'Cafeína: 3-6mg/kg (200-400mg) 45-60 min antes', 'Beta-alanina: 3.2g/día en dosis divididas', 'BCAAs, glutamina, HMB tienen evidencia débil en atletas bien nutridos', 'Vitamina D3: 2000-4000 UI/día si hay déficit'],
        fuente: 'Maughan RJ et al. (2018). IOC Consensus Statement on Dietary Supplements. BJSM',
        tags: ['creatina', 'cafeina', 'beta-alanina', 'suplementos', 'evidencia', 'rendimiento'],
        poblacion: ['atletas de fuerza', 'atletas de resistencia', 'atletas hyrox'],
        condiciones: ['hyrox', 'running', 'entrenamiento hibrido'], fuente_tipo: 'manual', verificado: true
    },
    // RECUPERACIÓN
    {
        coach_id: null, disciplina: 'recuperacion', categoria: 'recuperacion', tipo: 'revision', nivel_evidencia: 'revision_sistematica',
        titulo: 'HRV (variabilidad de la frecuencia cardíaca) como marcador de recuperación',
        resumen: 'La VFC o HRV mide la variabilidad entre latidos en reposo y refleja el estado del sistema nervioso autónomo. Una caída del 15-20% respecto a la media personal es señal de bajar intensidad. Apps como HRV4Training o Polar H10 permiten seguimiento diario.',
        puntos_clave: ['Medir HRV cada mañana al despertar, 5 min en supino', 'Caída del 15-20% = señal de reducir intensidad', 'Tendencia descendente 5-7 días = sobreentrenamiento', 'Apps: HRV4Training, Elite HRV, Polar Flow', 'Alcohol y mal sueño reducen HRV incluso sin entrenar'],
        fuente: 'Plews DJ et al. (2013). Training adaptation and HRV. IJSPP',
        tags: ['HRV', 'variabilidad FC', 'recuperacion', 'sobreentrenamiento', 'autorregulacion'],
        poblacion: ['atletas de resistencia', 'atletas híbridos', 'atletas hyrox'],
        condiciones: ['hyrox', 'running', 'entrenamiento hibrido'], fuente_tipo: 'manual', verificado: true
    },
    {
        coach_id: null, disciplina: 'recuperacion', categoria: 'recuperacion', tipo: 'meta_analisis', nivel_evidencia: 'meta_analisis',
        titulo: 'Sueño y rendimiento deportivo: el suplemento más infravalorado',
        resumen: 'Dormir menos de 7 horas reduce el rendimiento de resistencia hasta un 11% y el de fuerza hasta un 20%. El sueño es el periodo principal de síntesis proteica y liberación de hormona de crecimiento. La privación crónica eleva cortisol, reduce testosterona y aumenta riesgo de lesión.',
        puntos_clave: ['Menos de 7h de sueño reduce rendimiento aeróbico 10-11%', 'El sueño es cuando ocurre la mayoría de síntesis proteica', 'Temperatura óptima: 17-20°C', 'Siesta de 20-30 min mejora rendimiento en doble sesión', 'Priorizar sueño antes de añadir más suplementos o volumen'],
        fuente: 'Vitale KC et al. (2019). Sleep Hygiene for Optimizing Recovery in Athletes. Int J Sports Med',
        tags: ['sueño', 'recuperacion', 'rendimiento', 'hormona crecimiento', 'cortisol'],
        poblacion: ['atletas de resistencia', 'atletas de fuerza', 'atletas hyrox', 'amateurs'],
        condiciones: ['hyrox', 'running', 'entrenamiento hibrido'], fuente_tipo: 'manual', verificado: true
    }
];

async function insertarFichas() {
    console.log(`📤 Insertando ${fichas.length} fichas en knowledge_base...`);

    // Insertar una por una para evitar problemas de tamaño de payload
    let insertadas = 0;
    let errores = 0;

    for (let i = 0; i < fichas.length; i++) {
        const ficha = fichas[i];
        try {
            const res = await fetch(`${SUPABASE_URL}/rest/v1/knowledge_base`, {
                method: 'POST',
                headers: HEADERS,
                body: JSON.stringify(ficha),
            });
            if (res.ok || res.status === 409) {
                insertadas++;
                if (res.status === 409) {
                    process.stdout.write(`⚠️  Ficha ${i + 1} ya existe\n`);
                } else {
                    process.stdout.write(`✅ Ficha ${i + 1}/${fichas.length}: "${ficha.titulo.substring(0, 40)}..."\n`);
                }
            } else {
                errores++;
                const text = await res.text();
                process.stdout.write(`❌ Ficha ${i + 1}: ${res.status} - ${text.substring(0, 100)}\n`);
            }
        } catch (err) {
            errores++;
            process.stdout.write(`❌ Ficha ${i + 1}: Error de red - ${err.message}\n`);
        }
        // Pequeña pausa para no saturar
        await new Promise(r => setTimeout(r, 100));
    }

    console.log(`\n📊 Resultado: ${insertadas} insertadas, ${errores} errores`);
}

insertarFichas().catch(console.error);
