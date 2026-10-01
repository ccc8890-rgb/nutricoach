-- Postre / complemento de una comida (fruta, yogur, postre…): ingredientes extra de la propia comida,
-- así computan en los macros de la comida, el día y la semana en todo lo que lee comida_alimentos
-- (portal del cliente, lista de la compra, costes). Cambiar la receta principal no los borra.
alter table public.comida_alimentos
  add column if not exists es_complemento boolean not null default false,
  -- si el complemento es una receta (postre), sus ingredientes comparten este id para agruparlos
  add column if not exists complemento_receta_id uuid references public.recetas(id) on delete set null;

comment on column public.comida_alimentos.es_complemento is
  'true = postre/complemento añadido fuera de la receta principal de la comida.';

create index if not exists comida_alimentos_complemento_idx
  on public.comida_alimentos (comida_id) where es_complemento;
