-- ============================================================
-- SEED: Migrar 18 protocolos hardcodeados → knowledge_base
--
-- Origen: lib/knowledge-base.ts (BASE_CONOCIMIENTO)
-- Target: public.knowledge_base
--
-- Cada protocolo preserva sus tags exactos para que el sistema
-- de selección por perfil (detectarTags) siga funcionando.
-- 
-- Las condiciones de salud se mapean a la columna `condiciones`
-- para consultas específicas por patología.
-- ============================================================

-- LIMPIEZA: Eliminar semillas previas (solo los protocolos base, no los insertados por scraping)
DELETE FROM public.knowledge_base WHERE fuente_tipo = 'manual' AND tipo = 'protocolo';

-- ══════════════════════════════════════════════════════════════
-- 1. PÉRDIDA DE GRASA
-- ══════════════════════════════════════════════════════════════
INSERT INTO public.knowledge_base (
  disciplina, categoria, tipo, titulo, resumen, fuente, tags, condiciones,
  nivel_evidencia, activo, verificado, fuente_tipo
) VALUES (
  'nutricion', 'composicion_corporal', 'protocolo',
  'Pérdida de grasa con preservación muscular',
  $PROTO_PG$PROTOCOLO PÉRDIDA DE GRASA:
- Déficit calórico: 300-500 kcal/día (moderado). Evitar déficit >500 kcal/día para preservar masa muscular (Trexler et al. 2014).
- Proteína alta: 2.2-2.6 g/kg para preservar músculo en restricción calórica (Helms et al. 2014).
- Distribución proteína: mínimo 4 comidas con ≥25g proteína cada una (leucine threshold, Norton & Layman).
- Carbohidratos: reducir sin eliminar. Priorizar timing peri-entreno (Aragon & Schoenfeld 2013).
- Grasas: mínimo 0.5-0.7 g/kg/día para función hormonal.
- Refeed semanal si déficit >4 semanas: 1 día en mantenimiento con CHO extra mejora leptina y adherencia.$PROTO_PG$,
  'Trexler ET et al. Metabolic adaptation to weight loss. JISSN 2014. | Helms ER et al. A systematic review of dietary protein during caloric restriction. JISSN 2014. | Aragon AA, Schoenfeld BJ. Nutrient timing revisited. JISSN 2013.',
  ARRAY['perder_grasa', 'deficit'],
  '{}',
  'revision_sistematica', true, true, 'manual'
);

-- ══════════════════════════════════════════════════════════════
-- 2. GANANCIA MUSCULAR
-- ══════════════════════════════════════════════════════════════
INSERT INTO public.knowledge_base (
  disciplina, categoria, tipo, titulo, resumen, fuente, tags, condiciones,
  nivel_evidencia, activo, verificado, fuente_tipo
) VALUES (
  'nutricion', 'composicion_corporal', 'protocolo',
  'Hipertrofia y ganancia muscular',
  $PROTO_GM$PROTOCOLO GANANCIA MUSCULAR:
- Superávit calórico mínimo efectivo: 200-300 kcal/día. Superávit mayor aumenta grasa sin acelerar músculo (Morton et al. 2018).
- Proteína: 1.6-2.2 g/kg (punto de saturación ~1.62 g/kg en meta-análisis Morton 2018 BJSM).
- Distribución en 4-5 comidas con fuente proteica ≥30g por toma (leucine threshold ~2-3g).
- CHO: prioritario para recargar glucógeno entre sesiones. 3-5 g/kg/día en días de entreno.
- Creatina monohidrato: 3-5g/día con evidencia A (Buford et al. JISSN 2007).
- Timing: proteína 0-2h post-entreno relevante; ventana anabólica flexible (no solo inmediata).$PROTO_GM$,
  'Morton RW et al. A systematic review, meta-analysis and meta-regression of the effect of protein supplementation on RT-induced gains. BJSM 2018. | Buford TW et al. International Society of Sports Nutrition position stand: creatine supplementation. JISSN 2007.',
  ARRAY['ganar_musculo', 'hipertrofia', 'volumen'],
  '{}',
  'revision_sistematica', true, true, 'manual'
);

