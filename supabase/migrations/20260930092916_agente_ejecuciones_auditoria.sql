-- Auditoría persistente del Director para distinguir ejecuciones manuales,
-- cron y simulaciones aunque los logs de Vercel ya no estén disponibles.
create table if not exists public.agente_ejecuciones (
  id uuid primary key default gen_random_uuid(),
  modo text not null check (modo in ('diario', 'semanal')),
  origen text not null check (origen in ('cron', 'manual', 'sistema')),
  dry_run boolean not null default false,
  estado text not null default 'ejecutando'
    check (estado in ('ejecutando', 'completado', 'completado_con_errores', 'fallido')),
  clientes_procesados integer not null default 0 check (clientes_procesados >= 0),
  tareas_generadas integer not null default 0 check (tareas_generadas >= 0),
  errores jsonb not null default '[]'::jsonb,
  duracion_ms integer,
  iniciado_at timestamptz not null default now(),
  finalizado_at timestamptz
);

alter table public.agente_ejecuciones enable row level security;

comment on table public.agente_ejecuciones is
  'Historial interno de ejecuciones del director de agentes; acceso exclusivo service_role.';

create index if not exists agente_ejecuciones_iniciado_at_idx
  on public.agente_ejecuciones (iniciado_at desc);
