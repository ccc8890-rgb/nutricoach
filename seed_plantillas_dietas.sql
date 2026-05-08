-- ============================================================
-- SEED: 7 Plantillas de Dieta Base (v5 — Enfoque sostenible)
-- Basado en tendencias actuales de nutrición (2024-2025)
-- ============================================================
--
-- REFERENCIAS / INFLUENCIAS:
-- • Dr. Mike Israetel / Renaissance Periodization: calorie floors
--   (mujeres nunca <1.600, hombres nunca <2.000), déficit máx 15%
-- • Alan Aragon: proteína 1.6-1.8 g/kg óptimo para gen pop
-- • Morton et al. (2018) meta-análisis: 1.6 g/kg plateau MPS
-- • Eric Trexler / Menno Henselmans: grasas mín. 0.8 g/kg
--   para salud hormonal óptima
--
-- FILOSOFÍA:
-- • Sostenible > agresivo (no somos culturistas)
-- • Proteína ~1.6-1.8 g/kg (suficiente para gen pop)
-- • Grasas mín. 25-30% kcal para función hormonal (MUY importante)
-- • Carbohidratos generosos para adherencia y energía
-- • Déficit máx 10-15%, con suelo de 1.600-2.000 kcal
-- 
-- INSTRUCCIONES:
-- 1. Abre Supabase > SQL Editor
-- 2. Obtén tu coach_id: SELECT id FROM profiles WHERE role = 'coach';
-- 3. Reemplaza 'REEMPLAZAR_CON_TU_COACH_ID' con el UUID
-- 4. Ejecuta
-- ============================================================

-- ============================================================
-- PÉRDIDA DE PESO (Déficit 10-15%, suelo mínimo 1.600 kcal)
-- ============================================================

-- Plantilla 1: "Pérdida suave (1.600 kcal)"
-- Perfil: Mujer pequeña (~60-65kg) comenzando proceso
-- Prot: 1.7g/kg ~ 105g (26%) | Grasas: ~0.9g/kg = 55g (31%)
-- Carbs: (1600-420-495)/4 = 171g (43%)
INSERT INTO public.plantillas_dietas (coach_id, nombre, descripcion, kcal_objetivo, proteinas_objetivo, carbohidratos_objetivo, grasas_objetivo)
VALUES (
  'REEMPLAZAR_CON_TU_COACH_ID',
  'Pérdida suave (1.600 kcal)',
  'Déficit suave para inicio de pérdida de peso. Perfil: mujer pequeña o persona ligera (~60kg) que empieza. Proteína suficiente 1.7g/kg (105g). Grasas generosas (31%) para salud hormonal femenina. Una de las tendencias más actuales en nutrición sostenible.',
  1600, 105, 171, 55
);

-- Plantilla 2: "Pérdida moderada (1.900 kcal)"
-- Perfil: Mujer activa u hombre ligero (~68-72kg)
-- Prot: 1.7g/kg ~ 120g (25%) | Grasas: ~0.9g/kg = 62g (29%)
-- Carbs: (1900-480-558)/4 = 216g (45%)
INSERT INTO public.plantillas_dietas (coach_id, nombre, descripcion, kcal_objetivo, proteinas_objetivo, carbohidratos_objetivo, grasas_objetivo)
VALUES (
  'REEMPLAZAR_CON_TU_COACH_ID',
  'Pérdida moderada (1.900 kcal)',
  'Déficit moderado para pérdida de peso sostenible. Perfil: mujer activa u hombre ligero (~70kg). Proteína equilibrada (120g). Carbohidratos generosos (216g / 45%) para mantener energía sin sensación de restricción.',
  1900, 120, 216, 62
);

-- Plantilla 3: "Pérdida activa (2.200 kcal)"
-- Perfil: Hombre activo (~78-82kg) que entrena
-- Prot: 1.7g/kg ~ 135g (25%) | Grasas: ~0.8g/kg = 65g (27%)
-- Carbs: (2200-540-585)/4 = 269g (49%)
INSERT INTO public.plantillas_dietas (coach_id, nombre, descripcion, kcal_objetivo, proteinas_objetivo, carbohidratos_objetivo, grasas_objetivo)
VALUES (
  'REEMPLAZAR_CON_TU_COACH_ID',
  'Pérdida activa (2.200 kcal)',
  'Déficit ligero para hombre activo que entrena y busca pérdida de grasa sin sacrificar rendimiento. Proteína 1.7g/kg (135g). Carbohidratos altos (269g / 49%) para rendimiento en entrenos y buena adherencia.',
  2200, 135, 269, 65
);