-- ══════════════════════════════════════════════════════════════
-- 3. RECOMPOSICIÓN CORPORAL
-- ══════════════════════════════════════════════════════════════
INSERT INTO public.knowledge_base (
  disciplina, categoria, tipo, titulo, resumen, fuente, tags, condiciones,
  nivel_evidencia, activo, verificado, fuente_tipo
) VALUES (
  'nutricion', 'composicion_corporal', 'protocolo',
  'Recomposición corporal simultánea',
  $PROTO_RC$PROTOCOLO RECOMPOSICIÓN CORPORAL:
- Recomp simultánea posible en: principiantes, vuelta tras descanso, individuos con sobrepeso, atletas avanzados en déficit moderado con alta proteína (Barakat et al. 2020).
- Calorías: mantenimiento o déficit muy leve (-100 a -200 kcal).
- Proteína ELEVADA: 2.0-2.4 g/kg para maximizar señal anabólica en déficit.
- Timing crítico: CHO + proteína pre/post entreno (maximizar partición calórica).
- Paciencia: cambios visibles en 12-16 semanas. Evitar presionar déficit ante estancamiento báscula.
- Monitorizar: circunferencias + foto mensual, no solo peso.$PROTO_RC$,
  'Barakat C et al. Body Recomposition: Can Trained Individuals Build Muscle and Lose Fat at the Same Time? Strength Cond J 2020.',
  ARRAY['recomposicion'],
  '{}',
  'revision_sistematica', true, true, 'manual'
);

-- ══════════════════════════════════════════════════════════════
-- 4. RENDIMIENTO DEPORTIVO
-- ══════════════════════════════════════════════════════════════
INSERT INTO public.knowledge_base (
  disciplina, categoria, tipo, titulo, resumen, fuente, tags, condiciones,
  nivel_evidencia, activo, verificado, fuente_tipo
) VALUES (
  'general', 'metabolismo', 'protocolo',
  'Nutrición para rendimiento deportivo general',
  $PROTO_RD$PROTOCOLO RENDIMIENTO DEPORTIVO:
- CHO es el sustrato predominante en ejercicio >60% VO2max. No restringir sin causa.
- Carga de CHO: 3-5 g/kg en días moderados, 6-10 g/kg en días de alta carga o competición (Burke ISSN 2011).
- Proteína: 1.6-1.8 g/kg en fases de carga normal; 2.0-2.2 en fases de déficit o lesión.
- Hidratación: ≥500ml 2h antes + 150-250ml/15-20min durante. Electrolitos en sesiones >60min.
- Recuperación: CHO+proteína en 30-60 min post-sesión intensa (Ivy et al.).
- Creatina: beneficio en deportes intermitentes de alta intensidad (evidencia A).$PROTO_RD$,
  'Burke LM et al. Carbohydrates for training and competition. J Sports Sci 2011. | Thomas DT et al. Position of the Academy of Nutrition and Dietetics, Dietitians of Canada, and ACSM: Nutrition and Athletic Performance. J Acad Nutr Diet 2016.',
  ARRAY['rendimiento', 'atletismo', 'deporte', 'competicion'],
  '{}',
  'revision_sistematica', true, true, 'manual'
);

-- ══════════════════════════════════════════════════════════════
-- 5. RUNNING / RESISTENCIA
-- ══════════════════════════════════════════════════════════════
INSERT INTO public.knowledge_base (
  disciplina, categoria, tipo, titulo, resumen, fuente, tags, condiciones,
  nivel_evidencia, activo, verificado, fuente_tipo
) VALUES (
  'running', 'resistencia', 'protocolo',
  'Nutrición para running y resistencia aeróbica',
  $PROTO_RUN$PROTOCOLO RUNNING / RESISTENCIA:
- CHO como combustible principal >70% VO2max. Fat adaptation en volúmenes bajos (<65% VO2max) pero perjudica economía de carrera en alta intensidad (Volek et al., Burke 2021).
- Carga competición (1-3 días antes): 8-10 g/kg CHO/día + sodio elevado.
- Geles/CHO en carrera: 30-60g CHO/hora en >60min; 90g/hora si son múltiples fuentes (glucosa+fructosa) en >2.5h.
- Proteína post-carrera larga: 0.3-0.4 g/kg inmediatos para reducir daño muscular.
- Hierro: vigilar en corredores (hemolisis por impacto). Analítica semestral.
- Electrolitos: sodio 500-700 mg/hora en carrera larga. Evitar hiponatremia.$PROTO_RUN$,
  'Burke LM et al. Low carbohydrate, high fat diet impairs exercise economy. J Physiol 2017. | Jeukendrup AE. A step towards personalized sports nutrition. Sports Med 2014.',
  ARRAY['running', 'fondo', 'maraton', 'trail', 'resistencia_aerobica'],
  '{}',
  'revision_sistematica', true, true, 'manual'
);

