alter table public.generaciones_plan_inicial
  add column if not exists intento_token uuid;

update public.generaciones_plan_inicial
set intento_token = gen_random_uuid()
where intento_token is null;

alter table public.generaciones_plan_inicial
  alter column intento_token set default gen_random_uuid(),
  alter column intento_token set not null;

alter table public.planes_nutricion
  add column if not exists generacion_intento_token uuid;

alter table public.planes_entrenamiento
  add column if not exists generacion_intento_token uuid;

update public.planes_nutricion p
set generacion_intento_token = g.intento_token
from public.generaciones_plan_inicial g
where p.generacion_inicial_id = g.id
  and p.generacion_intento_token is null;

update public.planes_entrenamiento p
set generacion_intento_token = g.intento_token
from public.generaciones_plan_inicial g
where p.generacion_inicial_id = g.id
  and p.generacion_intento_token is null;

alter table public.planes_nutricion
  add constraint planes_nutricion_generacion_intento_pareado
  check ((generacion_inicial_id is null) = (generacion_intento_token is null))
  not valid;

alter table public.planes_nutricion
  validate constraint planes_nutricion_generacion_intento_pareado;

alter table public.planes_entrenamiento
  add constraint planes_entrenamiento_generacion_intento_pareado
  check ((generacion_inicial_id is null) = (generacion_intento_token is null))
  not valid;

alter table public.planes_entrenamiento
  validate constraint planes_entrenamiento_generacion_intento_pareado;

drop index if exists public.uq_plan_nutricion_generacion;
drop index if exists public.uq_plan_entrenamiento_generacion;

create unique index uq_plan_nutricion_generacion_intento
  on public.planes_nutricion(generacion_inicial_id, generacion_intento_token)
  where generacion_inicial_id is not null;

create unique index uq_plan_entrenamiento_generacion_intento
  on public.planes_entrenamiento(generacion_inicial_id, generacion_intento_token)
  where generacion_inicial_id is not null;

create or replace function public.validar_intento_plan_generacion()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_estado text;
  v_intento_token uuid;
  v_validar boolean;
begin
  if (new.generacion_inicial_id is null) <> (new.generacion_intento_token is null) then
    raise exception using
      errcode = 'P0001',
      message = 'La generación y la lease del intento deben informarse juntas';
  end if;

  if new.generacion_inicial_id is null then
    return new;
  end if;

  if tg_op = 'INSERT' then
    v_validar := true;
  else
    v_validar := new.generacion_inicial_id is distinct from old.generacion_inicial_id
      or new.generacion_intento_token is distinct from old.generacion_intento_token
      or (new.activo and not old.activo);
  end if;

  if not v_validar then
    return new;
  end if;

  select g.estado, g.intento_token
  into v_estado, v_intento_token
  from public.generaciones_plan_inicial g
  where g.id = new.generacion_inicial_id
  for share;

  if not found
    or v_estado <> 'procesando'
    or v_intento_token <> new.generacion_intento_token
  then
    raise exception using
      errcode = 'P0001',
      message = 'La lease del intento de generación ya no está vigente';
  end if;

  return new;
end;
$$;

drop trigger if exists validar_intento_plan_nutricion
  on public.planes_nutricion;
create trigger validar_intento_plan_nutricion
before insert or update of generacion_inicial_id, generacion_intento_token, activo
on public.planes_nutricion
for each row execute function public.validar_intento_plan_generacion();

drop trigger if exists validar_intento_plan_entrenamiento
  on public.planes_entrenamiento;
create trigger validar_intento_plan_entrenamiento
before insert or update of generacion_inicial_id, generacion_intento_token, activo
on public.planes_entrenamiento
for each row execute function public.validar_intento_plan_generacion();

drop function if exists public.claim_generacion_plan_inicial(uuid, text, uuid);

