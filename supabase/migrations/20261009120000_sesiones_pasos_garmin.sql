-- 20261009120000_sesiones_pasos_garmin.sql
-- Running estructurado: pasos de la sesión + rastro del entreno enviado a Garmin.
ALTER TABLE public.plantilla_sesiones
  ADD COLUMN IF NOT EXISTS pasos jsonb;

ALTER TABLE public.sesiones_entrenamiento
  ADD COLUMN IF NOT EXISTS pasos jsonb,
  ADD COLUMN IF NOT EXISTS garmin_workout_id text,
  ADD COLUMN IF NOT EXISTS garmin_programado_fecha date;

COMMENT ON COLUMN public.plantilla_sesiones.pasos IS 'Pasos estructurados de carrera (ver lib/entrenos/pasos.ts). NULL = sesión clásica por ejercicios.';
COMMENT ON COLUMN public.sesiones_entrenamiento.pasos IS 'Pasos estructurados de carrera. NULL = sesión clásica por ejercicios.';