-- ══════════════════════════════════════════════════════════════
-- 6. CICLISMO / TRIATLÓN
-- ══════════════════════════════════════════════════════════════
INSERT INTO public.knowledge_base (
  disciplina, categoria, tipo, titulo, resumen, fuente, tags, condiciones,
  nivel_evidencia, activo, verificado, fuente_tipo
) VALUES (
  'triatlon', 'resistencia', 'protocolo',
  'Nutrición para ciclismo y triatlón',
  $PROTO_CT$PROTOCOLO CICLISMO / TRIATLÓN:
- Fueling en ruta: 60-90g CHO/hora (gel + bebida isotónica). Entrenamiento intestinal obligatorio en ironman.
- Bebida isotónica: 30-60g CHO + 500-700mg sodio/litro.
- Nutrición etapas: recuperación 30min post-segmento intenso (CHO+proteína). Protocolo "sleep low" opcional en base.
- Pre-race: desayuno CHO 3-4h antes (1-4g/kg), top-up gel 30min antes.
- Proteína diaria en fase competitiva: 1.6-2.0 g/kg.
- Cafeína: 3-6 mg/kg 60min antes mejora rendimiento (Spriet 2014). Límite 400mg/día.$PROTO_CT$,
  'Friel J. The Triathlete Training Bible. 4th ed. 2016. | Spriet LL. Exercise and sport performance with low doses of caffeine. Sports Med 2014.',
  ARRAY['ciclismo', 'triatlon', 'bici', 'ironman'],
  '{}',
  'revision_sistematica', true, true, 'manual'
);

-- ══════════════════════════════════════════════════════════════
-- 7. HYROX / CROSSFIT
-- ══════════════════════════════════════════════════════════════
INSERT INTO public.knowledge_base (
  disciplina, categoria, tipo, titulo, resumen, fuente, tags, condiciones,
  nivel_evidencia, activo, verificado, fuente_tipo
) VALUES (
  'hibrido', 'hiit', 'protocolo',
  'Nutrición para HYROX, CrossFit y deportes funcionales de alta intensidad',
  $PROTO_HX$PROTOCOLO HYROX / CROSSFIT / FUNCIONAL:
- CHO intra-sesión: WODs >45min se benefician de 30-45g CHO durante. Especialmente en dobles.
- Carga semanal: 4-6 g/kg/día CHO en semanas de alto volumen; reducir en deload.
- Proteína: 2.0-2.4 g/kg por alta demanda glucolítica + remodelado muscular.
- Beta-alanina: 3.2-6.4g/día reduce acidosis muscular (Hobson et al. 2012). Útil para AMRAPs y chipper.
- Recuperación entre sesiones dobles: proteína 40g + CHO 1.2g/kg en <60min.
- Hidratación: mínimo 2.5L/día. Sesiones muy sudadas (+700ml/hora).$PROTO_HX$,
  'Hobson RM et al. Effects of beta-alanine supplementation on exercise performance. Amino Acids 2012. | Butts J et al. Creatine Use in Sports. Sports Health 2018.',
  ARRAY['hyrox', 'crossfit', 'funcional', 'hiit', 'wod'],
  '{}',
  'revision_sistematica', true, true, 'manual'
);

-- ══════════════════════════════════════════════════════════════
-- 8. FUERZA / POWERLIFTING
-- ══════════════════════════════════════════════════════════════
INSERT INTO public.knowledge_base (
  disciplina, categoria, tipo, titulo, resumen, fuente, tags, condiciones,
  nivel_evidencia, activo, verificado, fuente_tipo
) VALUES (
  'fuerza', 'fuerza', 'protocolo',
  'Nutrición para fuerza máxima y powerlifting',
  $PROTO_FP$PROTOCOLO FUERZA MÁXIMA:
- Calorías: mantenimiento o superávit según fase. Corte de peso: déficit agresivo solo 4-6 semanas pre-competición.
- Proteína: 1.6-2.2 g/kg. No necesariamente >2.2 en fuerza pura (sin déficit calórico).
- Timing pre-entreno: CHO de bajo IG 2-3h antes + pequeño CHO rápido 30min antes de la sesión principal.
- Creatina: 3-5g/día. Mayor evidencia en esfuerzos cortos máximos (<30s). Carga opcional.
- Corte de peso rápido (<3 días): restricción sodio y CHO, no restricción hídrica extrema.
- Post-sesión: proteína 40-50g + CHO 1g/kg para reposición glucógeno.$PROTO_FP$,
  'Schoenfeld BJ. The Mechanisms of Muscle Hypertrophy and Their Application to Resistance Training. J Strength Cond Res 2010. | Buford TW et al. ISSN position stand: creatine supplementation. JISSN 2007.',
  ARRAY['fuerza', 'powerlifting', 'halterofilia', 'pesado'],
  '{}',
  'revision_sistematica', true, true, 'manual'
);

