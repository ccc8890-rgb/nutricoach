-- Capa «Estudio» de la ficha (cocina profesional): rendimiento, tiempos, mise en place, porcionado, conservación, equipo, variantes, origen.
-- Estructura validada en lib/recetas/estudio.ts. Nula = sin datos.
alter table public.recetas add column if not exists estudio jsonb;
-- Revertir:
--   alter table public.recetas drop column estudio;
