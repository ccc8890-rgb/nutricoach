-- «Mis platos»: platos propios del cliente (foto + ingredientes + macros estimadas), revisados por su coach.
-- Aditiva. Solo service role (RLS activado sin políticas), igual que recetas_favoritas_cliente.
-- Deshacer:
--   alter table comidas drop column if exists plato_cliente_id;
--   drop table if exists platos_analisis_log; drop table if exists platos_cliente_ingredientes; drop table if exists platos_cliente;

create table if not exists public.platos_cliente (
  id uuid primary key default gen_random_uuid(),
  cliente_id uuid not null references public.clientes(id) on delete cascade,
  nombre text not null default '',
  tipo_comida text not null default 'Comida' check (tipo_comida in ('Desayuno', 'Comida', 'Cena', 'Snack', 'Otro')),
  nota_cliente text,
  estado text not null default 'borrador' check (estado in ('borrador', 'pendiente', 'aprobado', 'devuelto')),
  foto_original_url text,
  foto_limpia_url text,
  porciones numeric not null default 1 check (porciones > 0),
  pasos text,
  kcal numeric not null default 0,
  proteinas numeric not null default 0,
  carbohidratos numeric not null default 0,
  grasas numeric not null default 0,
  incompleto boolean not null default true,
  estimado boolean not null default true,
  ia_modelo text,
  nota_coach text,
  aprobado_snapshot jsonb,
  aprobado_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists platos_cliente_cliente_estado_idx on public.platos_cliente (cliente_id, estado);

create table if not exists public.platos_cliente_ingredientes (
  id uuid primary key default gen_random_uuid(),
  plato_id uuid not null references public.platos_cliente(id) on delete cascade,
  nombre_libre text not null,
  alimento_id uuid references public.alimentos(id) on delete set null,
  cantidad_gramos numeric not null default 0 check (cantidad_gramos >= 0),
  orden int not null default 0
);
create index if not exists platos_cliente_ingredientes_plato_idx on public.platos_cliente_ingredientes (plato_id, orden);

-- Registro de análisis de foto por cliente (límite diario de coste)
create table if not exists public.platos_analisis_log (
  id uuid primary key default gen_random_uuid(),
  cliente_id uuid not null references public.clientes(id) on delete cascade,
  created_at timestamptz not null default now()
);
create index if not exists platos_analisis_log_cliente_idx on public.platos_analisis_log (cliente_id, created_at);

alter table public.platos_cliente enable row level security;
alter table public.platos_cliente_ingredientes enable row level security;
alter table public.platos_analisis_log enable row level security;

-- Comida del plan que viene de un plato del cliente (para marcarla «Mi plato» en «En tu plan»)
alter table public.comidas add column if not exists plato_cliente_id uuid references public.platos_cliente(id) on delete set null;
