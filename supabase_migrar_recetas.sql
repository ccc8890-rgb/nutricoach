-- ============================================================
-- MIGRACIÓN: Recetas del esquema antiguo al nuevo
-- ============================================================
-- El esquema antiguo tenía columnas como:
--   kcal_por_porcion, proteinas_por_porcion, ingredientes (text), pasos, url, tipo_plato
--
-- El esquema nuevo tiene:
--   kcal, proteinas, instrucciones, url_origen, tipo_coccion,
--   + receta_ingredientes (join table), consejos, dificultad, porciones, etc.
-- ============================================================

-- 1. Añadir columnas nuevas que puedan faltar
do $$ begin
  -- Mapeo de columnas antiguas a nuevas
  if exists (select 1 from information_schema.columns where table_name='recetas' and column_name='pasos') then
    alter table public.recetas rename column pasos to instrucciones;
  end if;

  if exists (select 1 from information_schema.columns where table_name='recetas' and column_name='kcal_por_porcion') then
    alter table public.recetas rename column kcal_por_porcion to kcal;
  end if;

  if exists (select 1 from information_schema.columns where table_name='recetas' and column_name='proteinas_por_porcion') then
    alter table public.recetas rename column proteinas_por_porcion to proteinas;
  end if;

  if exists (select 1 from information_schema.columns where table_name='recetas' and column_name='carbohidratos_por_porcion') then
    alter table public.recetas rename column carbohidratos_por_porcion to carbohidratos;
  end if;

  if exists (select 1 from information_schema.columns where table_name='recetas' and column_name='grasas_por_porcion') then
    alter table public.recetas rename column grasas_por_porcion to grasas;
  end if;

  if exists (select 1 from information_schema.columns where table_name='recetas' and column_name='tipo_plato') then
    alter table public.recetas rename column tipo_plato to tipo_coccion;
  end if;

  if exists (select 1 from information_schema.columns where table_name='recetas' and column_name='url') then
    alter table public.recetas rename column url to url_origen;
  end if;

  -- Añadir columnas del nuevo esquema que no existan
  if not exists (select 1 from information_schema.columns where table_name='recetas' and column_name='descripcion') then
    alter table public.recetas add column descripcion text;
  end if;

  if not exists (select 1 from information_schema.columns where table_name='recetas' and column_name='consejos') then
    alter table public.recetas add column consejos text;
  end if;

  if not exists (select 1 from information_schema.columns where table_name='recetas' and column_name='dificultad') then
    alter table public.recetas add column dificultad text;
  end if;

  if not exists (select 1 from information_schema.columns where table_name='recetas' and column_name='porciones') then
    alter table public.recetas add column porciones int default 1;
  end if;

  if not exists (select 1 from information_schema.columns where table_name='recetas' and column_name='tiempo_prep_min') then
    alter table public.recetas add column tiempo_prep_min int;
  end if;

  if not exists (select 1 from information_schema.columns where table_name='recetas' and column_name='tiempo_coccion_min') then
    alter table public.recetas add column tiempo_coccion_min int;
  end if;

  if not exists (select 1 from information_schema.columns where table_name='recetas' and column_name='fibra') then
    alter table public.recetas add column fibra numeric(6,2) default 0;
  end if;

  if not exists (select 1 from information_schema.columns where table_name='recetas' and column_name='imagen_url') then
    alter table public.recetas add column imagen_url text;
  end if;

  if not exists (select 1 from information_schema.columns where table_name='recetas' and column_name='fuente') then
    alter table public.recetas add column fuente text default 'manual';
  end if;

  if not exists (select 1 from information_schema.columns where table_name='recetas' and column_name='notion_id') then
    alter table public.recetas add column notion_id text;
  end if;

  if not exists (select 1 from information_schema.columns where table_name='recetas' and column_name='instrucciones') then
    alter table public.recetas add column instrucciones text;
  end if;

  if not exists (select 1 from information_schema.columns where table_name='recetas' and column_name='kcal') then
    alter table public.recetas add column kcal numeric(7,2);
  end if;

  if not exists (select 1 from information_schema.columns where table_name='recetas' and column_name='proteinas') then
    alter table public.recetas add column proteinas numeric(6,2);
  end if;

  if not exists (select 1 from information_schema.columns where table_name='recetas' and column_name='carbohidratos') then
    alter table public.recetas add column carbohidratos numeric(6,2);
  end if;

  if not exists (select 1 from information_schema.columns where table_name='recetas' and column_name='grasas') then
    alter table public.recetas add column grasas numeric(6,2);
  end if;

  if not exists (select 1 from information_schema.columns where table_name='recetas' and column_name='intolerancias') then
    alter table public.recetas add column intolerancias text[];
  end if;

  if not exists (select 1 from information_schema.columns where table_name='recetas' and column_name='activa') then
    alter table public.recetas add column activa boolean default true;
  end if;

  if not exists (select 1 from information_schema.columns where table_name='recetas' and column_name='updated_at') then
    alter table public.recetas add column updated_at timestamptz default now();
  end if;
end $$;

