// Base de conocimiento científica — selección dinámica por perfil cliente
// Los protocolos se inyectan en el prompt de DeepSeek según tags detectados del onboarding
//
// ARQUITECTURA (Fase 1 — Unificación Knowledge Base):
//   1. consultarKnowledgeDB() — consulta Supabase knowledge_base por tags y condiciones
//   2. seleccionarProtocolos() — async, intenta DB primero, fallback a BASE_CONOCIMIENTO
//   3. BASE_CONOCIMIENTO — 18 protocolos hardcodeados como fallback si DB vacía o sin conexión

import { SupabaseClient } from '@supabase/supabase-js'

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
// TAG BRIDGE — Puente entre tags del perfil cliente y tags de papers PubMed
// Los papers tienen tags en español natural (ej: "perdida grasa", "deficit calorico")
// mientras que el perfil cliente usa tags normalizados (ej: "perder_grasa", "deficit")
// Este mapa expande cada tag cliente a sus equivalentes semánticos en KB.
// ──────────────────────────────────────────────────────────────

export const TAG_BRIDGE: Record<string, string[]> = {
  // Objetivos corporales
  perder_grasa: ['perdida grasa', 'deficit calorico', 'composicion corporal', 'obesidad', 'grasa', 'balance energetico', 'NEAT', 'ayuno intermitente', 'compensacion', 'frecuencia comidas'],
  deficit: ['deficit calorico', 'perdida grasa', 'restriccion calorica', 'deficit energetico', 'conservacion muscular'],
  ganar_musculo: ['hipertrofia', 'masa muscular', 'sintesis muscular', 'proteina', 'volumen', 'mTOR', 'leucina', 'MPS', 'sintesis_proteica', 'aminoacidos_ramificados', 'sintesis_proteica_muscular'],
  hipertrofia: ['hipertrofia', 'masa muscular', 'sintesis muscular', 'proteina', 'mTOR', 'entrenamiento_fuerza', 'leucina', 'sintesis_proteica'],
  volumen: ['volumen', 'hipertrofia', 'masa muscular', 'dosis-respuesta', 'sobrecarga', 'series', 'frecuencia', 'dosis'],
  recomposicion: ['composicion corporal', 'perdida grasa', 'hipertrofia', 'composicion_corporal'],
  mantenimiento: ['mantenimiento', 'nutricion deportiva', 'proteina', 'carbohidratos', 'hidratacion', 'macronutrientes'],
  salud_general: ['salud cardiovascular', 'nutricion', 'dieta mediterranea', 'prevencion', 'bienestar', 'ejercicio', 'adherencia', 'cambio de comportamiento', 'educacion nutricional', 'cambio de conducta', 'fibra', 'salud publica'],

  // Rendimiento / deporte
  rendimiento: ['rendimiento', 'rendimiento_deportivo', 'rendimiento_resistencia', 'rendimiento_carrera', 'atletas', 'nutricion deportiva', 'glucogeno', 'timing', 'pre-entreno', 'post-entreno', 'ergogenico', 'energia', 'macros', 'recomendaciones'],
  atletismo: ['rendimiento', 'atletas', 'competicion', 'rendimiento_deportivo'],
  deporte: ['rendimiento', 'ejercicio', 'atletas', 'rendimiento deportivo', 'ejercicio_fisico'],
  competicion: ['competicion', 'rendimiento', 'atletas', 'elite'],

  // Running / resistencia
  running: ['running', 'zona2', 'rendimiento_resistencia', 'intensidad', 'zona de entrenamiento', 'kilometraje', 'carga', 'VO2max', 'maraton', 'aeróbico', 'base aeróbica', 'amateur', 'corredores_entrenados'],
  fondo: ['zona2', 'aeróbico', 'base aeróbica', 'resistencia', 'kilometraje', 'carga', 'zona3'],
  maraton: ['running', 'resistencia', 'kilometraje', 'zona2', 'carga', 'maraton'],
  trail: ['running', 'resistencia', 'trail'],
  resistencia_aerobica: ['resistencia', 'aeróbico', 'zona2', 'umbral', 'ejercicio_resistencia', 'VO2max', 'entrenamiento_aerobico'],

  // Hyrox / Crossfit / funcional
  hyrox: ['hyrox', 'hibrido', 'fuerza', 'intensidad', 'zona2', 'funcional', 'wod', 'interferencia', 'compatibilidad', 'concurrente', 'crossfit', 'distribucion', 'distribución'],
  crossfit: ['hyrox', 'hibrido', 'fuerza', 'intensidad', 'funcional', 'wod', 'interferencia', 'compatibilidad', 'crossfit'],
  funcional: ['hibrido', 'fuerza', 'intensidad', 'interferencia', 'compatibilidad'],
  hiit: ['hiit', 'intensidad', 'polarizado', '80/20', 'entrenamiento_intervalico', 'entrenamiento_intervalico_alta_intensidad'],
  wod: ['hyrox', 'hibrido', 'fuerza', 'intensidad', 'wod'],

  // Fuerza / powerlifting
  fuerza: ['fuerza', 'entrenamiento_fuerza', 'series', 'fallo muscular', 'RPE', 'RIR', 'dosis-respuesta', 'sobrecarga', 'intensidad', 'carga', 'RM', 'dosis', 'ejercicio_resistencia', 'fallo', 'repeticiones', 'pesas', 'progresion', 'entrenamiento_de_fuerza'],
  powerlifting: ['fuerza', 'entrenamiento_fuerza', 'series', 'sentadilla', 'potencia', 'sentadillas', 'RM', 'repeticiones'],
  halterofilia: ['fuerza', 'potencia', 'entrenamiento_fuerza'],
  potencia: ['potencia', 'fuerza', 'dosis-respuesta', 'entrenamiento_fuerza', 'velocidad'],

  // Nivel / experiencia
  amateur: ['amateur', 'principiante', 'recreacional'],
  recreacional: ['amateur', 'principiante', 'recreacional'],
  principiante: ['amateur', 'principiante'],
  elite: ['atletas', 'competicion', 'rendimiento_deportivo', 'elite'],

  // Condiciones metabólicas / salud
  diabetes: ['diabetes', 'diabetes tipo 2', 'insulina', 'glucemia', 'hemoglobina glicosilada', 'HbA1c', 'diabetes mellitus', 'diabetes tipo 1', 'diabetes_t2', 'prediabetes', 'control glucemico', 'glucosa_intersticial', 'hipoglucemia', 'gliclazida'],
  resistencia_insulina: ['resistencia a la insulina', 'insulina', 'diabetes tipo 2', 'diabetes', 'HOMA-IR', 'glucemia', 'resistencia_insulina', 'prediabetes', 'glp-1'],
  glucemia: ['glucemia', 'insulina', 'diabetes', 'diabetes tipo 2', 'HbA1c', 'control glucemico', 'glucosa_intersticial', 'indice_glucemico'],

  // Tiroides — EXPANDIDO con nuevas fuentes clínicas PubMed
  hipotiroidismo: ['tiroides', 'hormonas', 'metabolismo', 'mujeres', 'hipotiroidismo', 'hashimoto', 'TSH', 'tiroxina', 'funcion_tiroidea', 'disfuncion_tiroidea', 'nutrientes_tiroideos', 'disfuncion tiroidea', 'metabolismo_energetico', 'autoimmunidad', 'morfologia_tiroidea'],
  tiroides: ['tiroides', 'hormonas', 'metabolismo', 'TSH', 'hipotiroidismo', 'hashimoto', 'funcion_tiroidea', 'disfuncion_tiroidea'],

  // PCOS / SOP / Menopausia — EXPANDIDO con nuevas fuentes clínicas PubMed
  pcos: ['hormonas', 'mujeres', 'insulina', 'sop', 'SOP', 'ovario poliquistico', 'sindrome metabolico', 'testosterona', 'sindrome_ovario_poliquistico', 'morfologia_ovarica', 'salud_femenina', 'glp-1'],
  sop: ['sop', 'hormonas', 'mujeres', 'insulina', 'pcos', 'ovario poliquistico', 'sindrome metabolico', 'sindrome_ovario_poliquistico', 'salud_femenina', 'testosterona'],
  menopausia: ['mujeres', 'hormonas', 'salud osea', 'tercera edad', 'menopausia', 'estrogenos', 'osteoporosis', 'densidad osea', 'mujeres_posmenopausicas', 'salud_femenina', 'metabolismo_oseo', 'homocisteina', 'densidad_mineral_osea', 'densidad_osea', 'fracturas_osteoporoticas', 'perimenopausia', 'dimorfismo_sexual', 'depresion'],
  climaterio: ['mujeres', 'hormonas', 'salud osea', 'menopausia', 'estrogenos', 'climaterio', 'perimenopausia'],

  // Edad / sarcopenia
  sarcopenia: ['sarcopenia', 'adultos_mayores', 'masa muscular', 'proteina', 'sintesis muscular', 'envejecimiento', 'tercera edad', 'calidad muscular', 'fuerza muscular', 'leucina', 'MPS', 'sintesis_proteica', 'funcion_fisica', 'adultos_mediana_edad', 'calidad_de_vida'],
  envejecimiento: ['adultos_mayores', 'sarcopenia', 'envejecimiento', 'tercera edad', 'longevidad', 'calidad de vida', 'funcion_fisica', 'adultos_mediana_edad'],
  mayor_55: ['adultos_mayores', 'sarcopenia', 'envejecimiento', 'tercera edad', 'fuerza muscular', 'deterioro funcional', 'funcion_fisica'],

  // Cardiovascular / HTA
  hta: ['hipertension', 'salud cardiovascular', 'enfermedad cardiovascular', 'sodio', 'presion arterial', 'riesgo cardiovascular', 'dieta DASH', 'medicion presion arterial', 'dispositivos oscilometricos', 'monitoreo ambulatorio', 'monitorizacion ambulatoria'],
  hipertension: ['hipertension', 'salud cardiovascular', 'enfermedad cardiovascular', 'sodio', 'presion arterial', 'riesgo cardiovascular', 'dieta DASH', 'tension_alta', 'medicion presion arterial', 'dispositivos oscilometricos', 'monitorizacion ambulatoria'],
  presion_alta: ['hipertension', 'salud cardiovascular', 'presion arterial', 'tension_alta', 'riesgo cardiovascular', 'medicion presion arterial'],
  cardiovascular: ['salud cardiovascular', 'enfermedad cardiovascular', 'riesgo cardiovascular', 'prevencion cardiovascular', 'dieta mediterranea', 'medicion presion arterial', 'monitorizacion ambulatoria', 'fibrilacion_auricular', 'ictus', 'hemodinamica_cerebral'],

  // Colesterol / dislipemia
  dislipemia: ['colesterol', 'grasas saludables', 'omega-3', 'enfermedad cardiovascular', 'dieta mediterranea', 'trigliceridos', 'LDL', 'HDL', 'perfil lipidico', 'hipercolesterolemia', 'colesterol'],
  colesterol: ['colesterol', 'grasas saludables', 'omega-3', 'enfermedad cardiovascular', 'dieta mediterranea', 'LDL', 'HDL', 'trigliceridos', 'dislipemia', 'perfil lipidico', 'hipercolesterolemia'],

  // Hígado graso
  higado_graso: ['obesidad', 'metabolismo', 'dieta mediterranea', 'higado', 'esteatosis hepatica', 'NAFLD', 'transaminasas', 'resistencia insulina', 'higado_graso', 'mafl', 'enfermedad cronica'],
  nafld: ['obesidad', 'metabolismo', 'dieta mediterranea', 'higado', 'esteatosis hepatica', 'transaminasas', 'NAFLD', 'mafl', 'higado_graso'],
  esteatosis: ['obesidad', 'metabolismo', 'higado', 'esteatosis hepatica', 'transaminasas', 'NAFLD', 'higado_graso'],

  // Salud mental
  ansiedad: ['salud mental', 'bienestar', 'HRV', 'sueño', 'cortisol', 'estres', 'estrés', 'neurotransmisores', 'depresion', 'estado de animo', 'bienestar_psicologico', 'depresion_perinatal', 'depresion_prenatal', 'eventos_vitales'],
  salud_mental: ['salud mental', 'bienestar', 'cortisol', 'HRV', 'depresion', 'ansiedad', 'estres', 'neurotransmisores', 'bienestar_psicologico', 'depresion_perinatal'],
  estres: ['cortisol', 'HRV', 'salud mental', 'estres', 'bienestar', 'sueño', 'recuperacion', 'variabilidad_frecuencia_cardiaca'],
  sueno: ['sueño', 'cortisol', 'recuperacion', 'HRV', 'salud mental', 'cronobiologia', 'ritmo circadiano', 'privacion_sueno', 'higiene del sueño', 'siesta'],

  // Dieta / alimentación
  vegano: ['vegetariano', 'veganismo', 'plant-based', 'proteina vegetal', 'sin_carne', 'vegetales', 'biodisponibilidad', 'dieta basada en plantas', 'hierro', 'vitamina b12', 'dieta_vegana', 'proteina_vegetal'],
  vegetariano: ['vegetariano', 'veganismo', 'plant-based', 'proteina vegetal', 'sin_carne', 'vegetales', 'biodisponibilidad', 'dieta basada en plantas', 'dieta_vegana', 'proteina_vegetal'],
  plant_based: ['vegetariano', 'veganismo', 'plant-based', 'proteina vegetal', 'vegetales', 'dieta basada en plantas', 'proteina_vegetal'],
  vegetales: ['vegetales', 'verduras', 'fibra', 'dieta mediterranea', 'plant-based', 'dieta basada en plantas', 'frutas'],

  // Obesidad / composición
  obesidad: ['obesidad', 'IMC', 'composicion corporal', 'perdida grasa', 'deficit calorico', 'sobrepeso', 'tejido adiposo', 'sindrome metabolico', 'grasa visceral', 'circunferencia cintura', 'perdida peso', 'perdida_de_peso', 'control_peso', 'reduccion_peso', 'peso_corporal', 'tejido_adiposo_visceral', 'balance energetico', 'compensacion'],

  // Suplementación general
  suplementos: ['suplementacion', 'suplementos', 'creatina', 'cafeina', 'beta-alanina', 'proteina suero', 'whey', 'suplementacion_deportiva', 'suplementacion_proteica', 'suplementos_proteicos', 'ISSN'],
  creatina: ['creatina', 'fuerza', 'suplementacion', 'masa muscular', 'rendimiento', 'hmb', 'suplementacion_deportiva'],
  cafeina: ['cafeina', 'rendimiento', 'estimulante', 'fatiga', 'concentracion', 'ergogenico'],
  proteina_suplementos: ['proteina', 'whey', 'proteina suero', 'suplementacion proteica', 'leucina', 'mTOR', 'biodisponibilidad', 'proteina_de_suero', 'proteina_suero', 'proteina_vegetal', 'proteina_animal', 'suplementacion_proteica'],

  // Running y ciclismo avanzado
  ciclismo: ['ciclismo', 'rendimiento', 'resistencia', 'aeróbico', 'umbral', 'potencia', 'VO2max', 'ciclismo'],
  triatlon: ['triatlon', 'rendimiento', 'resistencia', 'rendimiento_resistencia', 'carga', 'VO2max', 'recuperacion', 'natacion'],
  bici: ['ciclismo', 'rendimiento', 'resistencia', 'potencia'],
  ironman: ['ironman', 'rendimiento', 'resistencia', 'hidratacion', 'sodio', 'carga de carbohidratos', 'ultra-resistencia', 'sodio'],

  // Natación / deportes acuáticos
  natacion: ['rendimiento', 'resistencia', 'aeróbico', 'VO2max', 'natacion'],

  // Lesiones / rehabilitación
  lesiones: ['lesiones', 'recuperacion', 'rehabilitacion', 'prevencion', 'dolor', 'inflamacion', 'proteina', 'dolor_persistente', 'lesion_musculoesqueletica', 'antiinflamatorio', 'dolor_lumbar', 'prevencion'],
  recuperacion: ['recuperacion', 'descanso', 'sueño', 'cortisol', 'HRV', 'inflamacion', 'nutricion deportiva', 'fisioterapia', 'DOMS', 'agua fria', 'recuperacion activa', 'masaje', 'compresion', 'recuperacion_muscular', 'calidad_de_vida', 'variabilidad_frecuencia_cardiaca', 'variabilidad FC'],
  rehabilitacion: ['lesiones', 'recuperacion', 'rehabilitacion', 'proteina', 'sintesis muscular', 'calidad muscular', 'funcion_fisica', 'dolor_persistente'],

  // Deportes de equipo
  deporte_equipo: ['rendimiento', 'deporte', 'ejercicio', 'competicion', 'intensidad', 'carga global', 'cambio_de_direccion', 'velocidad', 'futbol', 'futbol_femenino', 'futbol_sala_femenino'],

  // Nutrición general — nuevos bridges para conceptos transversales
  hidratacion: ['hidratacion', 'sodio', 'isotonica', 'hiponatremia', 'sudor', 'deshidratacion', 'calor_humedad'],
  carbohidratos: ['carbohidratos', 'carga de carbohidratos', 'glucogeno', 'dieta_alta_en_carbohidratos', 'bajo carbohidratos', 'indice_glucemico', 'isomaltulosa'],
  proteina: ['proteina', 'leucina', 'sintesis muscular', 'masa muscular', 'MPS', 'mTOR', 'sintesis_proteica', 'sintesis_proteica_muscular', 'biodisponibilidad', 'whey', 'aminoacidos_ramificados', 'fuentes_naturales', 'proteina_vegetal', 'proteina_animal', 'dieta_alta_proteina', 'suplementacion_proteica'],
  periodizacion: ['periodizacion', 'mesociclo', 'carga', 'descarga', 'deload', 'progresion', 'distribucion', 'distribución', 'lineal', 'ondulante', 'dosis-respuesta', 'sobrecarga', 'sobreentrenamiento', 'autorregulacion', 'ACWR'],
  nutricion_deportiva: ['nutricion deportiva', 'suplementacion deportiva', 'timing', 'pre-entreno', 'post-entreno', 'hidratacion', 'glucogeno', 'recuperacion', 'macros', 'micronutrientes', 'periodizacion_nutricional'],
  suplementacion: ['suplementacion', 'suplementos', 'creatina', 'cafeina', 'beta-alanina', 'whey', 'proteina suero', 'suplementacion_deportiva', 'suplementacion_proteica', 'ISSN', 'hmb'],

  // Salud ósea / osteoporosis (nuevas fuentes clínicas)
  salud_osea: ['salud osea', 'osteoporosis', 'densidad osea', 'densidad_mineral_osea', 'densidad_osea', 'fracturas_osteoporoticas', 'calcio', 'vitamina_d', 'metabolismo_oseo', 'homocisteina', 'mujeres_posmenopausicas'],
  hueso: ['salud osea', 'osteoporosis', 'densidad osea', 'masa_osea', 'calcio', 'vitamina_d'],
  masa_osea: ['salud osea', 'osteoporosis', 'densidad_mineral_osea', 'densidad_osea', 'metabolismo_oseo'],

  // Suplementación avanzada
  absorcion: ['biodisponibilidad', 'absorcion', 'digestion', 'nutrientes'],
  l_citrulina: ['l-citrulina', 'oxido nitrico', 'rendimiento', 'flujo sanguineo', 'ergogenico'],
  creatina_monohidrato: ['creatina', 'fuerza', 'masa muscular', 'suplementacion', 'rendimiento'],
  beta_alanina: ['beta-alanina', 'carnesina', 'buffer', 'capacidad', 'alta intensidad'],
  cafeína: ['cafeina', 'estimulante', 'rendimiento', 'fatiga', 'concentracion', 'ergogenico'],
  probioticos: ['probióticos', 'microbiota', 'salud intestinal', 'microbioma', 'microbiota_intestinal', 'inmunidad', 'permeabilidad_intestinal'],

  // Microbiota / salud intestinal
  microbiota: ['microbiota', 'microbioma', 'microbiota_intestinal', 'salud intestinal', 'fibra', 'probióticos', 'butirato', 'postbiotico', 'permeabilidad_intestinal'],
  microbioma: ['microbiota', 'microbioma', 'microbiota_intestinal', 'salud intestinal', 'fibra'],
  butirato: ['butirato', 'fibra', 'microbiota', 'salud intestinal', 'acido_graso_cc'],
  permeabilidad_intestinal: ['permeabilidad_intestinal', 'intestino permeable', 'microbiota', 'salud intestinal', 'butirato', 'probióticos'],
  fodmap: ['fodmap', 'sindrome_intestino_irritable', 'fermentacion', 'sintomas_gastrointestinales', 'tolerancia_gastrointestinal', 'dieta_baja_en_fodmap'],
  sindrome_intestino_irritable: ['sindrome_intestino_irritable', 'fodmap', 'sintomas_gastrointestinales', 'tolerancia_gastrointestinal', 'dieta_baja_en_fodmap', 'permeabilidad_intestinal'],

  // Dieta mediterránea / patrones dietéticos
  dieta_mediterranea: ['dieta mediterránea', 'dieta mediterranea', 'salud cardiovascular', 'prevencion cardiovascular', 'aceite de oliva virgen extra', 'frutos secos', 'fibra', 'grasas saludables', 'omega-3', 'frutas', 'vegetales'],
  aceite_oliva: ['aceite de oliva virgen extra', 'grasas saludables', 'dieta mediterránea', 'AOVE', 'polifenoles', 'cardiosaludable'],
  frutos_secos: ['frutos secos', 'nueces', 'grasas saludables', 'omega-3', 'fibra', 'dieta mediterránea', 'snack saludable'],
  alimentos_ultraprocesados: ['alimentos ultraprocesados', 'alimentos_ultraprocesados', 'ultraprocesados', 'novel', 'bebidas azucaradas', 'carnes procesadas', 'grasas saturadas', 'calidad dietetica', 'enfermedades crónicas'],
  patron_dietetico: ['patron dietetico', 'patrones dieteticos', 'patrones dietéticos', 'dieta', 'calidad dietetica', 'habitos alimentarios', 'factores_dieteticos'],

  // Nutrición clínica / patologías
  dieta_cetogenica: ['dieta_cetogenica', 'cetogenica', 'keto', 'grasas', 'baja grasa', 'bajo carbohidratos', 'cuerpos cetonicos', 'epilepsia', 'obesidad'],
  dieta_sin_gluten: ['dieta_sin_gluten', 'gluten', 'celiaquia', 'introducción de gluten', 'enfermedad celiaca'],
  enfermedad_renal: ['enfermedad_renal_cronica', 'renal', 'riñon', 'proteinuria', 'filtrado glomerular', 'potasio', 'soporte_nutricional'],
  soporte_nutricional: ['nutricion clinica', 'soporte_nutricional', 'nutricion enteral', 'nutricion parenteral', 'control_enfermedad', 'intervencion_dietetica'],
  nutricion_clinica: ['nutricion clinica', 'soporte_nutricional', 'nutricion enteral', 'intervencion_nutricional', 'clinica', 'hospitalario'],

  // Prevención / factores de riesgo
  prevencion: ['prevención', 'prevencion', 'salud publica', 'factores de riesgo', 'factores_dieteticos', 'factores_reproductivos', 'factores_socioeconomicos', 'enfermedades crónicas'],
  mortalidad: ['mortalidad', 'mortalidad cardiovascular', 'mortalidad cardiometabolica', 'supervivencia', 'riesgo_cardiovascular', 'prevencion cardiovascular'],
  riesgo_cardiovascular: ['riesgo_cardiovascular', 'salud cardiovascular', 'enfermedad cardiovascular', 'prevencion cardiovascular', 'mortalidad cardiovascular', 'funcion_cardiaca'],
  salud_metabolica: ['salud_metabolica', 'metabolismo', 'sindrome metabolico', 'obesidad', 'resistencia insulina', 'gasto energetico', 'ingesta_energetica'],
  gasto_energetico: ['gasto energetico', 'metabolismo', 'ingesta_energetica', 'balance energetico', 'NEAT', 'termogenesis', 'REE', 'TEE'],

  // Suplementación carbohidratos / nutrientes específicos
  suplementacion_carbohidratos: ['suplementacion_carbohidratos', 'carbohidratos', 'carga de carbohidratos', 'glucogeno', 'geles', 'isotonica', 'rendimiento_resistencia'],
  ferritina: ['ferritina', 'hierro', 'hemoglobina', 'anemia', 'ferritina', 'atletas', 'mujeres', 'rendimiento', 'donacion_sangre'],
  potasio: ['potasio', 'electrolitos', 'hidratacion', 'sodio', 'presion arterial', 'salud cardiovascular', 'calambres'],
  restriccion_calorica: ['restriccion_calorica', 'deficit calorico', 'perdida grasa', 'longevidad', 'envejecimiento', 'ayuno intermitente'],
  crono_nutricion: ['crono-nutricion', 'ritmo circadiano', 'timing', 'desayuno', 'sueño', 'cronobiologia', 'metabolismo', 'hormonas'],

  // Entrenamiento avanzado
  desentrenamiento: ['desentrenamiento', 'destreine', 'destraining', 'detraining', 'mantenimiento', 'recuperacion', 'cese', 'descanso'],
  rangos_movimiento: ['rango_de_movimiento', 'ROM', 'amplitud', 'movilidad', 'flexibilidad', 'lesiones', 'entrenamiento_fuerza', 'hipertrofia'],
  series_agrupadas: ['series_agrupadas', 'cluster sets', 'series agrupadas', 'descanso intra-serie', 'potencia', 'fuerza', 'volumen'],
  superseries: ['superseries', 'series compuestas', 'antagonistas', 'eficiencia_temporal', 'densidad', 'hipertrofia'],
  entrenamiento_combinado: ['entrenamiento_combinado', 'concurrente', 'hibrido', 'fuerza', 'resistencia', 'interferencia', 'compatibilidad'],
  sobreentrenamiento: ['sobreentrenamiento', 'sobrecarga', 'fatiga cronica', 'recuperacion', 'HRV', 'cortisol', 'rendimiento', 'ACWR'],
  autorregulacion: ['autorregulacion', 'RPE', 'RIR', 'autoregulación', 'intensidad', 'carga', 'periodizacion', 'entrenamiento_fuerza'],
  rhabdomiolisis: ['rabdomiolisis', 'rhabdomiolisis', 'daño muscular', 'CK', 'exceso entrenamiento', 'riesgo'],

  // Running / resistencia avanzado
  red_s: ['red-s', 'deficit energetico', 'triada', 'disponibilidad_energetica', 'atletas', 'mujeres', 'hormonas', 'menstruacion', 'hueso', 'salud osea'],
  triada_atleta: ['triada', 'red-s', 'mujeres', 'atletas', 'disponibilidad_energetica', 'amenorrea', 'salud osea'],
  periodo_ventana: ['periodizacion_nutricional', 'timing', 'pre-entreno', 'post-entreno', 'ventana anabolica', 'carbohidratos', 'proteina'],
  oxidacion_grasas: ['oxidacion_grasas', 'fat oxidation', 'grasas', 'metabolismo', 'zona2', 'ejercicio_resistencia', 'baja intensidad'],
  seiler: ['seiler', 'polarizado', '80/20', 'zona2', 'intensidad', 'running', 'rendimiento_resistencia'],

  // Psicología / coaching nutricional
  coaching_nutricional: ['coaching nutricional', 'entrevista motivacional', 'cambio de comportamiento', 'cambio de conducta', 'adherencia', 'educación nutricional', 'hábitos alimentarios', 'intervención nutricional', 'desconocimiento_nutricional'],
  educacion_nutricional: ['educación nutricional', 'coaching nutricional', 'habitos_alimentarios', 'adherencia', 'cambio de comportamiento', 'desconocimiento_nutricional', 'intervencion_intensiva'],
  habitos_alimentarios: ['habitos_alimentarios', 'conducta alimentaria', 'adherencia', 'cambio de comportamiento', 'dieta', 'patron dietetico', 'factores_socioeconomicos', 'entrevista motivacional'],
  apetito: ['apetito', 'hambre', 'saciedad', 'compensacion', 'frecuencia comidas', 'volumen', 'densidad_energetica', 'control_peso'],

  // Salud femenina / género
  diferencias_sexo: ['diferencias_sexo', 'sexo', 'hombre', 'mujer', 'dimorfismo_sexual', 'hombres', 'mujeres_jovenes', 'hombres_jovenes', 'hormonas'],
  salud_femenina: ['mujeres', 'hormonas', 'ginecologia', 'obstetricia', 'suelo_pelvico', 'factores_reproductivos', 'paridad', 'menopausia', 'pcos', 'incontinencia_urinaria'],
  suelo_pelvico: ['suelo_pelvico', 'suelo pelvico', 'incontinencia_urinaria', 'mujeres', 'embarazo', 'postparto', 'rehabilitacion'],
  ginecologia: ['ginecologia', 'obstetricia', 'mujeres', 'salud femenina', 'menstruacion', 'anticonceptivos', 'fertilidad'],

  // Pediatría / adolescentes
  pediatria: ['pediatría', 'niños', 'adolescentes', 'infancia', 'neurodesarrollo', 'crecimiento', 'alimentación complementaria'],
  adolescentes: ['adolescentes', 'jovenes', 'pediatría', 'nutricion', 'deporte', 'rendimiento', 'creencias', 'composicion corporal'],
  tercera_edad: ['tercera_edad', 'adultos_mayores', 'envejecimiento', 'sarcopenia', 'calidad_de_vida', 'funcion_fisica', 'adultos', 'nutricion clinica', 'polimedicacion'],

  // Tecnología / IA
  inteligencia_artificial: ['inteligencia_artificial', 'IA', 'machine learning', 'aprendizaje_automatico', 'nutricion_precision', 'personalizacion'],
  nutricion_precision: ['nutricion_precision', 'personalizacion', 'genomica', 'metabolomica', 'microbioma', 'inteligencia_artificial'],
  monitorizacion: ['monitorizacion', 'monitoreo_bioquimico', 'marcadores_bioquimicos', 'control', 'seguimiento', 'glucemia', 'HbA1c', 'ferritina'],

  // Inmunidad / inflamación
  inmunidad: ['inmunidad', 'sistema inmune', 'inflamacion', 'defensas', 'ejercicio', 'nutricion', 'vitaminas', 'minerales', 'probióticos', 'cinc', 'vitamina_c', 'vitamina_d'],
  inflamacion: ['inflamacion', 'antiinflamatorio', 'cronico', 'inmunidad', 'omega-3', 'grasas saludables', 'dieta mediterranea', 'cortisol', 'ejercicio'],

  // Miscelánea — otros bridges relevantes
  cancer: ['supervivientes_de_cancer', 'cancer_mama', 'terapia_endocrina', 'oncologia', 'nutricion clinica', 'caquexia', 'supervivencia'],
  vegano_avanzado: ['vegano', 'plant_based', 'veganismo', 'b12', 'hierro', 'biodisponibilidad', 'proteina vegetal', 'aminoacidos'],
  tiroides_avanzado: ['tiroides', 'hipotiroidismo', 'hashimoto', 'TSH', 'T4', 'T3', 'yodo', 'selenio', 'cinc', 'funcion_tiroidea'],
  intoxicacion: ['toxicología', 'metales_pesados', 'metales', 'disrupcion_endocrina', 'parabenos', 'seguridad', 'alimentaria'],
  medio_ambiente: ['sostenibilidad', 'medio ambiente', 'huella carbono', 'dieta sostenible', 'alimentos locales', 'estacionalidad'],
}

