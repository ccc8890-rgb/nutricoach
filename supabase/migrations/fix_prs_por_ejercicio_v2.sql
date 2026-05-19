-- Fix: prs_por_ejercicio usaba sets_ejecutados -> 0 (primer set) en lugar de s.set_data
-- 
-- Bug: El SELECT referenciaba sets_ejecutados -> 0 (siempre el primer set del array)
-- en lugar de s.set_data (el set actual desplegado por LATERAL jsonb_array_elements)
--
-- Esto causaba que:
--   - peso_max_kg siempre mostraba el peso del PRIMER set, no del MÁS PESADO
--   - reps_en_pr siempre mostraba las reps del primer set
--   - volumen_pr siempre calculaba con los datos del primer set
--
-- El ORDER BY s.set_data sí funcionaba correctamente, pero DISTINCT ON elegía
-- la primera fila del grupo (ordenada por peso DESC) y luego mostraba datos incorrectos

CREATE OR REPLACE VIEW public.prs_por_ejercicio AS
SELECT DISTINCT ON (cliente_id, ejercicio_id)
  cliente_id,
  ejercicio_id,
  fecha,
  (s.set_data ->> 'peso_kg')::numeric AS peso_max_kg,
  (s.set_data ->> 'reps')::integer AS reps_en_pr,
  ((s.set_data ->> 'peso_kg')::numeric * (s.set_data ->> 'reps')::integer) AS volumen_pr
FROM public.registros_sets,
  LATERAL jsonb_array_elements(sets_ejecutados) AS s(set_data)
WHERE (s.set_data ->> 'peso_kg') IS NOT NULL
  AND (s.set_data ->> 'peso_kg')::numeric > 0
ORDER BY cliente_id, ejercicio_id, (s.set_data ->> 'peso_kg')::numeric DESC;

COMMENT ON VIEW public.prs_por_ejercicio IS 'PR tracking: mejor marca (peso) por ejercicio y cliente';
