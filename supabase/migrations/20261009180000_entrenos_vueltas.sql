-- Parciales por vuelta de cada entreno de carrera (tipo de paso, distancia, tiempo, pulso, velocidad).
-- Permiten comparar lo planificado con lo ejecutado repetición a repetición.
alter table public.entrenos_realizados add column if not exists vueltas jsonb;
comment on column public.entrenos_realizados.vueltas is
  'Array de vueltas Garmin: {tipo: WARMUP|ACTIVE|RECOVERY|COOLDOWN|..., paso, distancia_m, duracion_s, fc_media, velocidad_ms}.';
