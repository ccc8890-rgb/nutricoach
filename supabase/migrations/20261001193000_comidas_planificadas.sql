-- Semanas futuras de un plan de dieta: solo planificación del coach. No las lee el portal del
-- cliente ni la lista de la compra hasta que el coach activa la semana (se convierte en comidas).
-- semana = 1 es la próxima semana respecto a la semana en curso (tabla comidas), 2 la siguiente…
create table if not exists public.comidas_planificadas (
  id uuid primary key default gen_random_uuid(),
  plan_id uuid not null references public.planes_nutricion(id) on delete cascade,
  semana smallint not null check (semana between 1 and 8),
  dia_semana text not null
    check (dia_semana in ('Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo')),
  franja text not null
    check (franja in ('Desayuno', 'Media mañana', 'Comida', 'Merienda', 'Cena')),
  receta_id uuid not null references public.recetas(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (plan_id, semana, dia_semana, franja)
);

alter table public.comidas_planificadas enable row level security;

comment on table public.comidas_planificadas is
  'Semanas futuras planificadas por el coach (receta por día y franja); acceso exclusivo service_role.';

create index if not exists comidas_planificadas_plan_semana_idx
  on public.comidas_planificadas (plan_id, semana);
