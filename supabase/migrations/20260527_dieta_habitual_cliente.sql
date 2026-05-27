create table if not exists public.dieta_habitual_cliente (
  id uuid primary key default gen_random_uuid(),
  cliente_id uuid not null references public.clientes(id) on delete cascade,
  momento text not null check (momento in ('desayuno', 'media_manana', 'comida', 'merienda', 'cena', 'general')),
  texto_original text not null,
  plato_normalizado text not null,
  frecuencia text not null default 'habitual',
  importancia_adherencia text not null default 'media' check (importancia_adherencia in ('alta', 'media', 'baja')),
  modificable text not null default 'ajustar_cantidades' check (modificable in ('mantener_base', 'ajustar_cantidades', 'sustituible')),
  estrategia text,
  ingredientes_clave text[] not null default '{}',
  preferencias_detectadas text[] not null default '{}',
  fuente text not null default 'dia_tipico' check (fuente in ('dia_tipico', 'favoritos', 'manual', 'feedback')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (cliente_id, fuente, momento, plato_normalizado)
);

alter table public.dieta_habitual_cliente enable row level security;

create index if not exists idx_dieta_habitual_cliente_cliente
  on public.dieta_habitual_cliente(cliente_id);

create index if not exists idx_dieta_habitual_cliente_momento
  on public.dieta_habitual_cliente(momento);

create index if not exists idx_dieta_habitual_cliente_ingredientes
  on public.dieta_habitual_cliente using gin(ingredientes_clave);

alter table public.comidas
  add column if not exists dieta_habitual_id uuid references public.dieta_habitual_cliente(id) on delete set null,
  add column if not exists origen_adherencia text not null default 'recetario'
    check (origen_adherencia in ('recetario', 'habitual_adaptado', 'novedad_controlada', 'manual')),
  add column if not exists adaptacion_habitual text;

create index if not exists idx_comidas_dieta_habitual_id
  on public.comidas(dieta_habitual_id)
  where dieta_habitual_id is not null;
