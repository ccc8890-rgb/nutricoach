-- Circuito de revisión: Carlos (1ª) → agente → Carlos (2ª). fase_revision nula = ficha nueva.
alter table public.recetas
  add column if not exists fase_revision text check (fase_revision in ('en_agente', 'segunda'));

-- Historial: acciones de Carlos y veredictos del agente (solo service role)
create table if not exists public.recetas_revision_eventos (
  id uuid primary key default gen_random_uuid(),
  receta_id uuid not null references public.recetas(id) on delete cascade,
  tipo text not null check (tipo in ('al_agente', 'devuelta', 'volver_a_nueva', 'agente', 'aprobada', 'descartada', 'error')),
  actor text not null check (actor in ('carlos', 'agente')),
  nota text,
  veredicto text,
  confianza numeric,
  resumen text,
  hallazgos jsonb,
  correcciones jsonb,
  aplicadas jsonb,
  modelo text,
  tokens_entrada integer,
  tokens_salida integer,
  hash_ficha text,
  created_at timestamptz not null default now()
);
create index if not exists recetas_revision_eventos_receta_idx on public.recetas_revision_eventos (receta_id, created_at);
create index if not exists recetas_revision_eventos_fecha_idx on public.recetas_revision_eventos (created_at);
alter table public.recetas_revision_eventos enable row level security;
-- Revertir:
--   drop table public.recetas_revision_eventos;
--   alter table public.recetas drop column fase_revision;
