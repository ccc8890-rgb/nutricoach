-- La IA de entrenamiento (lib/agentes/aplicar.ts) intenta leer y escribir
-- el RPE de cada ejercicio de una sesión REAL asignada a un cliente
-- (sesion_ejercicios), pero esa columna solo existía en las plantillas
-- (plantilla_sesion_ejercicios). Cualquier aplicación de una actualización
-- de IA que tocara RPE fallaba en silencio con "column does not exist".
alter table public.sesion_ejercicios
  add column if not exists rpe text;
