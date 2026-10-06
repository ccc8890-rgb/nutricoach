-- Piezas de contenido: una receta (o idea) que Carlos quiere grabar y publicar.
-- Fuente de verdad del estado de contenido; recetas.contenido_estado queda como caché derivado del icono.
create table if not exists public.piezas_contenido (
  id uuid primary key default gen_random_uuid(),
  coach_id uuid not null references auth.users(id) on delete cascade,
  receta_id uuid references public.recetas(id) on delete set null,
  plan_id uuid references public.planes_nutricion(id) on delete set null,
  titulo text not null,
  enlace_referencia text,
  notas text,
  gancho text,
  estado text not null default 'idea'
    check (estado in ('idea', 'documentada', 'para_grabar', 'grabada', 'editada', 'programada', 'publicada')),
  fecha_grabacion date,
  fecha_publicacion date,
  planos_hechos text[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists piezas_contenido_coach_estado_idx on public.piezas_contenido (coach_id, estado);
create index if not exists piezas_contenido_receta_idx on public.piezas_contenido (receta_id);
create index if not exists piezas_contenido_grabacion_idx on public.piezas_contenido (coach_id, fecha_grabacion);

alter table public.piezas_contenido enable row level security;

create policy piezas_contenido_coach on public.piezas_contenido
  for all to authenticated
  using (coach_id = auth.uid())
  with check (coach_id = auth.uid());

comment on table public.piezas_contenido is
  'Ideas y recetas a grabar/publicar por el coach. Las rutas API usan service role y filtran por coach_id.';

-- Copia lo que ya estaba marcado con el icono del planificador. Lo grabado entra con la escaleta completa.
insert into public.piezas_contenido (coach_id, receta_id, titulo, estado, planos_hechos)
select r.coach_id, r.id, r.nombre, r.contenido_estado,
       case when r.contenido_estado = 'grabada'
            then array['ingredientes', 'proceso', 'cocinado', 'plato', 'detalle', 'macros']
            else '{}'::text[] end
from public.recetas r
where r.contenido_estado is not null
  and r.coach_id is not null
  and not exists (select 1 from public.piezas_contenido p where p.receta_id = r.id);
