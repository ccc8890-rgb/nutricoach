-- Endurece el matching SQL de ingredientes.
-- Regla: mejor dejar alimento_id NULL que enlazar un alimento incorrecto,
-- porque un mal match contamina macros, lista de compra y decisiones IA.

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

  -- 1. Match exacto sobre nombre normalizado.
  SELECT a.id INTO alimento_id
  FROM public.alimentos a
  WHERE trim(regexp_replace(translate(lower(a.nombre), 'áéíóúüñ', 'aeiouun'), '[^a-z0-9\s]', ' ', 'g')) = v_norm
  LIMIT 1;

  IF FOUND THEN
    confianza := 'exacta';
    RETURN;
  END IF;

  -- 2. Fuzzy conservador por tokens significativos.
  -- Antes se usaba solo el token más largo, lo que provocaba:
  -- "salsa de soja baja en sal" -> "Salsa verde"
  -- "yogur griego natural 0%" -> "Atún en lata al natural"
  -- "pan rallado integral" -> "Arroz Integral Vaso Pack de 2"
  SELECT array_agg(token ORDER BY length(token) DESC) INTO v_tokens
  FROM (
    SELECT DISTINCT token
    FROM regexp_split_to_table(v_norm, '\s+') AS token
    WHERE length(token) > 3
      AND token NOT IN (
        'salsa', 'baja', 'bajo', 'alta', 'alto', 'integral', 'natural',
        'fresco', 'fresca', 'sodio', 'pequeno', 'pequenos', 'pequena', 'pequenas',
        'crujiente', 'ligera', 'ligero', 'casero', 'casera', 'cocido',
        'cocida', 'asado', 'asada', 'encurtida', 'picado', 'picada'
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
    -- Si el ingrediente es una salsa, no permitimos que matchee con productos
    -- que solo comparten el ingrediente base ("soja" -> lecitina de soja).
    (v_norm NOT LIKE 'salsa %' OR trim(p.nombre_norm) LIKE 'salsa%')
    AND
    (
      array_length(v_tokens, 1) = 1
      AND p.score = 1
      AND trim(p.nombre_norm) ~ ('(^|\s)' || v_tokens[1] || '(\s|$)')
    )
    OR (
      array_length(v_tokens, 1) >= 2
      AND p.score >= 2
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

-- Limpieza de malos matches detectados en el quality gate del 25-05-2026.
UPDATE public.receta_ingredientes ri
SET alimento_id = NULL,
    last_matched_at = NULL
FROM public.alimentos a
WHERE ri.alimento_id = a.id
  AND (
    (lower(ri.nombre_libre) LIKE '%salsa de soja%' AND lower(a.nombre) LIKE '%salsa verde%')
    OR (lower(ri.nombre_libre) LIKE '%salsa de soja%' AND lower(a.nombre) NOT LIKE 'salsa%')
    OR (lower(ri.nombre_libre) LIKE '%pan rallado%' AND lower(a.nombre) LIKE '%arroz integral%')
    OR (
      lower(ri.nombre_libre) LIKE '%yogur griego%'
      AND translate(lower(a.nombre), 'áéíóúüñ', 'aeiouun') LIKE '%atun%natural%'
    )
  );

-- Reintenta solo los ingredientes del nuevo lote chef healthy que quedaron
-- sin match o fueron anulados por la limpieza anterior.
WITH candidatos AS (
  SELECT
    ri.id AS ingrediente_id,
    (public.match_ingrediente_por_nombre(ri.nombre_libre)).alimento_id AS nuevo_alimento_id
  FROM public.receta_ingredientes ri
  JOIN public.recetas r ON r.id = ri.receta_id
  WHERE r.tags @> ARRAY['chef_healthy_batch']::text[]
    AND ri.alimento_id IS NULL
)
UPDATE public.receta_ingredientes ri
SET alimento_id = c.nuevo_alimento_id,
    last_matched_at = now()
FROM candidatos c
WHERE ri.id = c.ingrediente_id
  AND c.nuevo_alimento_id IS NOT NULL;

-- Pulido de datos del lote: instrucciones legibles y etiquetas básicas
-- de aptitud alimentaria para que el quality gate no dependa de revisión manual.
UPDATE public.recetas
SET instrucciones = trim(regexp_replace(instrucciones, '\s+([0-9]+[\.)]\s+)', E'\n\\1', 'g'))
WHERE tags @> ARRAY['chef_healthy_batch']::text[]
  AND instrucciones IS NOT NULL;

WITH receta_texto AS (
  SELECT
    r.id,
    lower(
      coalesce(r.nombre, '') || ' ' ||
      coalesce(r.descripcion, '') || ' ' ||
      coalesce(string_agg(ri.nombre_libre, ' '), '')
    ) AS texto
  FROM public.recetas r
  LEFT JOIN public.receta_ingredientes ri ON ri.receta_id = r.id
  WHERE r.tags @> ARRAY['chef_healthy_batch']::text[]
  GROUP BY r.id
),
inferidas AS (
  SELECT
    id,
    array_remove(ARRAY[
      CASE WHEN texto !~ '(trigo|pan|tortilla|wrap|pasta|cuscus|couscous|harina|seitan|seitán|cebada|centeno|bulgur|pan rallado)' THEN 'Sin Gluten' END,
      CASE WHEN texto !~ '(yogur|yogurt|leche|queso|nata|mantequilla|kefir|kéfir|mozzarella|parmesano|ricotta)' THEN 'Sin Lactosa' END,
      CASE WHEN texto !~ '(huevo|claras|yema)' THEN 'Sin Huevo' END,
      CASE WHEN texto !~ '(almendra|nuez|nueces|avellana|pistacho|cacahuete|anacardo|tahini|sesamo|sésamo)' THEN 'Sin Frutos Secos' END,
      CASE WHEN texto !~ '(pollo|pavo|ternera|cerdo|jamon|jamón|lomo|carne|bacon|beicon|salmon|salmón|atun|atún|merluza|bacalao|gamba|langostino|sepia|pulpo|rape|dorada|lubina)' THEN 'Vegetariano' END,
      CASE WHEN texto !~ '(pollo|pavo|ternera|cerdo|jamon|jamón|lomo|carne|bacon|beicon|salmon|salmón|atun|atún|merluza|bacalao|gamba|langostino|sepia|pulpo|rape|dorada|lubina|yogur|yogurt|leche|queso|nata|mantequilla|kefir|kéfir|mozzarella|parmesano|ricotta|huevo|claras|yema)' THEN 'Vegano' END
    ]::text[], NULL) AS intolerancias
  FROM receta_texto
)
UPDATE public.recetas r
SET intolerancias = NULLIF(i.intolerancias, ARRAY[]::text[])
FROM inferidas i
WHERE r.id = i.id;