-- 2. Migrar intolerancias de text a text[] si están en texto plano
update public.recetas
set intolerancias = case
  when intolerancias is null then null
  when array_length(intolerancias, 1) > 0 then intolerancias  -- ya es array
  else string_to_array(intolerancias::text, ',')
end
where intolerancias is not null;

-- 3. Migrar cocina a tipo_coccion si estaba como texto suelto
-- (solo si la columna sigue existiendo como texto plano)

-- 4. Migrar ingredientes (texto plano) a receta_ingredientes
-- Solo si la tabla receta_ingredientes NO existe, la creamos
create table if not exists public.receta_ingredientes (
  id uuid default uuid_generate_v4() primary key,
  receta_id uuid references public.recetas(id) on delete cascade,
  alimento_id uuid references public.alimentos(id),
  nombre_libre text,
  cantidad_gramos numeric(7,2) not null,
  orden int default 0,
  created_at timestamptz default now()
);

-- Crear índices si no existen
create index if not exists recetas_coach_id_idx on public.recetas(coach_id);
create index if not exists receta_ingredientes_receta_id_idx on public.receta_ingredientes(receta_id);

-- 5. Migrar datos de ingredientes desde el campo text antiguo
-- Buscar recetas que tengan ingredientes en texto pero NO en receta_ingredientes
do $$
declare
  r record;
  ing_line text;
  ing_parts text[];
  ing_nombre text;
  ing_gramos numeric;
  ing_idx int := 0;
begin
  for r in
    select id, ingredientes
    from public.recetas
    where ingredientes is not null
      and ingredientes != ''
      and not exists (select 1 from public.receta_ingredientes where receta_id = recetas.id)
  loop
    ing_idx := 0;
    for ing_line in select unnest(string_to_array(r.ingredientes, E'\n')) loop
      ing_line := trim(ing_line);
      continue when ing_line = '';
      ing_idx := ing_idx + 1;

      -- Intentar extraer cantidad (número al inicio)
      ing_parts := regexp_matches(ing_line, '^([\d.,]+)\s*(?:g|gr|gramos?)?\s*(.+)$', 'i');
      if ing_parts is not null then
        ing_gramos := replace(ing_parts[1], ',', '.')::numeric;
        ing_nombre := trim(ing_parts[2]);
      else
        -- Sin cantidad explícita, asumir 100g
        ing_gramos := 100;
        ing_nombre := ing_line;
      end if;

      insert into public.receta_ingredientes (receta_id, nombre_libre, cantidad_gramos, orden)
      values (r.id, ing_nombre, ing_gramos, ing_idx);
    end loop;
  end loop;
end $$;

-- 6. Calcular macros desde ingredientes vinculados
update public.recetas r
set
  kcal = sub.kcal,
  proteinas = sub.proteinas,
  carbohidratos = sub.carbohidratos,
  grasas = sub.grasas,
  fibra = sub.fibra
from (
  select
    ri.receta_id,
    round(sum(a.calorias * ri.cantidad_gramos / 100.0) / nullif(r2.porciones, 0), 2) as kcal,
    round(sum(a.proteinas * ri.cantidad_gramos / 100.0) / nullif(r2.porciones, 0), 2) as proteinas,
    round(sum(a.carbohidratos * ri.cantidad_gramos / 100.0) / nullif(r2.porciones, 0), 2) as carbohidratos,
    round(sum(a.grasas * ri.cantidad_gramos / 100.0) / nullif(r2.porciones, 0), 2) as grasas,
    round(sum(coalesce(a.fibra, 0) * ri.cantidad_gramos / 100.0) / nullif(r2.porciones, 0), 2) as fibra
  from public.receta_ingredientes ri
  join public.alimentos a on a.id = ri.alimento_id
  join public.recetas r2 on r2.id = ri.receta_id
  group by ri.receta_id
) sub
where r.id = sub.receta_id
  and (r.kcal is null or r.kcal = 0);

-- 7. RLS para la nueva tabla
alter table public.receta_ingredientes enable row level security;

drop policy if exists "Coach puede gestionar ingredientes de receta" on public.receta_ingredientes;
create policy "Coach puede gestionar ingredientes de receta" on public.receta_ingredientes
  for all using (
    exists (select 1 from public.recetas where id = receta_id and coach_id = auth.uid())
  );

drop policy if exists "Cliente puede ver ingredientes de recetas de su coach" on public.receta_ingredientes;
create policy "Cliente puede ver ingredientes de recetas de su coach" on public.receta_ingredientes
  for select using (
    exists (
      select 1 from public.recetas r
      join public.clientes c on c.coach_id = r.coach_id
      where r.id = receta_id and c.profile_id = auth.uid()
    )
  );

-- 8. Storage bucket para imágenes
insert into storage.buckets (id, name, public)
values ('recetas', 'recetas', true)
on conflict (id) do nothing;

-- 9. Eliminar columna ingredientes (texto) si ya no se necesita
-- Comentado: mejor mantenerla hasta confirmar que la migración fue exitosa
-- alter table public.recetas drop column if exists ingredientes;

-- 10. Actualizar timestamp de migración
update public.recetas set updated_at = now() where true;

