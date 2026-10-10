-- Hitos de entrenamiento que anota el coach (cambio de enfoque, de material, vuelta tras una lesión…)
-- para medir después qué pasó con el atleta en el panel de rendimiento (Seguimiento).
alter table public.perfil_entreno_cliente add column if not exists hitos_entreno jsonb not null default '[]'::jsonb;
comment on column public.perfil_entreno_cliente.hitos_entreno is
  'Array (máx. 30) de {id, fecha (AAAA-MM-DD), titulo, descripcion, metrica_objetivo?, direccion?}. Lo escribe el coach desde Rendimiento > Seguimiento.';
