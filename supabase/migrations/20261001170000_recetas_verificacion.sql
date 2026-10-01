-- Recetario de confianza: una receta verificada está completa y revisada.
-- 'auto' = la marcó el sistema (completa + quality gate sin bloqueantes);
-- 'coach' = la confirmó el coach. NULL = no verificada.
alter table public.recetas
  add column if not exists verificacion text
    check (verificacion in ('auto', 'coach')),
  add column if not exists verificada_at timestamptz;

create index if not exists idx_recetas_verificadas
  on public.recetas (tipo_plato)
  where estado = 'aprobada' and verificacion is not null;
