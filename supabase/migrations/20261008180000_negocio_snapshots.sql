-- Foto diaria de las cifras de negocio del coach, para poder dibujar su evolución en el dashboard.
-- La escribe el cron /api/cron/snapshot-negocio con service role; el coach solo la lee.
create table if not exists public.negocio_snapshots (
  coach_id uuid not null references auth.users(id) on delete cascade,
  fecha date not null,
  clientes_activos integer not null default 0,
  clientes_membresia_activa integer not null default 0,
  clientes_sin_membresia integer not null default 0,
  mrr_estimado numeric(12,2) not null default 0,
  ingresos_mes_actual numeric(12,2) not null default 0,
  ingresos_30d numeric(12,2) not null default 0,
  created_at timestamptz not null default now(),
  primary key (coach_id, fecha)
);

alter table public.negocio_snapshots enable row level security;

create policy negocio_snapshots_lectura_coach on public.negocio_snapshots
  for select to authenticated
  using (coach_id = auth.uid());

comment on table public.negocio_snapshots is
  'Una fila por coach y día con las cifras del dashboard de negocio. Solo escribe el cron (service role).';
