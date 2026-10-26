-- Tipo (plato / elaboración) y familia de cocinero de cada ficha del recetario.
alter table public.recetas
  add column if not exists tipo_contenido text not null default 'plato' check (tipo_contenido in ('plato', 'elaboracion'));
alter table public.recetas add column if not exists familia text;
create index if not exists recetas_tipo_familia_idx on public.recetas (tipo_contenido, familia);
-- Las elaboraciones ya marcadas (salsa_base) pasan a ser del tipo elaboración
update public.recetas set tipo_contenido = 'elaboracion' where tipo_receta = 'salsa_base';
-- Revertir:
--   drop index public.recetas_tipo_familia_idx;
--   alter table public.recetas drop column familia;
--   alter table public.recetas drop column tipo_contenido;
