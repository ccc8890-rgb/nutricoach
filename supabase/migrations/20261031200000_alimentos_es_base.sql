-- Alimentos «base»: los que de verdad se usan (recetas y dietas) más BEDCA y los del coach. Los buscadores para AÑADIR un alimento
-- (editor de recetas, constructor de dietas) buscan primero ahí; el resto del catálogo (productos de supermercado) sigue para precios y compra.
-- Aditiva y reversible:  drop trigger … ; drop function promover_alimento_base(); alter table alimentos drop column es_base;
alter table alimentos add column if not exists es_base boolean not null default false;
create index if not exists idx_alimentos_es_base on alimentos (es_base) where es_base;

update alimentos set es_base = true
where es_comestible
  and (fuente in ('bedca', 'coach')
       or id in (select alimento_id from receta_ingredientes where alimento_id is not null
                 union select alimento_id from comida_alimentos where alimento_id is not null));

-- Un alimento pasa a ser base en cuanto una receta o una comida lo usa
create or replace function promover_alimento_base() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.alimento_id is not null then
    update alimentos set es_base = true where id = new.alimento_id and not es_base;
  end if;
  return new;
end $$;

drop trigger if exists trg_promover_base_receta_ingredientes on receta_ingredientes;
create trigger trg_promover_base_receta_ingredientes after insert or update of alimento_id on receta_ingredientes
  for each row execute function promover_alimento_base();
drop trigger if exists trg_promover_base_comida_alimentos on comida_alimentos;
create trigger trg_promover_base_comida_alimentos after insert or update of alimento_id on comida_alimentos
  for each row execute function promover_alimento_base();
