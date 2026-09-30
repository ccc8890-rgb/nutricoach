-- Aprobación atómica de cliente.
-- Rollback forward-only: DROP FUNCTION public.aprobar_cliente_atomico(uuid, uuid);

create or replace function public.aprobar_cliente_atomico(
  p_cliente_id uuid,
  p_actor_id uuid
)
returns table (
  ok boolean,
  codigo text,
  mensaje text,
  accion text,
  cliente_profile_id uuid
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_coach_id uuid;
  v_profile_id uuid;
  v_plan_nutricion_id uuid;
  v_plan_entrenamiento_id uuid;
begin
  select c.coach_id, c.profile_id
  into v_coach_id, v_profile_id
  from public.clientes c
  where c.id = p_cliente_id
  for update;

  if not found then
    return query select
      false,
      'CLIENT_NOT_FOUND'::text,
      'Cliente no encontrado.'::text,
      'Comprueba que el cliente sigue existiendo.'::text,
      null::uuid;
    return;
  end if;

  if p_actor_id is null or v_coach_id is distinct from p_actor_id then
    return query select
      false,
      'CLIENT_NOT_OWNED'::text,
      'No tienes permiso para gestionar este cliente.'::text,
      'Selecciona un cliente de tu cartera.'::text,
      null::uuid;
    return;
  end if;

  select p.id
  into v_plan_nutricion_id
  from public.planes_nutricion p
  where p.cliente_id = p_cliente_id
    and p.activo
  limit 1
  for update;

  select p.id
  into v_plan_entrenamiento_id
  from public.planes_entrenamiento p
  where p.cliente_id = p_cliente_id
    and p.activo
  limit 1
  for update;

  if v_plan_nutricion_id is null or v_plan_entrenamiento_id is null then
    return query select
      false,
      'ACTIVE_PLANS_REQUIRED'::text,
      'El cliente necesita un plan activo de nutrición y otro de entrenamiento.'::text,
      'Activa ambos planes antes de aprobar al cliente.'::text,
      v_profile_id;
    return;
  end if;

  update public.clientes c
  set
    revisado_por_coach = true,
    activo = true
  where c.id = p_cliente_id
    and c.coach_id = p_actor_id;

  if not found then
    raise exception using
      errcode = 'P0001',
      message = 'El cliente cambió de propietario durante la aprobación';
  end if;

  return query select
    true,
    'CLIENT_APPROVED'::text,
    'Cliente aprobado y activado.'::text,
    null::text,
    v_profile_id;
end;
$$;

revoke all on function public.aprobar_cliente_atomico(uuid, uuid)
  from public, anon, authenticated;
grant execute on function public.aprobar_cliente_atomico(uuid, uuid)
  to service_role;