-- ============================================================
-- GANANCIA DE MASA MUSCULAR (Superávit moderado)
-- ============================================================

-- Plantilla 4: "Ganancia moderada (2.600 kcal)"
-- Perfil: Hombre ~80kg entrenando fuerza
-- Prot: 1.7g/kg ~ 140g (21%) | Grasas: ~0.8g/kg = 65g (23%)
-- Carbs: (2600-560-585)/4 = 364g (56%)
INSERT INTO public.plantillas_dietas (coach_id, nombre, descripcion, kcal_objetivo, proteinas_objetivo, carbohidratos_objetivo, grasas_objetivo)
VALUES (
  'REEMPLAZAR_CON_TU_COACH_ID',
  'Ganancia moderada (2.600 kcal)',
  'Superávit moderado para ganancia muscular limpia. Perfil: persona que entrena fuerza (~80kg). Carbohidratos altos (364g / 56%) para maximizar rendimiento y recuperación. Proteína 1.7g/kg suficiente para hipertrofia.',
  2600, 140, 364, 65
);

-- Plantilla 5: "Ganancia activa (2.900 kcal)"
-- Perfil: Persona grande (~85-90kg) / hardgainer
-- Prot: 1.7g/kg ~ 150g (21%) | Grasas: ~0.8g/kg = 70g (22%)
-- Carbs: (2900-600-630)/4 = 418g (58%)
INSERT INTO public.plantillas_dietas (coach_id, nombre, descripcion, kcal_objetivo, proteinas_objetivo, carbohidratos_objetivo, grasas_objetivo)
VALUES (
  'REEMPLAZAR_CON_TU_COACH_ID',
  'Ganancia activa (2.900 kcal)',
  'Superávit para ganancia de volumen en personas con alta demanda energética. Perfil: hardgainer o persona grande (~85-90kg). Alta densidad de carbohidratos (418g / 58%) para rendimiento máximo.',
  2900, 150, 418, 70
);

-- ============================================================
-- RECOMPOSICIÓN CORPORAL (Déficit ligero)
-- ============================================================

-- Plantilla 6: "Recomposición (2.000 kcal)"
-- Perfil: Persona ~73-78kg principiante/retomando
-- Prot: 1.8g/kg ~ 135g (27%) | Grasas: ~0.8g/kg = 58g (26%)
-- Carbs: (2000-540-522)/4 = 235g (47%)
INSERT INTO public.plantillas_dietas (coach_id, nombre, descripcion, kcal_objetivo, proteinas_objetivo, carbohidratos_objetivo, grasas_objetivo)
VALUES (
  'REEMPLAZAR_CON_TU_COACH_ID',
  'Recomposición (2.000 kcal)',
  'Déficit ligero para recomposición en principiantes o personas que retoman actividad (~75kg). Proteína ligeramente elevada (1.8g/kg / 135g) para optimizar balance nitrogenado. Carbohidratos generosos (235g) para adherencia.',
  2000, 135, 235, 58
);

-- ============================================================
-- CARGA DE CARBOHIDRATOS PARA COMPETICIÓN
-- Basado en protocolos clásicos: 3 días previos, 8-12g/kg carbos
-- ============================================================

