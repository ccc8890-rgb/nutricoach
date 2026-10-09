-- Huella de los pasos enviados a Garmin, para el envío automático (reenviar solo si cambian).
ALTER TABLE public.sesiones_entrenamiento
  ADD COLUMN IF NOT EXISTS garmin_pasos_hash text;
