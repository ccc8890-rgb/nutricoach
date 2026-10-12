-- Entrenos de Garmin por semana del bloque: con progresión semanal cada semana tiene sus pasos, así que cada (sesión, semana) es su propio entreno.
-- {"2": {"workout_id": "...", "fechas": ["2026-10-20"], "hash": "..."}}
alter table public.sesiones_entrenamiento
  add column if not exists garmin_variantes jsonb not null default '{}'::jsonb;
