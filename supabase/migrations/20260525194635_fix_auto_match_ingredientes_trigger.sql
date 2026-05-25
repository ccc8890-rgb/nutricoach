-- Corrige el trigger de matching automático de ingredientes.
-- La versión anterior hacía:
--   SELECT match_ingrediente_por_nombre(...) INTO v_alimento_id, v_confianza
-- y Postgres intentaba meter el record completo "(uuid,exacta)" en v_alimento_id.
-- Hay que seleccionar explícitamente las columnas OUT de la función.

CREATE OR REPLACE FUNCTION public.try_match_ingrediente()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_alimento_id uuid;
  v_confianza text;
BEGIN
  IF NEW.alimento_id IS NULL THEN
    SELECT m.alimento_id, m.confianza
    INTO v_alimento_id, v_confianza
    FROM public.match_ingrediente_por_nombre(NEW.nombre_libre) AS m;

    IF v_alimento_id IS NOT NULL THEN
      NEW.alimento_id := v_alimento_id;
      NEW.last_matched_at := now();
    END IF;
  END IF;

  RETURN NEW;
END;
$$;
