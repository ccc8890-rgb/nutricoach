-- Plantillas de planificación de dieta: 1, 2 o 4 semanas de platos (por día y franja) guardadas por el coach
-- para reutilizarlas en otros clientes o como copia de seguridad. Guarda receta_id + nombre, no cantidades:
-- al aplicarla, el motor ajusta las raciones al objetivo de cada cliente.
create table if not exists public.plantillas_semana_dieta (
  id uuid primary key default gen_random_uuid(),
  coach_id uuid not null references auth.users(id) on delete cascade,
  nombre text not null,
  descripcion text,
  etiquetas text[] not null default '{}',
  semanas jsonb not null,
  created_at timestamptz not null default now()
);

create index if not exists plantillas_semana_dieta_coach_idx on public.plantillas_semana_dieta (coach_id, created_at desc);

alter table public.plantillas_semana_dieta enable row level security;

create policy plantillas_semana_dieta_coach on public.plantillas_semana_dieta
  for all to authenticated
  using (coach_id = auth.uid())
  with check (coach_id = auth.uid());
