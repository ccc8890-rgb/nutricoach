-- Registro de semanas del plan-objetivo aplicadas al plan activo, con los pasos anteriores para poder deshacerlas.
alter table public.perfil_entreno_cliente add column if not exists plan_objetivo_log jsonb not null default '[]'::jsonb;
comment on column public.perfil_entreno_cliente.plan_objetivo_log is
  'Array (máx. 5) de {id, at, semana, cambios:[{sesionId, nombre, anteriores}]}. Lo escribe "aplicar semana" y lo consume "deshacer".';
