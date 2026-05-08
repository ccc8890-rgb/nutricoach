-- ============================================================
-- NUTRICOACH - Migración: Precios de Supermercado
-- ============================================================
-- Este script crea las tablas necesarias para gestionar
-- precios de alimentos en diferentes supermercados.
--
-- SUPERMERCADOS SOPORTADOS:
--   Mercadona, Carrefour, Consum, Aldi, Lidl
--
-- Ejecutar en: Supabase > SQL Editor
-- ============================================================

-- 1. TABLA: supermercados
create table if not exists public.supermercados (
  id uuid default uuid_generate_v4() primary key,
  nombre text not null unique,
  slug text not null unique,
  logo_url text,
  color text,               -- color corporativo para UI
  activo boolean default true,
  created_at timestamptz default now()
);

alter table public.supermercados enable row level security;

create policy "Cualquier autenticado puede leer supermercados" on public.supermercados
  for select using (auth.role() = 'authenticated');

create policy "Solo coach puede gestionar supermercados" on public.supermercados
  for all using (
    exists (select 1 from public.profiles where id = auth.uid() and role = 'coach')
  );

-- 2. TABLA: productos_supermercado
create table if not exists public.productos_supermercado (
  id uuid default uuid_generate_v4() primary key,
  supermercado_id uuid references public.supermercados(id) on delete cascade not null,
  alimento_id uuid references public.alimentos(id) on delete cascade not null,
  precio_por_kg numeric(10,4) not null,     -- precio en euros por kilogramo
  precio_unidad numeric(10,4),              -- precio por unidad (opcional, ej. huevos, lechuga)
  unidad text default 'kg',                  -- kg, unidad, L
  url_producto text,                         -- enlace al producto en web del supermercado
  fecha_precio date not null default current_date,  -- cuándo se consultó/actualizó
  notas text,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),

  -- Un alimento solo puede tener un precio por supermercado
  unique(supermercado_id, alimento_id)
);

alter table public.productos_supermercado enable row level security;

create policy "Cualquier autenticado puede leer productos_supermercado" on public.productos_supermercado
  for select using (auth.role() = 'authenticated');

create policy "Solo coach puede gestionar productos_supermercado" on public.productos_supermercado
  for all using (
    exists (select 1 from public.profiles where id = auth.uid() and role = 'coach')
  );

-- 3. VISTA: precios_actuales (precios más recientes por alimento y supermercado)
create or replace view public.precios_actuales as
select distinct on (ps.alimento_id, ps.supermercado_id)
  ps.id,
  ps.supermercado_id,
  s.nombre as supermercado_nombre,
  s.slug as supermercado_slug,
  s.color as supermercado_color,
  ps.alimento_id,
  a.nombre as alimento_nombre,
  a.categoria as alimento_categoria,
  ps.precio_por_kg,
  ps.precio_unidad,
  ps.unidad,
  ps.url_producto,
  ps.fecha_precio,
  ps.notas,
  ps.updated_at
from public.productos_supermercado ps
join public.supermercados s on s.id = ps.supermercado_id
join public.alimentos a on a.id = ps.alimento_id
order by ps.alimento_id, ps.supermercado_id, ps.fecha_precio desc;

-- 4. SEED: Supermercados españoles
insert into public.supermercados (nombre, slug, color) values
  ('Mercadona', 'mercadona', '#00A650'),
  ('Carrefour', 'carrefour', '#004B87'),
  ('Consum', 'consum', '#C8102E'),
  ('Aldi', 'aldi', '#002D72'),
  ('Lidl', 'lidl', '#0050AA'),
  ('Alcampo', 'alcampo', '#FFD100'),
  ('Día', 'dia', '#D32F2F'),
  ('El Corte Inglés', 'el-corte-ingles', '#002D62'),
  ('Hipercor', 'hipercor', '#003A70'),
  ('Bonpreu', 'bonpreu', '#E00034'),
  ('Esclat', 'esclat', '#00843D'),
  ('Eroski', 'eroski', '#00843D')
