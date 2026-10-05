-- Decisiones del coach sobre las propuestas de suplementación de cada cliente.
create table public.suplementacion_cliente (
  id uuid primary key default gen_random_uuid(),
  cliente_id uuid not null references public.clientes(id) on delete cascade,
  suplemento_id text not null,
  ambito text not null check (ambito in ('sesion', 'diaria', 'carrera')),
  estado text not null default 'propuesta' check (estado in ('propuesta', 'aprobada', 'descartada')),
  dosis text,
  timing text,
  notas text,
  decidido_por uuid references auth.users(id),
  decidido_at timestamptz,
  created_at timestamptz default now(),
  unique (cliente_id, suplemento_id, ambito)
);

create index suplementacion_cliente_cliente_id_idx on public.suplementacion_cliente(cliente_id);

alter table public.suplementacion_cliente enable row level security;

create policy suplementacion_cliente_coach on public.suplementacion_cliente
  for all to authenticated
  using (exists (
    select 1 from public.clientes c
    where c.id = suplementacion_cliente.cliente_id and c.coach_id = auth.uid()
  ))
  with check (exists (
    select 1 from public.clientes c
    where c.id = suplementacion_cliente.cliente_id and c.coach_id = auth.uid()
  ));

create policy suplementacion_cliente_aprobada on public.suplementacion_cliente
  for select to authenticated
  using (estado = 'aprobada' and exists (
    select 1 from public.clientes c
    where c.id = suplementacion_cliente.cliente_id and c.profile_id = auth.uid()
  ));
