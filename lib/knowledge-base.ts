// Base de conocimiento científica — selección dinámica por perfil cliente
// Los protocolos se inyectan en el prompt de DeepSeek según tags detectados del onboarding

export interface ProtocoloCientifico {
  id: string
  titulo: string
  tags: string[]           // detectados desde el perfil del cliente
  resumen: string          // bloque de texto inyectado en el prompt
  referencias: string[]    // citas para respaldo científico
}

// ──────────────────────────────────────────────────────────────
// BASE DE CONOCIMIENTO — 18 protocolos (15 originales + HTA, dislipemia, hígado graso)
// ──────────────────────────────────────────────────────────────

export const BASE_CONOCIMIENTO: ProtocoloCientifico[] = [
  {
    id: 'perdida_grasa',
    titulo: 'Pérdida de grasa con preservación muscular',
    tags: ['perder_grasa', 'deficit'],
    resumen: `PROTOCOLO PÉRDIDA DE GRASA:
- Déficit calórico: 300-500 kcal/día (moderado). Evitar déficit >500 kcal/día para preservar masa muscular (Trexler et al. 2014).
- Proteína alta: 2.2-2.6 g/kg para preservar músculo en restricción calórica (Helms et al. 2014).
- Distribución proteína: mínimo 4 comidas con ≥25g proteína cada una (leucine threshold, Norton & Layman).
- Carbohidratos: reducir sin eliminar. Priorizar timing peri-entreno (Aragon & Schoenfeld 2013).
- Grasas: mínimo 0.5-0.7 g/kg/día para función hormonal.
- Refeed semanal si déficit >4 semanas: 1 día en mantenimiento con CHO extra mejora leptina y adherencia.`,
    referencias: [
      'Trexler ET et al. Metabolic adaptation to weight loss. JISSN 2014.',
      'Helms ER et al. A systematic review of dietary protein during caloric restriction. JISSN 2014.',
      'Aragon AA, Schoenfeld BJ. Nutrient timing revisited. JISSN 2013.',
    ],
  },
  {
    id: 'ganancia_muscular',
    titulo: 'Hipertrofia y ganancia muscular',
    tags: ['ganar_musculo', 'hipertrofia', 'volumen'],
    resumen: `PROTOCOLO GANANCIA MUSCULAR:
- Superávit calórico mínimo efectivo: 200-300 kcal/día. Superávit mayor aumenta grasa sin acelerar músculo (Morton et al. 2018).
- Proteína: 1.6-2.2 g/kg (punto de saturación ~1.62 g/kg en meta-análisis Morton 2018 BJSM).
- Distribución en 4-5 comidas con fuente proteica ≥30g por toma (leucine threshold ~2-3g).
- CHO: prioritario para recargar glucógeno entre sesiones. 3-5 g/kg/día en días de entreno.
- Creatina monohidrato: 3-5g/día con evidencia A (Buford et al. JISSN 2007).
- Timing: proteína 0-2h post-entreno relevante; ventana anabólica flexible (no solo inmediata).`,
    referencias: [
      'Morton RW et al. A systematic review, meta-analysis and meta-regression of the effect of protein supplementation on RT-induced gains. BJSM 2018.',
      'Buford TW et al. International Society of Sports Nutrition position stand: creatine supplementation. JISSN 2007.',
    ],
  },
  {
    id: 'recomposicion',
    titulo: 'Recomposición corporal simultánea',
    tags: ['recomposicion'],
    resumen: `PROTOCOLO RECOMPOSICIÓN CORPORAL:
- Recomp simultánea posible en: principiantes, vuelta tras descanso, individuos con sobrepeso, atletas avanzados en déficit moderado con alta proteína (Barakat et al. 2020).
- Calorías: mantenimiento o déficit muy leve (-100 a -200 kcal).
- Proteína ELEVADA: 2.0-2.4 g/kg para maximizar señal anabólica en déficit.
- Timing crítico: CHO + proteína pre/post entreno (maximizar partición calórica).
- Paciencia: cambios visibles en 12-16 semanas. Evitar presionar déficit ante estancamiento báscula.
- Monitorizar: circunferencias + foto mensual, no solo peso.`,
    referencias: [
      'Barakat C et al. Body Recomposition: Can Trained Individuals Build Muscle and Lose Fat at the Same Time? Strength Cond J 2020.',
    ],
  },
  {
    id: 'rendimiento_atletico',
    titulo: 'Nutrición para rendimiento deportivo general',
    tags: ['rendimiento', 'atletismo', 'deporte', 'competicion'],
    resumen: `PROTOCOLO RENDIMIENTO DEPORTIVO:
- CHO es el sustrato predominante en ejercicio >60% VO2max. No restringir sin causa.
- Carga de CHO: 3-5 g/kg en días moderados, 6-10 g/kg en días de alta carga o competición (Burke ISSN 2011).
- Proteína: 1.6-1.8 g/kg en fases de carga normal; 2.0-2.2 en fases de déficit o lesión.
- Hidratación: ≥500ml 2h antes + 150-250ml/15-20min durante. Electrolitos en sesiones >60min.
- Recuperación: CHO+proteína en 30-60 min post-sesión intensa (Ivy et al.).
- Creatina: beneficio en deportes intermitentes de alta intensidad (evidencia A).`,
    referencias: [
      'Burke LM et al. Carbohydrates for training and competition. J Sports Sci 2011.',
      'Thomas DT et al. Position of the Academy of Nutrition and Dietetics, Dietitians of Canada, and ACSM: Nutrition and Athletic Performance. J Acad Nutr Diet 2016.',
    ],
  },
  {
    id: 'running_fondo',
    titulo: 'Nutrición para running y resistencia aeróbica',
    tags: ['running', 'fondo', 'maraton', 'trail', 'resistencia_aerobica'],
    resumen: `PROTOCOLO RUNNING / RESISTENCIA:
- CHO como combustible principal >70% VO2max. Fat adaptation en volúmenes bajos (<65% VO2max) pero perjudica economía de carrera en alta intensidad (Volek et al., Burke 2021).
- Carga competición (1-3 días antes): 8-10 g/kg CHO/día + sodio elevado.
- Geles/CHO en carrera: 30-60g CHO/hora en >60min; 90g/hora si son múltiples fuentes (glucosa+fructosa) en >2.5h.
- Proteína post-carrera larga: 0.3-0.4 g/kg inmediatos para reducir daño muscular.
- Hierro: vigilar en corredores (hemolisis por impacto). Analítica semestral.
- Electrolitos: sodio 500-700 mg/hora en carrera larga. Evitar hiponatremia.`,
    referencias: [
      'Burke LM et al. Low carbohydrate, high fat diet impairs exercise economy. J Physiol 2017.',
      'Jeukendrup AE. A step towards personalized sports nutrition. Sports Med 2014.',
    ],
  },
  {
    id: 'ciclismo_triatlon',
    titulo: 'Nutrición para ciclismo y triatlón',
    tags: ['ciclismo', 'triatlon', 'bici', 'ironman'],
    resumen: `PROTOCOLO CICLISMO / TRIATLÓN:
- Fueling en ruta: 60-90g CHO/hora (gel + bebida isotónica). Entrenamiento intestinal obligatorio en ironman.
- Bebida isotónica: 30-60g CHO + 500-700mg sodio/litro.
- Nutrición etapas: recuperación 30min post-segmento intenso (CHO+proteína). Protocolo "sleep low" opcional en base.
- Pre-race: desayuno CHO 3-4h antes (1-4g/kg), top-up gel 30min antes.
- Proteína diaria en fase competitiva: 1.6-2.0 g/kg.
- Cafeína: 3-6 mg/kg 60min antes mejora rendimiento (Spriet 2014). Límite 400mg/día.`,
    referencias: [
      'Friel J. The Triathlete\'s Training Bible. 4th ed. 2016.',
      'Spriet LL. Exercise and sport performance with low doses of caffeine. Sports Med 2014.',
    ],
  },
  {
    id: 'hyrox_crossfit',
    titulo: 'Nutrición para HYROX, CrossFit y deportes funcionales de alta intensidad',
    tags: ['hyrox', 'crossfit', 'funcional', 'hiit', 'wod'],
    resumen: `PROTOCOLO HYROX / CROSSFIT / FUNCIONAL:
- CHO intra-sesión: WODs >45min se benefician de 30-45g CHO durante. Especialmente en dobles.
- Carga semanal: 4-6 g/kg/día CHO en semanas de alto volumen; reducir en deload.
- Proteína: 2.0-2.4 g/kg por alta demanda glucolítica + remodelado muscular.
- Beta-alanina: 3.2-6.4g/día reduce acidosis muscular (Hobson et al. 2012). Útil para AMRAPs y chipper.
- Recuperación entre sesiones dobles: proteína 40g + CHO 1.2g/kg en <60min.
- Hidratación: mínimo 2.5L/día. Sesiones muy sudadas (+700ml/hora).`,
    referencias: [
      'Hobson RM et al. Effects of beta-alanine supplementation on exercise performance. Amino Acids 2012.',
      'Butts J et al. Creatine Use in Sports. Sports Health 2018.',
    ],
  },
  {
    id: 'fuerza_powerlifting',
    titulo: 'Nutrición para fuerza máxima y powerlifting',
    tags: ['fuerza', 'powerlifting', 'halterofilia', 'pesado'],
    resumen: `PROTOCOLO FUERZA MÁXIMA:
- Calorías: mantenimiento o superávit según fase. Corte de peso: déficit agresivo solo 4-6 semanas pre-competición.
- Proteína: 1.6-2.2 g/kg. No necesariamente >2.2 en fuerza pura (sin déficit calórico).
- Timing pre-entreno: CHO de bajo IG 2-3h antes + pequeño CHO rápido 30min antes de la sesión principal.
- Creatina: 3-5g/día. Mayor evidencia en esfuerzos cortos máximos (<30s). Carga opcional.
- Corte de peso rápido (<3 días): restricción sodio y CHO, no restricción hídrica extrema.
- Post-sesión: proteína 40-50g + CHO 1g/kg para reposición glucógeno.`,
    referencias: [
      'Schoenfeld BJ. The Mechanisms of Muscle Hypertrophy and Their Application to Resistance Training. J Strength Cond Res 2010.',
      'Buford TW et al. ISSN position stand: creatine supplementation. JISSN 2007.',
    ],
  },
  {
    id: 'diabetes_t2',
    titulo: 'Nutrición con diabetes tipo 2 o resistencia a insulina',
    tags: ['diabetes', 'diabetes_t2', 'resistencia_insulina', 'glucemia'],
    resumen: `PROTOCOLO DIABETES T2 / RESISTENCIA INSULINA:
- Índice glucémico: priorizar CHO de bajo IG (legumbres, avena, boniato, quinoa). Reducir refinados.
- Distribución CHO: pequeñas cantidades en cada comida. Evitar grandes cargas de CHO únicas.
- Timing ejercicio: actividad física post-comida (15-30min) reduce pico glucémico.
- Proteína: 1.2-1.6 g/kg. Alta proteína puede aumentar insulina pero no glucosa (beneficioso).
- Fibra: ≥25g/día (ralentiza absorción glucosa). Verduras en cada comida.
- Grasas: limitar saturadas. Omega-3 mejora sensibilidad insulina (Mori & Woodman 2006).
- Pérdida de peso: 5-10% del peso corporal mejora HbA1c y sensibilidad insulina significativamente.
- ⚠️ Derivar a médico/endocrino si toma medicación hipoglucemiante para ajuste de dosis.`,
    referencias: [
      'American Diabetes Association. Standards of Medical Care in Diabetes. Diabetes Care 2024.',
      'Mori TA, Woodman RJ. The independent effects of EPA and DHA on cardiovascular risk factors. Curr Opin Clin Nutr Metab Care 2006.',
    ],
  },
  {
    id: 'hipotiroidismo',
    titulo: 'Nutrición con hipotiroidismo',
    tags: ['hipotiroidismo', 'tiroides', 'hashimoto'],
    resumen: `PROTOCOLO HIPOTIROIDISMO:
- Metabolismo reducido: ajustar TDEE a la baja (-10-15%). Evitar déficits agresivos que bajen T3.
- Proteína elevada: 2.0-2.4 g/kg para contrarrestar tendencia catabólica y retención hídrica.
- Selenio: 55-200 mcg/día (nueces de Brasil, mariscos). Cofactor deiodinasa T4→T3 (Zimmermann & Köhrle 2002).
- Yodo: ni deficiencia ni exceso. 150-300 mcg/día de fuentes alimentarias (algas con moderación).
- Evitar bociógenos en exceso crudo: brócoli, col, berros, cacahuetes (crudos interfieren absorción yodo).
- Hierro: revisión frecuente. Hipotiroidismo autoinmune asociado a anemia.
- Timing medicación (levotiroxina): 30-60min antes del desayuno, sin calcio/hierro simultáneo.
- Vitamina D: frecuentemente baja en Hashimoto. Suplementar si <30 ng/ml.`,
    referencias: [
      'Zimmermann MB, Köhrle J. The impact of iron and selenium deficiencies on iodine and thyroid metabolism. Thyroid 2002.',
      'Ventura M et al. Selenium and thyroid disease: From pathophysiology to treatment. Int J Endocrinol 2017.',
    ],
  },
  {
    id: 'menopausia_pcos',
    titulo: 'Nutrición en menopausia y síndrome de ovario poliquístico (SOP)',
    tags: ['menopausia', 'pcos', 'sop', 'climaterio', 'perimenopausia'],
    resumen: `PROTOCOLO MENOPAUSIA / SOP:
- Resistencia a insulina (SOP): igual que protocolo diabetes T2 — bajo IG, fibra alta, CHO distribuidos.
- Calcio: 1200-1500 mg/día (menopausia). Fuentes: lácteos, sardinas con espina, tofu cálcico, almendras.
- Vitamina D: 1500-2000 UI/día para absorción calcio y salud ósea (OMS).
- Proteína alta: 2.0 g/kg para contrarrestar sarcopenia acelerada post-menopausia.
- Fitoestrógenos (SOP/menopausia): soja, lino, legumbres. Evidencia moderada en síntomas vasomotores.
- Omega-3: reduce inflamación y mejora resistencia insulina (SOP).
- Hierro post-menopausia: necesidades menores. Monitorizar ferritina si hay suplementación.
- Ejercicio de fuerza: imprescindible para densidad ósea y sensibilidad insulina. Orientar el plan de entreno.`,
    referencias: [
      'The Menopause Society. Hormone Therapy Position Statement. Menopause 2022.',
      'Moran LJ et al. Dietary composition in restoring reproductive and metabolic physiology in overweight women with PCOS. J Clin Endocrinol Metab 2003.',
    ],
  },
  {
    id: 'vegetariano_vegano',
    titulo: 'Nutrición vegetariana y vegana',
    tags: ['vegetariano', 'vegano', 'plant_based', 'sin_carne'],
    resumen: `PROTOCOLO VEGETARIANO / VEGANO:
- Proteína: 10-20% más que omnívoros para compensar menor digestibilidad (PDCAAS). Target 1.8-2.2 g/kg.
- Fuentes proteicas completas: soja/edamame/tempeh (único vegetal con perfil AA completo), combinación legumbre+cereal.
- B12: OBLIGATORIA suplementación en veganos (2000 mcg/semana o 50-100 mcg/día cianocobalamina).
- Hierro no hemo: absorción 2-3x menor. Consumir con vitamina C. Evitar café/té con la comida.
- Zinc: biodisponibilidad menor. Remojar legumbres (reduce fitatos). Target 15-20 mg/día.
- Omega-3: ALA no se convierte eficientemente en EPA/DHA. Suplementar con algas DHA (250-500 mg/día).
- Calcio vegano: brócoli, col rizada, tahini, leches vegetales enriquecidas. Mínimo 1000 mg/día.
- Creatina: no presente en alimentos vegetales. Suplementar 3-5g/día mejora más que en omnívoros.`,
    referencias: [
      'Rogerson D. Vegan diets: practical advice for athletes and exercisers. J Int Soc Sports Nutr 2017.',
      'Melina V et al. Position of the Academy of Nutrition and Dietetics: Vegetarian Diets. J Acad Nutr Diet 2016.',
    ],
  },
  {
    id: 'sarcopenia_mayores',
    titulo: 'Nutrición en adultos mayores y prevención de sarcopenia',
    tags: ['mayor_55', 'sarcopenia', 'envejecimiento', 'tercera_edad'],
    resumen: `PROTOCOLO SARCOPENIA / ADULTOS MAYORES:
- Proteína: 1.6-2.0 g/kg (más alta que adultos jóvenes por resistencia anabólica).
- Leucina threshold aumentado: necesitan ≥2.5-3g leucina/toma para activar síntesis proteica (Katsanos et al.).
- Distribución: 4-5 tomas con ≥30-40g proteína cada una. Evitar toma única alta (limitación absorción).
- Vitamina D: 2000-4000 UI/día. Deficiencia prevalente >65 años. Crítica para función muscular y ósea.
- Calcio: 1200-1500 mg/día. Combinado con vitamina D reduce caídas y fracturas (Bischoff-Ferrari 2009).
- CHO y grasas: adaptar al nivel de actividad. No restringir CHO sin motivo en mayores activos.
- Hidratación: mecanismo de sed reducido. Promover 8-10 vasos/día activamente.
- Creatina: evidencia creciente en sarcopenia. 3-5g/día combinado con resistencia (Brose et al. 2003).`,
    referencias: [
      'Katsanos CS et al. A high proportion of leucine is required for optimal stimulation of the rate of muscle protein synthesis by essential amino acids. Am J Physiol 2006.',
      'Bischoff-Ferrari HA et al. Prevention of nonvertebral fractures with oral vitamin D and dose dependency. Arch Intern Med 2009.',
    ],
  },
  {
    id: 'amateur_recreacional',
    titulo: 'Nutrición para deportista amateur y salud general',
    tags: ['salud_general', 'mantenimiento', 'amateur', 'recreacional', 'bienestar'],
    resumen: `PROTOCOLO DEPORTISTA AMATEUR / SALUD GENERAL:
- Calorías: equilibrio energético o leve déficit/superávit según objetivo secundario.
- Proteína: 1.2-1.6 g/kg/día. Suficiente para mantenimiento y recuperación sin exigencia de élite.
- Estilo mediterráneo: evidencia robusta en longevidad, marcadores inflamatorios y adherencia (PREDIMED 2013).
- CHO: 3-5 g/kg en días activos. No restringir. Cereales integrales, fruta, legumbres.
- Grasas saludables: aceite oliva virgen extra, nueces, aguacate, pescado azul 2-3x/semana.
- Fibra: 25-35g/día (salud intestinal + saciedad + glucemia).
- Alcohol: evidencia clara de daño >1 bebida/día. No tiene efecto protector cardiovascular real.
- Prioridad de adherencia: el mejor plan es el que el cliente puede mantener consistentemente.`,
    referencias: [
      'Estruch R et al. Primary prevention of cardiovascular disease with a Mediterranean diet. NEJM 2013 (PREDIMED).',
      'Thomas DT et al. Position of the Academy of Nutrition and Dietetics, Dietitians of Canada, and ACSM. J Acad Nutr Diet 2016.',
    ],
  },
  {
    id: 'hta_hipertension',
    titulo: 'Hipertensión arterial y salud cardiovascular',
    tags: ['hta', 'hipertension', 'presion_alta', 'cardiovascular', 'tension_alta'],
    resumen: `PROTOCOLO HIPERTENSIÓN ARTERIAL:
- REDUCCIÓN DE SODIO: prioridad absoluta. Objetivo < 1500-2000 mg/día (DASH-Sodium Trial, NEJM 1997; Sacks et al. 2001).
- AUMENTO DE POTASIO: > 3500 mg/día. Fuentes: frutas, verduras de hoja verde, legumbres, boniato, plátano, aguacate.
- DIETA DASH: rica en frutas, verduras, lácteos desnatados, cereales integrales, proteína magra. Reduce PA sistólica 8-14 mmHg.
- PESO: cada kg perdido reduce PA ~1-1.5 mmHg. Objetivo pérdida 5-10% si sobrepeso.
- ALCOHOL: limitar ≤1 bebida/día (mujeres), ≤2 (hombres). Reducción directa de PA.
- MAGNESIO: > 300 mg/día de fuentes dietéticas. Relación inversa con PA en meta-análisis.
- OMEGA-3: EPA+DHA > 2g/semana. Pescado azul 2-3 raciones/semana. Efecto vasodilatador.
- EVITAR: embutidos, conservas saladas, snacks salados, quesos curados, pan industrial, salsas comerciales, platos preparados.
- CAFEÍNA: si consume café, limitar a 2-3 tazas/día. No efecto negativo crónico en consumidores habituales.
- ⚠️ Interacción medicación: diuréticos (riesgo hipopotasemia), IECA/ARAII (vigilar potasio si función renal alterada). Derivar a nefrólogo si ERC.`,
    referencias: [
      'Sacks FM et al. DASH-Sodium Collaborative Research Group. Effects on blood pressure of reduced dietary sodium and the DASH diet. NEJM 2001.',
      'Appel LJ et al. A clinical trial of the effects of dietary patterns on blood pressure. NEJM 1997 (DASH).',
      'Whelton PK et al. 2017 ACC/AHA Guideline for the Prevention, Detection, Evaluation, and Management of High Blood Pressure. Hypertension 2018.',
      'Filippou CD et al. Dietary approaches to stop hypertension (DASH) diet and blood pressure reduction in adults. Adv Nutr 2021.',
    ],
  },
  {
    id: 'dislipemia',
    titulo: 'Dislipemia y perfil lipídico',
    tags: ['colesterol', 'dislipemia', 'ldl', 'trigliceridos', 'hipercolesterolemia'],
    resumen: `PROTOCOLO DISLIPEMIA:
- GRASA SATURADA: reducir a < 7% de calorías totales. Limitar carnes rojas grasas, lácteos enteros, aceite de palma/coco, ultraprocesados.
- GRASA INSATURADA: aumentar. Aceite oliva virgen extra (AOVE 30-40g/día), frutos secos (30g/día), aguacate.
- OMEGA-3: EPA+DHA 2-4g/día para reducción de triglicéridos (30-50%). Pescado azul 3-4 raciones/semana o suplemento.
- FIBRA SOLUBLE: avena, legumbres, manzana, psyllium, berenjena. Reduce LDL 5-15% (Brown et al. 1999).
- FITOESTEROLES: 2g/día reduce LDL 8-10%. Presentes en algunos lácteos enriquecidos.
- EJERCICIO: mejora perfil lipídico (↑HDL, ↓triglicéridos). Entreno aeróbico + fuerza óptimo.
- ALCOHOL: si consume, moderado (≤1-2 bebidas/día). El HDL sube pero no compensa otros riesgos.
- CARBOHIDRATOS REFINADOS: limitar, se asocian a ↑triglicéridos. Priorizar cereales integrales y legumbres.
- ⚠️ Interacción estatinas: evitar pomelo/toronja (inhibe CYP3A4). Coenzima Q10 podría mitigar mialgias.`,
    referencias: [
      'Brown L et al. Cholesterol-lowering effects of dietary fiber: a meta-analysis. Am J Clin Nutr 1999.',
      'Jacobson TA et al. National Lipid Association recommendations for patient-centered management of dyslipidemia. J Clin Lipidol 2015.',
      'Estruch R et al. Primary prevention of cardiovascular disease with a Mediterranean diet. NEJM 2013 (PREDIMED).',
    ],
  },
  {
    id: 'higado_graso_nafld',
    titulo: 'Enfermedad del hígado graso no alcohólico (NAFLD/MAFLD)',
    tags: ['higado_graso', 'nafld', 'mafl', 'higado', 'transaminasas', 'esteatosis'],
    resumen: `PROTOCOLO HÍGADO GRASO / NAFLD:
- PÉRDIDA DE PESO: > 5% del peso corporal reduce esteatosis > 30% (Vilar-Gomez et al. 2015). >10% mejora inflamación y fibrosis.
- DIETA MEDITERRÁNEA: evidencia A para reducción de grasa hepática (PREDIMED).
- AZÚCARES AÑADIDOS Y FRUCTOSA: eliminar. La fructosa (especialmente en bebidas azucaradas, zumos y ultraprocesados) se metaboliza en hígado y promueve lipogénesis de novo.
- CARBOHIDRATOS: moderados, de bajo IG. Evitar grandes cargas de CHO refinado.
- GRASA SATURADA: limitar < 10% kcal. Priorizar AOVE como fuente grasa principal.
- CAFÉ: 2-3 tazas/día asociado a menor riesgo de fibrosis hepática (evidencia epidemiológica consistente).
- VITAMINA E: 800 UI/día puede mejorar histología en NASH confirmado por biopsia (PIVENS trial). NO recomendar sin supervisión médica.
- EJERCICIO: aeróbico + fuerza 3-5 días/semana. Reduce grasa hepática incluso sin pérdida de peso significativa.
- ALCOHOL: idealmente 0. Si es posible, limitar drásticamente.`,
    referencias: [
      'Vilar-Gomez E et al. Weight loss through lifestyle modification significantly reduces features of nonalcoholic steatohepatitis. Gastroenterology 2015.',
      'Sanyal AJ et al. Pioglitazone, vitamin E, or placebo for nonalcoholic steatohepatitis (PIVENS). NEJM 2010.',
      'Romero-Gómez M et al. NAFLD and MAFLD: What Is New in Diagnosis and Classification? J Hepatol 2020.',
    ],
  },
]

