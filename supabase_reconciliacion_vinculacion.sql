-- ============================================================
-- NUTRICOACH - Reconciliación de Vinculación (Scraping → Alimentos)
-- ============================================================
--
-- PROBLEMA: El scraping puede crear alimentos DUPLICADOS con
-- macros=0 y es_generico=true cuando no encuentra match exacto
-- con los alimentos del seed. Esto rompe la vinculación porque:
--   - productos_supermercado apunta al duplicado, no al real
--   - Las vistas (mejores_precios_por_alimento) no muestran esos precios
--   - Los cálculos de coste fallan
--
-- SOLUCIÓN:
--   1. Identificar alimentos sospechosos de ser duplicados
--      (creados por scraping: es_generico=true, calorias=0, no custom=false)
--   2. Buscar su equivalente en seed_alimentos mediante matching
--      progresivo (misma lógica que match_alimento)
--   3. Re-apuntar productos_supermercado.alimento_id al correcto
--   4. Re-apuntar precios_historico.alimento_id al correcto
--   5. Eliminar (o desactivar) los duplicados huérfanos
--
-- Ejecutar en: Supabase > SQL Editor (después de seed_alimentos.sql)
-- ============================================================

-- ─── 1. IDENTIFICAR DUPLICADOS POTENCIALES ────────────────────
-- Alimentos creados por scraping (sin macros, no son del seed)

with sospechosos as (
  select
    a.id as duplicado_id,
    a.nombre as duplicado_nombre,
    a.categoria
  from public.alimentos a
  where a.custom = false                           -- NO son del seed
    and coalesce(a.calorias, 0) = 0
    and coalesce(a.proteinas, 0) = 0
    and coalesce(a.carbohidratos, 0) = 0
    and coalesce(a.grasas, 0) = 0
    and a.es_generico = true
)
select * from sospechosos order by duplicado_nombre;

-- ─── 2. FUNCIÓN: Buscar alimento seed equivalente ────────────
-- Re-implementación del matching en SQL para la reconciliación
-- (misma lógica que match_alimento + normalizador.ts)

create or replace function public.reconciliar_alimento(
  p_nombre_duplicado text
) returns uuid as $$
declare
  v_seed_id uuid;
  v_nombre_limpio text;
  v_palabras text[];
  v_palabra text;
begin
  -- Limpiar nombre: quitar marcas, paréntesis, cantidades, descriptores
  v_nombre_limpio := regexp_replace(p_nombre_duplicado, '\([^)]*\)', '', 'g');
  v_nombre_limpio := regexp_replace(v_nombre_limpio, '\d+\s*(kg|g|ml|l|litro|litros|unidad(?:es)?|pack|ud|uds|unid|pieza(?:s)?|cl|dl|mg|µg)', '', 'gi');
  v_nombre_limpio := regexp_replace(v_nombre_limpio, '(pack|lote|caja|kit)\s*\d+', '', 'gi');
  v_nombre_limpio := regexp_replace(v_nombre_limpio, '\d+\s*(pack|lote|caja|kit)', '', 'gi');
  v_nombre_limpio := regexp_replace(v_nombre_limpio, '\m(freír|freir|asar|cocinar|horno|plancha|vapor|microondas|troceado|fileteado|cortado|entero|natural|ecológico|ecologica|tradicional|congelado|fresco|fresca|ahumado|curado|desnatado|semidesnatado|light|zero|gourmet|premium|selección|seleccion|artesano|artesana|casero|casera|extra|loncheado|picado|rallado|triturado|molido|deshuesado|pelado|sin lactosa|sin gluten|vegano|vegetal)\M', '', 'gi');
  v_nombre_limpio := regexp_replace(v_nombre_limpio, '\m(de|del|la|las|los|el|en|con|sin|y|e|o|a|para|por|al|un|una|su|que)\M', '', 'gi');
  v_nombre_limpio := trim(regexp_replace(v_nombre_limpio, '\s+', ' ', 'g'));

  -- Solo buscar entre alimentos del seed (custom = false, tienen macros)
  -- 1. Intento exacto
  select a.id into v_seed_id from public.alimentos a
  where a.custom = false
    and lower(a.nombre) = lower(v_nombre_limpio)
  limit 1;
  if found then return v_seed_id; end if;

  -- 2. Intento exacto sin acentos
  select a.id into v_seed_id from public.alimentos a
  where a.custom = false
    and lower(unaccent(a.nombre)) = lower(unaccent(v_nombre_limpio))
  limit 1;
  if found then return v_seed_id; end if;

  -- 3. Contiene bidireccional (solo seed)
  select a.id into v_seed_id from public.alimentos a
  where a.custom = false
    and (lower(v_nombre_limpio) like '%' || lower(a.nombre) || '%'
      or lower(a.nombre) like '%' || lower(v_nombre_limpio) || '%')
  limit 1;
  if found then return v_seed_id; end if;

  -- 4. Palabra clave más larga
  v_palabras := regexp_split_to_array(v_nombre_limpio, '\s+');
  if array_length(v_palabras, 1) > 0 then
    select palabra into v_palabra from (
      select unnest(v_palabras) as palabra
    ) sub order by length(palabra) desc limit 1;

    select a.id into v_seed_id from public.alimentos a
    where a.custom = false
      and lower(a.nombre) like '%' || lower(v_palabra) || '%'
    limit 1;
    if found then return v_seed_id; end if;
  end if;

  -- 5. Fuzzy matching (solo seed, similarity > 0.3)
  select a.id into v_seed_id from public.alimentos a
  where a.custom = false
    and lower(a.nombre) % lower(v_nombre_limpio)
  order by similarity(lower(a.nombre), lower(v_nombre_limpio)) desc
  limit 1;
  if found then return v_seed_id; end if;

  return null;
