-- Biblioteca de métodos del coach: sesiones, principios y técnicas de otros entrenadores (Instagram, webs, PDFs) guardados como
-- fichas con miniatura y enlace de origen. Solo accesible con service role (RLS sin políticas). Los vocabularios coinciden con
-- lib/metodos/constantes.ts: si cambias uno, cambia el otro.
create table if not exists public.metodos (
  id uuid primary key default gen_random_uuid(),
  coach_id uuid not null references auth.users(id) on delete cascade,
  tipo text not null check (tipo in ('sesion', 'principio', 'tecnica')),
  titulo text not null,
  resumen text,
  modalidad text not null check (modalidad in ('fuerza', 'running', 'hyrox', 'funcional', 'bici', 'natacion', 'movilidad', 'pliometria')),
  objetivo text check (objetivo in ('fuerza', 'hipertrofia', 'resistencia', 'potencia', 'movilidad', 'perdida_grasa', 'rendimiento')),
  nivel text check (nivel in ('principiante', 'intermedio', 'avanzado')),
  material text[] not null default '{}',
  duracion_min integer check (duracion_min is null or duracion_min between 1 and 600),
  estructura jsonb not null default '[]'::jsonb,
  autor text,
  plataforma text,
  url_origen text,
  video_url text,
  miniatura_url text,
  confianza text not null default 'anecdotico' check (confianza in ('anecdotico', 'experto', 'respaldado')),
  estado text not null default 'en_revision' check (estado in ('en_revision', 'con_agente', 'aprobada', 'descartada')),
  disponible_ia boolean not null default false,
  notas_coach text,
  tags text[] not null default '{}',
  huella text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- la IA solo puede ver fichas aprobadas
  constraint metodos_ia_solo_aprobadas check (disponible_ia = false or estado = 'aprobada')
);
create unique index if not exists metodos_coach_huella_uidx on public.metodos (coach_id, huella);
create index if not exists metodos_coach_estado_idx on public.metodos (coach_id, estado, created_at desc);
alter table public.metodos enable row level security;

-- Historial de cada ficha (altas, ediciones, aprobaciones y cambios de la marca de IA)
create table if not exists public.metodos_eventos (
  id uuid primary key default gen_random_uuid(),
  metodo_id uuid not null references public.metodos(id) on delete cascade,
  tipo text not null check (tipo in ('creada', 'editada', 'aprobada', 'descartada', 'reabierta', 'ia_activada', 'ia_desactivada')),
  nota text,
  created_at timestamptz not null default now()
);
create index if not exists metodos_eventos_metodo_idx on public.metodos_eventos (metodo_id, created_at);
alter table public.metodos_eventos enable row level security;
-- Revertir:
--   drop table public.metodos_eventos;
--   drop table public.metodos;