// ── Tags adicionales para normalización de objetivos ──
// Algunos tags de papers que son sinónimos de bridges existentes
const TAG_SINONIMOS: Record<string, string[]> = {
  deficit: ['deficit', 'deficit calorico', 'perdida grasa'],
  cardiovascular: ['cardiovascular', 'salud cardiovascular', 'enfermedad cardiovascular'],
  esteatosis: ['esteatosis', 'higado graso', 'NAFLD', 'higado_graso'],
}

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
// Consulta a Supabase knowledge_base por tags del cliente
// ──────────────────────────────────────────────────────────────

interface KBRow {
  titulo: string
  resumen: string | null
  contenido_completo: string | null
  fuente: string | null
  tags: string[]
  condiciones: string[]
  nivel_evidencia: string | null
}

/**
 * Expande tags del cliente usando TAG_BRIDGE.
 * Cada tag cliente se expande a sus equivalentes en KB.
 */
export function expandirTags(tagsCliente: string[]): string[] {
  const expanded = new Set<string>()
  for (const tag of tagsCliente) {
    expanded.add(tag)
    const bridge = TAG_BRIDGE[tag]
    if (bridge) {
      for (const eq of bridge) expanded.add(eq)
    }
  }
  return [...expanded]
}

/**
 * Consulta Supabase knowledge_base filtrando por tags y condiciones de salud.
 * Usa TAG_BRIDGE para expandir tags del cliente a equivalentes en KB.
 * Devuelve array vacío si no hay resultados o hay error.
 */
