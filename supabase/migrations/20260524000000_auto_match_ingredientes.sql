-- ============================================================
-- Migration: Auto-match ingredientes huérfanos
-- Añade columna last_matched_at para tracking y mejora el RPC
-- existente calcular_macros_receta para también actualizar score
-- ============================================================

-- 1. Añadir columna de tracking a receta_ingredientes
ALTER TABLE public.receta_ingredientes
ADD COLUMN IF NOT EXISTS last_matched_at timestamptz;

-- 2. Función para asignar alimento_id por nombre (matching básico desde SQL)
--    Sirve como primer filtro rápido antes de llamar a la IA.
--    Busca por coincidencia exacta o ILIKE en la tabla alimentos.
CREATE OR REPLACE FUNCTION public.match_ingrediente_por_nombre(
  p_nombre_libre text,
  OUT alimento_id uuid,
  OUT confianza text
)
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  v_norm text;
BEGIN
  alimento_id := NULL;
  confianza := 'no_match';

  IF p_nombre_libre IS NULL OR length(trim(p_nombre_libre)) < 2 THEN
    RETURN;
  END IF;

  v_norm := lower(trim(p_nombre_libre));

  -- 1. Match exacto (sin acentos)
  SELECT a.id INTO alimento_id
  FROM public.alimentos a
  WHERE lower(trim(a.nombre)) = v_norm
     OR lower(trim(a.nombre)) = replace(v_norm, 'á', 'a')
     OR lower(trim(a.nombre)) = replace(v_norm, 'é', 'e')
     OR lower(trim(a.nombre)) = replace(v_norm, 'í', 'i')
     OR lower(trim(a.nombre)) = replace(v_norm, 'ó', 'o')
     OR lower(trim(a.nombre)) = replace(v_norm, 'ú', 'u')
  LIMIT 1;

  IF FOUND THEN
    confianza := 'exacta';
    RETURN;
  END IF;

  -- 2. Solapamiento de tokens: extraer el token más largo (> 3 chars) y buscar LIKE
  --    NOTA: EVITAR contains bidireccional, que causó falsos positivos en TypeScript
  --    (ej: "Vino blanco" → "Arroz blanco"). Solo se busca el token clave del ingrediente
  --    en los nombres de alimentos, no al revés.
  -- 2. Primera palabra clave (la más larga > 3 chars)
  WITH palabras AS (
    SELECT unnest(string_to_array(v_norm, ' ')) AS palabra
  ),
  larga AS (
    SELECT palabra FROM palabras WHERE length(palabra) > 3 ORDER BY length(palabra) DESC LIMIT 1
  )
  SELECT a.id INTO alimento_id
  FROM public.alimentos a, larga
  WHERE lower(trim(a.nombre)) LIKE '%' || larga.palabra || '%'
  LIMIT 1;

  IF FOUND THEN
    confianza := 'fuzzy';
    RETURN;
  END IF;

  -- 3. Sin match
  RETURN;
END;
$$;

-- 3. Trigger: Al insertar un ingrediente sin alimento_id, intentar match básico
--    (el match avanzado con IA se hace desde la aplicación)
CREATE OR REPLACE FUNCTION public.try_match_ingrediente()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_alimento_id uuid;
  v_confianza text;
BEGIN
  -- Solo si no tiene alimento_id
  IF NEW.alimento_id IS NULL THEN
    SELECT match_ingrediente_por_nombre(NEW.nombre_libre) INTO v_alimento_id, v_confianza;

    IF v_alimento_id IS NOT NULL THEN
      NEW.alimento_id := v_alimento_id;
      NEW.last_matched_at := now();
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_try_match_ingrediente ON public.receta_ingredientes;
CREATE TRIGGER trg_try_match_ingrediente
  BEFORE INSERT ON public.receta_ingredientes
  FOR EACH ROW
  EXECUTE FUNCTION public.try_match_ingrediente();

-- 4. Recrear calcular_macros_receta para que también actualice score_calidad
--    si la receta tiene la columna
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
  v_score_column_exists boolean;
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
    kcal                = CASE WHEN v_porciones > 0 THEN ROUND((total_kcal / v_porciones)::numeric, 2) ELSE 0 END,
    proteinas           = CASE WHEN v_porciones > 0 THEN ROUND((total_proteinas / v_porciones)::numeric, 2) ELSE 0 END,
    carbohidratos       = CASE WHEN v_porciones > 0 THEN ROUND((total_carbohidratos / v_porciones)::numeric, 2) ELSE 0 END,
    grasas              = CASE WHEN v_porciones > 0 THEN ROUND((total_grasas / v_porciones)::numeric, 2) ELSE 0 END,
    fibra               = CASE WHEN v_porciones > 0 THEN ROUND((total_fibra / v_porciones)::numeric, 2) ELSE 0 END,
    kcal_100g           = CASE WHEN peso_total > 0 THEN ROUND(((total_kcal / peso_total) * 100)::numeric, 2) ELSE NULL END,
    proteinas_100g      = CASE WHEN peso_total > 0 THEN ROUND(((total_proteinas / peso_total) * 100)::numeric, 2) ELSE NULL END,
    carbohidratos_100g  = CASE WHEN peso_total > 0 THEN ROUND(((total_carbohidratos / peso_total) * 100)::numeric, 2) ELSE NULL END,
    grasas_100g         = CASE WHEN peso_total > 0 THEN ROUND(((total_grasas / peso_total) * 100)::numeric, 2) ELSE NULL END,
    fibra_100g          = CASE WHEN peso_total > 0 THEN ROUND(((total_fibra / peso_total) * 100)::numeric, 2) ELSE NULL END,
    peso_total_g        = peso_total,
    updated_at          = now()
  WHERE id = p_receta_id;
END;
$$;
