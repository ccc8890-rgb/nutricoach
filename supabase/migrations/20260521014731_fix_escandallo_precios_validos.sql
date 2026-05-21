-- Escandallos: las vistas de precio no deben exponer productos sin precio/kg
-- válido ni alimentos marcados como no comestibles. Un precio 0 entraba como
-- "más barato" y subestimaba costes de recetas/listas de compra.

delete from public.productos_supermercado
where id in (
  'd7e964ff-936e-4341-ae95-5196973722f6', -- Sal -> Suavizante Origins Bergamota Salvaje
  '0e510f60-f428-4417-8345-806c8096e175', -- Super Cuquis -> Compresa con alas super Deliplus
  'd0f12181-a839-49f4-b620-982a880f89da', -- Super Cuquis -> Compresa con alas super Ausonia
  'be460c40-950d-4dcf-9fd0-575c40203454'  -- Super Cuquis -> Compresa con alas super Evax
);

insert into public.alimentos (
  id,
  nombre,
  categoria,
  calorias,
  proteinas,
  carbohidratos,
  grasas,
  fibra,
  custom,
  es_generico,
  fuente
) values (
  '91946107-b6ae-4f36-9190-165b84e02033',
  'Salsa verde',
  'Condimentos',
  35,
  1,
  6,
  0.5,
  1,
  false,
  true,
  'coach'
) on conflict (id) do nothing;

update public.receta_ingredientes
set alimento_id = '91946107-b6ae-4f36-9190-165b84e02033'
where id = 'd04e0858-315e-4816-9350-b1da2bf24901';

update public.receta_ingredientes
set alimento_id = '0a547955-282b-407b-b156-a9141a46d189'
where id = '1fd1312b-9801-4178-a0ef-63408412db80';

update public.receta_ingredientes
set alimento_id = '23ec40c0-75bf-4e8d-b4d9-a56405a809fb'
where id = 'd48e3489-1a35-490a-b1a6-cc59001e8790';

create or replace view public.mejores_precios_por_alimento
with (security_invoker = true) as
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
where
  a.es_comestible is distinct from false
  and ps.precio_por_kg is not null
  and ps.precio_por_kg > 0
order by
  ps.alimento_id,
  ps.supermercado_id,
  case when ps.preferido then 0 else 1 end,
  ps.precio_por_kg asc;

create or replace view public.top_precios_escandallo
with (security_invoker = true) as
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
  where
    a.es_comestible is distinct from false
    and ps.precio_por_kg is not null
    and ps.precio_por_kg > 0
)
select * from ranked where ranking <= 3;

create or replace view public.precios_actuales
with (security_invoker = true) as
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
where
  a.es_comestible is distinct from false
  and ps.precio_por_kg is not null
  and ps.precio_por_kg > 0
order by ps.alimento_id, ps.supermercado_id, ps.fecha_precio desc;
