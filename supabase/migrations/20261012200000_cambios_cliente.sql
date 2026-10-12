-- Cambios que hace el atleta en su plan (mover una sesión o una comida…): el plan nace en el coach, así que el coach tiene que enterarse.
create table if not exists public.cambios_cliente (
  id uuid primary key default gen_random_uuid(),
  cliente_id uuid not null references public.clientes(id) on delete cascade,
  plan_id uuid,
  tipo text not null,
  resumen text not null,
  detalle jsonb not null default '{}'::jsonb,
  visto boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists cambios_cliente_pendientes_idx on public.cambios_cliente (cliente_id, visto, created_at desc);
-- Solo la service role (las rutas comprueban que el usuario sea el cliente o su coach)
alter table public.cambios_cliente enable row level security;
