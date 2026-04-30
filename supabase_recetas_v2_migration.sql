-- ============================================================================
-- MIGRACIÓN: recetas v2
-- Descripción: Añade columnas, funciones, triggers, políticas e índices para
--              la nueva versión del módulo de recetas.
-- Idempotente: usa IF NOT EXISTS / OR REPLACE en todos los casos.
-- ============================================================================

-- ============================================================================
-- SECCIÓN 1: ALTER TABLE recetas
-- ============================================================================
ALTER TABLE public.recetas
  ADD COLUMN IF NOT EXISTS estado text NOT NULL DEFAULT 'aprobada'
    CHECK (estado IN ('borrador','en_revision','aprobada','descartada'));

ALTER TABLE public.recetas
  ADD COLUMN IF NOT EXISTS fuente_tipo text DEFAULT 'manual'
    CHECK (fuente_tipo IN ('manual','web','instagram','tiktok','youtube','ia_generada'));

ALTER TABLE public.recetas
  ADD COLUMN IF NOT EXISTS autor_original text;

ALTER TABLE public.recetas
  ADD COLUMN IF NOT EXISTS kcal_100g numeric(7,2);

ALTER TABLE public.recetas
  ADD COLUMN IF NOT EXISTS proteinas_100g numeric(6,2);

ALTER TABLE public.recetas
  ADD COLUMN IF NOT EXISTS carbohidratos_100g numeric(6,2);

ALTER TABLE public.recetas
  ADD COLUMN IF NOT EXISTS grasas_100g numeric(6,2);

ALTER TABLE public.recetas
  ADD COLUMN IF NOT EXISTS fibra_100g numeric(6,2);

ALTER TABLE public.recetas
  ADD COLUMN IF NOT EXISTS peso_total_g numeric(7,2);

ALTER TABLE public.recetas
  ADD COLUMN IF NOT EXISTS tags text[] NOT NULL DEFAULT '{}';

ALTER TABLE public.recetas
  ADD COLUMN IF NOT EXISTS notas_coach text;

ALTER TABLE public.recetas
  ADD COLUMN IF NOT EXISTS raw_scrape jsonb;

ALTER TABLE public.recetas
  ADD COLUMN IF NOT EXISTS similar_ids uuid[] NOT NULL DEFAULT '{}';

-- ============================================================================
-- SECCIÓN 2: ALTER TABLE receta_ingredientes
-- ============================================================================
ALTER TABLE public.receta_ingredientes
  ADD COLUMN IF NOT EXISTS cantidad_original numeric(7,2);

ALTER TABLE public.receta_ingredientes
  ADD COLUMN IF NOT EXISTS unidad_display text;

ALTER TABLE public.receta_ingredientes
  ADD COLUMN IF NOT EXISTS es_opcional boolean NOT NULL DEFAULT false;