export async function consultarKnowledgeDB(
  supabase: SupabaseClient,
  tagsCliente: string[],
  condicionesSalud?: string
): Promise<ProtocoloCientifico[]> {
  try {
    // 1. Expandir tags del cliente via TAG_BRIDGE
    const tagsExpandidos = expandirTags(tagsCliente)

    // 2. Construir query base: activos, incluye globales (coach_id IS NULL) + coach-específicos
    let query = supabase
      .from('knowledge_base')
      .select('titulo, resumen, contenido_completo, fuente, tags, condiciones, nivel_evidencia')
      .eq('activo', true)
      .order('verificado', { ascending: false })
      .order('created_at', { ascending: false })
      .limit(20)

    // 3. Filtrar por tags expandidos — usamos .overlaps para tags[]
    if (tagsExpandidos.length > 0) {
      const tagsArray = tagsExpandidos.map(t => `"${t.replace(/"/g, '\\"')}"`).join(',')
      query = query.or(`tags.ov.{${tagsArray}}`)
    }

    // 3. Filtrar por condiciones de salud si hay
    if (condicionesSalud) {
      const condiciones = extraerCondiciones(condicionesSalud)
      if (condiciones.length > 0) {
        const condArray = condiciones.map(c => `"${c.replace(/"/g, '\\"')}"`).join(',')
        query = query.or(`condiciones.ov.{${condArray}}`)
      }
    }

    const { data, error } = await query

    if (error) {
      console.error('[consultarKnowledgeDB] Error:', error.message)
      return []
    }

    if (!data || data.length === 0) return []

    // 4. Mapear filas KB a ProtocoloCientifico[]
    return (data as KBRow[]).map((row, i) => {
      // Usar contenido_completo si resumen es muy corto
      const resumen = row.resumen && row.resumen.length > 50
        ? row.resumen
        : (row.contenido_completo || row.resumen || '')

      const referencias = row.fuente
        ? row.fuente.split('|').map(r => r.trim()).filter(Boolean)
        : []

      return {
        id: `kb_${i}`,
        titulo: row.titulo,
        tags: row.tags || [],
        resumen,
        referencias,
      }
    })
  } catch (err) {
    console.error('[consultarKnowledgeDB] Exception:', err)
    return []
  }
}

