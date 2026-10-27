-- Proteína(s) principal(es) de cada receta (Pollo, Carne, Pescado, Huevo, Legumbres, Vegetal, Queso, Lácteos), calculadas desde
-- sus ingredientes por scripts/clasificar-proteina-principal.ts (también en la pasada de 6 h). Alimenta los filtros del selector de recetas.
alter table public.recetas add column if not exists proteinas_principales text[] not null default '{}';
create index if not exists recetas_proteinas_principales_idx on public.recetas using gin (proteinas_principales);
-- Revertir:
--   drop index public.recetas_proteinas_principales_idx;
--   alter table public.recetas drop column proteinas_principales;