-- ══════════════════════════════════════════════════════════════
-- 9. DIABETES T2
-- ══════════════════════════════════════════════════════════════
INSERT INTO public.knowledge_base (
  disciplina, categoria, tipo, titulo, resumen, fuente, tags, condiciones,
  nivel_evidencia, activo, verificado, fuente_tipo
) VALUES (
  'nutricion', 'patologia', 'protocolo',
  'Nutrición con diabetes tipo 2 o resistencia a insulina',
  $PROTO_DT$PROTOCOLO DIABETES T2 / RESISTENCIA INSULINA:
- Índice glucémico: priorizar CHO de bajo IG (legumbres, avena, boniato, quinoa). Reducir refinados.
- Distribución CHO: pequeñas cantidades en cada comida. Evitar grandes cargas de CHO únicas.
- Timing ejercicio: actividad física post-comida (15-30min) reduce pico glucémico.
- Proteína: 1.2-1.6 g/kg. Alta proteína puede aumentar insulina pero no glucosa (beneficioso).
- Fibra: ≥25g/día (ralentiza absorción glucosa). Verduras en cada comida.
- Grasas: limitar saturadas. Omega-3 mejora sensibilidad insulina (Mori & Woodman 2006).
- Pérdida de peso: 5-10% del peso corporal mejora HbA1c y sensibilidad insulina significativamente.
- ⚠️ Derivar a médico/endocrino si toma medicación hipoglucemiante para ajuste de dosis.$PROTO_DT$,
  'American Diabetes Association. Standards of Medical Care in Diabetes. Diabetes Care 2024. | Mori TA, Woodman RJ. The independent effects of EPA and DHA on cardiovascular risk factors. Curr Opin Clin Nutr Metab Care 2006.',
  ARRAY['diabetes', 'diabetes_t2', 'resistencia_insulina', 'glucemia'],
  ARRAY['diabetes', 'diabetes_tipo_2', 'resistencia_insulina'],
  'revision_sistematica', true, true, 'manual'
);

-- ══════════════════════════════════════════════════════════════
-- 10. HIPOTIROIDISMO
-- ══════════════════════════════════════════════════════════════
INSERT INTO public.knowledge_base (
  disciplina, categoria, tipo, titulo, resumen, fuente, tags, condiciones,
  nivel_evidencia, activo, verificado, fuente_tipo
) VALUES (
  'nutricion', 'patologia', 'protocolo',
  'Nutrición con hipotiroidismo',
  $PROTO_HT$PROTOCOLO HIPOTIROIDISMO:
- Metabolismo reducido: ajustar TDEE a la baja (-10-15%). Evitar déficits agresivos que bajen T3.
- Proteína elevada: 2.0-2.4 g/kg para contrarrestar tendencia catabólica y retención hídrica.
- Selenio: 55-200 mcg/día (nueces de Brasil, mariscos). Cofactor deiodinasa T4→T3 (Zimmermann & Köhrle 2002).
- Yodo: ni deficiencia ni exceso. 150-300 mcg/día de fuentes alimentarias (algas con moderación).
- Evitar bociógenos en exceso crudo: brócoli, col, berros, cacahuetes (crudos interfieren absorción yodo).
- Hierro: revisión frecuente. Hipotiroidismo autoinmune asociado a anemia.
- Timing medicación (levotiroxina): 30-60min antes del desayuno, sin calcio/hierro simultáneo.
- Vitamina D: frecuentemente baja en Hashimoto. Suplementar si <30 ng/ml.$PROTO_HT$,
  'Zimmermann MB, Köhrle J. The impact of iron and selenium deficiencies on iodine and thyroid metabolism. Thyroid 2002. | Ventura M et al. Selenium and thyroid disease: From pathophysiology to treatment. Int J Endocrinol 2017.',
  ARRAY['hipotiroidismo', 'tiroides', 'hashimoto'],
  ARRAY['hipotiroidismo', 'tiroides', 'hashimoto'],
  'revision_sistematica', true, true, 'manual'
);

