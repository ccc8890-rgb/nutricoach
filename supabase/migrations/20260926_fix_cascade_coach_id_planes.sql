-- Incidente real (26-09-2026): borrar un usuario coach de Supabase Auth
-- arrastraba en cascada TODOS los planes de nutrición y entrenamiento de
-- TODOS sus clientes (FK coach_id -> profiles.id ON DELETE CASCADE), sin
-- ningún aviso. Se cambia a RESTRICT: ahora no se puede borrar una cuenta
-- de coach mientras tenga planes en BD, hay que reasignarlos o borrarlos
-- explícitamente primero.
alter table public.planes_nutricion
  drop constraint planes_nutricion_coach_id_fkey,
  add constraint planes_nutricion_coach_id_fkey
    foreign key (coach_id) references public.profiles(id) on delete restrict;

alter table public.planes_entrenamiento
  drop constraint planes_entrenamiento_coach_id_fkey,
  add constraint planes_entrenamiento_coach_id_fkey
    foreign key (coach_id) references public.profiles(id) on delete restrict;
