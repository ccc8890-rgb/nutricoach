-- ============================================================
-- SEED: Precios de supermercado para alimentos básicos
-- ============================================================
-- Ejecutar DESPUÉS de:
--   1. seed_alimentos.sql + seed_alimentos_extra.sql
--   2. supabase_precios_supermercado.sql
--   3. supabase_productos_vs_alimentos.sql
--
-- Inserta precios de referencia para alimentos básicos en los
-- supermercados disponibles. Solo inserta si no existe ya un
-- producto para ese (supermercado_id, alimento_id).
-- ============================================================

-- ─── Función helper: insertar precio si no existe ────────────
create or replace function _seed_insertar_precio(
  p_slug text,
  p_alimento_nombre text,
  p_precio_kg numeric,
  p_unidad text default 'kg',
  p_precio_uni numeric default null
) returns void language plpgsql as $$
declare
  v_sm_id  uuid;
  v_al_id  uuid;
begin
  v_sm_id := (select id from public.supermercados where slug = p_slug limit 1);
  v_al_id := (select id from public.alimentos where nombre = p_alimento_nombre limit 1);

  if v_sm_id is null then
    raise warning '[seed_precios] Supermercado no encontrado: %', p_slug;
    return;
  end if;
  if v_al_id is null then
    raise warning '[seed_precios] Alimento no encontrado: %', p_alimento_nombre;
    return;
  end if;

  if not exists (
    select 1 from public.productos_supermercado
    where supermercado_id = v_sm_id and alimento_id = v_al_id
  ) then
    insert into public.productos_supermercado
      (supermercado_id, alimento_id, nombre_original, precio_por_kg, precio_unidad, unidad, fecha_precio)
    values
      (v_sm_id, v_al_id, 'Seed: ' || p_alimento_nombre, p_precio_kg, p_precio_uni, p_unidad, current_date);
  end if;
end;
$$;

-- ─── Función helper: batch multi-supermercado ───────────────
create or replace function _seed_insertar_batch(
  p_alimento_nombre text,
  p_precios numeric[],
  p_unidad text default 'kg'
) returns void language plpgsql as $$
declare
  v_slugs text[] := array['mercadona','carrefour','consum','lidl','alcampo','dia','eroski'];
begin
  for i in 1..least(array_length(v_slugs, 1), array_length(p_precios, 1)) loop
    if p_precios[i] is not null then
      perform _seed_insertar_precio(v_slugs[i], p_alimento_nombre, p_precios[i], p_unidad);
    end if;
  end loop;
end;
$$;

-- ============================================================
-- CARNES
-- ============================================================

select _seed_insertar_batch('Pechuga de pollo (cruda)',       array[7.95, 8.49, 7.75, 6.99, 8.25, 7.49, 8.10]);
select _seed_insertar_batch('Muslo de pollo sin piel',         array[5.95, 6.29, 5.75, 4.99, 6.15, 5.49, null]);
select _seed_insertar_batch('Pavo pechuga (cruda)',            array[8.95, 9.49, 8.75, 7.99, 9.20, null, null]);
select _seed_insertar_batch('Ternera magra (solomillo)',       array[14.95, 16.50, 15.25, 12.99, 15.90, 13.49, 15.80]);
select _seed_insertar_batch('Ternera picada (5% grasa)',       array[9.95, 10.90, 9.75, 8.49, 10.50, null, null]);
select _seed_insertar_batch('Lomo de cerdo',                   array[7.95, 8.49, 7.65, 6.99, 8.20, 7.29, null]);
select _seed_insertar_batch('Jamón serrano',                   array[15.95, 18.00, 16.50, 12.99, 17.50, null, null]);

-- ============================================================
-- PESCADOS
-- ============================================================

select _seed_insertar_batch('Salmón (fresco)',                 array[12.95, 14.50, 13.25, 10.99, 13.90, 11.49, 13.50]);
select _seed_insertar_batch('Merluza',                         array[10.95, 12.00, 11.50, 8.99, 11.80, null, null]);
select _seed_insertar_batch('Atún en lata al natural',         array[14.50, 16.00, 15.00, 11.99, null, 13.50, null]);
select _seed_insertar_batch('Dorada',                          array[8.95, 9.90, 9.50, 7.99, 9.75, null, null]);
select _seed_insertar_batch('Gambas',                          array[14.95, 16.50, 15.00, 11.99, null, 13.50, null]);

