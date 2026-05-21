alter table public.recetas
  add column if not exists score_calidad integer,
  add column if not exists score_calidad_detalle jsonb,
  add column if not exists nivel_fit text,
  add column if not exists tipo_uso text,
  add column if not exists contexto_uso text,
  add column if not exists apta_cliente text,
  add column if not exists alcohol_culinario boolean not null default false,
  add column if not exists quality_estado_sugerido text,
  add column if not exists quality_issues jsonb,
  add column if not exists quality_actualizado_at timestamptz;

alter table public.recetas
  add constraint recetas_score_calidad_range
  check (score_calidad is null or (score_calidad >= 0 and score_calidad <= 100)) not valid;

create table if not exists public.recetas_auditoria (
  id uuid primary key default gen_random_uuid(),
  receta_id uuid not null references public.recetas(id) on delete cascade,
  evento text not null,
  score_antes integer,
  score_despues integer,
  issues jsonb,
  cambios jsonb,
  origen text not null default 'sistema',
  created_at timestamptz not null default now()
);

create index if not exists recetas_auditoria_receta_id_created_at_idx
  on public.recetas_auditoria (receta_id, created_at desc);

create index if not exists recetas_score_calidad_idx
  on public.recetas (score_calidad);

create index if not exists recetas_nivel_fit_idx
  on public.recetas (nivel_fit);

create index if not exists recetas_tipo_uso_idx
  on public.recetas (tipo_uso);

create index if not exists recetas_apta_cliente_idx
  on public.recetas (apta_cliente);
