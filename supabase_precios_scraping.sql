-- ============================================================
-- NUTRICOACH - Migración: Scraping de Precios (Fase 1)
-- ============================================================
-- Ejecutar en: Supabase > SQL Editor
-- ============================================================

-- 1. TABLA: precios_historico
-- Guarda el histórico de precios para ver tendencias
create table if not exists public.precios_historico (
  id uuid default uuid_generate_v4() primary key,
  supermercado_id uuid references public.supermercados(id) on delete cascade not null,
  alimento_id uuid references public.alimentos(id) on delete cascade,
  nombre_producto text,                             -- nombre original del producto scrapeado
  precio_por_kg numeric(10,4) not null,
  precio_unidad numeric(10,4),
  unidad text default 'kg',
  url_producto text,
  fecha_precio date not null default current_date,
  fuente text not null default 'manual'             -- manual, scraping_http, scraping_playwright, apify
    check (fuente in ('manual','scraping_http','scraping_playwright','apify')),
  metadatos jsonb,                                   -- info extra del scraping (marca, cantidad, etc.)
  created_at timestamptz default now()
);

alter table public.precios_historico enable row level security;

create policy "Cualquier autenticado puede leer precios_historico"
  on public.precios_historico for select using (auth.role() = 'authenticated');

create policy "Solo coach puede insertar precios_historico"
  on public.precios_historico for insert with check (
    exists (select 1 from public.profiles where id = auth.uid() and role = 'coach')
  );

-- Índices para consultas de tendencias
create index if not exists idx_precios_historico_alimento_supermercado
  on public.precios_historico(alimento_id, supermercado_id, fecha_precio desc);

create index if not exists idx_precios_historico_fecha
  on public.precios_historico(fecha_precio desc);

-- 2. FUNCIÓN: match_alimento (v2 — mejorada)
-- Busca un alimento por nombre usando fuzzy matching con trigramas
-- Versión mejorada: elimina marcas, stop words, acentos, y busca por palabra clave
create extension if not exists pg_trgm;

create or replace function public.match_alimento(
  p_nombre text
) returns uuid as $$
declare
  v_alimento_id uuid;
  v_nombre_limpio text;
  v_palabras text[];
  v_palabra text;
begin
  -- Limpiar el nombre: quitar marcas, tamaños, parentesis
  v_nombre_limpio := regexp_replace(p_nombre, '\([^)]*\)', '', 'g');
  v_nombre_limpio := regexp_replace(v_nombre_limpio, '\d+\s*(kg|g|ml|l|litro|litros|unidad(?:es)?|pack|ud|uds|unid|pieza(?:s)?|cl|dl|mg|µg)', '', 'gi');
  v_nombre_limpio := regexp_replace(v_nombre_limpio, '(pack|lote|caja|kit)\s*\d+', '', 'gi');
  v_nombre_limpio := regexp_replace(v_nombre_limpio, '\d+\s*(pack|lote|caja|kit)', '', 'gi');
  -- Quitar marcas conocidas
  v_nombre_limpio := regexp_replace(v_nombre_limpio, '^(Hacendado|Bosque Verde|Deliplus|Carrefour|Milbona|Cien|Lidl|Bellsola|Día|Dia|Alcampo|Auchan|Consum|Eroski|Bonpreu|Esclat|Hipercor|Senda|Aliada)\s+', '', 'i');
  v_nombre_limpio := regexp_replace(v_nombre_limpio, '\s+(Hacendado|Bosque Verde|Deliplus|Carrefour|Milbona|Cien|Lidl|Bellsola|Día|Dia|Alcampo|Auchan|Consum|Eroski|Bonpreu|Esclat|Hipercor|Senda|Aliada)$', '', 'i');
  -- Quitar descriptores comunes
  v_nombre_limpio := regexp_replace(v_nombre_limpio, '\y(freír|freir|asar|cocinar|horno|plancha|vapor|microondas|troceado|fileteado|cortado|entero|natural|ecológico|ecologica|tradicional|congelado|fresco|fresca|ahumado|curado|desnatado|semidesnatado|light|zero|gourmet|premium|selección|seleccion|artesano|artesana|casero|casera|extra|loncheado|picado|rallado|triturado|molido|deshuesado|pelado|sin lactosa|sin gluten|vegano|vegetal)\y', '', 'gi');
  -- Quitar stop words
  v_nombre_limpio := regexp_replace(v_nombre_limpio, '\y(de|del|la|las|los|el|en|con|sin|y|e|o|a|para|por|al|un|una|su|que)\y', '', 'gi');
  v_nombre_limpio := trim(regexp_replace(v_nombre_limpio, '\s+', ' ', 'g'));

  -- 1. Intento exacto (sin sensibilidad a mayúsculas)
  select id into v_alimento_id from public.alimentos
  where lower(nombre) = lower(v_nombre_limpio)
  limit 1;
  if found then return v_alimento_id; end if;

  -- 2. Intento exacto ignorando acentos (unaccent)
  select id into v_alimento_id from public.alimentos
  where lower(unaccent(nombre)) = lower(unaccent(v_nombre_limpio))
  limit 1;
  if found then return v_alimento_id; end if;

  -- 3. Contiene bidireccional
  select id into v_alimento_id from public.alimentos
  where lower(v_nombre_limpio) like '%' || lower(nombre) || '%'
     or lower(nombre) like '%' || lower(v_nombre_limpio) || '%'
  limit 1;
  if found then return v_alimento_id; end if;

  -- 4. Coincidencia por palabra clave (la palabra más larga)
  v_palabras := regexp_split_to_array(v_nombre_limpio, '\s+');
  if array_length(v_palabras, 1) > 0 then
    -- Ordenar por longitud descendente (la más larga = la más significativa)
    select palabra into v_palabra from (
      select unnest(v_palabras) as palabra
    ) sub order by length(palabra) desc limit 1;

    select id into v_alimento_id from public.alimentos
    where lower(nombre) like '%' || lower(v_palabra) || '%'
    limit 1;
    if found then return v_alimento_id; end if;
  end if;

  -- 5. Fuzzy matching con trigramas (similarity > 0.3)
  select id into v_alimento_id from public.alimentos
  where lower(nombre) % lower(v_nombre_limpio)
  order by similarity(lower(nombre), lower(v_nombre_limpio)) desc
  limit 1;
  if found then return v_alimento_id; end if;

  -- No encontrado
  return null;