// ──────────────────────────────────────────────────────────────
// Normalización de valores del perfil → tags
// ──────────────────────────────────────────────────────────────

const TAG_OBJETIVO: Record<string, string[]> = {
  perder_grasa: ['perder_grasa', 'deficit'],
  ganar_musculo: ['ganar_musculo', 'hipertrofia'],
  recomposicion: ['recomposicion'],
  mantenimiento: ['mantenimiento', 'salud_general'],
  rendimiento: ['rendimiento', 'atletismo'],
}

const TAG_ENTRENO: Record<string, string[]> = {
  running: ['running', 'fondo', 'resistencia_aerobica'],
  maraton: ['running', 'fondo', 'maraton'],
  trail: ['running', 'fondo', 'trail'],
  ciclismo: ['ciclismo'],
  triatlon: ['ciclismo', 'triatlon'],
  crossfit: ['crossfit', 'funcional', 'hiit', 'wod'],
  hyrox: ['hyrox', 'funcional'],
  powerlifting: ['fuerza', 'powerlifting'],
  halterofilia: ['fuerza', 'halterofilia'],
  fuerza: ['fuerza'],
  gym: ['fuerza', 'hipertrofia'],
  hiit: ['hiit', 'funcional'],
  natacion: ['rendimiento', 'resistencia_aerobica'],
  deporte_equipo: ['rendimiento', 'atletismo'],
}

