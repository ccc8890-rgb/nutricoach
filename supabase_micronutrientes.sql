-- ============================================================
-- MIGRATION: Añadir micronutrientes a la tabla alimentos
-- ============================================================

-- Vitaminas
alter table public.alimentos add column if not exists vitamina_a_ug numeric(8,2) default 0;   -- µg (retinol equivalentes)
alter table public.alimentos add column if not exists vitamina_c_mg numeric(8,2) default 0;   -- mg
alter table public.alimentos add column if not exists vitamina_d_ug numeric(8,2) default 0;   -- µg
alter table public.alimentos add column if not exists vitamina_e_mg numeric(8,2) default 0;   -- mg (alfa-tocoferol)
alter table public.alimentos add column if not exists vitamina_k_ug numeric(8,2) default 0;   -- µg
alter table public.alimentos add column if not exists vitamina_b6_mg numeric(8,2) default 0;  -- mg
alter table public.alimentos add column if not exists vitamina_b12_ug numeric(8,2) default 0; -- µg
alter table public.alimentos add column if not exists tiamina_mg numeric(8,2) default 0;      -- mg (B1)
alter table public.alimentos add column if not exists riboflavina_mg numeric(8,2) default 0;   -- mg (B2)
alter table public.alimentos add column if not exists niacina_mg numeric(8,2) default 0;      -- mg (B3)
alter table public.alimentos add column if not exists folato_ug numeric(8,2) default 0;       -- µg (B9)

-- Minerales
alter table public.alimentos add column if not exists calcio_mg numeric(8,2) default 0;
alter table public.alimentos add column if not exists hierro_mg numeric(8,2) default 0;
alter table public.alimentos add column if not exists magnesio_mg numeric(8,2) default 0;
alter table public.alimentos add column if not exists fosforo_mg numeric(8,2) default 0;
alter table public.alimentos add column if not exists potasio_mg numeric(8,2) default 0;
alter table public.alimentos add column if not exists sodio_mg numeric(8,2) default 0;
alter table public.alimentos add column if not exists zinc_mg numeric(8,2) default 0;
alter table public.alimentos add column if not exists cobre_mg numeric(8,2) default 0;
alter table public.alimentos add column if not exists selenio_ug numeric(8,2) default 0;

-- Perfil de ácidos grasos (opcional pero útil)
alter table public.alimentos add column if not exists saturados_g numeric(8,2) default 0;
alter table public.alimentos add column if not exists monoinsaturados_g numeric(8,2) default 0;
alter table public.alimentos add column if not exists poliinsaturados_g numeric(8,2) default 0;
alter table public.alimentos add column if not exists colesterol_mg numeric(8,2) default 0;

-- ============================================================
-- FUNCIÓN: Actualizar micronutrientes desde JSON
-- ============================================================
-- Permite al coach o al script actualizar los micronutrientes
-- de un alimento sin tocar los macros.

create or replace function public.actualizar_micronutrientes(
  p_alimento_id uuid,
  p_micros jsonb
) returns public.alimentos
language plpgsql security definer
as $$
declare
  result public.alimentos;
begin
  update public.alimentos set
    vitamina_a_ug = coalesce((p_micros->>'vitamina_a_ug')::numeric, vitamina_a_ug),
    vitamina_c_mg = coalesce((p_micros->>'vitamina_c_mg')::numeric, vitamina_c_mg),
    vitamina_d_ug = coalesce((p_micros->>'vitamina_d_ug')::numeric, vitamina_d_ug),
    vitamina_e_mg = coalesce((p_micros->>'vitamina_e_mg')::numeric, vitamina_e_mg),
    vitamina_k_ug = coalesce((p_micros->>'vitamina_k_ug')::numeric, vitamina_k_ug),
    vitamina_b6_mg = coalesce((p_micros->>'vitamina_b6_mg')::numeric, vitamina_b6_mg),
    vitamina_b12_ug = coalesce((p_micros->>'vitamina_b12_ug')::numeric, vitamina_b12_ug),
    tiamina_mg = coalesce((p_micros->>'tiamina_mg')::numeric, tiamina_mg),
    riboflavina_mg = coalesce((p_micros->>'riboflavina_mg')::numeric, riboflavina_mg),
    niacina_mg = coalesce((p_micros->>'niacina_mg')::numeric, niacina_mg),
    folato_ug = coalesce((p_micros->>'folato_ug')::numeric, folato_ug),
    calcio_mg = coalesce((p_micros->>'calcio_mg')::numeric, calcio_mg),
    hierro_mg = coalesce((p_micros->>'hierro_mg')::numeric, hierro_mg),
    magnesio_mg = coalesce((p_micros->>'magnesio_mg')::numeric, magnesio_mg),
    fosforo_mg = coalesce((p_micros->>'fosforo_mg')::numeric, fosforo_mg),
    potasio_mg = coalesce((p_micros->>'potasio_mg')::numeric, potasio_mg),
    sodio_mg = coalesce((p_micros->>'sodio_mg')::numeric, sodio_mg),
    zinc_mg = coalesce((p_micros->>'zinc_mg')::numeric, zinc_mg),
    cobre_mg = coalesce((p_micros->>'cobre_mg')::numeric, cobre_mg),
    selenio_ug = coalesce((p_micros->>'selenio_ug')::numeric, selenio_ug),
    saturados_g = coalesce((p_micros->>'saturados_g')::numeric, saturados_g),
    monoinsaturados_g = coalesce((p_micros->>'monoinsaturados_g')::numeric, monoinsaturados_g),
    poliinsaturados_g = coalesce((p_micros->>'poliinsaturados_g')::numeric, poliinsaturados_g),
    colesterol_mg = coalesce((p_micros->>'colesterol_mg')::numeric, colesterol_mg)
  where id = p_alimento_id
  returning * into result;
  
  return result;
end;
$$;
