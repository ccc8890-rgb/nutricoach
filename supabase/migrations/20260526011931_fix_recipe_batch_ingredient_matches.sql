-- Corrige falsos matches detectados en las recetas chef healthy en revisión.
-- Root cause: el matcher SQL por tokens elegía productos de supermercado que
-- comparten una palabra ("Paté de Pimienta") antes que el ingrediente culinario.

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
  v_tokens text[];
BEGIN
  alimento_id := NULL;
  confianza := 'no_match';

  IF p_nombre_libre IS NULL OR length(trim(p_nombre_libre)) < 2 THEN
    RETURN;
  END IF;

  v_norm := lower(trim(regexp_replace(p_nombre_libre, '\([^)]*\)', ' ', 'g')));
  v_norm := translate(v_norm, 'áéíóúüñ', 'aeiouun');
  v_norm := regexp_replace(v_norm, '[^a-z0-9\s]', ' ', 'g');
  v_norm := regexp_replace(v_norm, '\s+', ' ', 'g');
  v_norm := trim(v_norm);

  -- Aliases culinarios seguros. Son ingredientes frecuentes donde el catálogo
  -- de supermercado introduce falsos positivos por producto preparado.
  SELECT a.id INTO alimento_id
  FROM public.alimentos a
  WHERE a.nombre = CASE
    WHEN v_norm IN ('sal y pimienta', 'pimienta', 'pimienta negra') THEN 'Pimienta negra molida'
    WHEN v_norm LIKE 'pimienta negra %' THEN 'Pimienta negra molida'
    WHEN v_norm LIKE 'yogur griego natural 0%' OR v_norm LIKE 'yogur griego natural 0 %' THEN 'Yogur griego natural (0%)'
    WHEN v_norm = 'yogur griego natural' THEN 'Yogur griego natural'
    WHEN v_norm LIKE 'zanahoria rallada%' THEN 'Zanahoria'
    WHEN v_norm = 'kale' OR v_norm LIKE 'kale %' THEN 'Kale (col rizada)'
    WHEN v_norm LIKE 'zumo de limon%' OR v_norm LIKE 'jugo de limon%' THEN 'Limón'
    WHEN v_norm = 'miso' OR v_norm LIKE 'miso %' THEN 'Miso blanco'
    WHEN v_norm LIKE 'quinoa cocida%' THEN 'Quinoa (cocida)'
    WHEN v_norm LIKE 'arroz integral cocido%' THEN 'Arroz integral (cocido)'
    WHEN v_norm LIKE 'arroz integral en seco%' OR v_norm LIKE 'arroz integral crudo%' THEN 'Arroz integral (crudo)'
    WHEN v_norm LIKE 'pechuga de pollo fileteada%' OR v_norm LIKE 'pechuga de pollo filete grande%' THEN 'Pechuga de pollo (cruda)'
    WHEN v_norm LIKE 'pechuga de pollo cocida%' THEN 'Pechuga de pollo'
    ELSE NULL
  END
  LIMIT 1;

  IF FOUND THEN
    confianza := 'alias_seguro';
    RETURN;
  END IF;

  -- 1. Match exacto sobre nombre normalizado.
  SELECT a.id INTO alimento_id
  FROM public.alimentos a
  WHERE trim(regexp_replace(translate(lower(a.nombre), 'áéíóúüñ', 'aeiouun'), '[^a-z0-9\s]', ' ', 'g')) = v_norm
  ORDER BY
    CASE
      WHEN translate(lower(a.nombre), 'áéíóúüñ', 'aeiouun') LIKE 'pate%' THEN 1
      ELSE 0
    END,
    length(a.nombre) ASC
  LIMIT 1;

  IF FOUND THEN
    confianza := 'exacta';
    RETURN;
  END IF;

  -- 2. Fuzzy conservador por tokens significativos.
  SELECT array_agg(token ORDER BY length(token) DESC) INTO v_tokens
  FROM (
    SELECT DISTINCT token
    FROM regexp_split_to_table(v_norm, '\s+') AS token
    WHERE length(token) > 3
      AND token NOT IN (
        'salsa', 'baja', 'bajo', 'alta', 'alto', 'integral', 'natural',
        'fresco', 'fresca', 'sodio', 'pequeno', 'pequenos', 'pequena', 'pequenas',
        'crujiente', 'ligera', 'ligero', 'casero', 'casera', 'cocido',
        'cocida', 'asado', 'asada', 'encurtida', 'picado', 'picada',
        'rallada', 'rallado', 'fileteada', 'fileteado'
      )
  ) t;

  IF v_tokens IS NULL OR array_length(v_tokens, 1) IS NULL THEN
    RETURN;
  END IF;

  WITH candidatos AS (
    SELECT
      a.id,
      regexp_replace(translate(lower(a.nombre), 'áéíóúüñ', 'aeiouun'), '[^a-z0-9\s]', ' ', 'g') AS nombre_norm
    FROM public.alimentos a
  ),
  puntuados AS (
    SELECT
      c.id,
      c.nombre_norm,
      (
        SELECT count(*)
        FROM unnest(v_tokens) AS token
        WHERE c.nombre_norm ~ ('(^|\s)' || token || '(\s|$)')
      ) AS score
    FROM candidatos c
  )
  SELECT p.id INTO alimento_id
  FROM puntuados p
  WHERE
    (
      v_norm NOT LIKE 'salsa %' OR trim(p.nombre_norm) LIKE 'salsa%'
    )
    AND trim(p.nombre_norm) NOT LIKE 'pate %'
    AND trim(p.nombre_norm) NOT LIKE 'pate'
    AND trim(p.nombre_norm) NOT LIKE 'zumo %'
    AND trim(p.nombre_norm) NOT LIKE 'bebida %'
    AND (
      (
        array_length(v_tokens, 1) = 1
        AND p.score = 1
        AND trim(p.nombre_norm) ~ ('(^|\s)' || v_tokens[1] || '(\s|$)')
      )
      OR (
        array_length(v_tokens, 1) >= 2
        AND p.score >= 2
      )
    )
  ORDER BY p.score DESC, abs(length(p.nombre_norm) - length(v_norm)) ASC
  LIMIT 1;

  IF FOUND THEN
    confianza := 'fuzzy_segura';
    RETURN;
  END IF;

  RETURN;
