-- Las plantillas conservan el «sin parar» al copiarse a un plan de cliente y viceversa.
alter table public.plantilla_sesion_ejercicios
  add column if not exists encadenado boolean not null default false;
