-- El coach decide por cliente si el portal muestra la capa profesional de las recetas (Estudio y técnicas).
alter table public.clientes
  add column if not exists acceso_profesional boolean not null default false;
-- Revertir: alter table public.clientes drop column acceso_profesional;
