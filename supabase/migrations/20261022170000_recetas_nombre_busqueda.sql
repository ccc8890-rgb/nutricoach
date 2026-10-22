-- Búsqueda de recetas sin distinguir tildes: «limon» encuentra «Limón».
-- `unaccent` es STABLE y no puede usarse en una columna generada; esta envoltura IMMUTABLE (patrón habitual)
-- fija el diccionario. Aditiva y reversible:
--   alter table public.recetas drop column nombre_busqueda; drop function public.immutable_unaccent(text);
create or replace function public.immutable_unaccent(texto text)
returns text
language sql
immutable
parallel safe
strict
set search_path = public
as $$ select public.unaccent('public.unaccent'::regdictionary, texto) $$;

alter table public.recetas
  add column if not exists nombre_busqueda text
  generated always as (lower(public.immutable_unaccent(nombre))) stored;
