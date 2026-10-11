-- Ajustes por fecha sobre la plantilla semanal de un plan de entreno.
-- La plantilla (sesiones_entrenamiento.dia_semana) se repite cada semana; esto permite
-- mover, copiar o quitar una sesión en UNA fecha concreta sin tocar el resto de semanas.
--   mover : la sesión sale de fecha_origen y aparece en fecha
--   copiar: la sesión aparece además en fecha
--   omitir: la sesión no aparece en fecha_origen (fecha es null)
create table if not exists public.calendario_entreno_ajustes (
  id uuid primary key default gen_random_uuid(),
  plan_id uuid not null references public.planes_entrenamiento(id) on delete cascade,
  sesion_id uuid not null references public.sesiones_entrenamiento(id) on delete cascade,
  tipo text not null check (tipo in ('mover', 'copiar', 'omitir')),
  fecha_origen date,
  fecha date,
  created_at timestamptz not null default now(),
  check ((tipo = 'mover' and fecha_origen is not null and fecha is not null)
      or (tipo = 'copiar' and fecha is not null)
      or (tipo = 'omitir' and fecha_origen is not null))
);

create index if not exists calendario_entreno_ajustes_plan_idx on public.calendario_entreno_ajustes (plan_id);

alter table public.calendario_entreno_ajustes enable row level security;

create policy "coach gestiona ajustes de calendario de sus planes"
  on public.calendario_entreno_ajustes for all
  using (exists (select 1 from public.planes_entrenamiento p where p.id = plan_id and p.coach_id = auth.uid()))
  with check (exists (select 1 from public.planes_entrenamiento p where p.id = plan_id and p.coach_id = auth.uid()));
