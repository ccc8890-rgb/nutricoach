-- Control visual de imágenes de recetas.
-- No genera imágenes: solo añade metadatos para revisión, calidad y futura regeneración controlada.

ALTER TABLE recetas
  ADD COLUMN IF NOT EXISTS imagen_origen text DEFAULT 'desconocida',
  ADD COLUMN IF NOT EXISTS imagen_estado text DEFAULT 'pendiente',
  ADD COLUMN IF NOT EXISTS imagen_quality_score integer,
  ADD COLUMN IF NOT EXISTS imagen_realismo_score integer,
  ADD COLUMN IF NOT EXISTS imagen_match_receta_score integer,
  ADD COLUMN IF NOT EXISTS imagen_needs_review boolean DEFAULT true,
  ADD COLUMN IF NOT EXISTS imagen_review_notes text,
  ADD COLUMN IF NOT EXISTS imagen_reviewed_at timestamptz,
  ADD COLUMN IF NOT EXISTS imagen_reviewed_by uuid,
  ADD COLUMN IF NOT EXISTS imagen_prompt_base text,
  ADD COLUMN IF NOT EXISTS imagen_estilo_preset text,
  ADD COLUMN IF NOT EXISTS imagen_updated_at timestamptz DEFAULT now();

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'recetas_imagen_quality_score_range'
  ) THEN
    ALTER TABLE recetas
      ADD CONSTRAINT recetas_imagen_quality_score_range
      CHECK (imagen_quality_score IS NULL OR (imagen_quality_score >= 0 AND imagen_quality_score <= 100)) NOT VALID;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'recetas_imagen_realismo_score_range'
  ) THEN
    ALTER TABLE recetas
      ADD CONSTRAINT recetas_imagen_realismo_score_range
      CHECK (imagen_realismo_score IS NULL OR (imagen_realismo_score >= 0 AND imagen_realismo_score <= 100)) NOT VALID;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'recetas_imagen_match_score_range'
  ) THEN
    ALTER TABLE recetas
      ADD CONSTRAINT recetas_imagen_match_score_range
      CHECK (imagen_match_receta_score IS NULL OR (imagen_match_receta_score >= 0 AND imagen_match_receta_score <= 100)) NOT VALID;
  END IF;
END $$;

UPDATE recetas
SET
  imagen_origen = CASE
    WHEN imagen_url IS NULL OR imagen_url = '' THEN 'missing'
    WHEN fuente_tipo IN ('instagram', 'tiktok', 'youtube', 'web') THEN 'scraped'
    WHEN fuente_tipo IN ('ia_generada', 'deepseek', 'gemini', 'openai') THEN 'ai'
    ELSE coalesce(imagen_origen, 'desconocida')
  END,
  imagen_estado = CASE
    WHEN imagen_url IS NULL OR imagen_url = '' THEN 'sin_imagen'
    WHEN fuente_tipo IN ('ia_generada', 'deepseek', 'gemini', 'openai') THEN 'revisar'
    ELSE coalesce(imagen_estado, 'pendiente')
  END,
  imagen_needs_review = CASE
    WHEN imagen_url IS NULL OR imagen_url = '' THEN true
    WHEN fuente_tipo IN ('ia_generada', 'deepseek', 'gemini', 'openai') THEN true
    ELSE coalesce(imagen_needs_review, false)
  END,
  imagen_quality_score = coalesce(
    imagen_quality_score,
    CASE
      WHEN imagen_url IS NULL OR imagen_url = '' THEN 0
      WHEN fuente_tipo IN ('instagram', 'tiktok', 'youtube', 'web') THEN 72
      WHEN fuente_tipo IN ('ia_generada', 'deepseek', 'gemini', 'openai') THEN 45
      ELSE 55
    END
  ),
  imagen_realismo_score = coalesce(
    imagen_realismo_score,
    CASE
      WHEN imagen_url IS NULL OR imagen_url = '' THEN 0
      WHEN fuente_tipo IN ('instagram', 'tiktok', 'youtube', 'web') THEN 75
      WHEN fuente_tipo IN ('ia_generada', 'deepseek', 'gemini', 'openai') THEN 42
      ELSE 55
    END
  ),
  imagen_match_receta_score = coalesce(imagen_match_receta_score, CASE WHEN imagen_url IS NULL OR imagen_url = '' THEN 0 ELSE 60 END),
  imagen_estilo_preset = coalesce(imagen_estilo_preset, 'real_food_editorial'),
  imagen_updated_at = now()
WHERE imagen_updated_at IS NULL OR imagen_origen = 'desconocida' OR imagen_estado = 'pendiente';

CREATE INDEX IF NOT EXISTS idx_recetas_imagen_estado ON recetas(imagen_estado);
CREATE INDEX IF NOT EXISTS idx_recetas_imagen_origen ON recetas(imagen_origen);
CREATE INDEX IF NOT EXISTS idx_recetas_imagen_needs_review ON recetas(imagen_needs_review);
CREATE INDEX IF NOT EXISTS idx_recetas_imagen_quality_score ON recetas(imagen_quality_score);