end;
$$ language plpgsql security definer stable;

-- ─── 3. RE-APUNTAR productos_supermercado al alimento correcto ──
-- Para cada duplicado, busca su seed equivalente y actualiza

do $$
declare
  v_duplicado record;
  v_seed_id uuid;
  v_actualizados int := 0;
  v_omitidos int := 0;
  v_errores int := 0;
begin
  raise notice '=== RECONCILIACIÓN: Buscando duplicados... ===';

  for v_duplicado in
    select a.id as duplicado_id, a.nombre as duplicado_nombre
    from public.alimentos a
    where a.custom = false
      and coalesce(a.calorias, 0) = 0
      and coalesce(a.proteinas, 0) = 0
      and coalesce(a.carbohidratos, 0) = 0
      and coalesce(a.grasas, 0) = 0
      and a.es_generico = true
  loop
    -- Buscar alimento seed equivalente
    v_seed_id := public.reconciliar_alimento(v_duplicado.duplicado_nombre);

    if v_seed_id is not null then
      -- Verificar que no estamos apuntando al mismo
      if v_seed_id = v_duplicado.duplicado_id then
        continue;
      end if;

      -- Re-apuntar productos_supermercado
      update public.productos_supermercado
      set alimento_id = v_seed_id
      where alimento_id = v_duplicado.duplicado_id;

      -- Re-apuntar precios_historico
      update public.precios_historico
      set alimento_id = v_seed_id
      where alimento_id = v_duplicado.duplicado_id;

      v_actualizados := v_actualizados + 1;

      raise notice '  ✓ "%s" → seed ID: %s',
        v_duplicado.duplicado_nombre, v_seed_id;
    else
      v_omitidos := v_omitidos + 1;
      raise notice '  ? "%s" → sin match seed (omitido)',
        v_duplicado.duplicado_nombre;
    end if;
  end loop;

  raise notice '=== RECONCILIACIÓN COMPLETADA ===';
  raise notice '  Re-apuntados: %', v_actualizados;
  raise notice '  Omitidos (sin match): %', v_omitidos;
  raise notice '  Errores: %', v_errores;
end;
$$;

-- ─── 4. ELIMINAR DUPLICADOS HUÉRFANOS ─────────────────────────
-- Alimentos duplicados que ya no tienen referencias

do $$
declare
  v_eliminados int := 0;
begin
  -- Eliminar duplicados que:
  -- 1. Son genéricos sin macros (creados por scraping)
  -- 2. Ya no tienen productos_supermercado apuntando a ellos
  -- 3. Ya no tienen precios_historico apuntando a ellos
  -- 4. No están referenciados en comida_alimentos ni ninguna otra tabla

  delete from public.alimentos a
  where a.custom = false
    and coalesce(a.calorias, 0) = 0
    and coalesce(a.proteinas, 0) = 0
    and coalesce(a.carbohidratos, 0) = 0
    and coalesce(a.grasas, 0) = 0
    and a.es_generico = true
    and not exists (
      select 1 from public.productos_supermercado ps
      where ps.alimento_id = a.id
    )
    and not exists (
      select 1 from public.precios_historico ph
      where ph.alimento_id = a.id
    )
    and not exists (
      select 1 from public.comida_alimentos ca
      where ca.alimento_id = a.id
    );

  get diagnostics v_eliminados := ROW_COUNT;
  raise notice 'Duplicados huérfanos eliminados: %', v_eliminados;
end;
$$;

-- ─── 5. FUNCIÓN DE MANTENIMIENTO: match_alimento mejorado ────
-- Actualizar la función match_alimento para que PREFIERA
-- alimentos del seed (custom=false) sobre duplicados genéricos.

create or replace function public.match_alimento(
  p_nombre text
) returns uuid as $$
declare
  v_alimento_id uuid;
  v_nombre_limpio text;
  v_palabras text[];
  v_palabra text;
