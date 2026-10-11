-- Fechas en las que una sesión de carrera está programada en el calendario de Garmin.
-- Antes solo se guardaba una (garmin_programado_fecha: la próxima ocurrencia); ahora el envío
-- automático deja programada también la semana siguiente completa.
alter table public.sesiones_entrenamiento add column if not exists garmin_fechas jsonb not null default '[]'::jsonb;
comment on column public.sesiones_entrenamiento.garmin_fechas is 'Array de fechas AAAA-MM-DD programadas en Garmin Connect para el entreno garmin_workout_id.';
