-- Recetas favoritas del cliente (para cocinar, crear contenido…) y fase de cada ingrediente (bizcocho, salsa, topping…).
create table if not exists public.recetas_favoritas_cliente (
  cliente_id uuid not null references public.clientes(id) on delete cascade,
  receta_id uuid not null references public.recetas(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (cliente_id, receta_id)
);
-- Solo la service role (las rutas comprueban que el usuario sea el cliente o su coach)
alter table public.recetas_favoritas_cliente enable row level security;

-- Fase de la receta a la que pertenece el ingrediente; null = receta de una sola pieza
alter table public.receta_ingredientes add column if not exists grupo text;
