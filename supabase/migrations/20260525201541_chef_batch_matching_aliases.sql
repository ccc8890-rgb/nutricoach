-- Aliases seguros aprendidos del lote chef healthy 25-05-2026.
-- Se aplican solo a ingredientes huérfanos del lote para no tocar recetas históricas.

WITH fixes(pattern, alimento_nombre) AS (
  VALUES
    ('%mostaza antigua%', 'Gran Salsa Mostaza Bote'),
    ('%arroz jazmín cocido%', 'Arroz blanco (cocido)'),
    ('%mango maduro%', 'Mango'),
    ('%zumo de lima%', 'Jugo de lima'),
    ('%jengibre fresco rallado%', 'Jengibre fresco'),
    ('%pan de burger%', 'Maxi pan de burger')
),
matched AS (
  SELECT
    ri.id AS ingrediente_id,
    ri.receta_id,
    a.id AS alimento_id
  FROM public.receta_ingredientes ri
  JOIN public.recetas r ON r.id = ri.receta_id
  JOIN fixes f ON lower(ri.nombre_libre) LIKE f.pattern
  JOIN public.alimentos a ON a.nombre = f.alimento_nombre
  WHERE r.tags @> ARRAY['chef_healthy_batch']::text[]
    AND ri.alimento_id IS NULL
)
UPDATE public.receta_ingredientes ri
SET alimento_id = m.alimento_id,
    last_matched_at = now()
FROM matched m
WHERE ri.id = m.ingrediente_id;

DO $$
DECLARE
  receta uuid;
BEGIN
  FOR receta IN
    SELECT DISTINCT ri.receta_id
    FROM public.receta_ingredientes ri
    JOIN public.recetas r ON r.id = ri.receta_id
    WHERE r.tags @> ARRAY['chef_healthy_batch']::text[]
  LOOP
    PERFORM public.calcular_macros_receta(receta);
  END LOOP;
END $$;
