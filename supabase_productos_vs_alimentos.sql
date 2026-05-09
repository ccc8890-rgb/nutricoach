-- ============================================================
-- NUTRICOACH - Migración: Productos vs Alimentos (multi-precio)
-- ============================================================
-- 
-- PROBLEMA: El UNIQUE(supermercado_id, alimento_id) impedía tener
-- múltiples productos del mismo supermercado apuntando al mismo
-- alimento (ej: 3 aceites de oliva distintos → mismo alimento).
-- 
-- SOLUCIÓN:
--   1. Eliminar UNIQUE(supermercado_id, alimento_id)
--   2. Nuevo UNIQUE(supermercado_id, url_producto)
--   3. Columnas: nombre_original, marca, preferido
--   4. Vistas: mejores_precios_por_alimento, top_precios_escandallo
--
-- Ejecutar en: Supabase > SQL Editor
-- ============================================================

-- ─── 1. ELIMINAR CONSTRAINTS ANTIGUOS ────────────────────────

-- Eliminar el UNIQUE que impedía múltiples productos por alimento
alter table public.productos_supermercado
  drop constraint if exists productos_supermercado_supermercado_id_alimento_id_key;

-- También el índice redundante (lo recreamos después)
drop index if exists idx_productos_supermercado_compuesto;

-- ─── 2. AÑADIR COLUMNAS NUEVAS ───────────────────────────────

alter table public.productos_supermercado
  add column if not exists nombre_original text;

alter table public.productos_supermercado
  add column if not exists marca text;

alter table public.productos_supermercado
  add column if not exists preferido boolean default false;

-- ─── 3. NUEVO UNIQUE: supermercado_id + url_producto ─────────
-- Cada combinación supermercado + URL debe ser única.
-- Si un producto no tiene URL, se permite NULL (con una excepción).

-- Como puede haber filas con url_producto NULL, creamos un índice
-- parcial que solo aplica UNIQUE cuando url_producto NO es NULL
create unique index if not exists idx_productos_supermercado_url_unique
  on public.productos_supermercado(supermercado_id, url_producto)
  where url_producto is not null;

-- ─── 4. NUEVOS ÍNDICES ───────────────────────────────────────

-- Índice para consultar "mejor precio por alimento cruzando supermercados"
create index if not exists idx_productos_mejor_precio
  on public.productos_supermercado(alimento_id, precio_por_kg asc);

-- Índice para filtrar por preferido
create index if not exists idx_productos_preferido
  on public.productos_supermercado(alimento_id, supermercado_id)
  where preferido = true;

-- ─── 5. VISTA: mejores_precios_por_alimento ──────────────────
-- Devuelve el producto más barato (o preferido) para cada alimento
-- en cada supermercado. Útil para costes por defecto.

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
order by
  ps.alimento_id,
  ps.supermercado_id,
  case when ps.preferido then 0 else 1 end,  -- primero el preferido
  ps.precio_por_kg asc;                        -- después el más barato

-- ─── 6. VISTA: top_precios_escandallo ────────────────────────
-- Ranking global: el más barato de CADA alimento en TODOS los
-- supermercados. Prioriza preferido sobre precio.

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
)
select * from ranked where ranking <= 3;  -- top 3 más baratos

-- ─── 7. ACTUALIZAR VISTA EXISTENTE: precios_actuales ────────
-- La vista actual usa DISTINCT ON pero solo por última fecha.
-- La mantenemos para compatibilidad, pero ahora también incluimos
-- las nuevas columnas.

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
order by ps.alimento_id, ps.supermercado_id, ps.fecha_precio desc;

-- ─── 8. NOTA: El histórico no necesita cambios ───────────────
-- precios_historico ya permite múltiples registros por
-- (supermercado_id, alimento_id, fecha_precio) sin UNIQUE.
-- Cada vez que se scrapea un producto, se inserta un nuevo
-- registro histórico.
