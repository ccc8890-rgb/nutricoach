-- Plantillas base generadas por el motor para un perfil estándar (kcal × tipo de dieta), regenerables.
alter table public.plantillas_semana_dieta
  add column if not exists origen text not null default 'coach' check (origen in ('coach', 'base')),
  add column if not exists clave text,
  add column if not exists perfil jsonb,
  add column if not exists generada_at timestamptz;

create unique index if not exists plantillas_semana_dieta_clave_idx
  on public.plantillas_semana_dieta (coach_id, clave) where clave is not null;
