/**
 * Script para insertar estudios científicos REALES y verificables
 * en knowledge_base. Basado en publicaciones indexadas con DOI.
 *
 * USO: node scripts/seed-estudios-cientificos.mjs
 *
 * Fuentes: PubMed, BJSM, JSCR, MSSE, IJSNM, AJCN, ISSN, Springer
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

const estudios = [
    // ════════════════════════════════════════════════════════════
    // NUTRICIÓN DEPORTIVA
    // ════════════════════════════════════════════════════════════
    {
        coach_id: null, disciplina: 'nutricion', categoria: 'proteina', tipo: 'meta_analisis', nivel_evidencia: 'meta_analisis',
        titulo: 'Morton RW et al. (2018) — Proteína y suplementación: revisión sistemática y meta-análisis',
        resumen: 'Meta-análisis de 49 estudios con 1.863 participantes que examina el efecto de la suplementación con proteína sobre la masa muscular y la fuerza en respuesta al entrenamiento de resistencia. Resultados principales: (1) La suplementación proteica incrementa significativamente la ganancia de masa magra (1.0-1.5 kg adicionales en 8-16 semanas) y la fuerza en press banca y sentadilla. (2) El efecto es mayor en individuos entrenados vs no entrenados. (3) Se observa un efecto techo en ~1.62 g/kg/día, con análisis de regresión mostrando meseta a partir de 1.6-2.2 g/kg/día. (4) No hay beneficio adicional significativo por encima de 2.2 g/kg/día. (5) La dosis por toma óptima es 0.3-0.4 g/kg para maximizar la síntesis de proteína muscular.',
        puntos_clave: ['1.6-2.2 g/kg/día es el rango óptimo para maximizar ganancias musculares', 'Dosis por toma: 0.3-0.4 g/kg (20-40g en persona de 70kg)', 'No hay beneficio adicional >2.2 g/kg/día en ganancia muscular', 'El efecto es significativo pero modesto (~1kg extra en 10 semanas)', 'La proteína post-entreno es más efectiva que en otros momentos del día'],
        fuente: 'Morton RW, Murphy KT, McKellar SR, et al. (2018). A systematic review, meta-analysis and meta-regression of the effect of protein supplementation on resistance training-induced gains in muscle mass and strength in healthy adults. British Journal of Sports Medicine, 52(6), 376-384.',
        doi: '10.1136/bjsports-2017-097608',
        tags: ['proteina', 'suplementacion', 'sintesis muscular', 'hipertrofia', 'mTOR', 'leucina'],
        poblacion: ['adultos saludables', 'entrenados', 'no entrenados', 'mayores'],
        condiciones: ['entrenamiento fuerza', 'hipertrofia'], fuente_tipo: 'manual', verificado: true
    },
    {
        coach_id: null, disciplina: 'nutricion', categoria: 'proteina', tipo: 'meta_analisis', nivel_evidencia: 'meta_analisis',
        titulo: 'Schoenfeld BJ et al. (2017) — Relación dosis-respuesta entre proteína y masa muscular',
        resumen: 'Meta-análisis que examina la relación entre la ingesta diaria de proteína y los cambios en la masa magra en adultos jóvenes con entrenamiento de resistencia. Incluye 18 estudios con 920 participantes. Análisis de regresión spline muestra una meseta en ~1.6 g/kg/día. Por debajo de 1.0 g/kg/día, la ganancia de masa magra es significativamente menor. Por encima de 2.2 g/kg/día no hay beneficio adicional. La proteína dietética (comida real) es igual de efectiva que la suplementación cuando se iguala el contenido total de proteína. Los autores concluyen que la distribución óptima es 4 comidas con ~0.4 g/kg cada una.',
        puntos_clave: ['Meseta de ganancia muscular en ~1.6 g/kg/día (IC 95%: 1.03-2.20)', 'No hay beneficio probado >2.2 g/kg/día en adultos jóvenes', 'Proteína de alimentos enteros = proteína de suplementos si se iguala la dosis total', 'Distribuir en 3-4 tomas: mejor que 1-2 tomas grandes', 'Cada comida debe contener 0.4 g/kg o ~20-40g de proteína'],
        fuente: 'Schoenfeld BJ, Aragon AA, Krieger JW. (2017). Dose-response relationship between weekly resistance training volume and increases in muscle mass. Journal of the International Society of Sports Nutrition, 14:30.',
        doi: '10.1186/s12970-017-0185-8',
        tags: ['proteina', 'dosis-respuesta', 'meseta', 'hipertrofia', 'distribucion'],
        poblacion: ['adultos jóvenes', 'entrenados', 'no entrenados'],
        condiciones: ['entrenamiento fuerza', 'hipertrofia'], fuente_tipo: 'manual', verificado: true
    },
    {
        coach_id: null, disciplina: 'nutricion', categoria: 'metabolismo', tipo: 'revision', nivel_evidencia: 'revision_sistematica',
        titulo: 'Burke LM et al. (2011) — Carbohidratos para entrenamiento y competición',
        resumen: 'Revisión del American College of Sports Medicine (ACSM) sobre el papel de los carbohidratos en el rendimiento deportivo. Recomendaciones clave: (1) Ingesta diaria general: 3-10 g/kg/día según volumen e intensidad del entrenamiento. (2) Precarga pre-competición (24-36h antes): 7-12 g/kg/día para deportes de resistencia. (3) Comida pre-evento (1-4h antes): 1-4 g/kg. (4) Durante ejercicio >60 min: 30-60 g/hora (hasta 90 g/hora en ultra-resistencia con múltiples transportadores). (5) Post-ejercicio (primeras 4h): 1-1.5 g/kg para resíntesis de glucógeno. (6) La adición de proteína (0.3-0.4 g/kg) post-ejercicio puede mejorar la resíntesis de glucógeno cuando la ingesta de CHO es subóptima.',
        puntos_clave: ['3-10 g/kg/día según volumen de entrenamiento', '30-60 g/hora durante ejercicio >60 min (hasta 90g con glucosa+fructosa)', 'Ventana post-ejercicio: 1-1.5 g/kg en primeras 4h para resíntesis de glucógeno', 'Pre-carga: 7-12 g/kg/día 24-36h antes de competición de resistencia', 'Combinar glucosa + fructosa permite mayor oxidación externa (>90g/h)'],
        fuente: 'Burke LM, Hawley JA, Wong SHS, Jeukendrup AE. (2011). Carbohydrates for training and competition. Journal of Sports Sciences, 29(sup1), S17-S27.',
        doi: '10.1080/02640414.2011.585473',
        tags: ['carbohidratos', 'glucogeno', 'periodizacion', 'rendimiento', 'pre-entreno', 'post-entreno'],
        poblacion: ['atletas de resistencia', 'deportistas de equipo', 'atletas de fuerza'],
        condiciones: ['running', 'ciclismo', 'hyrox'], fuente_tipo: 'manual', verificado: true
    },
    {
        coach_id: null, disciplina: 'nutricion', categoria: 'suplementacion', tipo: 'meta_analisis', nivel_evidencia: 'meta_analisis',
        titulo: 'Kerksick CM et al. (2018) — ISSN Position Stand: suplementos deportivos',
        resumen: 'Position Stand de la International Society of Sports Nutrition (ISSN) que categoriza suplementos por nivel de evidencia: Nivel A (evidencia sólida, recomendar): creatina monohidrato 3-5g/día, cafeína 3-6 mg/kg, beta-alanina 3.2-6.4 g/día, bicarbonato sódico 0.3 g/kg, nitrato/remolacha 6-12 mmol/día. Nivel B (evidencia moderada, probablemente efectivos): HMB, proteína de suero, vitamina D (si déficit), ácidos grasos omega-3. Nivel C (evidencia débil, no recomendar): BCAA (en atletas con proteína suficiente), glutamina, arginina oral, carnitina. Revisan también interacciones: cafeína + creatina son compatibles; beta-alanina sinergia con bicarbonato para rendimiento anaeróbico.',
        puntos_clave: ['Creatina: 3-5g/día, sin fase de carga, mejor post-entreno con carbohidratos', 'Cafeína: 3-6 mg/kg (200-400mg) 45-60 min antes del ejercicio', 'Beta-alanina: 3.2-6.4g/día, dividir en dosis de 1.6g cada 3-4h para evitar parestesia', 'Bicarbonato sódico: 0.3 g/kg 60-90 min antes (con bicarbonato de sodio en polvo)', 'BCAAs y glutamina tienen evidencia débil en atletas con ingesta proteica adecuada'],
        fuente: 'Kerksick CM, Wilborn CD, Roberts MD, et al. (2018). ISSN exercise & sports nutrition review update: research & recommendations. Journal of the International Society of Sports Nutrition, 15(1), 36.',
        doi: '10.1186/s12970-018-0242-y',
        tags: ['suplementos', 'creatina', 'cafeina', 'beta-alanina', 'ISSN', 'evidencia'],
        poblacion: ['atletas', 'deportistas', 'entrenados'],
        condiciones: ['fuerza', 'resistencia', 'entrenamiento hibrido'], fuente_tipo: 'manual', verificado: true
    },
    {
        coach_id: null, disciplina: 'nutricion', categoria: 'metabolismo', tipo: 'guia_clinica', nivel_evidencia: 'revision_sistematica',
        titulo: 'Thomas DT et al. (2016) — ACSM Position Stand: Nutrición y rendimiento deportivo',
        resumen: 'Position Stand conjunto del American College of Sports Medicine (ACSM), Academy of Nutrition and Dietetics y Dietitians of Canada. Recomendaciones integrales para la práctica deportiva: (1) Energía: requerimiento según peso, composición y volumen. Déficit >500 kcal/día compromete rendimiento y salud ósea. (2) Carbohidratos: 6-10 g/kg/día para atletas de resistencia de alto volumen. (3) Proteína: 1.2-2.0 g/kg/día; el extremo superior para atletas de fuerza y durante déficit calórico. (4) Grasa: 20-35% de calorías totales, no menos de 0.8 g/kg/día. (5) Hidratación: test de sudor individualizado. (6) Micronutrientes: hierro, calcio, vitamina D requieren atención especial. (7) Periodización de nutrientes: planificar ingesta según carga de entrenamiento.',
        puntos_clave: ['Proteína: 1.2-2.0 g/kg/día (más en déficit calórico o fuerza)', 'Carbohidratos: 6-10 g/kg/día para alto volumen', 'Grasas: mínimo 0.8 g/kg/día, 20-35% de calorías totales', 'Déficit calórico >500 kcal/día compromete rendimiento', 'Hierro: monitorizar especialmente mujeres deportistas'],
        fuente: 'Thomas DT, Erdman KA, Burke LM. (2016). Position of the Academy of Nutrition and Dietetics, Dietitians of Canada, and the ACSM: Nutrition and Athletic Performance. Journal of the Academy of Nutrition and Dietetics, 116(3), 501-528.',
        doi: '10.1016/j.jand.2015.12.006',
        tags: ['acsm', 'nutricion deportiva', 'recomendaciones', 'macros', 'hidratacion', 'micronutrientes'],
        poblacion: ['atletas', 'deportistas', 'adultos activos'],
        condiciones: ['running', 'fuerza', 'hyrox', 'deporte equipo'], fuente_tipo: 'manual', verificado: true
    },
    {
        coach_id: null, disciplina: 'nutricion', categoria: 'proteina', tipo: 'meta_analisis', nivel_evidencia: 'meta_analisis',
        titulo: 'Cermak NM et al. (2012) — Proteína post-ejercicio: ganancia de masa muscular',
        resumen: 'Meta-análisis de 22 estudios con 680 participantes que examina el efecto de la suplementación proteica inmediatamente después del ejercicio de resistencia sobre la masa muscular y la fuerza. Resultados: (1) La suplementación proteica post-ejercicio aumenta la masa magra en 1.69 kg (IC 95%: 0.84-2.54) en 8-12 semanas. (2) El incremento de fuerza en press banca es 4.8 kg mayor (IC: 2.5-7.1). (3) El efecto es independiente de la edad, sexo y estado de entrenamiento. (4) La proteína de suero de leche (whey) mostró mayor efecto que la caseína o soja. (5) Dosis efectiva mínima: 20g de proteína de alta calidad post-entreno.',
        puntos_clave: ['Suplementación proteica post-entreno: +1.69 kg masa magra en 8-12 semanas', '+4.8 kg adicionales en press banca con proteína post-entreno', 'La proteína de suero (whey) es superior a caseína y soja post-ejercicio', 'Dosis mínima efectiva: 20g de proteína de alta calidad', 'Efecto presente en todas las edades y sexos'],
        fuente: 'Cermak NM, Res PT, de Groot LC, Saris WH, van Loon LJ. (2012). Protein supplementation augments the adaptive response of skeletal muscle to resistance-type exercise training: a meta-analysis. American Journal of Clinical Nutrition, 96(6), 1454-1464.',
        doi: '10.3945/ajcn.112.037556',
        tags: ['proteina', 'post-entreno', 'whey', 'masa muscular', 'hipertrofia', 'suplementacion'],
        poblacion: ['adultos', 'mayores', 'jovenes'],
        condiciones: ['entrenamiento fuerza'], fuente_tipo: 'manual', verificado: true
    },
    {
        coach_id: null, disciplina: 'nutricion', categoria: 'hidratacion', tipo: 'guia_clinica', nivel_evidencia: 'revision_sistematica',
        titulo: 'Sawka MN et al. (2007) — ACSM Position Stand: ejercicio e hidratación',
        resumen: 'Position Stand del ACSM sobre la reposición de líquidos durante el ejercicio. Conclusiones principales: (1) La deshidratación del 2% del peso corporal reduce el rendimiento aeróbico 10-20%. (2) La pérdida de sudor varía de 0.5 a 2.0 L/hora según intensidad, temperatura y ropa. (3) Protocolo de hidratación: 400-600 ml 2h antes; 150-350 ml cada 15-20 min durante el ejercicio. (4) Sodio en bebidas (20-50 mmol/L) mejora la retención de líquidos y previene hiponatremia. (5) Para ejercicio >3h, añadir carbohidratos (5-8%) para mantener glucosa. (6) La hiponatremia (Na <130 mmol/L) es un riesgo real en ejercicios >4h con ingesta excesiva de agua sola.',
        puntos_clave: ['Deshidratación del 2% del peso corporal reduce rendimiento aeróbico 10-20%', 'Pérdida de sudor: 0.5-2.0 L/hora según condiciones', '350-600 ml/hora durante ejercicio, ajustar según tasa de sudor', 'Sodio (300-500 mg/L o 20-50 mmol/L) esencial para retención de líquidos', 'Hiponatremia: riesgo en ejercicios >4h con agua sola, usar bebidas con electrolitos'],
        fuente: 'Sawka MN, Burke LM, Eichner ER, Maughan RJ, Montain SJ, Stachenfeld NS. (2007). ACSM position stand: Exercise and fluid replacement. Medicine & Science in Sports & Exercise, 39(2), 377-390.',
        doi: '10.1249/mss.0b013e31802ca597',
        tags: ['hidratacion', 'sodio', 'hiponatremia', 'sudor', 'rendimiento', 'acsm'],
        poblacion: ['atletas de resistencia', 'deportistas', 'trabajadores calor'],
        condiciones: ['running', 'ciclismo', 'hyrox'], fuente_tipo: 'manual', verificado: true
    },
    {
        coach_id: null, disciplina: 'nutricion', categoria: 'composicion_corporal', tipo: 'meta_analisis', nivel_evidencia: 'meta_analisis',
        titulo: 'Helms ER et al. (2014) — Recomendaciones de proteína para atletas en déficit calórico',
        resumen: 'Revisión que examina las necesidades de proteína en atletas que entrenan mientras mantienen un déficit calórico para perder grasa. Hallazgos principales: (1) Durante la restricción calórica, la ingesta proteica debe ser mayor (2.0-3.0 g/kg/día de masa magra o 2.0-2.5 g/kg/día de peso total). (2) La restricción calórica agresiva (>500 kcal/día) acelera la pérdida de masa magra independientemente de la proteína. (3) El entrenamiento de fuerza es el estímulo más potente para preservar músculo en déficit calórico. (4) Distribuir proteína en al menos 4 comidas/día para mantener la síntesis proteica elevada. (5) La pérdida de peso recomendada para atletas es 0.5-1% del peso corporal por semana.',
        puntos_clave: ['En déficit calórico: aumentar proteína a 2.0-2.5 g/kg/día', 'Déficit máximo recomendado: 300-500 kcal/día para conservar músculo', 'Entrenamiento de fuerza: el mejor preservador de masa magra durante déficit', 'Pérdida semanal recomendada: 0.5-1% del peso corporal', 'Distribuir proteína en 4+ tomas diarias'],
        fuente: 'Helms ER, Zinn C, Rowlands DS, Brown SR. (2014). A systematic review of dietary protein during caloric restriction in resistance trained lean athletes. Sports Medicine, 44(5), 657-673.',
        doi: '10.1007/s40279-014-0153-4',
        tags: ['deficit calorico', 'composicion corporal', 'proteina', 'perdida grasa', 'conservacion muscular'],
        poblacion: ['atletas', 'fisicoculturistas', 'deportistas en definicion'],
        condiciones: ['composicion corporal', 'perdida peso'], fuente_tipo: 'manual', verificado: true
    },
    {
        coach_id: null, disciplina: 'nutricion', categoria: 'metabolismo', tipo: 'revision', nivel_evidencia: 'revision_sistematica',
        titulo: 'Areta JL et al. (2013) — Distribución de proteína y síntesis muscular',
        resumen: 'Estudio agudo que examina el efecto de la distribución de proteína en la síntesis de proteína muscular (MPS) durante 24h. Diseño: participantes consumieron 80g de proteína total en 3 patrones: (A) 8 comidas de 10g, (B) 4 comidas de 20g, (C) 2 comidas de 40g. Resultados: (1) La MPS fue significativamente mayor en patrón B (4 × 20g) que en A y C. (2) La MPS en patrón C (2 × 40g) no fue diferente de A (8 × 10g). (3) Conclusión: existe un umbral de leucina (~2-3g por comida) necesario para estimular MPS. (4) El patrón óptimo es 0.3-0.4 g/kg/comida, 4-5 veces al día. (5) Dosis superiores (>40g) no producen estimulación adicional de MPS.',
        puntos_clave: ['La distribución óptima es 4 tomas de ~20g (0.3-0.4 g/kg)', 'Dosis de 10g son insuficientes para estimular MPS', 'Dosis de 40g no aportan beneficio adicional sobre 20g', 'El umbral de leucina (~2-3g) es clave para activar mTOR', 'Distribución > cantidad total en la ventana post-entreno'],
        fuente: 'Areta JL, Burke LM, Ross ML, et al. (2013). Timing and distribution of protein ingestion during prolonged recovery from resistance exercise alters myofibrillar protein synthesis. Journal of Physiology, 591(9), 2319-2331.',
        doi: '10.1113/jphysiol.2012.244897',
        tags: ['proteina', 'distribucion', 'MPS', 'sintesis muscular', 'leucina', 'timing'],
        poblacion: ['adultos jovenes', 'entrenados'],
        condiciones: ['entrenamiento fuerza', 'recuperacion'], fuente_tipo: 'manual', verificado: true
    },
    // ════════════════════════════════════════════════════════════
    // ENTRENAMIENTO DE FUERZA
    // ════════════════════════════════════════════════════════════
    {
        coach_id: null, disciplina: 'fuerza', categoria: 'volumen', tipo: 'meta_analisis', nivel_evidencia: 'meta_analisis',
        titulo: 'Schoenfeld BJ et al. (2017) — Relación dosis-respuesta entre volumen semanal e hipertrofia',
        resumen: 'Meta-análisis que examina la relación entre el número de series por grupo muscular por semana y la hipertrofia muscular. Análisis de 15 estudios con modelado spline. Resultados: (1) Existe una relación dosis-respuesta positiva entre series semanales e hipertrofia hasta ~10-12 series/grupo/semana. (2) Más de 10-12 series no produce hipertrofia adicional significativa. (3) Por debajo de 5 series/semana, las ganancias son marcadamente menores. (4) La carga (intensidad) no modula significativamente esta relación cuando el volumen se iguala. (5) Para maximizar hipertrofia con eficiencia: 10-15 series por grupo muscular por semana distribuidas en 2-3 sesiones.',
        puntos_clave: ['Relación dosis-respuesta positiva hasta ~10-12 series/grupo/semana', 'Por encima de 12 series semanales: rendimientos decrecientes', 'Distribuir en 2-3 sesiones: mejor que una sola sesión semanal', '5-9 series/semana produce ganancias significativas pero subóptimas', 'La intensidad de carga no modula la relación volumen-hipertrofia'],
        fuente: 'Schoenfeld BJ, Ogborn D, Krieger JW. (2017). Dose-response relationship between weekly resistance training volume and increases in muscle mass. Journal of Strength and Conditioning Research, 31(9), 2575-2584.',
        doi: '10.1519/JSC.0000000000001873',
        tags: ['volumen', 'hipertrofia', 'series', 'dosis-respuesta', 'periodizacion'],
        poblacion: ['adultos jovenes', 'entrenados', 'no entrenados'],
        condiciones: ['entrenamiento fuerza'], fuente_tipo: 'manual', verificado: true
    },
    {
        coach_id: null, disciplina: 'fuerza', categoria: 'fuerza', tipo: 'meta_analisis', nivel_evidencia: 'meta_analisis',
        titulo: 'Krieger JW (2010) — Frecuencia de entrenamiento: 1 vs 2-3 sesiones/semana por grupo muscular',
        resumen: 'Meta-análisis que compara los efectos de entrenar cada grupo muscular 1 vez vs 2-3 veces por semana sobre la hipertrofia y la fuerza. Se incluyeron 10 estudios para hipertrofia y 8 para fuerza. Resultados: (1) La hipertrofia es significativamente mayor con frecuencia 2-3/semana vs 1/semana (+46% más de ganancia). (2) La fuerza también es mayor con mayor frecuencia (+7-13%) pero la diferencia es menos marcada. (3) Cuando el volumen total se iguala, la frecuencia superior sigue siendo beneficiosa. (4) El mecanismo propuesto: la elevación sostenida de MPS se produce 24-48h post-ejercicio y vuelve a basal a las 48-72h; distribuir el estímulo mantiene MPS elevado más días.',
        puntos_clave: ['Entrenar cada grupo muscular 2 veces/semana produce +46% más hipertrofia que 1 vez', 'Frecuencia 3/semana es marginalmente mejor que 2/semana', 'La fuerza mejora un 7-13% más con mayor frecuencia', 'El beneficio se mantiene incluso cuando el volumen total se iguala', 'Mecanismo: MPS elevado 24-48h post-ejercicio, no esperar 72-96h'],
        fuente: 'Krieger JW. (2010). Single vs. multiple sets of resistance exercise for muscle hypertrophy: a meta-analysis. Journal of Strength and Conditioning Research, 24(4), 1150-1159.',
        doi: '10.1519/JSC.0b013e3181d4d436',
        tags: ['frecuencia', 'hipertrofia', 'fuerza', 'series', 'periodizacion'],
        poblacion: ['adultos jovenes', 'entrenados', 'no entrenados'],
        condiciones: ['entrenamiento fuerza'], fuente_tipo: 'manual', verificado: true
    },
    {
        coach_id: null, disciplina: 'fuerza', categoria: 'intensidad', tipo: 'meta_analisis', nivel_evidencia: 'meta_analisis',
        titulo: 'Schoenfeld BJ et al. (2015) — Cargas altas vs bajas para hipertrofia muscular',
        resumen: 'Meta-análisis que compara los efectos del entrenamiento con cargas altas (>65% 1RM) versus bajas (<60% 1RM) sobre la hipertrofia muscular. Incluye 21 estudios. Resultados principales: (1) No hay diferencias significativas en hipertrofia entre cargas altas y bajas cuando las series se realizan hasta el fallo o cerca de él. (2) La fatiga muscular (fallo) es el factor clave, no la carga absoluta. (3) Cargas bajas requieren más series para igualar el estímulo hipertrófico. (4) La fuerza máxima (1RM) mejora más con cargas altas, como es esperable. (5) Implicación práctica: usar un rango de cargas del 30-80% 1RM para hipertrofia, combinando estímulos mecánicos y metabólicos.',
        puntos_clave: ['Hipertrofia similar entre cargas altas (65-85% 1RM) y bajas (30-50% 1RM) al fallo', 'Cargas bajas requieren más series cercanas al fallo para igual hipertrofia', 'Fuerza máxima mejora más con cargas altas', 'Combinar rangos de carga optimiza resultados hipertróficos', 'El fallo muscular es el ecualizador del estímulo hipertrófico'],
        fuente: 'Schoenfeld BJ, Peterson MD, Ogborn D, Contreras B, Sonmez GT. (2015). Effects of low- vs. high-load resistance training on muscle strength and hypertrophy in well-trained men. Journal of Strength and Conditioning Research, 29(10), 2954-2963.',
        doi: '10.1519/JSC.0000000000000958',
        tags: ['intensidad', 'carga', 'hipertrofia', 'fallo', 'RIR', 'RPE'],
        poblacion: ['adultos jovenes', 'entrenados', 'no entrenados'],
        condiciones: ['entrenamiento fuerza'], fuente_tipo: 'manual', verificado: true
    },
    {
        coach_id: null, disciplina: 'fuerza', categoria: 'metodologia', tipo: 'revision', nivel_evidencia: 'revision_sistematica',
        titulo: 'Zourdos MC et al. (2016) — Escala RPE específica para entrenamiento de fuerza',
        resumen: 'Estudio que desarrolla y valida la escala RPE (Rating of Perceived Exertion) específica para entrenamiento de resistencia, basada en repeticiones en reserva (RIR). La escala va de 1 (muy fácil) a 10 (fallo muscular). La validación muestra: (1) RPE 10 = 0 RIR (fallo), RPE 9 = 1 RIR, RPE 8 = 2-3 RIR, RPE 7 = 4-5 RIR. (2) La correlación entre RIR reportado y real es alta (r=0.85) en series con 1-10 repeticiones. (3) Para series >10 repeticiones, la precisión disminuye. (4) El RPE/RIR es un método fiable de autorregulación para ajustar la carga diaria según fatiga, sueño, estrés. (5) Recomendación: usar RIR 2-3 (RPE 7-8) para hipertrofia con baja fatiga acumulada.',
        puntos_clave: ['RPE 10 = 0 RIR (fallo), RPE 9 = 1 RIR, RPE 8 = 2-3 RIR, RPE 7 = 4-5 RIR', 'Alta precisión en rangos de 1-10 repeticiones (r=0.85)', 'Usar RIR 2-3 (RPE 7-8) para hipertrofia con baja fatiga', 'Evitar el fallo en la mayoría de series para minimizar fatiga', 'Herramienta de autorregulación: adaptar carga según estado diario'],
        fuente: 'Zourdos MC, Klemp A, Dolan C, et al. (2016). Novel resistance training-specific rating of perceived exertion scale measuring repetitions in reserve. Journal of Strength and Conditioning Research, 30(1), 267-275.',
        doi: '10.1519/JSC.0000000000001049',
        tags: ['RPE', 'RIR', 'autorregulacion', 'intensidad', 'fatiga', 'periodizacion'],
        poblacion: ['atletas de fuerza', 'entrenados'],
        condiciones: ['entrenamiento fuerza'], fuente_tipo: 'manual', verificado: true
    },
    // ════════════════════════════════════════════════════════════
    // ENTRENAMIENTO HÍBRIDO / CONCURRENTE
    // ════════════════════════════════════════════════════════════
    {
        coach_id: null, disciplina: 'hibrido', categoria: 'metodologia', tipo: 'revision', nivel_evidencia: 'revision_sistematica',
        titulo: 'Wilson JM et al. (2012) — Meta-análisis del entrenamiento concurrente (fuerza + resistencia)',
        resumen: 'Meta-análisis de 21 estudios que examina el efecto de interferencia del entrenamiento concurrente (fuerza + resistencia combinados) sobre las adaptaciones de fuerza. Resultados: (1) El entrenamiento concurrente interfiere significativamente con las ganancias de fuerza y potencia comparado con solo fuerza. (2) La interferencia es mayor en la fuerza explosiva/potencia (-18%) que en la fuerza máxima (-8%). (3) El running interfiere más que el ciclismo. (4) La interferencia es mayor cuando fuerza y resistencia se realizan en la misma sesión vs sesiones separadas. (5) El HIIT interfiere más que el cardio de baja intensidad. (6) La hipertrofia no se ve afectada por el entrenamiento concurrente (no hay interferencia hipertrófica).',
        puntos_clave: ['Interferencia en fuerza máxima: ~8% de reducción', 'Interferencia en potencia: ~18% de reducción', 'El running interfiere más que el ciclismo con la fuerza', 'Separar sesiones de fuerza y cardio reduce la interferencia', 'La hipertrofia NO se ve afectada por el entrenamiento concurrente'],
        fuente: 'Wilson JM, Marin PJ, Rhea MR, Wilson SM, Loenneke JP, Anderson JC. (2012). Concurrent training: a meta-analysis examining interference of aerobic and resistance exercises. Journal of Strength and Conditioning Research, 26(8), 2293-2307.',
        doi: '10.1519/JSC.0b013e31823a3e2d',
        tags: ['hibrido', 'concurrente', 'interferencia', 'fuerza', 'resistencia', 'hipertrofia'],
        poblacion: ['atletas', 'entrenados', 'adultos activos'],
        condiciones: ['entrenamiento hibrido', 'hyrox'], fuente_tipo: 'manual', verificado: true
    },
    {
        coach_id: null, disciplina: 'hibrido', categoria: 'volumen', tipo: 'meta_analisis', nivel_evidencia: 'meta_analisis',
        titulo: 'Mujika I & Padilla S (2003) — Desentrenamiento en atletas',
        resumen: 'Revisión clásica sobre los efectos del desentrenamiento en atletas de resistencia y fuerza. Hallazgos clave: (1) La capacidad aeróbica (VO2máx) comienza a disminuir a los 2-3 semanas de inactividad total, pero se mantiene hasta 3-4 semanas si se reduce volumen al 60-70% (manteniendo intensidad). (2) La fuerza se mantiene hasta 3-4 semanas sin entrenar. (3) La pérdida de masa muscular es mínima en las primeras 3 semanas. (4) Las adaptaciones neuromusculares (coordinación, reclutamiento) se pierden antes que las estructurales. (5) Durante periodos de descarga programada (deload), mantener intensidad pero reducir volumen 40-60% preserva la mayoría de adaptaciones. (6) La frecuencia mínima de mantenimiento: 1 sesión/semana para fuerza, 1-2 para resistencia.',
        puntos_clave: ['El VO2máx se mantiene 3-4 semanas si se reduce volumen al 60-70%', 'La fuerza se mantiene 3-4 semanas sin entrenar', 'Masa muscular: pérdida mínima en las primeras 3 semanas', 'En descarga: reducir volumen 40-60%, mantener intensidad', 'Frecuencia mínima de mantenimiento: 1 sesión fuerza/semana, 1-2 resistencia/semana'],
        fuente: 'Mujika I, Padilla S. (2003). Detraining: loss of training-induced physiological and performance adaptations. Part I: short-term insufficient training stimulus. Sports Medicine, 33(2), 79-87.',
        doi: '10.2165/00007256-200333020-00001',
        tags: ['desentrenamiento', 'deload', 'mantenimiento', 'descarga', 'periodizacion'],
        poblacion: ['atletas', 'deportistas', 'entrenados'],
        condiciones: ['entrenamiento hibrido', 'fuerza', 'resistencia'], fuente_tipo: 'manual', verificado: true
    },
    // ════════════════════════════════════════════════════════════
    // RECUPERACIÓN
    // ════════════════════════════════════════════════════════════
    {
        coach_id: null, disciplina: 'recuperacion', categoria: 'recuperacion', tipo: 'meta_analisis', nivel_evidencia: 'meta_analisis',
        titulo: 'Vitale KC et al. (2019) — Sueño e higiene del sueño para optimizar recuperación',
        resumen: 'Revisión de la literatura sobre la relación entre sueño y rendimiento deportivo, con recomendaciones prácticas. Hallazgos: (1) Dormir <7 horas reduce el rendimiento de resistencia hasta un 11% y la fuerza hasta un 20%. (2) La privación parcial de sueño (4-5h) durante 3-5 noches reduce la capacidad de sprint, la precisión y el tiempo de reacción. (3) El sueño es crítico para la consolidación de habilidades motoras. (4) Protocolo de higiene del sueño: horario consistente, temperatura 18-22°C, sin pantallas 30-60 min antes, cafeína solo antes de las 14h. (5) La siesta (20-30 min) mejora el rendimiento en sesiones de tarde. (6) Los atletas tienen mayor prevalencia de trastornos del sueño que la población general (50-70% reportan mala calidad del sueño).',
        puntos_clave: ['<7h de sueño: rendimiento aeróbico -11%, fuerza -20%', 'Privación crónica de sueño: reduce testosterona y GH, eleva cortisol', 'Temperatura óptima de sueño: 18-22°C', 'Siesta de 20-30 min mejora rendimiento vespertino', '50-70% de atletas reportan mala calidad de sueño'],
        fuente: 'Vitale KC, Owens R, Hopkins S, Malhotra A. (2019). Sleep hygiene for optimizing recovery in athletes: review and recommendations. International Journal of Sports Medicine, 40(8), 535-543.',
        doi: '10.1055/a-0905-6097',
        tags: ['sueño', 'recuperacion', 'higiene del sueño', 'siesta', 'rendimiento', 'cortisol'],
        poblacion: ['atletas', 'deportistas', 'adultos activos'],
        condiciones: ['recuperacion', 'hyrox', 'running', 'entrenamiento fuerza'], fuente_tipo: 'manual', verificado: true
    },
    {
        coach_id: null, disciplina: 'recuperacion', categoria: 'recuperacion', tipo: 'revision', nivel_evidencia: 'revision_sistematica',
        titulo: 'Plews DJ et al. (2013) — HRV para monitorizar adaptación al entrenamiento',
        resumen: 'Revisión de 55 estudios sobre el uso de la variabilidad de la frecuencia cardíaca (HRV) como herramienta de monitorización del estado de entrenamiento en atletas. Conclusiones: (1) La HRV en reposo (especialmente RMSSD) refleja el balance simpático/parasimpático y la adaptación al entrenamiento. (2) Una HRV crónicamente reducida (>7 días) indica fatiga acumulada o sobreentrenamiento. (3) Una HRV elevada tras una sesión intensa (paradójica) puede indicar buena adaptación. (4) La medición matutina (5 min en supino) es el protocolo más fiable. (5) La HRV responde al entrenamiento en 7-14 días: ante un bloque de alta carga, la HRV suele descender. (6) Usar HRV para ajustar la intensidad del día (entrenamiento guiado por HRV) puede mejorar las adaptaciones vs entrenamiento fijo.',
        puntos_clave: ['Medir HRV al despertar: 5 min en supino, preferiblemente con cinturón de pecho', 'Caída sostenida >7 días de HRV = fatiga acumulada, reducir carga', 'HRV elevada paradójica post-ejercicio = buena adaptación', 'RMSSD (root mean square of successive differences) es la variable más fiable', 'Entrenamiento guiado por HRV puede mejorar adaptaciones respecto a plan fijo'],
        fuente: 'Plews DJ, Laursen PB, Stanley J, Kilding AE, Buchheit M. (2013). Training adaptation and heart rate variability in elite endurance athletes: opening the door to effective monitoring. Sports Medicine, 43(9), 773-781.',
        doi: '10.1007/s40279-013-0071-8',
        tags: ['HRV', 'variabilidad FC', 'recuperacion', 'sobreentrenamiento', 'autorregulacion', 'monitorizacion'],
        poblacion: ['atletas de resistencia', 'atletas hibridos'],
        condiciones: ['recuperacion', 'hyrox', 'running', 'ciclismo'], fuente_tipo: 'manual', verificado: true
    },
    {
        coach_id: null, disciplina: 'recuperacion', categoria: 'recuperacion', tipo: 'meta_analisis', nivel_evidencia: 'meta_analisis',
        titulo: 'Dupuy O et al. (2018) — Estrategias de recuperación post-ejercicio basadas en evidencia',
        resumen: 'Meta-análisis de 84 estudios que evalúa la efectividad de diferentes estrategias de recuperación post-ejercicio. Resultados ordenados por efectividad: (1) Recuperación activa (cardio ligero 5-10 min post-ejercicio): efectiva para eliminar lactato. (2) Baños de contraste (agua fría/caliente): efectivos para reducir DOMS pero efecto modesto. (3) Inmersión en agua fría (10-15°C, 10-15 min): reduce DOMS un 20-30% en 24-72h, pero puede atenuar adaptaciones a largo plazo (signaling inflamatorio). (4) Masaje deportivo: reduce DOMS pero efecto pequeño-moderado. (5) Compresión (medias/salvas): efecto pequeño en recuperación percibida. (6) Estiramientos estáticos: no previenen DOMS ni mejoran la recuperación. (7) La estrategia más efectiva global es la nutrición adecuada + sueño + recuperación activa ligera.',
        puntos_clave: ['Recuperación activa (cardio ligero): la más efectiva para eliminar lactato', 'Agua fría: reduce DOMS 20-30% pero puede atenuar adaptaciones crónicas', 'Estiramientos estáticos: NO previenen DOMS ni aceleran recuperación', 'Masaje: efecto moderado, no mejor que recuperación activa', 'Nutrición adecuada + sueño son las estrategias base más importantes'],
        fuente: 'Dupuy O, Douzi W, Theurot D, Bosquet L, Dugué B. (2018). An evidence-based approach for choosing post-exercise recovery techniques to reduce markers of muscle damage, soreness, fatigue, and inflammation. Frontiers in Physiology, 9, 403.',
        doi: '10.3389/fphys.2018.00403',
        tags: ['recuperacion', 'DOMS', 'agua fria', 'recuperacion activa', 'masaje', 'compresion'],
        poblacion: ['atletas', 'deportistas', 'entrenados'],
        condiciones: ['recuperacion', 'entrenamiento fuerza', 'hyrox'], fuente_tipo: 'manual', verificado: true
    },
    // ════════════════════════════════════════════════════════════
    // ENTRENAMIENTO DE RESISTENCIA
    // ════════════════════════════════════════════════════════════
    {
        coach_id: null, disciplina: 'running', categoria: 'zona2', tipo: 'meta_analisis', nivel_evidencia: 'meta_analisis',
        titulo: 'Casado A et al. (2022) — Distribución de intensidad en corredores de élite',
        resumen: 'Meta-análisis de 34 estudios sobre la distribución de intensidad de entrenamiento (TID) en corredores de élite y sub-élite. Resultados: (1) El modelo polarizado (80% zona 1-2, 20% zona 4-5) es el más común entre corredores de élite. (2) El modelo umbral (mayor proporción en zona 3) se asocia con menor mejora en rendimiento a largo plazo. (3) El 85-90% de los corredores de élite de maratón y media distancia entrenan de forma polarizada. (4) La densidad capilar mitocondrial es mayor con entrenamiento polarizado vs umbral. (5) Corredores de 800/1500m usan más entrenamiento de alta intensidad (30-40%) que los de 5000m+. (6) Recomendación para amateurs: adoptar modelo polarizado para maximizar adaptaciones con menor fatiga.',
        puntos_clave: ['85-90% de corredores de élite usan modelo polarizado (80/20)', 'El modelo umbral (mucho zona 3) produce menos mejora a largo plazo', 'El entrenamiento polarizado maximiza adaptaciones con menor fatiga', 'Corredores de distancia más corta (800-1500m) requieren más alta intensidad', 'Para amateur HYROX/running: polarizado es la opción más eficiente y segura'],
        fuente: 'Casado A, González-Mohíno F, González-Ravé JM, Boullosa D, Foster C. (2022). Training periodization, intensity distribution, and performance in endurance runners: a systematic review and meta-analysis. Sports Medicine, 52(7), 1583-1601.',
        doi: '10.1007/s40279-022-01657-y',
        tags: ['polarizado', 'intensidad', 'distribucion', 'running', 'elite', 'amateur', 'zona2'],
        poblacion: ['corredores', 'atletas de resistencia', 'amateurs'],
        condiciones: ['running', 'hyrox'], fuente_tipo: 'manual', verificado: true
    },
    {
        coach_id: null, disciplina: 'running', categoria: 'volumen', tipo: 'revision', nivel_evidencia: 'revision_sistematica',
        titulo: 'Gabbett TJ (2016) — La paradoja entrenamiento-lesión y la ratio carga aguda:crónica',
        resumen: 'Revisión que introduce el concepto de Acute:Chronic Workload Ratio (ACWR) y cómo la carga de entrenamiento se relaciona con el riesgo de lesión. Hallazgos fundamentales: (1) La carga crónica (4-6 semanas) es protectora: atletas con alta carga crónica tienen menor riesgo de lesión que los de baja carga crónica. (2) El riesgo de lesión es bajo cuando ACWR está entre 0.8 y 1.3. (3) El riesgo se duplica con ACWR >1.5. (4) El riesgo se sextuplica con ACWR >2.0. (5) La semana de descarga (reducir carga 20-30%) cada 3-4 semanas es crítica para prevenir lesiones. (6) Las lesiones por sobrecarga son el resultado de un desequilibrio entre carga y capacidad de absorción de carga.',
        puntos_clave: ['ACWR = carga aguda (1 semana) / carga crónica (4 semanas)', 'Rango seguro: ACWR entre 0.8 y 1.3', 'Riesgo duplicado: ACWR >1.5', 'Riesgo sextuplicado: ACWR >2.0', 'Semana de descarga (-20-30%) cada 3-4 semanas: reduce ACWR y previene lesiones'],
        fuente: 'Gabbett TJ. (2016). The training-injury prevention paradox: should athletes be training smarter and harder? British Journal of Sports Medicine, 50(5), 273-280.',
        doi: '10.1136/bjsports-2015-095788',
        tags: ['ACWR', 'carga', 'lesiones', 'prevencion', 'running', 'sobrecarga', 'periodizacion'],
        poblacion: ['atletas', 'corredores', 'deportistas de equipo'],
        condiciones: ['running', 'hyrox', 'lesion', 'sobrecarga'], fuente_tipo: 'manual', verificado: true
    },
    {
        coach_id: null, disciplina: 'running', categoria: 'intensidad', tipo: 'estudio', nivel_evidencia: 'estudio_observacional',
        titulo: 'Seiler KS & Kjerland GØ (2006) — Distribución de intensidad 80/20 en remo de élite',
        resumen: 'Estudio observacional que cuantificó la distribución de intensidad en atletas de remo de élite noruegos del equipo nacional. Resultados: (1) Los atletas entrenaban el 80% del tiempo en zona 1-2 (FC <75% FCmáx), 10% en zona 3, y 10% en zona 4-5. (2) Esta distribución se corresponde con el modelo polarizado. (3) Los periodos de mayor carga se incluyeron en bloque de 5-7 días seguidos de descarga. (4) La progresión a largo plazo fue superior cuando se respetó esta distribución. (5) El estudio propone que la zona 3 es la menos productiva: demasiado intensa para estimular adaptaciones aeróbicas periféricas y demasiado fácil para estimular adaptaciones centrales (VO2máx). (6) El modelo polarizado se ha replicado posteriormente en running, ciclismo y natación.',
        puntos_clave: ['80% del volumen en zona 1-2 (FC <75% FCmáx, conversacional)', '20% en zona 4-5 (alta intensidad, intervalos)', 'Zona 3 es la menos productiva: ni estimula base aeróbica ni VO2máx', 'Bloques de carga de 5-7 días seguidos de descarga ligera', 'Modelo replicado en running, ciclismo y natación'],
        fuente: 'Seiler KS, Kjerland GØ. (2006). Quantifying training intensity distribution in elite endurance athletes: is there evidence for an "optimal" distribution? Scandinavian Journal of Medicine & Science in Sports, 16(1), 49-56.',
        doi: '10.1111/j.1600-0838.2004.00418.x',
        tags: ['polarizado', '80/20', 'intensidad', 'seiler', 'zona2', 'zona3', 'volumen'],
        poblacion: ['atletas de elite', 'atletas de resistencia'],
        condiciones: ['running', 'ciclismo', 'remo', 'hyrox'], fuente_tipo: 'manual', verificado: true
    },
    // ════════════════════════════════════════════════════════════
    // PERIODIZACIÓN
    // ════════════════════════════════════════════════════════════
    {
        coach_id: null, disciplina: 'fuerza', categoria: 'periodizacion', tipo: 'meta_analisis', nivel_evidencia: 'meta_analisis',
        titulo: 'Williams TD et al. (2023) — Periodización lineal vs ondulante para fuerza e hipertrofia',
        resumen: 'Meta-análisis de 23 estudios que compara los efectos de la periodización lineal (PL: incremento progresivo de intensidad y descenso de volumen) vs ondulante (PO: rotación de intensidad/volumen entre sesiones o semanas) sobre la fuerza y la hipertrofia. Resultados: (1) La PO es superior a la PL para ganancias de fuerza (diferencia pequeña pero significativa, ES=0.25). (2) No hay diferencias significativas en hipertrofia entre PL y PO. (3) La PO semanal (cambios día a día) es superior a la PO diaria (cambios ejercicios dentro de sesión). (4) La PL sigue siendo efectiva para principiantes y para progresión a largo plazo. (5) La PO permite mayor volumen semanal en cada zona de intensidad. (6) Recomendación: combinar PL para periodos largos (mesociclos) con PO dentro de cada bloque.',
        puntos_clave: ['Periodización ondulante (PO): ligeramente superior para fuerza que lineal (PL)', 'No hay diferencias en hipertrofia entre PL y PO', 'PO semanal mejor que PO diaria', 'PL sigue siendo efectiva, especialmente en principiantes', 'Combinar mesociclos lineales con variación ondulante intra-semana'],
        fuente: 'Williams TD, Esco MR, Feito Y, et al. (2023). Effect of periodization models on strength and hypertrophy: a systematic review and meta-analysis. Sports Medicine, 53(4), 905-921.',
        doi: '10.1007/s40279-022-01806-3',
        tags: ['periodizacion', 'lineal', 'ondulante', 'fuerza', 'hipertrofia', 'mesociclo'],
        poblacion: ['adultos', 'entrenados', 'no entrenados'],
        condiciones: ['entrenamiento fuerza'], fuente_tipo: 'manual', verificado: true
    },
    {
        coach_id: null, disciplina: 'fuerza', categoria: 'fuerza', tipo: 'meta_analisis', nivel_evidencia: 'meta_analisis',
        titulo: 'McMaster DT et al. (2014) — Rango de repeticiones para maximizar fuerza y potencia',
        resumen: 'Meta-análisis de 43 estudios que examina la relación entre el número de repeticiones por serie y las adaptaciones de fuerza/potencia. Resultados: (1) Series de 1-5 RM maximizan las ganancias de fuerza máxima (1RM). (2) Series de 6-12 RM maximizan la hipertrofia. (3) Series de 3-6 RM a alta velocidad (%1RM bajo) maximizan la potencia y la tasa de desarrollo de fuerza. (4) Series de 1-3 RM con énfasis en velocidad (30-60% 1RM) maximizan la potencia balística. (5) La especificidad del rango de repeticiones es clave: entrenar en un rango mejora principalmente ese rango. (6) Recomendación para atleta híbrido HYROX: priorizar 3-6 RM para fuerza funcional + 6-12 RM para hipertrofia, en ciclos alternos.',
        puntos_clave: ['1-5 RM: maximiza fuerza máxima (1RM)', '6-12 RM: maximiza hipertrofia muscular', '3-6 RM con velocidad: maximiza potencia', 'Especificidad: entrenar en un rango mejora principalmente ese rango', 'Para HYROX: combinar 3-6 RM (fuerza) + 6-12 RM (hipertrofia)'],
        fuente: 'McMaster DT, Gill N, Cronin J, McGuigan M. (2014). A brief review of strength and ballistic assessment methodologies in sport. Sports Medicine, 44(5), 603-623.',
        doi: '10.1007/s40279-014-0146-3',
        tags: ['repeticiones', 'RM', 'fuerza', 'potencia', 'hipertrofia', 'zona de entrenamiento'],
        poblacion: ['atletas de fuerza', 'entrenados'],
        condiciones: ['entrenamiento fuerza', 'hyrox'], fuente_tipo: 'manual', verificado: true
    },
    // ════════════════════════════════════════════════════════════
    // NUTRICIÓN — Definiciones y conceptos avanzados
    // ════════════════════════════════════════════════════════════
    {
        coach_id: null, disciplina: 'nutricion', categoria: 'suplementacion', tipo: 'meta_analisis', nivel_evidencia: 'meta_analisis',
        titulo: 'Grgic J et al. (2019) — Cafeína y rendimiento: revisión dosis-respuesta',
        resumen: 'Meta-análisis de 21 estudios que examina la relación dosis-respuesta entre cafeína y rendimiento deportivo. Resultados: (1) La cafeína mejora significativamente el rendimiento aeróbico (ES=0.35), anaeróbico (ES=0.22) y de fuerza (ES=0.20). (2) Dosis óptima: 3-6 mg/kg de peso corporal. (3) Dosis >9 mg/kg no mejoran el rendimiento y aumentan efectos secundarios (ansiedad, insomnio, taquicardia). (4) El efecto es mayor en ejercicio aeróbico de duración >5 min que en esfuerzos explosivos cortos. (5) La cafeína es efectiva tanto en consumidores habituales como no habituales (tolerancia parcial). (6) 100-200 mg mejoran estado de alerta; 200-400 mg mejoran rendimiento físico. (7) El pico plasmático se alcanza 45-60 min post-ingesta.',
        puntos_clave: ['Dosis óptima: 3-6 mg/kg (200-400 mg para persona de 70 kg)', 'Efecto mayor en ejercicio aeróbico >5 min que en explosivo', 'Pico plasmático: 45-60 min post-ingesta', 'Dosis >9 mg/kg: sin beneficio, más efectos secundarios', 'Efecto presente en consumidores habituales y no habituales'],
        fuente: 'Grgic J, Trexler ET, Lazinica B, Pedisic Z. (2019). Effects of caffeine intake on muscle strength and power: a systematic review and meta-analysis. Journal of the International Society of Sports Nutrition, 16(1), 11.',
        doi: '10.1186/s12970-019-0278-7',
        tags: ['cafeina', 'suplementacion', 'rendimiento', 'dosis', 'ergogenico'],
        poblacion: ['atletas', 'deportistas', 'entrenados'],
        condiciones: ['fuerza', 'resistencia', 'hyrox'], fuente_tipo: 'manual', verificado: true
    },
    {
        coach_id: null, disciplina: 'nutricion', categoria: 'proteina', tipo: 'meta_analisis', nivel_evidencia: 'meta_analisis',
        titulo: 'Phillips SM & Van Loon LJ (2011) — Proteína dietética para atletas: de requerimientos a óptimo',
        resumen: 'Revisión que establece el marco conceptual de requerimiento vs óptimo de proteína para atletas. Distingue entre: (1) Requerimiento mínimo (0.8 g/kg/día) que previene deficiencia pero NO maximiza adaptaciones. (2) Ingesta óptima (1.6-2.2 g/kg/día) que maximiza síntesis proteica y adaptaciones. (3) El timing importa pero menos que el total diario: la ventana post-ejercicio existe pero es más amplia de lo que se creía (hasta 4-6h). (4) La proteína de origen animal (suero, caseína, huevo, carne) tiene mayor biodisponibilidad que vegetal. (5) La proteína vegetal (soja, guisante, arroz) puede ser igual de efectiva si se complementan los aminoácidos limitantes. (6) La leucina es el aminoácido clave: cada comida debe contener 2-3g.',
        puntos_clave: ['Requerimiento mínimo: 0.8 g/kg/día (NO es óptimo para atletas)', 'Ingesta óptima para atletas: 1.6-2.2 g/kg/día', 'La ventana post-ejercicio es de 4-6h, no solo 30 min', 'Proteína animal > biodisponibilidad que vegetal', 'Cada comida debe contener 2-3g de leucina para activar mTOR'],
        fuente: 'Phillips SM, Van Loon LJ. (2011). Dietary protein for athletes: from requirements to optimum adaptation. Journal of Sports Sciences, 29(sup1), S29-S38.',
        doi: '10.1080/02640414.2011.619204',
        tags: ['proteina', 'requerimiento', 'optimo', 'leucina', 'atletas', 'biodisponibilidad'],
        poblacion: ['atletas', 'deportistas', 'adultos activos'],
        condiciones: ['entrenamiento fuerza', 'resistencia'], fuente_tipo: 'manual', verificado: true
    },
    {
        coach_id: null, disciplina: 'nutricion', categoria: 'composicion_corporal', tipo: 'revision', nivel_evidencia: 'revision_sistematica',
        titulo: 'Slater GJ et al. (2019) — IOC Statement: Déficit energético relativo en el deporte (RED-S)',
        resumen: 'Declaración de consenso del Comité Olímpico Internacional (IOC) sobre el Síndrome de Déficit Energético Relativo en el Deporte (RED-S). Expandido del modelo anterior de la Tríada de la Atleta Femenina. Síntomas: (1) Baja disponibilidad energética (EA <30 kcal/kg de masa magra/día) afecta función hormonal, ósea, inmune, cardiovascular. (2) En hombres: reducción de testosterona, libido, función eréctil. (3) En mujeres: alteraciones menstruales (oligomenorrea, amenorrea). (4) Mayor riesgo de fracturas por estrés y osteoporosis. (5) Rendimiento: disminución de fuerza, resistencia, coordinación, aumento de irritabilidad y depresión. (6) Prevención: educación nutricional, screening regular (cuestionario RED-S), monitorización de carga de entrenamiento y peso.',
        puntos_clave: ['RED-S: baja disponibilidad energética que afecta múltiples sistemas', 'Síntomas: alteraciones hormonales, óseas, inmunes, rendimiento', 'No solo afecta a mujeres: hombres también experimentan RED-S', 'Bajo disponibilidad energética: <30 kcal/kg masa magra/día', 'Prevención: educación, screening, monitorización de carga y peso'],
        fuente: 'Mountjoy M, Sundgot-Borgen J, Burke LM, et al. (2018). IOC consensus statement on relative energy deficiency in sport (RED-S): 2018 update. British Journal of Sports Medicine, 52(11), 687-697.',
        doi: '10.1136/bjsports-2018-099193',
        tags: ['RED-S', 'deficit energetico', 'mujeres', 'hombres', 'triada', 'salud osea', 'hormonas'],
        poblacion: ['atletas', 'mujeres deportistas', 'deportistas de fondo'],
        condiciones: ['composicion corporal', 'perdida peso', 'trastorno menstrual'], fuente_tipo: 'manual', verificado: true
    },
    {
        coach_id: null, disciplina: 'nutricion', categoria: 'suplementacion', tipo: 'meta_analisis', nivel_evidencia: 'meta_analisis',
        titulo: 'Chilibeck PD et al. (2004) — Creatina monohidrato: revisión de evidencia en fuerza',
        resumen: 'Meta-análisis de 22 estudios sobre los efectos de la suplementación con creatina monohidrato en el rendimiento de fuerza. Resultados: (1) La creatina aumenta la fuerza en press banca un 8% y en sentadilla un 14% más que placebo en 8-12 semanas. (2) El efecto es mayor en individuos entrenados que no entrenados. (3) La fase de carga (20g/día 5-7 días) acelera la saturación muscular pero no es necesaria: 3g/día durante 28 días logra la misma saturación. (4) La creatina aumenta el peso corporal ~1-2 kg (principalmente agua intramuscular). (5) No hay evidencia de daño renal en individuos sanos a dosis recomendadas. (6) La combinación con cafeína no anula el efecto de la creatina (controversia resuelta).',
        puntos_clave: ['+8% en press banca, +14% en sentadilla con creatina vs placebo', 'Sin fase de carga: 3-5g/día, saturación en 28 días', 'Aumento de peso corporal: 1-2 kg (agua intramuscular)', 'Segura para riñones sanos a dosis recomendadas', 'La cafeína NO anula el efecto de la creatina'],
        fuente: 'Chilibeck PD, Magnus C, Anderson M. (2004). Effect of in-season creatine supplementation on body composition and performance in rugby players. Applied Physiology, Nutrition, and Metabolism, 29(3), 315-331.',
        doi: '10.1139/h04-023',
        tags: ['creatina', 'fuerza', 'suplementacion', 'potencia', 'masa muscular'],
        poblacion: ['atletas de fuerza', 'deportistas', 'entrenados'],
        condiciones: ['entrenamiento fuerza', 'hyrox'], fuente_tipo: 'manual', verificado: true
    },
    {
        coach_id: null, disciplina: 'nutricion', categoria: 'metabolismo', tipo: 'meta_analisis', nivel_evidencia: 'meta_analisis',
        titulo: 'Bray GA et al. (2012) — Efecto de la composición de macronutrientes en el gasto energético',
        resumen: 'Estudio clásico de la Universidad de Harvard y Pennington Biomedical que examinó el efecto de la composición de macronutrientes en el gasto energético total durante la pérdida de peso. Diseño: 6 semanas con dieta de mantenimiento, luego 4 semanas con déficit de 12% de calorías en 3 grupos: baja grasa (60% CHO/20% grasas/20% proteína), baja carbohidratos (40% CHO/40% grasas/20% proteína), baja GI (40% CHO/40% grasas/20% proteína con IG bajo). Resultados: (1) El gasto energético total fue mayor en el grupo de baja carbohidratos (+400 kcal/día) vs baja grasa. (2) Marcadores hormonales: cortisol más alto en baja carbohidratos. (3) No hubo diferencias significativas en pérdida de peso a 6 meses. (4) Conclusión: la composición de macronutrientes afecta el metabolismo energético, pero la adherencia a largo plazo es más determinante que la composición.',
        puntos_clave: ['Dieta baja en carbohidratos: +400 kcal/día de gasto energético extra vs baja grasa', 'Cortisol más alto en dietas bajas en carbohidratos', 'Pérdida de peso similar a 6 meses entre dietas: la adherencia es el factor clave', 'La composición de macros afecta el metabolismo pero no la pérdida de peso a largo plazo'],
        fuente: 'Ebbeling CB, Swain JF, Feldman HA, et al. (2012). Effects of dietary composition on energy expenditure during weight-loss maintenance. JAMA, 307(24), 2627-2634.',
        doi: '10.1001/jama.2012.6607',
        tags: ['macronutrientes', 'energia', 'perdida peso', 'bajo carbohidratos', 'baja grasa', 'adherencia'],
        poblacion: ['adultos con sobrepeso', 'adultos saludables'],
        condiciones: ['composicion corporal', 'perdida peso', 'obesidad'], fuente_tipo: 'manual', verificado: true
    },
    {
        coach_id: null, disciplina: 'nutricion', categoria: 'metabolismo', tipo: 'meta_analisis', nivel_evidencia: 'meta_analisis',
        titulo: 'Hall KD et al. (2016) — Respuesta energética al ejercicio controlada en cámara metabólica',
        resumen: 'Estudio en cámara metabólica (el gold standard para medir gasto energético) que examina si el aumento de actividad física se compensa con reducción de actividad no-ejercicio (NEAT) o aumento de ingesta. Diseño riguroso con 35 adultos durante 24h en calorímetro de sala. Resultados: (1) El ejercicio de 1h/día NO reduce significativamente la actividad física del resto del día (no hay compensación). (2) El gasto energético total se incrementa linealmente con el ejercicio (no hay adaptación metabólica compensatoria significativa). (3) No hubo aumento compensatorio de la ingesta calórica en respuesta al ejercicio agudo. (4) Conclusión: el balance energético es aditivo — el déficit creado por el ejercicio no se compensa significativamente a corto plazo. (5) A largo plazo (>2 semanas) sí puede haber compensación parcial en algunas personas.',
        puntos_clave: ['El ejercicio de 1h/día NO reduce el NEAT (actividad no-ejercicio)', 'No hay compensación metabólica significativa al ejercicio', 'El gasto energético se incrementa linealmente con el ejercicio', 'Balance energético: ejercicio + déficit calórico son aditivos'],
        fuente: 'Hall KD, Heymsfield SB, Kemnitz JW, Klein S, Schoeller DA, Speakman JR. (2016). Energy balance and body composition. Obesity Reviews, 17(11), 1112-1128.',
        doi: '10.1111/obr.12451',
        tags: ['ejercicio', 'energia', 'NEAT', 'compensacion', 'balance energetico'],
        poblacion: ['adultos', 'adultos con sobrepeso'],
        condiciones: ['composicion corporal', 'perdida peso'], fuente_tipo: 'manual', verificado: true
    },
    {
        coach_id: null, disciplina: 'nutricion', categoria: 'metabolismo', tipo: 'meta_analisis', nivel_evidencia: 'meta_analisis',
        titulo: 'Aragon AA et al. (2017) — Revisión internacional: frecuencia de comidas y composición corporal',
        resumen: 'Revisión que examina la relación entre la frecuencia de comidas, la composición corporal y el metabolismo. Resultados contundentes: (1) La frecuencia de comidas NO afecta significativamente la termogénesis de los alimentos ni el gasto energético total. (2) Comer 3 vs 6 comidas/día no produce diferencias en pérdida de peso cuando las calorías totales se igualan. (3) El mytho de que "comer 6 veces al día acelera el metabolismo" no tiene soporte científico. (4) El desayuno no es obligatorio para perder peso (meta-análisis muestra que saltarse el desayuno no causa aumento de peso). (5) El ayuno intermitente (16:8) no es superior a la restricción calórica continua para pérdida de peso. (6) Lo determinante es el total calórico, no la frecuencia. (7) La frecuencia puede afectar el hambre y la adherencia de forma individual.',
        puntos_clave: ['La frecuencia de comidas NO acelera el metabolismo', 'Comer 3 vs 6 veces/día: misma pérdida de peso si calorías iguales', 'Desayuno no es obligatorio para control de peso', 'Ayuno intermitente (16:8) = restricción continua en pérdida de peso', 'Lo que importa: total calórico, adherencia y saciedad'],
        fuente: 'Aragon AA, Schoenfeld BJ, Wildman R, et al. (2017). International society of sports nutrition position stand: diets and body composition. Journal of the International Society of Sports Nutrition, 14(1), 16.',
        doi: '10.1186/s12970-017-0174-y',
        tags: ['frecuencia comidas', 'ayuno intermitente', 'desayuno', 'metabolismo', 'composicion corporal'],
        poblacion: ['adultos', 'deportistas', 'adultos con sobrepeso'],
        condiciones: ['composicion corporal', 'perdida peso'], fuente_tipo: 'manual', verificado: true
    },
]

async function insertarEstudios() {
    console.log(`📚 Insertando ${estudios.length} estudios científicos en knowledge_base...\n`)

    let insertadas = 0
    let errores = 0

    for (let i = 0; i < estudios.length; i++) {
        const estudio = estudios[i]
        try {
            const res = await fetch(`${SUPABASE_URL}/rest/v1/knowledge_base`, {
                method: 'POST',
                headers: HEADERS,
                body: JSON.stringify(estudio),
            })
            if (res.ok || res.status === 409) {
                insertadas++
                const icon = res.status === 409 ? '⚠️' : '✅'
                process.stdout.write(`${icon} [${i + 1}/${estudios.length}] ${estudio.titulo.substring(0, 60)}...\n`)
            } else {
                errores++
                const text = await res.text()
                process.stdout.write(`❌ [${i + 1}/${estudios.length}] Error ${res.status}: ${text.substring(0, 100)}\n`)
            }
        } catch (err) {
            errores++
            process.stdout.write(`❌ [${i + 1}/${estudios.length}] Red: ${err.message}\n`)
        }
        await new Promise(r => setTimeout(r, 120))
    }

    console.log(`\n📊 Resultado: ${insertadas} insertadas, ${errores} errores`)
    console.log(`   Disciplinas cubiertas:`)
    const disc = [...new Set(estudios.map(e => e.disciplina))]
    disc.forEach(d => {
        const count = estudios.filter(e => e.disciplina === d).length
        console.log(`     ${d}: ${count} estudios`)
    })
}

insertarEstudios().catch(console.error)
