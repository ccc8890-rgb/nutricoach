-- ============================================================
-- FIX: Trigger calcular_macros_receta referencia columnas antiguas
-- Las columnas kcal_por_porcion, proteinas_por_porcion, etc.
-- fueron renombradas a kcal, proteinas, etc. pero el trigger
-- aún intenta actualizarlas, causando error 42703.
-- ============================================================

CREATE OR REPLACE FUNCTION public.calcular_macros_receta(p_receta_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  total_kcal         numeric := 0;
  total_proteinas    numeric := 0;
  total_carbohidratos numeric := 0;
  total_grasas       numeric := 0;
  total_fibra        numeric := 0;
  peso_total         numeric := 0;
  v_porciones        numeric;
BEGIN
  SELECT COALESCE(porciones, 1) INTO v_porciones
  FROM public.recetas
  WHERE id = p_receta_id;

  SELECT
    COALESCE(SUM(a.calorias       / 100.0 * ri.cantidad_gramos), 0),
    COALESCE(SUM(a.proteinas      / 100.0 * ri.cantidad_gramos), 0),
    COALESCE(SUM(a.carbohidratos  / 100.0 * ri.cantidad_gramos), 0),
    COALESCE(SUM(a.grasas         / 100.0 * ri.cantidad_gramos), 0),
    COALESCE(SUM(a.fibra          / 100.0 * ri.cantidad_gramos), 0),
    COALESCE(SUM(ri.cantidad_gramos), 0)
  INTO
    total_kcal, total_proteinas, total_carbohidratos,
    total_grasas, total_fibra, peso_total
  FROM public.receta_ingredientes ri
  LEFT JOIN public.alimentos a ON a.id = ri.alimento_id
  WHERE ri.receta_id = p_receta_id;

  UPDATE public.recetas
  SET
    kcal                = CASE WHEN v_porciones > 0 THEN total_kcal / v_porciones ELSE 0 END,
    proteinas           = CASE WHEN v_porciones > 0 THEN total_proteinas / v_porciones ELSE 0 END,
    carbohidratos       = CASE WHEN v_porciones > 0 THEN total_carbohidratos / v_porciones ELSE 0 END,
    grasas              = CASE WHEN v_porciones > 0 THEN total_grasas / v_porciones ELSE 0 END,
    fibra               = CASE WHEN v_porciones > 0 THEN total_fibra / v_porciones ELSE 0 END,
    kcal_100g           = CASE WHEN peso_total > 0 THEN (total_kcal / peso_total) * 100 ELSE NULL END,
    proteinas_100g      = CASE WHEN peso_total > 0 THEN (total_proteinas / peso_total) * 100 ELSE NULL END,
    carbohidratos_100g  = CASE WHEN peso_total > 0 THEN (total_carbohidratos / peso_total) * 100 ELSE NULL END,
    grasas_100g         = CASE WHEN peso_total > 0 THEN (total_grasas / peso_total) * 100 ELSE NULL END,
    fibra_100g          = CASE WHEN peso_total > 0 THEN (total_fibra / peso_total) * 100 ELSE NULL END,
    peso_total_g        = peso_total,
    updated_at          = now()
  WHERE id = p_receta_id;
END;
$$;

-- Ahora borramos el duplicado de Arroz del Senyoret (el más antiguo)
DELETE FROM public.receta_ingredientes WHERE receta_id = '0a589883-6fd5-43b2-a3df-46bd1658e51f';
DELETE FROM public.recetas WHERE id = '0a589883-6fd5-43b2-a3df-46bd1658e51f';