-- Plantilla 8: "Carga pre-competición (8g/kg carbos)"
-- Perfil: Deportista de resistencia (maratón, triatlón, ciclismo)
-- Basado en: Burke et al. (2011) — entrenamiento con baja disponibilidad
-- + carga clásica de 3 días con 8-12g/kg/día de carbohidratos
INSERT INTO public.plantillas_dietas (coach_id, nombre, descripcion, tipo, kcal_objetivo, proteinas_objetivo, carbohidratos_objetivo, grasas_objetivo)
VALUES (
  'REEMPLAZAR_CON_TU_COACH_ID',
  'Carga clásica (8g/kg carbos)',
  'Protocolo de carga de carbohidratos para competición de resistencia. 3 días previos con 8g/kg/día de carbohidratos. Basado en protocolo clásico de supercompensación de glucógeno. Proteína moderada (1.6g/kg) para no interferir con la carga. Grasas reducidas al mínimo (0.6g/kg) para maximizar ingesta de carbohidratos sin exceder kcal totales.',
  'carga',
  3200, 120, 600, 45
);

-- Plantilla 9: "Carga intensiva (12g/kg carbos)"
-- Perfil: Deportista de ultra-resistencia (>3h de competición)
-- Mayor densidad de carbohidratos para maximizar depósitos
INSERT INTO public.plantillas_dietas (coach_id, nombre, descripcion, tipo, kcal_objetivo, proteinas_objetivo, carbohidratos_objetivo, grasas_objetivo)
VALUES (
  'REEMPLAZAR_CON_TU_COACH_ID',
  'Carga intensiva (12g/kg carbos)',
  'Protocolo de carga intensiva para deportes de ultra-resistencia (maratón, triatlón Ironman, ultra-trail). 12g/kg/día de carbohidratos los 3 días previos. Proteína moderada (1.4g/kg). Grasas mínimas (0.4g/kg) para priorizar carbohidratos al máximo.',
  'carga',
  4000, 105, 900, 30
);

-- ============================================================
-- SUPLEMENTACIÓN PARA COMPETICIÓN
-- ============================================================

-- Plantilla 10: "Suplementos carrera (60-90 min)"
-- Perfil: Deportista que va a competir y necesita pauta de geles/electrolitos
INSERT INTO public.plantillas_dietas (coach_id, nombre, descripcion, tipo, kcal_objetivo, proteinas_objetivo, carbohidratos_objetivo, grasas_objetivo)
VALUES (
  'REEMPLAZAR_CON_TU_COACH_ID',
  'Protocolo suplementos (60-90 min)',
  'Plan de suplementación para competición de media distancia (~60-90 min). 1 gel cada 30 min (25g carbos cada uno), electrolitos cada 60 min, cafeína opcional 100mg 30 min antes. Hidratación 150ml cada 15 min. Ajustar según tolerancia individual del deportista.',
  'suplementos',
  600, 0, 150, 0
);

-- Plantilla 11: "Suplementos ultra (>3h)"
-- Perfil: Deportista de ultra-resistencia con necesidades mayores
INSERT INTO public.plantillas_dietas (coach_id, nombre, descripcion, tipo, kcal_objetivo, proteinas_objetivo, carbohidratos_objetivo, grasas_objetivo)
VALUES (
  'REEMPLAZAR_CON_TU_COACH_ID',
  'Protocolo suplementos ultra (>3h)',
  'Plan de suplementación para ultra-resistencia (>3h). 1 gel cada 20 min (25g carbos), electrolitos cada 30 min, cafeína 200mg con tolerancia. Hidratación 200ml cada 15 min. Incluir fuente de proteína líquida a partir de la hora 2 para reducir daño muscular.',
  'suplementos',
  2000, 40, 450, 10
);

-- Plantilla 7: "Recomposición activa (2.300 kcal)"
-- Perfil: Persona ~78-82kg entrenando regularmente
-- Prot: 1.7g/kg ~ 140g (24%) | Grasas: ~0.8g/kg = 62g (24%)
-- Carbs: (2300-560-558)/4 = 296g (51%)
INSERT INTO public.plantillas_dietas (coach_id, nombre, descripcion, kcal_objetivo, proteinas_objetivo, carbohidratos_objetivo, grasas_objetivo)
VALUES (
  'REEMPLAZAR_CON_TU_COACH_ID',
  'Recomposición activa (2.300 kcal)',
  'Ligero déficit para recomposición en personas que entrenan regularmente (~80kg). Carbohidratos dominantes (296g / 51%) para rendimiento en entrenos. Proteína 1.7g/kg (140g) para balance nitrogenado positivo.',
  2300, 140, 296, 62
);
