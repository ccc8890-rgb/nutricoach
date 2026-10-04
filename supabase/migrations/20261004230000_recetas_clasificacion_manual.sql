-- Clasificación profesional editable a mano: si es true, la auditoría automática no sobrescribe
-- nivel_fit / tipo_uso / contexto_uso / apta_cliente / alcohol_culinario (sí sigue recalculando el score).
alter table public.recetas
  add column if not exists clasificacion_manual boolean not null default false;