/**
 * Extrae condiciones de salud del texto libre (misma lógica que detectarTags)
 */
function extraerCondiciones(texto: string): string[] {
  const condiciones: string[] = []
  const lower = texto.toLowerCase()

  if (lower.includes('diabet') || lower.includes('glucemia') || lower.includes('insulina'))
    condiciones.push('diabetes')
  if (lower.includes('tiroides') || lower.includes('hipotiroid') || lower.includes('hashimoto'))
    condiciones.push('hipotiroidismo')
  if (lower.includes('sop') || lower.includes('ovario poliq') || lower.includes('pcos'))
    condiciones.push('pcos')
  if (lower.includes('menop') || lower.includes('climaterio') || lower.includes('perimen'))
    condiciones.push('menopausia')
  if (lower.includes('hipertens') || lower.includes('hta') || lower.includes('presion alta') ||
    lower.includes('tension alta') || lower.includes('cardiovascular'))
    condiciones.push('hipertension')
  if (lower.includes('higado graso') || lower.includes('hígado graso') || lower.includes('nafld') ||
    lower.includes('esteatosis') || lower.includes('transaminasas'))
    condiciones.push('higado_graso')
  if (lower.includes('colesterol') || lower.includes('dislipemia') || lower.includes('hipercolesterole'))
    condiciones.push('colesterol')
  if (lower.includes('ansiedad') || lower.includes('depresion') || lower.includes('depresión') ||
    lower.includes('salud mental'))
    condiciones.push('ansiedad')
  if (lower.includes('sarcopenia'))
    condiciones.push('sarcopenia')

  return condiciones
}