-- ══════════════════════════════════════════════════════════════
-- 11. MENOPAUSIA / SOP
-- ══════════════════════════════════════════════════════════════
INSERT INTO public.knowledge_base (
  disciplina, categoria, tipo, titulo, resumen, fuente, tags, condiciones,
  nivel_evidencia, activo, verificado, fuente_tipo
) VALUES (
  'nutricion', 'patologia', 'protocolo',
  'Nutrición en menopausia y síndrome de ovario poliquístico (SOP)',
  $PROTO_MP$PROTOCOLO MENOPAUSIA / SOP:
- Resistencia a insulina (SOP): igual que protocolo diabetes T2 — bajo IG, fibra alta, CHO distribuidos.
- Calcio: 1200-1500 mg/día (menopausia). Fuentes: lácteos, sardinas con espina, tofu cálcico, almendras.
- Vitamina D: 1500-2000 UI/día para absorción calcio y salud ósea (OMS).
- Proteína alta: 2.0 g/kg para contrarrestar sarcopenia acelerada post-menopausia.
- Fitoestrógenos (SOP/menopausia): soja, lino, legumbres. Evidencia moderada en síntomas vasomotores.
- Omega-3: reduce inflamación y mejora resistencia insulina (SOP).
- Hierro post-menopausia: necesidades menores. Monitorizar ferritina si hay suplementación.
- Ejercicio de fuerza: imprescindible para densidad ósea y sensibilidad insulina. Orientar el plan de entreno.$PROTO_MP$,
  'The Menopause Society. Hormone Therapy Position Statement. Menopause 2022. | Moran LJ et al. Dietary composition in restoring reproductive and metabolic physiology in overweight women with PCOS. J Clin Endocrinol Metab 2003.',
  ARRAY['menopausia', 'pcos', 'sop', 'climaterio', 'perimenopausia'],
  ARRAY['menopausia', 'pcos', 'sop', 'climaterio'],
  'revision_sistematica', true, true, 'manual'
);

-- ══════════════════════════════════════════════════════════════
-- 12. VEGETARIANO / VEGANO
-- ══════════════════════════════════════════════════════════════
INSERT INTO public.knowledge_base (
  disciplina, categoria, tipo, titulo, resumen, fuente, tags, condiciones,
  nivel_evidencia, activo, verificado, fuente_tipo
) VALUES (
  'nutricion', 'proteina', 'protocolo',
  'Nutrición vegetariana y vegana',
  $PROTO_VV$PROTOCOLO VEGETARIANO / VEGANO:
- Proteína: 10-20% más que omnívoros para compensar menor digestibilidad (PDCAAS). Target 1.8-2.2 g/kg.
- Fuentes proteicas completas: soja/edamame/tempeh (único vegetal con perfil AA completo), combinación legumbre+cereal.
- B12: OBLIGATORIA suplementación en veganos (2000 mcg/semana o 50-100 mcg/día cianocobalamina).
- Hierro no hemo: absorción 2-3x menor. Consumir con vitamina C. Evitar café/té con la comida.
- Zinc: biodisponibilidad menor. Remojar legumbres (reduce fitatos). Target 15-20 mg/día.
- Omega-3: ALA no se convierte eficientemente en EPA/DHA. Suplementar con algas DHA (250-500 mg/día).
- Calcio vegano: brócoli, col rizada, tahini, leches vegetales enriquecidas. Mínimo 1000 mg/día.
- Creatina: no presente en alimentos vegetales. Suplementar 3-5g/día mejora más que en omnívoros.$PROTO_VV$,
  'Rogerson D. Vegan diets: practical advice for athletes and exercisers. J Int Soc Sports Nutr 2017. | Melina V et al. Position of the Academy of Nutrition and Dietetics: Vegetarian Diets. J Acad Nutr Diet 2016.',
  ARRAY['vegetariano', 'vegano', 'plant_based', 'sin_carne'],
  '{}',
  'revision_sistematica', true, true, 'manual'
);