END;
$$;

WITH fixes(pattern, alimento_nombre) AS (
  VALUES
    ('%sal y pimienta%', 'Pimienta negra molida'),
    ('%pimienta negra%', 'Pimienta negra molida'),
    ('%yogur griego natural 0%', 'Yogur griego natural (0%)'),
    ('%zanahoria rallada%', 'Zanahoria'),
    ('kale', 'Kale (col rizada)'),
    ('%zumo de limón%', 'Limón'),
    ('%zumo de limon%', 'Limón'),
    ('miso', 'Miso blanco'),
    ('%quinoa cocida%', 'Quinoa (cocida)'),
    ('%arroz integral cocido%', 'Arroz integral (cocido)'),
    ('%arroz integral (en seco)%', 'Arroz integral (crudo)'),
    ('%pechuga de pollo fileteada%', 'Pechuga de pollo (cruda)'),
    ('%pechuga de pollo (filete grande)%', 'Pechuga de pollo (cruda)'),
    ('%pechuga de pollo cocida%', 'Pechuga de pollo')
),
matched AS (
  SELECT
    ri.id AS ingrediente_id,
    ri.receta_id,
    a.id AS alimento_id
  FROM public.receta_ingredientes ri
  JOIN fixes f ON lower(ri.nombre_libre) LIKE lower(f.pattern)
  JOIN public.alimentos a ON a.nombre = f.alimento_nombre
)
UPDATE public.receta_ingredientes ri
SET alimento_id = m.alimento_id,
    last_matched_at = now()
FROM matched m
WHERE ri.id = m.ingrediente_id;

-- Reintenta el lote chef healthy con la función endurecida.
WITH candidatos AS (
  SELECT
    ri.id AS ingrediente_id,
    (public.match_ingrediente_por_nombre(ri.nombre_libre)).alimento_id AS nuevo_alimento_id
  FROM public.receta_ingredientes ri
  JOIN public.recetas r ON r.id = ri.receta_id
  WHERE r.tags @> ARRAY['chef_healthy_batch']::text[]
)
UPDATE public.receta_ingredientes ri
SET alimento_id = c.nuevo_alimento_id,
    last_matched_at = now()
FROM candidatos c
WHERE ri.id = c.ingrediente_id
  AND c.nuevo_alimento_id IS NOT NULL;

-- Recalcula macros de recetas afectadas por los patrones anteriores.
WITH affected AS (
  SELECT DISTINCT ri.receta_id
  FROM public.receta_ingredientes ri
  JOIN public.recetas r ON r.id = ri.receta_id
  WHERE r.tags @> ARRAY['chef_healthy_batch']::text[]
    OR lower(ri.nombre_libre) LIKE ANY (ARRAY[
      '%sal y pimienta%',
      '%pimienta negra%',
      '%yogur griego natural 0%',
      '%zanahoria rallada%',
      '%kale%',
      '%zumo de limón%',
      '%zumo de limon%',
      '%miso%',
      '%quinoa cocida%',
      '%arroz integral cocido%',
      '%arroz integral (en seco)%',
      '%pechuga de pollo fileteada%',
      '%pechuga de pollo (filete grande)%',
      '%pechuga de pollo cocida%'
    ])
),
totals AS (
  SELECT
    r.id,
    greatest(coalesce(r.porciones, 1), 1) AS porciones,
    coalesce(sum(coalesce(a.calorias, 0) * coalesce(ri.cantidad_gramos, 0) / 100), 0) AS kcal_total,
    coalesce(sum(coalesce(a.proteinas, 0) * coalesce(ri.cantidad_gramos, 0) / 100), 0) AS prot_total,
    coalesce(sum(coalesce(a.carbohidratos, 0) * coalesce(ri.cantidad_gramos, 0) / 100), 0) AS carb_total,
    coalesce(sum(coalesce(a.grasas, 0) * coalesce(ri.cantidad_gramos, 0) / 100), 0) AS grasa_total,
    coalesce(sum(coalesce(a.fibra, 0) * coalesce(ri.cantidad_gramos, 0) / 100), 0) AS fibra_total,
    coalesce(sum(coalesce(ri.cantidad_gramos, 0)), 0) AS peso_total
  FROM public.recetas r
  JOIN affected af ON af.receta_id = r.id
  LEFT JOIN public.receta_ingredientes ri ON ri.receta_id = r.id
  LEFT JOIN public.alimentos a ON a.id = ri.alimento_id
  GROUP BY r.id, r.porciones
)
UPDATE public.recetas r
SET kcal = round((t.kcal_total / t.porciones)::numeric, 1),
    proteinas = round((t.prot_total / t.porciones)::numeric, 1),
    carbohidratos = round((t.carb_total / t.porciones)::numeric, 1),
    grasas = round((t.grasa_total / t.porciones)::numeric, 1),
    fibra = round((t.fibra_total / t.porciones)::numeric, 1),
    kcal_100g = CASE WHEN t.peso_total > 0 THEN round((t.kcal_total / t.peso_total * 100)::numeric, 1) ELSE 0 END,
    peso_total_g = round(t.peso_total)::integer
FROM totals t
WHERE r.id = t.id;