/**
 * Expande tags usando TAG_BRIDGE (versión para Set)
 */
function expandirTagsSet(tags: Set<string>): Set<string> {
  const expanded = new Set(tags)
  for (const tag of tags) {
    const bridge = TAG_BRIDGE[tag]
    if (bridge) {
      for (const eq of bridge) expanded.add(eq)
    }
  }
  return expanded
}

/**
 * Hace scoring de protocolos por coincidencia de tags (con TAG_BRIDGE) y devuelve top N
 */
function scoreAndFilter(
  protocolos: ProtocoloCientifico[],
  tagsCliente: Set<string>,
  limite: number
): ProtocoloCientifico[] {
  // Expandir tags del cliente para matchear con tags de KB
  const tagsExpandidos = expandirTagsSet(tagsCliente)

  const scored = protocolos.map(p => ({
    protocolo: p,
    score: p.tags.filter(t => tagsExpandidos.has(t)).length,
  }))

  return scored
    .filter(s => s.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limite)
    .map(s => s.protocolo)
}

// ──────────────────────────────────────────────────────────────
// Selección de protocolos relevantes (top N por score de tags)
// AHORA: consulta Supabase primero, fallback a hardcoded
// ──────────────────────────────────────────────────────────────

export async function seleccionarProtocolos(
  supabase: SupabaseClient | null,
  perfil: PerfilClienteKB,
  limite: number = 5
): Promise<ProtocoloCientifico[]> {
  const tagsCliente = detectarTags(perfil)

  if (tagsCliente.size === 0) {
    // Sin tags → protocolo general de salud (fallback)
    return BASE_CONOCIMIENTO.filter(p => p.tags.includes('salud_general')).slice(0, 1)
  }

  // 1. Intentar consultar Supabase (CON TAG_BRIDGE incluido en consultarKnowledgeDB)
  if (supabase) {
    const dbProtocolos = await consultarKnowledgeDB(
      supabase,
      [...tagsCliente],
      perfil.condiciones_salud ?? undefined
    )
    if (dbProtocolos.length > 0) {
      const seleccionados = scoreAndFilter(dbProtocolos, tagsCliente, limite)
      if (seleccionados.length > 0) return seleccionados
    }
  }

  // 2. Fallback: hardcoded (también expandimos tags con TAG_BRIDGE)
  const tagsExpandidos = expandirTagsSet(tagsCliente)
  const scored = BASE_CONOCIMIENTO.map(protocolo => {
    const matches = protocolo.tags.filter(t => tagsExpandidos.has(t)).length
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
