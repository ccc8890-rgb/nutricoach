-- Backfill inicial para diferenciar recetas healthy atractivas / chef.
-- Es heurístico: después se reemplaza por clasificación IA + revisión del coach.

UPDATE recetas
SET
  premium_chef = true,
  estilos = (
    SELECT ARRAY(
      SELECT DISTINCT x
      FROM unnest(coalesce(estilos, '{}') || ARRAY['chef_healthy','comfort_healthy','gourmet_simple']) AS x
    )
  ),
  adherencia_score = LEAST(100, GREATEST(coalesce(adherencia_score, 65), 82)),
  nivel_elaboracion = GREATEST(coalesce(nivel_elaboracion, 3), 3),
  taxonomia_actualizada_at = now()
WHERE estado = 'aprobada'
  AND (
    coalesce(tags, '{}') && ARRAY['Bowl','bowl','Tacos','tacos','Burrito','burrito','Crepe','crepe','Chocolate','chocolate','Granola','granola','Salsa','salsa']
    OR nombre ILIKE ANY (ARRAY[
      '%bowl%', '%taco%', '%burrito%', '%crep%', '%waffle%', '%burger%', '%bigmac%',
      '%choco%', '%granola%', '%aguacate%', '%chipotle%', '%curry%', '%thai%', '%poke%',
      '%lazanya%', '%feta%', '%pistacho%'
    ])
  );