end;
$$ language plpgsql security definer stable;

-- 3. FUNCIÓN: guardar_scraping_result
-- Guarda el resultado de un scraping en productos_supermercado + historico
-- NOTA: El UNIQUE(supermercado_id, alimento_id) fue eliminado en
-- supabase_productos_vs_alimentos.sql. Ahora upsert por URL cuando
-- esté disponible, o inserta nuevo producto si no hay URL.
create or replace function public.guardar_scraping_result(
  p_supermercado_id uuid,
  p_productos jsonb,   -- array de { nombre, precio_por_kg, precio_unidad?, url_producto?, unidad? }
  p_fuente text default 'scraping_http'
) returns table (
  producto_nombre text,
  alimento_id uuid,
  coincidencia text,   -- 'exacta', 'fuzzy', 'no_encontrado'
  precio numeric,
  error text
) language plpgsql security definer as $$
declare
  v_prod jsonb;
  v_alimento_id uuid;
  v_existing_id uuid;
  v_nombre text;
  v_precio_kg numeric;
  v_precio_uni numeric;
  v_url text;
  v_unidad text;
  v_coincidencia text;
  v_error text;
begin
  for v_prod in select * from jsonb_array_elements(p_productos)
  loop
    v_nombre := v_prod->>'nombre';
    v_precio_kg := (v_prod->>'precio_por_kg')::numeric;
    v_precio_uni := (v_prod->>'precio_unidad')::numeric;
    v_url := v_prod->>'url_producto';
    v_unidad := coalesce(v_prod->>'unidad', 'kg');
    v_error := null;

    -- Buscar alimento
    v_alimento_id := public.match_alimento(v_nombre);

    if v_alimento_id is null then
      v_coincidencia := 'no_encontrado';
    else
      -- Verificar tipo de coincidencia
      select case
        when lower(a.nombre) = lower(v_nombre) then 'exacta'
        else 'fuzzy'
      end into v_coincidencia
      from public.alimentos a where a.id = v_alimento_id;

      -- Buscar producto existente por URL (único por supermercado)
      if v_url is not null and v_url <> '' then
        select id into v_existing_id
        from public.productos_supermercado
        where supermercado_id = p_supermercado_id
          and url_producto = v_url
        limit 1;

        if v_existing_id is not null then
          -- Actualizar producto existente
          update public.productos_supermercado set
            alimento_id = v_alimento_id,
            nombre_original = v_nombre,
            precio_por_kg = v_precio_kg,
            precio_unidad = v_precio_uni,
            unidad = v_unidad,
            fecha_precio = current_date,
            updated_at = now()
          where id = v_existing_id;
        else
          -- Insertar nuevo producto
          insert into public.productos_supermercado
            (supermercado_id, alimento_id, nombre_original, precio_por_kg, precio_unidad, unidad, url_producto, fecha_precio)
          values
            (p_supermercado_id, v_alimento_id, v_nombre, v_precio_kg, v_precio_uni, v_unidad, v_url, current_date);
        end if;
      else
        -- Sin URL: insertar siempre (puede haber duplicados por alimento)
        insert into public.productos_supermercado
          (supermercado_id, alimento_id, nombre_original, precio_por_kg, precio_unidad, unidad, fecha_precio)
        values
          (p_supermercado_id, v_alimento_id, v_nombre, v_precio_kg, v_precio_uni, v_unidad, current_date);
      end if;
    end if;

    -- Insertar en histórico siempre
    insert into public.precios_historico
      (supermercado_id, alimento_id, nombre_producto, precio_por_kg, precio_unidad, url_producto, fuente)
    values
      (p_supermercado_id, v_alimento_id, v_nombre, v_precio_kg, v_precio_uni, v_url, p_fuente);

    producto_nombre := v_nombre;
    alimento_id := v_alimento_id;
    coincidencia := v_coincidencia;
    precio := v_precio_kg;
    error := v_error;

    return next;
  end loop;
end;
$$;
