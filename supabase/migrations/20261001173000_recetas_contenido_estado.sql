-- Planificación de contenido: recetas que el coach quiere grabar o ya grabó.
alter table public.recetas
  add column if not exists contenido_estado text
    check (contenido_estado in ('para_grabar', 'grabada'));
