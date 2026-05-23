-- ACEITUNAS EN PESCADOS -> CONDIMENTOS
-- Las aceitunas rellenas de anchoa aparecían en Pescados porque el nombre
-- contenía "anchoa" y el scraper/importador las categorizaba ahí.
-- Las aceitunas son encurtidos → Condimentos.

BEGIN;

UPDATE alimentos SET categoria = 'Condimentos'
WHERE categoria = 'Pescados' AND es_comestible IS NOT FALSE
AND (nombre ILIKE '%aceituna%' OR nombre ILIKE '%olivada%');

COMMIT;
