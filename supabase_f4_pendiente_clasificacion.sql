-- ============================================================
-- NUTRICOACH - FASE 4: Separar creación de alimentos del scraping
-- ============================================================
-- PROBLEMA: El scraper creaba alimentos como efecto secundario.
-- Ahora los productos sin match se marcan como pendientes y un
-- job independiente los clasifica.
--
-- Ejecutar en: Supabase > SQL Editor
-- ============================================================

-- ─── 1. AÑADIR COLUMNA pendiente_clasificacion ────────────────

alter table public.productos_supermercado
  add column if not exists pendiente_clasificacion boolean default false;

-- Índice para localizar rápidamente productos sin clasificar
create index if not exists idx_productos_pendientes
  on public.productos_supermercado(supermercado_id, pendiente_clasificacion)
  where pendiente_clasificacion = true;

-- ─── 2. FUNCIÓN: crear_alimento_desde_scraping ────────────────
-- Crea un alimento con datos mínimos (sin macros) y devuelve su ID.
-- Usada por el clasificador de pendientes.

create or replace function public.crear_alimento_desde_scraping(
  p_nombre text,
  p_categoria text default 'Supermercado'
) returns uuid
language plpgsql security definer
as $$
declare
  v_id uuid;
begin
  insert into public.alimentos (nombre, categoria, calorias, proteinas, carbohidratos, grasas, es_generico, es_comestible, fuente_nutricional)
  values (p_nombre, p_categoria, 0, 0, 0, 0, true, true, 'scraping_default')
  on conflict (nombre) do nothing
  returning id into v_id;

  -- Si ya existía (conflict), obtener su ID
  if v_id is null then
    select id into v_id from public.alimentos where nombre = p_nombre;
  end if;

  return v_id;
end;
$$;

-- ─── 3. VISTA: productos_pendientes_clasificar ────────────────
-- Útil para monitorizar cuántos productos están sin clasificar

create or replace view public.vista_pendientes_clasificar as
select
  ps.supermercado_id,
  s.nombre as supermercado_nombre,
  s.slug as supermercado_slug,
  count(*) as total_pendientes,
  count(distinct ps.nombre_original) as nombres_unicos
from public.productos_supermercado ps
join public.supermercados s on s.id = ps.supermercado_id
where ps.pendiente_clasificacion = true
  and ps.alimento_id is null
group by ps.supermercado_id, s.nombre, s.slug
order by total_pendientes desc;
