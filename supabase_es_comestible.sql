-- ============================================================
-- NUTRICOACH - Migración: Columna es_comestible en alimentos
-- ============================================================
--
-- PROBLEMA: Las vistas mejores_precios_por_alimento y
-- top_precios_escandallo incluyen productos no comestibles
-- (champús, desodorantes, lejías, etc.) que se scrapean de
-- supermercados y contaminan el escandallo.
--
-- SOLUCIÓN:
--   1. Añadir columna es_comestible a alimentos
--   2. Backfillear con script JS (usa la lógica de index.ts)
--   3. Actualizar vistas para filtrar solo comestibles
-- ============================================================

-- ─── 1. AÑADIR COLUMNA ───────────────────────────────────────

alter table public.alimentos
  add column if not exists es_comestible boolean default true;

-- Índice para filtrar rápido en vistas
create index if not exists idx_alimentos_es_comestible
  on public.alimentos(es_comestible)
  where es_comestible = true;

-- ─── 2. ACTUALIZAR VISTA: mejores_precios_por_alimento ─────────

create or replace view public.mejores_precios_por_alimento as
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
  ps.nombre_original,
  ps.marca,
  ps.preferido,
  ps.fecha_precio
from public.productos_supermercado ps
join public.supermercados s on s.id = ps.supermercado_id
join public.alimentos a on a.id = ps.alimento_id
where a.es_comestible = true  -- ← FILTRO NUEVO
order by
  ps.alimento_id,
  ps.supermercado_id,
  case when ps.preferido then 0 else 1 end,
  ps.precio_por_kg asc;

-- ─── 3. ACTUALIZAR VISTA: top_precios_escandallo ───────────────

create or replace view public.top_precios_escandallo as
with ranked as (
  select
    ps.id,
    ps.supermercado_id,
    s.nombre as supermercado_nombre,
    s.slug as supermercado_slug,
    ps.alimento_id,
    a.nombre as alimento_nombre,
    a.categoria as alimento_categoria,
    ps.precio_por_kg,
    ps.precio_unidad,
    ps.unidad,
    ps.url_producto,
    ps.nombre_original,
    ps.marca,
    ps.preferido,
    ps.fecha_precio,
    row_number() over (
      partition by ps.alimento_id
      order by
        case when ps.preferido then 0 else 1 end,
        ps.precio_por_kg asc
    ) as ranking
  from public.productos_supermercado ps
  join public.supermercados s on s.id = ps.supermercado_id
  join public.alimentos a on a.id = ps.alimento_id
  where a.es_comestible = true  -- ← FILTRO NUEVO
)
select * from ranked where ranking <= 3;

-- ─── 4. ACTUALIZAR VISTA: precios_actuales ─────────────────────

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
  ps.notas,
  ps.nombre_original,
  ps.marca,
  ps.preferido,
  ps.updated_at,
  ps.fecha_precio
from public.productos_supermercado ps
join public.supermercados s on s.id = ps.supermercado_id
join public.alimentos a on a.id = ps.alimento_id
where a.es_comestible = true  -- ← FILTRO NUEVO
order by ps.alimento_id, ps.supermercado_id, ps.fecha_precio desc;
