-- «Mis marcas» (lo que el atleta sabe de sí mismo, opcional) y «cierre de bloque» (cómo fueron las cargas), para afinar el siguiente plan.
alter table public.perfil_entreno_cliente
  add column if not exists marcas jsonb not null default '{}'::jsonb;

create table if not exists public.feedback_bloque (
  id uuid primary key default gen_random_uuid(),
  cliente_id uuid not null references public.clientes(id) on delete cascade,
  plan_id uuid not null references public.planes_entrenamiento(id) on delete cascade,
  clave text not null,
  valoracion text not null check (valoracion in ('flojo', 'justo', 'pesado')),
  created_at timestamptz not null default now(),
  unique (plan_id, clave)
);
create index if not exists feedback_bloque_cliente_idx on public.feedback_bloque (cliente_id, created_at desc);
-- Solo la service role (las rutas comprueban que el cliente sea el propio usuario)
alter table public.feedback_bloque enable row level security;