-- ============================================================
-- HUEVOS (con precio_unidad — docena ~600g → precio_por_kg)
-- ============================================================

select _seed_insertar_precio('mercadona', 'Huevo entero (L)', 4.95, 'unidad', 2.97);
select _seed_insertar_precio('carrefour', 'Huevo entero (L)', 5.50, 'unidad', 3.30);
select _seed_insertar_precio('consum',    'Huevo entero (L)', 5.20, 'unidad', 3.12);
select _seed_insertar_precio('lidl',      'Huevo entero (L)', 4.25, 'unidad', 2.55);
select _seed_insertar_precio('alcampo',   'Huevo entero (L)', 5.40, 'unidad', 3.24);
select _seed_insertar_precio('dia',       'Huevo entero (L)', 4.69, 'unidad', 2.81);

-- ============================================================
-- LÁCTEOS
-- ============================================================

select _seed_insertar_batch('Leche entera',                    array[0.95, 1.05, 1.00, 0.89, 1.02, 0.92, 1.00], 'L');
select _seed_insertar_batch('Leche desnatada',                 array[0.95, 1.05, 1.00, 0.85, 1.02, 0.92, 0.98], 'L');
select _seed_insertar_batch('Yogur griego natural (0%)',       array[4.50, 5.20, 4.80, 3.99, 5.00, 4.29, null]);
select _seed_insertar_batch('Yogur griego natural (entero)',   array[5.20, 5.90, 5.50, 4.49, 5.70, 4.99, null]);
select _seed_insertar_batch('Queso cottage',                   array[7.50, 8.50, 7.90, 6.49, null, 7.29, null]);
select _seed_insertar_batch('Queso mozzarella',                array[8.95, 10.00, 9.50, 7.49, 9.80, null, null]);
select _seed_insertar_batch('Queso parmesano',                 array[16.50, 19.00, 18.00, 14.99, 18.50, null, null]);

-- ============================================================
-- FRUTAS Y VERDURAS
-- ============================================================

select _seed_insertar_batch('Plátano',                         array[1.95, 2.25, 2.10, 1.79, 2.15, 1.89, null]);
select _seed_insertar_batch('Manzana',                         array[1.95, 2.39, 2.15, 1.69, 2.25, 1.85, null]);
select _seed_insertar_batch('Naranja',                         array[1.65, 1.99, 1.80, 1.49, 1.85, 1.59, null]);
select _seed_insertar_batch('Fresas',                          array[2.95, 3.50, 3.25, 2.49, 3.40, 2.89, null]);
select _seed_insertar_batch('Arándanos',                       array[8.95, 10.50, 9.75, 7.99, 10.00, null, null]);
select _seed_insertar_batch('Aguacate',                        array[4.95, 5.90, 5.50, 3.99, 5.75, 4.49, null]);
select _seed_insertar_batch('Espinacas (crudas)',              array[3.50, 4.20, 3.80, 2.99, 4.00, null, null]);
select _seed_insertar_batch('Brócoli (crudo)',                 array[2.50, 3.00, 2.75, 1.99, 2.90, null, null]);
select _seed_insertar_batch('Tomate',                          array[2.50, 2.99, 2.75, 1.99, 2.85, 2.39, null]);

-- ============================================================
-- CEREALES / DESPENSA
-- ============================================================

select _seed_insertar_batch('Arroz blanco (crudo)',            array[1.70, 2.10, 1.85, 1.49, 1.95, 1.65, 1.90]);
select _seed_insertar_batch('Aceite de oliva virgen extra',    array[8.50, 9.95, 9.25, 7.49, 9.50, 7.99, 9.00], 'L');

-- ============================================================
-- LIMPIEZA
-- ============================================================

drop function if exists public._seed_insertar_batch(text, numeric[], text);
drop function if exists public._seed_insertar_precio(text, text, numeric, text, numeric);
