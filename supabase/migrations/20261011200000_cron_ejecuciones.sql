-- Marca de «corrió bien / con errores» de las tareas automáticas (crons) para el panel «Estado del sistema».
create table if not exists public.cron_ejecuciones (
  id uuid primary key default gen_random_uuid(),
  cron text not null,
  estado text not null check (estado in ('ok', 'error')),
  detalle text,
  ejecutado_at timestamptz not null default now()
);

create index if not exists cron_ejecuciones_cron_fecha_idx on public.cron_ejecuciones (cron, ejecutado_at desc);

-- Solo la service role lee y escribe (sin políticas = nadie más)
alter table public.cron_ejecuciones enable row level security;