create function public.claim_generacion_plan_inicial(
  p_cliente_id uuid,
  p_clave text,
  p_actor_id uuid
)
returns table (
  generacion_id uuid,
  intento_token uuid,
  accion text,
  estado text,
  plan_nutricion_id uuid,
  plan_entrenamiento_id uuid,
  error_codigo text,
  error_mensaje text
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_generacion public.generaciones_plan_inicial%rowtype;
  v_es_nueva boolean;
  v_accion text;
begin
  insert into public.generaciones_plan_inicial (
    cliente_id,
    clave_idempotencia,
    solicitada_por
  )
  values (
    p_cliente_id,
    p_clave,
    p_actor_id
  )
  on conflict (cliente_id, clave_idempotencia) do nothing
  returning * into v_generacion;

  v_es_nueva := found;

  select g.*
  into strict v_generacion
  from public.generaciones_plan_inicial g
  where g.cliente_id = p_cliente_id
    and g.clave_idempotencia = p_clave
  for update;

  if v_es_nueva then
    v_accion := 'generar';
  elsif v_generacion.estado = 'completada' then
    v_accion := 'reutilizar';
  elsif v_generacion.estado = 'fallida'
    or (
      v_generacion.estado = 'procesando'
      and v_generacion.updated_at < now() - interval '5 minutes'
    )
  then
    update public.generaciones_plan_inicial g
    set
      estado = 'procesando',
      intentos = g.intentos + 1,
      intento_token = gen_random_uuid(),
      error_codigo = null,
      error_mensaje = null,
      completed_at = null,
      updated_at = now()
    where g.id = v_generacion.id
    returning g.* into v_generacion;

    v_accion := 'generar';
  else
    v_accion := 'esperar';
  end if;

  return query
  select
    v_generacion.id,
    case when v_accion = 'generar' then v_generacion.intento_token else null end,
    v_accion,
    v_generacion.estado,
    v_generacion.plan_nutricion_id,
    v_generacion.plan_entrenamiento_id,
    v_generacion.error_codigo,
    v_generacion.error_mensaje;
end;
$$;

create or replace function public.limpiar_borradores_generacion(
  p_generacion_id uuid,
  p_intento_token uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_estado text;
  v_intento_vigente uuid;
begin
  select g.estado, g.intento_token
  into v_estado, v_intento_vigente
  from public.generaciones_plan_inicial g
  where g.id = p_generacion_id
  for update;

  if not found
    or v_estado <> 'procesando'
    or v_intento_vigente <> p_intento_token
  then
    raise exception using
      errcode = 'P0001',
      message = 'La lease del intento de generación ya no está vigente';
  end if;

  delete from public.planes_nutricion
  where generacion_inicial_id = p_generacion_id
    and generacion_intento_token is distinct from p_intento_token
    and activo is false;

  delete from public.planes_entrenamiento
  where generacion_inicial_id = p_generacion_id
    and generacion_intento_token is distinct from p_intento_token
    and activo is false;
end;
$$;

create or replace function public.marcar_generacion_inicial_fallida(
  p_generacion_id uuid,
  p_intento_token uuid,
  p_error_codigo text,
  p_error_mensaje text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_estado text;
  v_intento_vigente uuid;
begin
  select g.estado, g.intento_token
  into v_estado, v_intento_vigente
  from public.generaciones_plan_inicial g
  where g.id = p_generacion_id
  for update;

  if not found
    or v_estado <> 'procesando'
    or v_intento_vigente <> p_intento_token
  then
    raise exception using
      errcode = 'P0001',
      message = 'La lease del intento de generación ya no está vigente';
  end if;

  delete from public.planes_nutricion
  where generacion_inicial_id = p_generacion_id
    and generacion_intento_token = p_intento_token
    and activo is false;

  delete from public.planes_entrenamiento
  where generacion_inicial_id = p_generacion_id
    and generacion_intento_token = p_intento_token
    and activo is false;

  update public.generaciones_plan_inicial
  set
    estado = 'fallida',
    error_codigo = left(p_error_codigo, 100),
    error_mensaje = left(p_error_mensaje, 500),
    completed_at = null,
    updated_at = now()
  where id = p_generacion_id
    and intento_token = p_intento_token;
end;
$$;

drop function if exists public.activar_planes_generacion(uuid, uuid, uuid);

create function public.activar_planes_generacion(
  p_generacion_id uuid,
  p_intento_token uuid,
  p_plan_nutricion_id uuid,
  p_plan_entrenamiento_id uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_cliente_id uuid;
  v_estado_generacion text;
  v_intento_vigente uuid;
  v_nutricion_valida boolean;
  v_entrenamiento_valido boolean;
begin
  select g.cliente_id, g.estado, g.intento_token
  into v_cliente_id, v_estado_generacion, v_intento_vigente
  from public.generaciones_plan_inicial g
  where g.id = p_generacion_id
  for update;

  if not found then
    raise exception using
      errcode = 'P0001',
      message = 'No existe la generación inicial indicada';
  end if;

  if v_estado_generacion <> 'procesando'
    or v_intento_vigente <> p_intento_token
  then
    raise exception using
      errcode = 'P0001',
      message = 'La lease del intento de generación ya no está vigente';
  end if;

  perform 1
  from public.planes_nutricion p
  where p.id = p_plan_nutricion_id
    and p.cliente_id = v_cliente_id
    and p.generacion_inicial_id = p_generacion_id
    and p.generacion_intento_token = p_intento_token
    and p.activo is false
  for update;
  v_nutricion_valida := found;

  perform 1
  from public.planes_entrenamiento p
  where p.id = p_plan_entrenamiento_id
    and p.cliente_id = v_cliente_id
    and p.generacion_inicial_id = p_generacion_id
    and p.generacion_intento_token = p_intento_token
    and p.activo is false
  for update;
  v_entrenamiento_valido := found;

  if not v_nutricion_valida or not v_entrenamiento_valido then
    raise exception using
      errcode = 'P0001',
      message = 'Falta un borrador inactivo vinculado al intento vigente';
  end if;

  update public.planes_nutricion
  set activo = false
  where cliente_id = v_cliente_id
    and activo
    and id <> p_plan_nutricion_id;

  update public.planes_entrenamiento
  set activo = false
  where cliente_id = v_cliente_id
    and activo
    and id <> p_plan_entrenamiento_id;

  update public.planes_nutricion
  set activo = true
  where id = p_plan_nutricion_id;

  update public.planes_entrenamiento
  set activo = true
  where id = p_plan_entrenamiento_id;

  delete from public.planes_nutricion
  where generacion_inicial_id = p_generacion_id
    and generacion_intento_token is distinct from p_intento_token
    and activo is false;

  delete from public.planes_entrenamiento
  where generacion_inicial_id = p_generacion_id
    and generacion_intento_token is distinct from p_intento_token
    and activo is false;

  update public.generaciones_plan_inicial
  set
    estado = 'completada',
    plan_nutricion_id = p_plan_nutricion_id,
    plan_entrenamiento_id = p_plan_entrenamiento_id,
    error_codigo = null,
    error_mensaje = null,
    completed_at = now(),
    updated_at = now()
  where id = p_generacion_id
    and intento_token = p_intento_token;
end;
$$;

revoke all on function public.validar_intento_plan_generacion()
  from public, anon, authenticated, service_role;
revoke all on function public.claim_generacion_plan_inicial(uuid, text, uuid)
  from public, anon, authenticated;
revoke all on function public.limpiar_borradores_generacion(uuid, uuid)
  from public, anon, authenticated;
revoke all on function public.marcar_generacion_inicial_fallida(uuid, uuid, text, text)
  from public, anon, authenticated;
revoke all on function public.activar_planes_generacion(uuid, uuid, uuid, uuid)
  from public, anon, authenticated;

grant execute on function public.claim_generacion_plan_inicial(uuid, text, uuid)
  to service_role;
grant execute on function public.limpiar_borradores_generacion(uuid, uuid)
  to service_role;
grant execute on function public.marcar_generacion_inicial_fallida(uuid, uuid, text, text)
  to service_role;
grant execute on function public.activar_planes_generacion(uuid, uuid, uuid, uuid)
  to service_role;
