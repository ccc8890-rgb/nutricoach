-- Técnicas de cocina como fichas propias (archivo de cocina). Solo service role (las rutas comprueban rol coach).
create table if not exists public.tecnicas (
  id uuid primary key default gen_random_uuid(),
  coach_id uuid not null,
  nombre text not null,
  familia text,
  descripcion text,
  principio text,
  pasos text,
  errores_tipicos text,
  variantes text,
  seguridad text,
  origen text,
  parametros jsonb not null default '{}'::jsonb,
  tags text[] not null default '{}',
  imagen_url text,
  url_origen text,
  autor_original text,
  estado text not null default 'en_revision' check (estado in ('en_revision', 'aprobada', 'descartada')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists tecnicas_estado_idx on public.tecnicas (estado);
create index if not exists tecnicas_familia_idx on public.tecnicas (familia);
alter table public.tecnicas enable row level security;

-- Recetas (y elaboraciones) que usan una técnica: «usa» / «se usa en»
create table if not exists public.receta_tecnicas (
  receta_id uuid not null references public.recetas(id) on delete cascade,
  tecnica_id uuid not null references public.tecnicas(id) on delete cascade,
  orden smallint not null default 0,
  primary key (receta_id, tecnica_id)
);
create index if not exists receta_tecnicas_tecnica_idx on public.receta_tecnicas (tecnica_id);
alter table public.receta_tecnicas enable row level security;
-- Revertir:
--   drop table public.receta_tecnicas;
--   drop table public.tecnicas;