-- ══════════════════════════════════════════════════════════════
-- 13. SARCOPENIA / MAYORES
-- ══════════════════════════════════════════════════════════════
INSERT INTO public.knowledge_base (
  disciplina, categoria, tipo, titulo, resumen, fuente, tags, condiciones,
  nivel_evidencia, activo, verificado, fuente_tipo
) VALUES (
  'nutricion', 'composicion_corporal', 'protocolo',
  'Nutrición en adultos mayores y prevención de sarcopenia',
  $PROTO_SM$PROTOCOLO SARCOPENIA / ADULTOS MAYORES:
- Proteína: 1.6-2.0 g/kg (más alta que adultos jóvenes por resistencia anabólica).
- Leucina threshold aumentado: necesitan ≥2.5-3g leucina/toma para activar síntesis proteica (Katsanos et al.).
- Distribución: 4-5 tomas con ≥30-40g proteína cada una. Evitar toma única alta (limitación absorción).
- Vitamina D: 2000-4000 UI/día. Deficiencia prevalente >65 años. Crítica para función muscular y ósea.
- Calcio: 1200-1500 mg/día. Combinado con vitamina D reduce caídas y fracturas (Bischoff-Ferrari 2009).
- CHO y grasas: adaptar al nivel de actividad. No restringir CHO sin motivo en mayores activos.
- Hidratación: mecanismo de sed reducido. Promover 8-10 vasos/día activamente.
- Creatina: evidencia creciente en sarcopenia. 3-5g/día combinado con resistencia (Brose et al. 2003).$PROTO_SM$,
  'Katsanos CS et al. A high proportion of leucine is required for optimal stimulation of the rate of muscle protein synthesis by essential amino acids. Am J Physiol 2006. | Bischoff-Ferrari HA et al. Prevention of nonvertebral fractures with oral vitamin D and dose dependency. Arch Intern Med 2009.',
  ARRAY['mayor_55', 'sarcopenia', 'envejecimiento', 'tercera_edad'],
  ARRAY['sarcopenia'],
  'revision_sistematica', true, true, 'manual'
);

-- ══════════════════════════════════════════════════════════════
-- 14. AMATEUR / SALUD GENERAL
-- ══════════════════════════════════════════════════════════════
INSERT INTO public.knowledge_base (
  disciplina, categoria, tipo, titulo, resumen, fuente, tags, condiciones,
  nivel_evidencia, activo, verificado, fuente_tipo
) VALUES (
  'general', 'metodologia', 'protocolo',
  'Nutrición para deportista amateur y salud general',
  $PROTO_AR$PROTOCOLO DEPORTISTA AMATEUR / SALUD GENERAL:
- Calorías: equilibrio energético o leve déficit/superávit según objetivo secundario.
- Proteína: 1.2-1.6 g/kg/día. Suficiente para mantenimiento y recuperación sin exigencia de élite.
- Estilo mediterráneo: evidencia robusta en longevidad, marcadores inflamatorios y adherencia (PREDIMED 2013).
- CHO: 3-5 g/kg en días activos. No restringir. Cereales integrales, fruta, legumbres.
- Grasas saludables: aceite oliva virgen extra, nueces, aguacate, pescado azul 2-3x/semana.
- Fibra: 25-35g/día (salud intestinal + saciedad + glucemia).
- Alcohol: evidencia clara de daño >1 bebida/día. No tiene efecto protector cardiovascular real.
- Prioridad de adherencia: el mejor plan es el que el cliente puede mantener consistentemente.$PROTO_AR$,
  'Estruch R et al. Primary prevention of cardiovascular disease with a Mediterranean diet. NEJM 2013 (PREDIMED). | Thomas DT et al. Position of the Academy of Nutrition and Dietetics, Dietitians of Canada, and ACSM. J Acad Nutr Diet 2016.',
  ARRAY['salud_general', 'mantenimiento', 'amateur', 'recreacional', 'bienestar'],
  '{}',
  'revision_sistematica', true, true, 'manual'
);

-- ══════════════════════════════════════════════════════════════
-- 15. HIPERTENSIÓN
-- ══════════════════════════════════════════════════════════════
INSERT INTO public.knowledge_base (
  disciplina, categoria, tipo, titulo, resumen, fuente, tags, condiciones,
  nivel_evidencia, activo, verificado, fuente_tipo
) VALUES (
  'nutricion', 'patologia', 'protocolo',
  'Hipertensión arterial y salud cardiovascular',
  $PROTO_HTA$PROTOCOLO HIPERTENSIÓN ARTERIAL:
- REDUCCIÓN DE SODIO: prioridad absoluta. Objetivo < 1500-2000 mg/día (DASH-Sodium Trial, NEJM 1997; Sacks et al. 2001).
- AUMENTO DE POTASIO: > 3500 mg/día. Fuentes: frutas, verduras de hoja verde, legumbres, boniato, plátano, aguacate.
- DIETA DASH: rica en frutas, verduras, lácteos desnatados, cereales integrales, proteína magra. Reduce PA sistólica 8-14 mmHg.
- PESO: cada kg perdido reduce PA ~1-1.5 mmHg. Objetivo pérdida 5-10% si sobrepeso.
- ALCOHOL: limitar ≤1 bebida/día (mujeres), ≤2 (hombres). Reducción directa de PA.
- MAGNESIO: > 300 mg/día de fuentes dietéticas. Relación inversa con PA en meta-análisis.
- OMEGA-3: EPA+DHA > 2g/semana. Pescado azul 2-3 raciones/semana. Efecto vasodilatador.
- EVITAR: embutidos, conservas saladas, snacks salados, quesos curados, pan industrial, salsas comerciales, platos preparados.
- CAFEÍNA: si consume café, limitar a 2-3 tazas/día. No efecto negativo crónico en consumidores habituales.
- ⚠️ Interacción medicación: diuréticos (riesgo hipopotasemia), IECA/ARAII (vigilar potasio si función renal alterada). Derivar a nefrólogo si ERC.$PROTO_HTA$,
  'Sacks FM et al. DASH-Sodium Collaborative Research Group. Effects on blood pressure of reduced dietary sodium and the DASH diet. NEJM 2001. | Appel LJ et al. A clinical trial of the effects of dietary patterns on blood pressure. NEJM 1997 (DASH). | Whelton PK et al. 2017 ACC/AHA Guideline for the Prevention, Detection, Evaluation, and Management of High Blood Pressure. Hypertension 2018. | Filippou CD et al. Dietary approaches to stop hypertension (DASH) diet and blood pressure reduction in adults. Adv Nutr 2021.',
  ARRAY['hta', 'hipertension', 'presion_alta', 'cardiovascular', 'tension_alta'],
  ARRAY['hipertension', 'presion_alta', 'hta', 'cardiovascular'],
  'revision_sistematica', true, true, 'manual'
);

