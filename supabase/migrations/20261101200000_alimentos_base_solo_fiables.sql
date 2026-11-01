-- Un alimento pasa a «base» al usarse en una receta o comida SOLO si su fuente es fiable (BEDCA, curada, coach).
-- Antes cualquier uso lo promocionaba: un enlace erróneo («Nata» → «Castañas heladas de nata») convertía el producto elaborado en «básico»
-- y el buscador lo ofrecía primero (círculo vicioso). Los de fuente IA / Open Food Facts siguen disponibles en «Ver más opciones».
-- Reversible: volver a crear la función sin la condición de fuente.
create or replace function promover_alimento_base() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.alimento_id is not null then
    update alimentos set es_base = true
    where id = new.alimento_id and not es_base and fuente in ('bedca', 'curada', 'coach');
  end if;
  return new;
end $$;
