-- Recetario inteligente v2: taxonomía profesional para generación semanal/14 días.

ALTER TABLE recetas
  ADD COLUMN IF NOT EXISTS objetivos text[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS deportes text[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS momentos text[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS estilos text[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS densidad_energetica text,
  ADD COLUMN IF NOT EXISTS digestibilidad text,
  ADD COLUMN IF NOT EXISTS nivel_elaboracion integer,
  ADD COLUMN IF NOT EXISTS adherencia_score integer,
  ADD COLUMN IF NOT EXISTS premium_chef boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS uso_personal boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS batch_cooking boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS tupper boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS coste_estimado_nivel text,
  ADD COLUMN IF NOT EXISTS taxonomia_version integer DEFAULT 2,
  ADD COLUMN IF NOT EXISTS taxonomia_actualizada_at timestamptz DEFAULT now();

ALTER TABLE recetas
  ADD CONSTRAINT recetas_nivel_elaboracion_range
  CHECK (nivel_elaboracion IS NULL OR (nivel_elaboracion >= 1 AND nivel_elaboracion <= 5)) NOT VALID;

ALTER TABLE recetas
  ADD CONSTRAINT recetas_adherencia_score_range
  CHECK (adherencia_score IS NULL OR (adherencia_score >= 0 AND adherencia_score <= 100)) NOT VALID;

UPDATE recetas
SET
  momentos = ARRAY_REMOVE(ARRAY[
    CASE
      WHEN lower(coalesce(tipo_plato, categoria, '')) LIKE '%desayuno%' THEN 'desayuno'
      WHEN lower(coalesce(tipo_plato, categoria, '')) LIKE '%almuerzo%' THEN 'media_manana'
      WHEN lower(coalesce(tipo_plato, categoria, '')) LIKE '%snack%' THEN 'merienda'
      WHEN lower(coalesce(tipo_plato, categoria, '')) LIKE '%merienda%' THEN 'merienda'
      WHEN lower(coalesce(tipo_plato, categoria, '')) LIKE '%cena%' THEN 'cena'
      WHEN lower(coalesce(tipo_plato, categoria, '')) LIKE '%comida%' THEN 'comida'
      ELSE NULL
    END
  ], NULL),
  objetivos = CASE
    WHEN coalesce(apta_cliente, '') IN ('perdida_grasa') THEN ARRAY['perdida_grasa','recomposicion']
    WHEN coalesce(apta_cliente, '') IN ('ganancia_muscular') THEN ARRAY['ganancia_muscular','recomposicion']
    WHEN coalesce(apta_cliente, '') IN ('atleta') THEN ARRAY['rendimiento','ganancia_muscular']
    WHEN coalesce(apta_cliente, '') IN ('clinica') THEN ARRAY['salud_general']
    WHEN coalesce(apta_cliente, '') IN ('mantenimiento') THEN ARRAY['mantenimiento','salud_general']
    ELSE ARRAY['salud_general','mantenimiento']
  END,
  deportes = CASE
    WHEN coalesce(apta_cliente, '') = 'atleta' OR coalesce(tags, '{}') && ARRAY['running','hyrox','ciclismo','triatlon','pre entreno','post entreno','rendimiento'] THEN ARRAY['running','hyrox','ciclismo','triatlon','endurance','general']
    ELSE ARRAY['general']
  END,
  estilos = ARRAY_REMOVE(ARRAY[
    'funcional',
    CASE WHEN coalesce(tags, '{}') && ARRAY['tupper','meal prep','batch cooking'] THEN 'batch_cooking' ELSE NULL END,
    CASE WHEN coalesce(tags, '{}') && ARRAY['tupper','meal prep'] THEN 'tupper' ELSE NULL END,
    CASE WHEN coalesce(tags, '{}') && ARRAY['gourmet','chef','comfort','healthy'] THEN 'chef_healthy' ELSE NULL END,
    CASE WHEN (coalesce(tiempo_prep_min, 0) + coalesce(tiempo_coccion_min, 0)) > 0 AND (coalesce(tiempo_prep_min, 0) + coalesce(tiempo_coccion_min, 0)) <= 20 THEN 'rapida' ELSE NULL END
  ], NULL),
  densidad_energetica = CASE
    WHEN coalesce(kcal, 0) < 350 THEN 'baja'
    WHEN coalesce(kcal, 0) <= 650 THEN 'media'
    ELSE 'alta'
  END,
  digestibilidad = CASE
    WHEN coalesce(grasas, 0) >= 35 THEN 'pesada'
    WHEN coalesce(kcal, 0) <= 450 AND coalesce(grasas, 0) <= 18 THEN 'ligera'
    ELSE 'media'
  END,
  nivel_elaboracion = CASE
    WHEN coalesce(dificultad, '') ILIKE '%dif%' THEN 4
    WHEN (coalesce(tiempo_prep_min, 0) + coalesce(tiempo_coccion_min, 0)) >= 45 THEN 4
    WHEN (coalesce(tiempo_prep_min, 0) + coalesce(tiempo_coccion_min, 0)) BETWEEN 25 AND 44 THEN 3
    WHEN (coalesce(tiempo_prep_min, 0) + coalesce(tiempo_coccion_min, 0)) BETWEEN 1 AND 24 THEN 2
    ELSE 3
  END,
  adherencia_score = LEAST(100, GREATEST(35,
    coalesce(score_calidad, 60)
    + CASE WHEN imagen_url IS NOT NULL THEN 8 ELSE -10 END
    + CASE WHEN coalesce(tags, '{}') && ARRAY['gourmet','chef','comfort','healthy'] THEN 10 ELSE 0 END
    + CASE WHEN (coalesce(tiempo_prep_min, 0) + coalesce(tiempo_coccion_min, 0)) BETWEEN 1 AND 25 THEN 6 ELSE 0 END
  )),
  premium_chef = coalesce(tags, '{}') && ARRAY['gourmet','chef','comfort','healthy'],
  batch_cooking = coalesce(tags, '{}') && ARRAY['batch cooking','meal prep'],
  tupper = coalesce(tags, '{}') && ARRAY['tupper','meal prep'],
  coste_estimado_nivel = CASE
    WHEN coalesce(kcal, 0) > 700 OR coalesce(proteinas, 0) > 45 THEN 'medio'
    ELSE 'bajo'
  END,
  taxonomia_version = 2,
  taxonomia_actualizada_at = now()
WHERE estado = 'aprobada';

CREATE INDEX IF NOT EXISTS idx_recetas_objetivos_gin ON recetas USING gin(objetivos);
CREATE INDEX IF NOT EXISTS idx_recetas_deportes_gin ON recetas USING gin(deportes);
CREATE INDEX IF NOT EXISTS idx_recetas_momentos_gin ON recetas USING gin(momentos);
CREATE INDEX IF NOT EXISTS idx_recetas_estilos_gin ON recetas USING gin(estilos);
CREATE INDEX IF NOT EXISTS idx_recetas_premium_chef ON recetas(premium_chef);
CREATE INDEX IF NOT EXISTS idx_recetas_adherencia_score ON recetas(adherencia_score);
