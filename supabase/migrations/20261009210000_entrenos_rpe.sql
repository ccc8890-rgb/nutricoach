-- Esfuerzo percibido (1-10) que anota el atleta tras el entreno. En fuerza/Hyrox el pulso infravalora la carga,
-- así que con RPE el cálculo de carga (TSS) usa RPE × duración. Nulo = sin anotar (la carga queda como antes).
alter table public.entrenos_realizados
  add column if not exists rpe smallint check (rpe between 1 and 10);

comment on column public.entrenos_realizados.rpe is
  'Esfuerzo percibido de la sesión (1-10), anotado por el atleta. Nulo si no lo anotó.';
