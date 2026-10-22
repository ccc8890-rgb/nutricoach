-- Búsqueda sin distinguir tildes también en alimentos y ejercicios (mismo patrón que recetas.nombre_busqueda).
-- Reversible: alter table public.alimentos drop column nombre_busqueda; alter table public.ejercicios drop column nombre_busqueda;
alter table public.alimentos
  add column if not exists nombre_busqueda text
  generated always as (lower(public.immutable_unaccent(nombre))) stored;

alter table public.ejercicios
  add column if not exists nombre_busqueda text
  generated always as (lower(public.immutable_unaccent(nombre))) stored;
