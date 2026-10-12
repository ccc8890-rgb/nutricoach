-- Progresión semana a semana dentro del bloque: semanas del macrociclo (minutos por tipo de sesión, descarga). La semana tipo del plan es la semana 1.
alter table public.planes_entrenamiento
  add column if not exists progresion jsonb;

comment on column public.planes_entrenamiento.progresion is '{version:1, semanas:[{n, descarga, sesiones:[{tipo, minutos}]}]}; null = plan sin progresión calculada (todas las semanas iguales).';
