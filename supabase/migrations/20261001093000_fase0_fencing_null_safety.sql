-- Un token NULL nunca autoriza una mutación fenceada. Además, la acción
-- referencial ON DELETE SET NULL debe desvincular también la lease del plan.

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
  -- Las FKs de planes usan ON DELETE SET NULL. Al borrar una generación,
  -- PostgreSQL actualiza generacion_inicial_id; el trigger mantiene ambos
  -- campos acoplados antes de que se valide el CHECK.
  if new.generacion_inicial_id is null then
    if tg_op = 'UPDATE' and old.generacion_inicial_id is not null then
      new.generacion_intento_token := null;
    end if;
    return new;
  end if;

  if new.generacion_intento_token is null then
    raise exception using
      errcode = 'P0001',
      message = 'La generación y la lease del intento deben informarse juntas';
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
    or v_intento_token is distinct from new.generacion_intento_token
  then
    raise exception using
      errcode = 'P0001',
      message = 'La lease del intento de generación ya no está vigente';
  end if;

  return new;
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
  if p_intento_token is null then
    raise exception using
      errcode = 'P0001',
      message = 'La lease del intento de generación es obligatoria';
  end if;

  select g.estado, g.intento_token
  into v_estado, v_intento_vigente
  from public.generaciones_plan_inicial g
  where g.id = p_generacion_id
  for update;

  if not found
    or v_estado <> 'procesando'
    or v_intento_vigente is distinct from p_intento_token
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
  if p_intento_token is null then
    raise exception using
      errcode = 'P0001',
      message = 'La lease del intento de generación es obligatoria';
  end if;

  select g.estado, g.intento_token
  into v_estado, v_intento_vigente
  from public.generaciones_plan_inicial g
  where g.id = p_generacion_id
  for update;

  if not found
    or v_estado <> 'procesando'
    or v_intento_vigente is distinct from p_intento_token
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
    and intento_token is not distinct from p_intento_token;
end;
$$;

create or replace function public.activar_planes_generacion(
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
  if p_intento_token is null then
    raise exception using
      errcode = 'P0001',
      message = 'La lease del intento de generación es obligatoria';
  end if;

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
    or v_intento_vigente is distinct from p_intento_token
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
    and intento_token is not distinct from p_intento_token;
end;
$$;