// ──────────────────────────────────────────────────────────────
// Tipo minimal del perfil que se recibe desde el onboarding
// ──────────────────────────────────────────────────────────────

export interface PerfilClienteKB {
  objetivo?: string | null
  tipo_entreno?: string | null
  condiciones_salud?: string | null    // texto libre del onboarding
  restricciones_alimentarias?: string | null
  edad?: number | null
  sexo?: 'hombre' | 'mujer' | 'otro' | null
}

// ──────────────────────────────────────────────────────────────
// Función principal: detectar tags del perfil
// ──────────────────────────────────────────────────────────────

function detectarTags(perfil: PerfilClienteKB): Set<string> {
  const tags = new Set<string>()

  // Objetivo
  if (perfil.objetivo) {
    const normalized = perfil.objetivo.toLowerCase().trim()
    const t = TAG_OBJETIVO[normalized] ?? ['salud_general']
    t.forEach(tag => tags.add(tag))
  }

  // Tipo de entreno
  if (perfil.tipo_entreno) {
    const normalized = perfil.tipo_entreno.toLowerCase().trim()
    for (const [key, vals] of Object.entries(TAG_ENTRENO)) {
      if (normalized.includes(key)) {
        vals.forEach(tag => tags.add(tag))
      }
    }
  }

  // Condiciones de salud (texto libre — busca keywords)
  if (perfil.condiciones_salud) {
    const texto = perfil.condiciones_salud.toLowerCase()
    if (texto.includes('diabet') || texto.includes('glucemia') || texto.includes('insulina')) {
      tags.add('diabetes').add('resistencia_insulina').add('glucemia')
    }
    if (texto.includes('tiroides') || texto.includes('hipotiroid') || texto.includes('hashimoto')) {
      tags.add('hipotiroidismo').add('tiroides')
    }
    if (texto.includes('sop') || texto.includes('ovario poliq') || texto.includes('pcos')) {
      tags.add('pcos').add('sop')
    }
    if (texto.includes('menop') || texto.includes('climaterio') || texto.includes('perimen')) {
      tags.add('menopausia').add('climaterio')
    }
    if (texto.includes('hipertens') || texto.includes('hta') || texto.includes('presion alta') || texto.includes('tension alta') || texto.includes('colesterol') || texto.includes('dislipemia') || texto.includes('hipercolesterole') || texto.includes('trigliceridos')) {
      tags.add('hta').add('hipertension').add('presion_alta').add('cardiovascular')
    }
    if (texto.includes('higado graso') || texto.includes('hígado graso') || texto.includes('nafld') || texto.includes('esteatosis') || texto.includes('transaminasas')) {
      tags.add('higado_graso').add('nafld').add('esteatosis')
    }
    if (texto.includes('ansiedad') || texto.includes('depresion') || texto.includes('depresión') || texto.includes('salud mental')) {
      tags.add('ansiedad').add('salud_mental')
    }
  }

  // Restricciones alimentarias
  if (perfil.restricciones_alimentarias) {
    const texto = perfil.restricciones_alimentarias.toLowerCase()
    if (texto.includes('vegano') || texto.includes('vegan')) {
      tags.add('vegano').add('plant_based')
    }
    if (texto.includes('vegetariano') || texto.includes('vegetarian')) {
      tags.add('vegetariano').add('plant_based')
    }
  }

  // Edad
  if (perfil.edad && perfil.edad >= 55) {
    tags.add('mayor_55')
    if (perfil.edad >= 65) tags.add('sarcopenia').add('envejecimiento')
  }

  return tags
}

