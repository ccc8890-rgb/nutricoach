-- Reserva de la ficha mientras el agente la revisa: evita dobles revisiones simultáneas (cron + pasada local + «Revisar ahora»).
alter table public.recetas drop constraint if exists recetas_fase_revision_check;
alter table public.recetas add constraint recetas_fase_revision_check check (fase_revision in ('en_agente', 'revisando', 'segunda'));
-- Cuándo se reservó (o se intentó por última vez): ordena la cola y permite recuperar reservas colgadas
alter table public.recetas add column if not exists fase_revision_at timestamptz;
-- Revertir:
--   update public.recetas set fase_revision = 'en_agente' where fase_revision = 'revisando';
--   alter table public.recetas drop constraint recetas_fase_revision_check;
--   alter table public.recetas add constraint recetas_fase_revision_check check (fase_revision in ('en_agente', 'segunda'));
--   alter table public.recetas drop column fase_revision_at;
