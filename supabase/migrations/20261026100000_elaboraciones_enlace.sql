-- Una línea de receta puede ser una elaboración (poolish, masa, salsa…) además de un alimento o texto libre.
alter table public.receta_ingredientes
  add column if not exists elaboracion_id uuid references public.recetas(id) on delete restrict;
alter table public.receta_ingredientes
  drop constraint if exists receta_ingredientes_alimento_o_elaboracion;
alter table public.receta_ingredientes
  add constraint receta_ingredientes_alimento_o_elaboracion check (not (alimento_id is not null and elaboracion_id is not null));
create index if not exists receta_ingredientes_elaboracion_idx on public.receta_ingredientes (elaboracion_id) where elaboracion_id is not null;
-- Peso del producto terminado (una masa pierde agua al cocinar). Vacío = suma de los ingredientes.
alter table public.recetas add column if not exists peso_final_g numeric check (peso_final_g > 0);
-- Revertir:
--   alter table public.recetas drop column peso_final_g;
--   drop index public.receta_ingredientes_elaboracion_idx;
--   alter table public.receta_ingredientes drop constraint receta_ingredientes_alimento_o_elaboracion;
--   alter table public.receta_ingredientes drop column elaboracion_id;