// ──────────────────────────────────────────────────────────────
// Selección de protocolos relevantes (top 5 por score de tags)
// ──────────────────────────────────────────────────────────────

export function seleccionarProtocolos(
  perfil: PerfilClienteKB,
  limite: number = 5
): ProtocoloCientifico[] {
  const tagsCliente = detectarTags(perfil)

  if (tagsCliente.size === 0) {
    // Sin tags → protocolo general de salud
    return BASE_CONOCIMIENTO.filter(p => p.tags.includes('salud_general')).slice(0, 1)
  }

  const scored = BASE_CONOCIMIENTO.map(protocolo => {
    const matches = protocolo.tags.filter(t => tagsCliente.has(t)).length
    return { protocolo, score: matches }
  })

  return scored
    .filter(s => s.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limite)
    .map(s => s.protocolo)
}

// ──────────────────────────────────────────────────────────────
// Formatea los protocolos seleccionados como bloque de texto
// para inyectar en el prompt de DeepSeek
// ──────────────────────────────────────────────────────────────

export function formatearEvidenciaParaPrompt(protocolos: ProtocoloCientifico[]): string {
  if (protocolos.length === 0) return ''

  const bloques = protocolos.map(p => {
    const refs = p.referencias.map(r => `  • ${r}`).join('\n')
    return `### ${p.titulo}\n${p.resumen}\n\nReferencias:\n${refs}`
  })

  return `
== EVIDENCIA CIENTÍFICA APLICABLE A ESTE CLIENTE ==
${bloques.join('\n\n---\n\n')}
== FIN EVIDENCIA ==
`.trim()
}