-- ══════════════════════════════════════════════════════════════
-- 16. DISLIPEMIA
-- ══════════════════════════════════════════════════════════════
INSERT INTO public.knowledge_base (
  disciplina, categoria, tipo, titulo, resumen, fuente, tags, condiciones,
  nivel_evidencia, activo, verificado, fuente_tipo
) VALUES (
  'nutricion', 'patologia', 'protocolo',
  'Dislipemia y perfil lipídico',
  $PROTO_DL$PROTOCOLO DISLIPEMIA:
- GRASA SATURADA: reducir a < 7% de calorías totales. Limitar carnes rojas grasas, lácteos enteros, aceite de palma/coco, ultraprocesados.
- GRASA INSATURADA: aumentar. Aceite oliva virgen extra (AOVE 30-40g/día), frutos secos (30g/día), aguacate.
- OMEGA-3: EPA+DHA 2-4g/día para reducción de triglicéridos (30-50%). Pescado azul 3-4 raciones/semana o suplemento.
- FIBRA SOLUBLE: avena, legumbres, manzana, psyllium, berenjena. Reduce LDL 5-15% (Brown et al. 1999).
- FITOESTEROLES: 2g/día reduce LDL 8-10%. Presentes en algunos lácteos enriquecidos.
- EJERCICIO: mejora perfil lipídico (↑HDL, ↓triglicéridos). Entreno aeróbico + fuerza óptimo.
- ALCOHOL: si consume, moderado (≤1-2 bebidas/día). El HDL sube pero no compensa otros riesgos.
- CARBOHIDRATOS REFINADOS: limitar, se asocian a ↑triglicéridos. Priorizar cereales integrales y legumbres.
- ⚠️ Interacción estatinas: evitar pomelo/toronja (inhibe CYP3A4). Coenzima Q10 podría mitigar mialgias.$PROTO_DL$,
  'Brown L et al. Cholesterol-lowering effects of dietary fiber: a meta-analysis. Am J Clin Nutr 1999. | Jacobson TA et al. National Lipid Association recommendations for patient-centered management of dyslipidemia. J Clin Lipidol 2015. | Estruch R et al. Primary prevention of cardiovascular disease with a Mediterranean diet. NEJM 2013 (PREDIMED).',
  ARRAY['colesterol', 'dislipemia', 'ldl', 'trigliceridos', 'hipercolesterolemia'],
  ARRAY['colesterol', 'dislipemia', 'hipercolesterolemia', 'trigliceridos'],
  'revision_sistematica', true, true, 'manual'
);

