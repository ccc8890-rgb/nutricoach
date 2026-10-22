-- Salsas que combinan con una receta («Va bien con…»). Una salsa es una receta con tipo_receta = 'salsa_base'.
create table if not exists public.receta_salsas (
  receta_id uuid not null references public.recetas(id) on delete cascade,
  salsa_id uuid not null references public.recetas(id) on delete cascade,
  orden smallint not null default 0,
  created_at timestamptz not null default now(),
  primary key (receta_id, salsa_id),
  check (receta_id <> salsa_id)
);
create index if not exists receta_salsas_salsa_idx on public.receta_salsas (salsa_id);
-- Solo la service role (las rutas comprueban que el usuario sea coach, o cliente con acceso a la receta aprobada)
alter table public.receta_salsas enable row level security;
-- Revertir: drop table public.receta_salsas;
