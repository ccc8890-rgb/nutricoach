create table public.generaciones_plan_inicial (
  id uuid primary key default gen_random_uuid(),
  cliente_id uuid not null references public.clientes(id) on delete cascade,
  clave_idempotencia text not null,
  solicitada_por uuid not null references auth.users(id),
  estado text not null default 'procesando'
    check (estado in ('procesando', 'completada', 'fallida')),
  intentos integer not null default 1 check (intentos > 0),
  plan_nutricion_id uuid references public.planes_nutricion(id) on delete set null,
  plan_entrenamiento_id uuid references public.planes_entrenamiento(id) on delete set null,
  error_codigo text,
  error_mensaje text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  completed_at timestamptz,
  unique (cliente_id, clave_idempotencia)
);

alter table public.generaciones_plan_inicial enable row level security;
revoke all on public.generaciones_plan_inicial from anon, authenticated;
grant select, insert, update, delete on public.generaciones_plan_inicial to service_role;

alter table public.planes_nutricion
  add column if not exists generacion_inicial_id uuid
    references public.generaciones_plan_inicial(id) on delete set null;

alter table public.planes_entrenamiento
  add column if not exists generacion_inicial_id uuid
    references public.generaciones_plan_inicial(id) on delete set null;

alter table public.agente_tareas
  add column if not exists revisado_por uuid references auth.users(id),
  add column if not exists error_aplicacion text,
  add column if not exists aplicacion_intentos integer not null default 0;

with ranked as (
  select
    id,
    row_number() over (
      partition by cliente_id
      order by created_at desc, id desc
    ) as rn
  from public.planes_nutricion
  where activo
)
update public.planes_nutricion p
set activo = false
from ranked r
where p.id = r.id
  and r.rn > 1;

with ranked as (
  select
    id,
    row_number() over (
      partition by cliente_id
      order by created_at desc, id desc
    ) as rn
  from public.planes_entrenamiento
  where activo
)
update public.planes_entrenamiento p
set activo = false
from ranked r
where p.id = r.id
  and r.rn > 1;

create unique index uq_plan_nutricion_activo_cliente
  on public.planes_nutricion(cliente_id)
  where activo;

create unique index uq_plan_entrenamiento_activo_cliente
  on public.planes_entrenamiento(cliente_id)
  where activo;

create unique index uq_plan_nutricion_generacion
  on public.planes_nutricion(generacion_inicial_id)
  where generacion_inicial_id is not null;

create unique index uq_plan_entrenamiento_generacion
  on public.planes_entrenamiento(generacion_inicial_id)
  where generacion_inicial_id is not null;

create or replace function public.claim_generacion_plan_inicial(
  p_cliente_id uuid,
  p_clave text,
  p_actor_id uuid
)
returns table (
  generacion_id uuid,
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
    v_accion,
    v_generacion.estado,
    v_generacion.plan_nutricion_id,
    v_generacion.plan_entrenamiento_id,
    v_generacion.error_codigo,
    v_generacion.error_mensaje;
end;
$$;

create or replace function public.activar_planes_generacion(
  p_generacion_id uuid,
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
  v_nutricion_valida boolean;
  v_entrenamiento_valido boolean;
begin
  select g.cliente_id
  into v_cliente_id
  from public.generaciones_plan_inicial g
  where g.id = p_generacion_id
  for update;

  if not found then
    raise exception using
      errcode = 'P0001',
      message = 'No existe la generación inicial indicada';
  end if;

  perform 1
  from public.planes_nutricion p
  where p.id = p_plan_nutricion_id
    and p.cliente_id = v_cliente_id
    and p.generacion_inicial_id = p_generacion_id
  for update;
  v_nutricion_valida := found;

  perform 1
  from public.planes_entrenamiento p
  where p.id = p_plan_entrenamiento_id
    and p.cliente_id = v_cliente_id
    and p.generacion_inicial_id = p_generacion_id
  for update;
  v_entrenamiento_valido := found;

  if not v_nutricion_valida or not v_entrenamiento_valido then
    raise exception using
      errcode = 'P0001',
      message = 'Falta uno de los borradores vinculados a la generación inicial';
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

  update public.generaciones_plan_inicial
  set
    estado = 'completada',
    plan_nutricion_id = p_plan_nutricion_id,
    plan_entrenamiento_id = p_plan_entrenamiento_id,
    error_codigo = null,
    error_mensaje = null,
    completed_at = now(),
    updated_at = now()
  where id = p_generacion_id;
end;
$$;

revoke all on function public.claim_generacion_plan_inicial(uuid, text, uuid)
  from public, anon, authenticated;
revoke all on function public.activar_planes_generacion(uuid, uuid, uuid)
  from public, anon, authenticated;

grant execute on function public.claim_generacion_plan_inicial(uuid, text, uuid)
  to service_role;
grant execute on function public.activar_planes_generacion(uuid, uuid, uuid)
  to service_role;