-- ============================================================================
-- SECCIÓN 3: FUNCIÓN calcular_macros_receta
-- ============================================================================
CREATE OR REPLACE FUNCTION public.calcular_macros_receta(p_receta_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  total_kcal       numeric := 0;
  total_proteinas  numeric := 0;
  total_carbohidratos numeric := 0;
  total_grasas     numeric := 0;
  total_fibra      numeric := 0;
  peso_total       numeric := 0;
  porciones        numeric;
BEGIN
  -- Obtener el número de porciones de la receta (por defecto 1 si es nulo)
  SELECT COALESCE(porciones, 1) INTO porciones
  FROM public.recetas
  WHERE id = p_receta_id;

  -- Sumar contribuciones de cada ingrediente
  SELECT
    COALESCE(SUM(a.calorias       / 100.0 * ri.cantidad_gramos), 0),
    COALESCE(SUM(a.proteinas      / 100.0 * ri.cantidad_gramos), 0),
    COALESCE(SUM(a.carbohidratos  / 100.0 * ri.cantidad_gramos), 0),
    COALESCE(SUM(a.grasas         / 100.0 * ri.cantidad_gramos), 0),
    COALESCE(SUM(a.fibra          / 100.0 * ri.cantidad_gramos), 0),
    COALESCE(SUM(ri.cantidad_gramos), 0)
  INTO
    total_kcal,
    total_proteinas,
    total_carbohidratos,
    total_grasas,
    total_fibra,
    peso_total
  FROM public.receta_ingredientes ri
  JOIN public.alimentos a ON a.id = ri.alimento_id
  WHERE ri.receta_id = p_receta_id;

  -- Actualizar la receta con los valores calculados
  UPDATE public.recetas
  SET
    kcal             = CASE WHEN porciones > 0 THEN total_kcal / porciones ELSE 0 END,
    proteinas        = CASE WHEN porciones > 0 THEN total_proteinas / porciones ELSE 0 END,
    carbohidratos    = CASE WHEN porciones > 0 THEN total_carbohidratos / porciones ELSE 0 END,
    grasas           = CASE WHEN porciones > 0 THEN total_grasas / porciones ELSE 0 END,
    fibra            = CASE WHEN porciones > 0 THEN total_fibra / porciones ELSE 0 END,
    kcal_100g        = CASE WHEN peso_total > 0 THEN total_kcal / peso_total * 100 ELSE NULL END,
    proteinas_100g   = CASE WHEN peso_total > 0 THEN total_proteinas / peso_total * 100 ELSE NULL END,
    carbohidratos_100g = CASE WHEN peso_total > 0 THEN total_carbohidratos / peso_total * 100 ELSE NULL END,
    grasas_100g      = CASE WHEN peso_total > 0 THEN total_grasas / peso_total * 100 ELSE NULL END,
    fibra_100g       = CASE WHEN peso_total > 0 THEN total_fibra / peso_total * 100 ELSE NULL END,
    peso_total_g     = peso_total,
    updated_at       = now()
  WHERE id = p_receta_id;
END;
$$;

-- ============================================================================
-- SECCIÓN 4: TRIGGER en receta_ingredientes
-- ============================================================================
CREATE OR REPLACE FUNCTION public.trigger_recalcular_macros()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    PERFORM public.calcular_macros_receta(OLD.receta_id);
  ELSE
    PERFORM public.calcular_macros_receta(NEW.receta_id);
  END IF;
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS recalcular_macros_on_ingrediente ON public.receta_ingredientes;
CREATE TRIGGER recalcular_macros_on_ingrediente
AFTER INSERT OR UPDATE OR DELETE ON public.receta_ingredientes
FOR EACH ROW
EXECUTE FUNCTION public.trigger_recalcular_macros();

-- ============================================================================
-- SECCIÓN 5: ACTUALIZAR política RLS cliente
-- ============================================================================
-- Eliminar políticas existentes de cliente sobre recetas y receta_ingredientes
DROP POLICY IF EXISTS "Cliente puede ver recetas aprobadas" ON public.recetas;
DROP POLICY IF EXISTS "Cliente puede ver ingredientes de recetas aprobadas" ON public.receta_ingredientes;

-- Recrear política para recetas: cliente solo ve recetas con estado = 'aprobada'
CREATE POLICY "Cliente puede ver recetas aprobadas"
ON public.recetas
FOR SELECT
TO authenticated
USING (
  (auth.jwt() ->> 'role') = 'cliente'
  AND estado = 'aprobada'
);

-- Recrear política para receta_ingredientes: cliente solo ve ingredientes de recetas aprobadas
CREATE POLICY "Cliente puede ver ingredientes de recetas aprobadas"
ON public.receta_ingredientes
FOR SELECT
TO authenticated
USING (
  (auth.jwt() ->> 'role') = 'cliente'
  AND EXISTS (
    SELECT 1 FROM public.recetas r
    WHERE r.id = receta_id
      AND r.estado = 'aprobada'
  )
);

-- Nota: las políticas existentes para coach se mantienen sin cambios.

-- ============================================================================
-- SECCIÓN 6: ÍNDICES
-- ============================================================================
CREATE INDEX IF NOT EXISTS recetas_estado_idx ON public.recetas(estado);
CREATE INDEX IF NOT EXISTS recetas_tipo_plato_idx ON public.recetas(tipo_plato);
CREATE INDEX IF NOT EXISTS recetas_tags_idx ON public.recetas USING GIN(tags);
CREATE INDEX IF NOT EXISTS recetas_similar_ids_idx ON public.recetas USING GIN(similar_ids);
CREATE INDEX IF NOT EXISTS receta_ingredientes_alimento_id_idx ON public.receta_ingredientes(alimento_id);
