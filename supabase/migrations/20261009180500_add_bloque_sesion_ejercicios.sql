alter table public.sesion_ejercicios
  add column if not exists bloque text not null default 'principal';

alter table public.sesion_ejercicios
  drop constraint if exists sesion_ejercicios_bloque_check;

alter table public.sesion_ejercicios
  add constraint sesion_ejercicios_bloque_check
  check (bloque in ('calentamiento', 'movilidad', 'pliometria', 'principal', 'accesorios', 'vuelta_calma'));

comment on column public.sesion_ejercicios.bloque is
  'Bloque funcional del ejercicio dentro de la sesión; principal mantiene compatibilidad con planes anteriores.';