on conflict (slug) do nothing;

-- 5. ÍNDICES
create index if not exists idx_productos_supermercado_supermercado
  on public.productos_supermercado(supermercado_id);
create index if not exists idx_productos_supermercado_alimento
  on public.productos_supermercado(alimento_id);
create index if not exists idx_productos_supermercado_fecha
  on public.productos_supermercado(fecha_precio desc);
create index if not exists idx_productos_supermercado_compuesto
  on public.productos_supermercado(supermercado_id, alimento_id);

-- 6. FUNCIÓN: Calcular coste de una comida
create or replace function public.calcular_coste_comida(
  p_comida_id uuid,
  p_supermercado_id uuid default null
) returns table (
  alimento_id uuid,
  alimento_nombre text,
  cantidad_gramos numeric,
  precio_por_kg numeric,
  coste_euros numeric
) language plpgsql security definer as $$
begin
  return query
  select
    a.id as alimento_id,
    a.nombre as alimento_nombre,
    ca.cantidad_gramos,
    coalesce(ps.precio_por_kg, 0) as precio_por_kg,
    round((ca.cantidad_gramos / 1000.0) * coalesce(ps.precio_por_kg, 0)::numeric, 4) as coste_euros
  from public.comida_alimentos ca
  join public.alimentos a on a.id = ca.alimento_id
  left join lateral (
    select ps.precio_por_kg
    from public.productos_supermercado ps
    where ps.alimento_id = a.id
      and (p_supermercado_id is null or ps.supermercado_id = p_supermercado_id)
    order by ps.fecha_precio desc
    limit 1
  ) ps on true
  where ca.comida_id = p_comida_id;
end;
$$;

-- 7. FUNCIÓN: Calcular coste total de un plan de nutrición semanal
create or replace function public.calcular_coste_plan(
  p_plan_id uuid,
  p_supermercado_id uuid default null
) returns table (
  alimento_id uuid,
  alimento_nombre text,
  categoria text,
  cantidad_total_gramos numeric,
  precio_por_kg numeric,
  coste_total_euros numeric,
  recetas_json jsonb
) language plpgsql security definer as $$
begin
  return query
  with alimentos_plan as (
    select
      a.id as alimento_id,
      a.nombre as alimento_nombre,
      a.categoria,
      ca.cantidad_gramos,
      coalesce(ps.precio_por_kg, 0) as precio_por_kg
    from public.planes_nutricion pn
    join public.comidas c on c.plan_id = pn.id
    join public.comida_alimentos ca on ca.comida_id = c.id
    join public.alimentos a on a.id = ca.alimento_id
    left join lateral (
      select ps.precio_por_kg
      from public.productos_supermercado ps
      where ps.alimento_id = a.id
        and (p_supermercado_id is null or ps.supermercado_id = p_supermercado_id)
      order by ps.fecha_precio desc
      limit 1
    ) ps on true
    where pn.id = p_plan_id
  )
  select
    ap.alimento_id,
    ap.alimento_nombre,
    ap.categoria,
    sum(ap.cantidad_gramos) as cantidad_total_gramos,
    max(ap.precio_por_kg) as precio_por_kg,
    round((sum(ap.cantidad_gramos) / 1000.0) * max(ap.precio_por_kg)::numeric, 4) as coste_total_euros,
    (
      select jsonb_agg(distinct jsonb_build_object(
        'comida_nombre', c.nombre,
        'gramos', ca_sub.cantidad_gramos
      ))
      from public.comidas c
      join public.comida_alimentos ca_sub on ca_sub.comida_id = c.id
      where c.plan_id = p_plan_id and ca_sub.alimento_id = ap.alimento_id
    ) as recetas_json
  from alimentos_plan ap
  group by ap.alimento_id, ap.alimento_nombre, ap.categoria
  order by ap.categoria, ap.alimento_nombre;
end;
$$;