-- ══════════════════════════════════════════════════════════════
-- 17. HÍGADO GRASO (NAFLD)
-- ══════════════════════════════════════════════════════════════
INSERT INTO public.knowledge_base (
  disciplina, categoria, tipo, titulo, resumen, fuente, tags, condiciones,
  nivel_evidencia, activo, verificado, fuente_tipo
) VALUES (
  'nutricion', 'patologia', 'protocolo',
  'Enfermedad del hígado graso no alcohólico (NAFLD/MAFLD)',
  $PROTO_HG$PROTOCOLO HÍGADO GRASO / NAFLD:
- PÉRDIDA DE PESO: > 5% del peso corporal reduce esteatosis > 30% (Vilar-Gomez et al. 2015). >10% mejora inflamación y fibrosis.
- DIETA MEDITERRÁNEA: evidencia A para reducción de grasa hepática (PREDIMED).
- AZÚCARES AÑADIDOS Y FRUCTOSA: eliminar. La fructosa (especialmente en bebidas azucaradas, zumos y ultraprocesados) se metaboliza en hígado y promueve lipogénesis de novo.
- CARBOHIDRATOS: moderados, de bajo IG. Evitar grandes cargas de CHO refinado.
- GRASA SATURADA: limitar < 10% kcal. Priorizar AOVE como fuente grasa principal.
- CAFÉ: 2-3 tazas/día asociado a menor riesgo de fibrosis hepática (evidencia epidemiológica consistente).
- VITAMINA E: 800 UI/día puede mejorar histología en NASH confirmado por biopsia (PIVENS trial). NO recomendar sin supervisión médica.
- EJERCICIO: aeróbico + fuerza 3-5 días/semana. Reduce grasa hepática incluso sin pérdida de peso significativa.
- ALCOHOL: idealmente 0. Si es posible, limitar drásticamente.$PROTO_HG$,
  'Vilar-Gomez E et al. Weight loss through lifestyle modification significantly reduces features of nonalcoholic steatohepatitis. Gastroenterology 2015. | Sanyal AJ et al. Pioglitazone, vitamin E, or placebo for nonalcoholic steatohepatitis (PIVENS). NEJM 2010. | Romero-Gómez M et al. NAFLD and MAFLD: What Is New in Diagnosis and Classification? J Hepatol 2020.',
  ARRAY['higado_graso', 'nafld', 'mafl', 'higado', 'transaminasas', 'esteatosis'],
  ARRAY['higado_graso', 'nafld', 'esteatosis'],
  'revision_sistematica', true, true, 'manual'
);

-- ══════════════════════════════════════════════════════════════
-- 18. ANSIEDAD / SALUD MENTAL
-- ══════════════════════════════════════════════════════════════
-- Nota: Este protocolo NO existe en los 17 originales de BASE_CONOCIMIENTO,
-- pero es referenciado en detectarTags() línea 404-406.
-- Lo añadimos para completar el sistema.
-- ══════════════════════════════════════════════════════════════
INSERT INTO public.knowledge_base (
  disciplina, categoria, tipo, titulo, resumen, fuente, tags, condiciones,
  nivel_evidencia, activo, verificado, fuente_tipo
) VALUES (
  'nutricion', 'metodologia', 'protocolo',
  'Nutrición y salud mental (ansiedad, depresión)',
  $PROTO_AM$PROTOCOLO ANSIEDAD / SALUD MENTAL:
- Relación bidireccional entre dieta y salud mental (Firth et al. 2020, Lancet Psychiatry).
- Omega-3 (EPA): 1-2g/día con alta concentración de EPA (>60%) muestra beneficio en depresión (Hallahan et al. 2016).
- Magnesio: 200-400 mg/día puede mejorar síntomas de ansiedad leve (Boyle et al. 2017).
- Vitamina D: deficiencia asociada a mayor riesgo de depresión. Mantener >30 ng/ml.
- Fermentados: probióticos y alimentos fermentados pueden mejorar eje intestino-cerebro.
- Evitar: cafeína excesiva (>400mg/día), alcohol, azúcar refinado en grandes cantidades.
- Comidas regulares: evitar largos periodos de ayuno que puedan desestabilizar glucemia y estado de ánimo.
- ⚠️ Si ansiedad/depresión moderada-grave: derivar a psicólogo/psiquiatra. La dieta es coadyuvante.$PROTO_AM$,
  'Firth J et al. Food and mood: a systematic review and meta-analysis of dietary interventions and depression. Lancet Psychiatry 2020. | Hallahan B et al. Efficacy of omega-3 fatty acids in depression. J Clin Psychiatry 2016.',
  ARRAY['ansiedad', 'salud_mental'],
  ARRAY['ansiedad', 'depresion', 'salud_mental'],
  'revision_sistematica', true, true, 'manual'
);

-- ══════════════════════════════════════════════════════════════
-- VERIFICACIÓN
-- ══════════════════════════════════════════════════════════════
SELECT '✅ Seed completado' AS resultado,
       COUNT(*) AS total_protocolos
FROM public.knowledge_base
WHERE fuente_tipo = 'manual' AND tipo = 'protocolo';
