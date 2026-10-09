-- Historial de cambios de VDOT del atleta: fecha, valor anterior y nuevo, origen y motivo.
alter table public.perfil_entreno_cliente add column if not exists vdot_historial jsonb not null default '[]'::jsonb;
comment on column public.perfil_entreno_cliente.vdot_historial is
  'Array de {fecha, anterior, vdot, origen, motivo}. Lo escribe la recalibración cuando el coach acepta un VDOT nuevo.';