begin
  -- Limpiar el nombre
  v_nombre_limpio := regexp_replace(p_nombre, '\([^)]*\)', '', 'g');
  v_nombre_limpio := regexp_replace(v_nombre_limpio, '\d+\s*(kg|g|ml|l|litro|litros|unidad(?:es)?|pack|ud|uds|unid|pieza(?:s)?|cl|dl|mg|µg)', '', 'gi');
  v_nombre_limpio := regexp_replace(v_nombre_limpio, '(pack|lote|caja|kit)\s*\d+', '', 'gi');
  v_nombre_limpio := regexp_replace(v_nombre_limpio, '\d+\s*(pack|lote|caja|kit)', '', 'gi');
  v_nombre_limpio := regexp_replace(v_nombre_limpio, '^(Hacendado|Bosque Verde|Deliplus|Carrefour|Milbona|Cien|Lidl|Bellsola|Día|Dia|Alcampo|Auchan|Consum|Eroski|Bonpreu|Esclat|Hipercor|Senda|Aliada)\s+', '', 'i');
  v_nombre_limpio := regexp_replace(v_nombre_limpio, '\s+(Hacendado|Bosque Verde|Deliplus|Carrefour|Milbona|Cien|Lidl|Bellsola|Día|Dia|Alcampo|Auchan|Consum|Eroski|Bonpreu|Esclat|Hipercor|Senda|Aliada)$', '', 'i');
  v_nombre_limpio := regexp_replace(v_nombre_limpio, '\m(freír|freir|asar|cocinar|horno|plancha|vapor|microondas|troceado|fileteado|cortado|entero|natural|ecológico|ecologica|tradicional|congelado|fresco|fresca|ahumado|curado|desnatado|semidesnatado|light|zero|gourmet|premium|selección|seleccion|artesano|artesana|casero|casera|extra|loncheado|picado|rallado|triturado|molido|deshuesado|pelado|sin lactosa|sin gluten|vegano|vegetal)\M', '', 'gi');
  v_nombre_limpio := regexp_replace(v_nombre_limpio, '\m(de|del|la|las|los|el|en|con|sin|y|e|o|a|para|por|al|un|una|su|que)\M', '', 'gi');
  v_nombre_limpio := trim(regexp_replace(v_nombre_limpio, '\s+', ' ', 'g'));

  -- 1. Exacto (prioriza seed sobre genéricos)
  select a.id into v_alimento_id from public.alimentos a
  where lower(a.nombre) = lower(v_nombre_limpio)
  order by case when a.custom = false then 0 else 1 end, a.es_generico asc
  limit 1;
  if found then return v_alimento_id; end if;

  -- 2. Exacto sin acentos (igual, prioriza seed)
  select a.id into v_alimento_id from public.alimentos a
  where lower(unaccent(a.nombre)) = lower(unaccent(v_nombre_limpio))
  order by case when a.custom = false then 0 else 1 end, a.es_generico asc
  limit 1;
  if found then return v_alimento_id; end if;

  -- 3. Contiene bidireccional (SOLO seed)
  select a.id into v_alimento_id from public.alimentos a
  where a.custom = false
    and (lower(v_nombre_limpio) like '%' || lower(a.nombre) || '%'
      or lower(a.nombre) like '%' || lower(v_nombre_limpio) || '%')
  limit 1;
  if found then return v_alimento_id; end if;

  -- 4. Palabra clave más larga (SOLO seed)
  v_palabras := regexp_split_to_array(v_nombre_limpio, '\s+');
  if array_length(v_palabras, 1) > 0 then
    select palabra into v_palabra from (
      select unnest(v_palabras) as palabra
    ) sub order by length(palabra) desc limit 1;

    select a.id into v_alimento_id from public.alimentos a
    where a.custom = false
      and lower(a.nombre) like '%' || lower(v_palabra) || '%'
    limit 1;
    if found then return v_alimento_id; end if;
  end if;

  -- 5. Fuzzy (SOLO seed, similarity > 0.3)
  select a.id into v_alimento_id from public.alimentos a
  where a.custom = false
    and lower(a.nombre) % lower(v_nombre_limpio)
  order by similarity(lower(a.nombre), lower(v_nombre_limpio)) desc
  limit 1;
  if found then return v_alimento_id; end if;

  -- 6. Fallback: cualquier alimento (incluye genéricos scraping)
  select a.id into v_alimento_id from public.alimentos a
  where lower(a.nombre) = lower(v_nombre_limpio)
     or lower(unaccent(a.nombre)) = lower(unaccent(v_nombre_limpio))
  limit 1;
  if found then return v_alimento_id; end if;

  return null;
end;
$$ language plpgsql security definer stable;

-- ─── 6. VERIFICACIÓN FINAL ─────────────────────────────────────
-- Comprobar que todos los productos_supermercado apuntan a alimentos con macros

select
  count(*) as total_productos,
  count(*) filter (
    where a.calorias = 0 and a.proteinas = 0
      and a.carbohidratos = 0 and a.grasas = 0
      and a.custom = false
  ) as productos_a_duplicados_sin_macros,
  count(*) filter (
    where a.calorias > 0 or a.proteinas > 0
      or a.carbohidratos > 0 or a.grasas > 0
  ) as productos_a_alimentos_con_macros
from public.productos_supermercado ps
join public.alimentos a on a.id = ps.alimento_id;

-- ─── 7. NOTA ───────────────────────────────────────────────────
-- Después de ejecutar esta reconciliation, volver a scrapear
-- los supermercados para que los nuevos productos se vinculen
-- correctamente usando la función match_alimento mejorada.
--
-- Para re-scrapear: usar el panel /precios/scraping o la API.
-- ============================================================
