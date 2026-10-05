-- Hora de inicio por sesión de entreno (HH:MM) y número de comidas al día por cliente.
-- Ambas opcionales: sin valor, el motor usa la hora del cuestionario y las franjas del plan, como hasta ahora.
alter table public.sesiones_entrenamiento
  add column if not exists hora_inicio text check (hora_inicio is null or hora_inicio ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$');
alter table public.clientes
  add column if not exists comidas_dia smallint check (comidas_dia is null or comidas_dia between 2 and 5);
