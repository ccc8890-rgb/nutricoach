-- «Encadenado»: el ejercicio sale directo al siguiente, sin pausa (estación Hyrox + carrera, trabajo en fatiga).
alter table public.sesion_ejercicios
  add column if not exists encadenado boolean not null default false;

comment on column public.sesion_ejercicios.encadenado is 'true = este ejercicio enlaza sin pausa con el siguiente de la sesión (misma ronda).';
