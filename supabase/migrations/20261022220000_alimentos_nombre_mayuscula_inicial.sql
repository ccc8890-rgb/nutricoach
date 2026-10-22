-- El nombre de un alimento (el que se ve en las recetas) empieza siempre en mayúscula, venga de donde venga
-- (app, scrapers, bridge de Content Radar, IA). Antes había 306 en minúscula.
create or replace function public.alimentos_nombre_mayuscula_inicial() returns trigger
language plpgsql as $$
begin
  new.nombre := upper(left(btrim(new.nombre), 1)) || substr(btrim(new.nombre), 2);
  return new;
end $$;

drop trigger if exists trg_alimentos_nombre_mayuscula on public.alimentos;
create trigger trg_alimentos_nombre_mayuscula
  before insert or update of nombre on public.alimentos
  for each row execute function public.alimentos_nombre_mayuscula_inicial();
-- Revertir: drop trigger trg_alimentos_nombre_mayuscula on public.alimentos; drop function public.alimentos_nombre_mayuscula_inicial();
