ALTER TABLE public.recetas
  ADD COLUMN IF NOT EXISTS recipe_intelligence_score integer,
  ADD COLUMN IF NOT EXISTS recipe_intelligence_tier text,
  ADD COLUMN IF NOT EXISTS recipe_intelligence_detail jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS recipe_intelligence_flags text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS macro_flex_score integer,
  ADD COLUMN IF NOT EXISTS planning_roles text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS recipe_intelligence_updated_at timestamptz;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'recetas_recipe_intelligence_score_range'
  ) THEN
    ALTER TABLE public.recetas
      ADD CONSTRAINT recetas_recipe_intelligence_score_range
      CHECK (recipe_intelligence_score IS NULL OR (recipe_intelligence_score >= 0 AND recipe_intelligence_score <= 100)) NOT VALID;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'recetas_macro_flex_score_range'
  ) THEN
    ALTER TABLE public.recetas
      ADD CONSTRAINT recetas_macro_flex_score_range
      CHECK (macro_flex_score IS NULL OR (macro_flex_score >= 0 AND macro_flex_score <= 100)) NOT VALID;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'recetas_recipe_intelligence_tier_valid'
  ) THEN
    ALTER TABLE public.recetas
      ADD CONSTRAINT recetas_recipe_intelligence_tier_valid
      CHECK (
        recipe_intelligence_tier IS NULL
        OR recipe_intelligence_tier IN ('elite', 'pro', 'usable', 'revisar', 'bloqueada')
      ) NOT VALID;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_recetas_recipe_intelligence_score
  ON public.recetas(recipe_intelligence_score DESC NULLS LAST);

CREATE INDEX IF NOT EXISTS idx_recetas_macro_flex_score
  ON public.recetas(macro_flex_score DESC NULLS LAST);

CREATE INDEX IF NOT EXISTS idx_recetas_planning_roles
  ON public.recetas USING gin(planning_roles);

CREATE INDEX IF NOT EXISTS idx_recetas_recipe_intelligence_flags
  ON public.recetas USING gin(recipe_intelligence_flags);
