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
    and cliente_id is not null
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
    and cliente_id is not null
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
  v_estado_generacion text;
  v_nutricion_valida boolean;
  v_entrenamiento_valido boolean;
begin
  select g.cliente_id, g.estado
  into v_cliente_id, v_estado_generacion
  from public.generaciones_plan_inicial g
  where g.id = p_generacion_id
  for update;

  if not found then
    raise exception using
      errcode = 'P0001',
      message = 'No existe la generación inicial indicada';
  end if;

  if v_estado_generacion <> 'procesando' then
    raise exception using
      errcode = 'P0001',
      message = 'La generación inicial no está en estado procesando';
  end if;

  perform 1
  from public.planes_nutricion p
  where p.id = p_plan_nutricion_id
    and p.cliente_id = v_cliente_id
    and p.generacion_inicial_id = p_generacion_id
    and p.activo is false
  for update;
  v_nutricion_valida := found;

  perform 1
  from public.planes_entrenamiento p
  where p.id = p_plan_entrenamiento_id
    and p.cliente_id = v_cliente_id
    and p.generacion_inicial_id = p_generacion_id
    and p.activo is false
  for update;
  v_entrenamiento_valido := found;

  if not v_nutricion_valida or not v_entrenamiento_valido then
    raise exception using
      errcode = 'P0001',
      message = 'Falta un borrador inactivo vinculado a la generación inicial';
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

create or replace function public.aplicar_ajuste_macros_seguro(
  p_tarea_id uuid,
  p_cliente_id uuid,
  p_campos jsonb
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_estado text;
  v_plan_id uuid;
  v_row_count integer;
begin
  select t.estado
  into v_estado
  from public.agente_tareas t
  where t.id = p_tarea_id
    and t.cliente_id = p_cliente_id
  for update;

  if not found then
    raise exception using
      errcode = 'P0001',
      message = 'La tarea no pertenece al cliente indicado';
  end if;

  if v_estado not in ('aprobado', 'modificado') then
    raise exception using
      errcode = 'P0001',
      message = 'La tarea no está aprobada ni modificada';
  end if;

  if p_campos is null
    or jsonb_typeof(p_campos) <> 'object'
    or p_campos = '{}'::jsonb
  then
    raise exception using
      errcode = 'P0001',
      message = 'La aplicación no contiene cambios de macros';
  end if;

  if exists (
    select 1
    from jsonb_object_keys(p_campos) key
    where key not in (
      'kcal_objetivo',
      'proteinas_objetivo',
      'carbohidratos_objetivo',
      'grasas_objetivo'
    )
      or jsonb_typeof(p_campos -> key) <> 'number'
      or p_campos ->> key in ('NaN', 'Infinity', '-Infinity')
  ) then
    raise exception using
      errcode = 'P0001',
      message = 'La aplicación contiene claves de macros no permitidas';
  end if;

  if (p_campos ? 'kcal_objetivo' and (
      (p_campos ->> 'kcal_objetivo')::numeric < 500
      or (p_campos ->> 'kcal_objetivo')::numeric > 10000
    ))
    or (p_campos ? 'proteinas_objetivo' and (
      (p_campos ->> 'proteinas_objetivo')::numeric < 0
      or (p_campos ->> 'proteinas_objetivo')::numeric > 1000
    ))
    or (p_campos ? 'carbohidratos_objetivo' and (
      (p_campos ->> 'carbohidratos_objetivo')::numeric < 0
      or (p_campos ->> 'carbohidratos_objetivo')::numeric > 2000
    ))
    or (p_campos ? 'grasas_objetivo' and (
      (p_campos ->> 'grasas_objetivo')::numeric < 0
      or (p_campos ->> 'grasas_objetivo')::numeric > 1000
    ))
  then
    raise exception using
      errcode = 'P0001',
      message = 'La aplicación contiene macros fuera de rango';
  end if;

  select p.id
  into v_plan_id
  from public.planes_nutricion p
  where p.cliente_id = p_cliente_id
    and p.activo
  for update;

  if not found then
    raise exception using
      errcode = 'P0001',
      message = 'No existe un plan de nutrición activo para el cliente';
  end if;

  update public.planes_nutricion
  set
    kcal_objetivo = coalesce((p_campos->>'kcal_objetivo')::numeric, kcal_objetivo),
    proteinas_objetivo = coalesce((p_campos->>'proteinas_objetivo')::numeric, proteinas_objetivo),
    carbohidratos_objetivo = coalesce((p_campos->>'carbohidratos_objetivo')::numeric, carbohidratos_objetivo),
    grasas_objetivo = coalesce((p_campos->>'grasas_objetivo')::numeric, grasas_objetivo)
  where id = v_plan_id;

  get diagnostics v_row_count = row_count;
  if v_row_count <> 1 then
    raise exception using
      errcode = 'P0001',
      message = 'No se ha actualizado el plan de nutrición activo';
  end if;

  update public.agente_tareas
  set
    estado = 'aplicado',
    aplicado_at = now(),
    error_aplicacion = null
  where id = p_tarea_id;

  get diagnostics v_row_count = row_count;
  if v_row_count <> 1 then
    raise exception using
      errcode = 'P0001',
      message = 'No se ha podido marcar la tarea de macros como aplicada';
  end if;
end;
$$;

create or replace function public.aplicar_actualizacion_entreno_segura(
  p_tarea_id uuid,
  p_cliente_id uuid,
  p_plan_id uuid,
  p_campos_plan jsonb,
  p_sesiones jsonb,
  p_ejercicios jsonb,
  p_mensaje text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_estado text;
  v_row_count integer;
  v_expected_sesiones integer;
  v_expected_ejercicios integer;
  v_sesion_id uuid;
  v_ejercicio_id uuid;
begin
  select t.estado
  into v_estado
  from public.agente_tareas t
  where t.id = p_tarea_id
    and t.cliente_id = p_cliente_id
  for update;

  if not found then
    raise exception using
      errcode = 'P0001',
      message = 'La tarea no pertenece al cliente indicado';
  end if;

  if v_estado not in ('aprobado', 'modificado') then
    raise exception using
      errcode = 'P0001',
      message = 'La tarea no está aprobada ni modificada';
  end if;

  perform 1
  from public.planes_entrenamiento p
  where p.id = p_plan_id
    and p.cliente_id = p_cliente_id
    and p.activo
  for update;

  if not found then
    raise exception using
      errcode = 'P0001',
      message = 'No existe el plan de entrenamiento activo indicado';
  end if;

  if coalesce(jsonb_typeof(p_campos_plan), 'object') <> 'object'
    or coalesce(jsonb_typeof(p_sesiones), 'array') <> 'array'
    or coalesce(jsonb_typeof(p_ejercicios), 'array') <> 'array'
  then
    raise exception using
      errcode = 'P0001',
      message = 'El formato de la actualización de entrenamiento no es válido';
  end if;

  if coalesce(p_campos_plan, '{}'::jsonb) = '{}'::jsonb
    and coalesce(p_sesiones, '[]'::jsonb) = '[]'::jsonb
    and coalesce(p_ejercicios, '[]'::jsonb) = '[]'::jsonb
    and nullif(btrim(p_mensaje), '') is null
  then
    raise exception using
      errcode = 'P0001',
      message = 'La aplicación no contiene cambios';
  end if;

  if exists (
    select 1
    from jsonb_object_keys(coalesce(p_campos_plan, '{}'::jsonb)) key
    where key not in ('descripcion_append', 'duracion_semanas')
  ) then
    raise exception using
      errcode = 'P0001',
      message = 'La actualización del plan contiene campos no permitidos';
  end if;

  if (coalesce(p_campos_plan, '{}'::jsonb) ? 'descripcion_append'
      and (
        jsonb_typeof(p_campos_plan -> 'descripcion_append') <> 'string'
        or nullif(btrim(p_campos_plan ->> 'descripcion_append'), '') is null
        or char_length(p_campos_plan ->> 'descripcion_append') > 2000
      ))
    or (coalesce(p_campos_plan, '{}'::jsonb) ? 'duracion_semanas'
      and (
        jsonb_typeof(p_campos_plan -> 'duracion_semanas') <> 'number'
        or case
          when char_length(p_campos_plan ->> 'duracion_semanas') <= 3
            and (p_campos_plan ->> 'duracion_semanas') ~ '^[0-9]+$'
            then (p_campos_plan ->> 'duracion_semanas')::integer not between 1 and 104
          else true
        end
      ))
  then
    raise exception using
      errcode = 'P0001',
      message = 'Los campos del plan no tienen tipo o rango válidos';
  end if;

  if exists (
    select 1
    from jsonb_array_elements(coalesce(p_sesiones, '[]'::jsonb)) item
    where jsonb_typeof(item) <> 'object'
      or nullif(item ->> 'id', '') is null
      or not ((item ->> 'id') ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$')
      or jsonb_typeof(item -> 'campos') <> 'object'
      or item -> 'campos' = '{}'::jsonb
      or exists (
        select 1
        from jsonb_object_keys(item -> 'campos') key
        where key not in ('notas_append', 'duracion_estimada_min', 'contexto_ia_append')
      )
      or (item -> 'campos' ? 'duracion_estimada_min'
        and (
          jsonb_typeof(item -> 'campos' -> 'duracion_estimada_min') <> 'number'
          or case
            when char_length(item -> 'campos' ->> 'duracion_estimada_min') <= 3
              and (item -> 'campos' ->> 'duracion_estimada_min') ~ '^[0-9]+$'
              then (item -> 'campos' ->> 'duracion_estimada_min')::integer not between 10 and 180
            else true
          end
        ))
      or (item -> 'campos' ? 'notas_append'
        and (
          jsonb_typeof(item -> 'campos' -> 'notas_append') <> 'string'
          or nullif(btrim(item -> 'campos' ->> 'notas_append'), '') is null
          or char_length(item -> 'campos' ->> 'notas_append') > 2000
        ))
      or (item -> 'campos' ? 'contexto_ia_append'
        and (
          jsonb_typeof(item -> 'campos' -> 'contexto_ia_append') <> 'string'
          or nullif(btrim(item -> 'campos' ->> 'contexto_ia_append'), '') is null
          or char_length(item -> 'campos' ->> 'contexto_ia_append') > 2000
        ))
  ) then
    raise exception using
      errcode = 'P0001',
      message = 'El formato de las sesiones de entrenamiento no es válido';
  end if;

  if exists (
    select 1
    from jsonb_array_elements(coalesce(p_ejercicios, '[]'::jsonb)) item
    where jsonb_typeof(item) <> 'object'
      or nullif(item ->> 'id', '') is null
      or not ((item ->> 'id') ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$')
      or jsonb_typeof(item -> 'campos') <> 'object'
      or item -> 'campos' = '{}'::jsonb
      or exists (
        select 1
        from jsonb_object_keys(item -> 'campos') key
        where key not in (
          'series', 'repeticiones', 'descanso_segundos', 'peso_sugerido',
          'rpe', 'notas_append', 'instruccion_ejercicio_append'
        )
      )
      or (item -> 'campos' ? 'series'
        and (
          jsonb_typeof(item -> 'campos' -> 'series') <> 'number'
          or case
            when char_length(item -> 'campos' ->> 'series') <= 2
              and (item -> 'campos' ->> 'series') ~ '^[0-9]+$'
              then (item -> 'campos' ->> 'series')::integer not between 1 and 12
            else true
          end
        ))
      or (item -> 'campos' ? 'descanso_segundos'
        and (
          jsonb_typeof(item -> 'campos' -> 'descanso_segundos') <> 'number'
          or case
            when char_length(item -> 'campos' ->> 'descanso_segundos') <= 3
              and (item -> 'campos' ->> 'descanso_segundos') ~ '^[0-9]+$'
              then (item -> 'campos' ->> 'descanso_segundos')::integer not between 15 and 600
            else true
          end
        ))
      or exists (
        select 1
        from unnest(array[
          'repeticiones', 'peso_sugerido', 'rpe',
          'notas_append', 'instruccion_ejercicio_append'
        ]) key
        where item -> 'campos' ? key
          and (
            jsonb_typeof(item -> 'campos' -> key) <> 'string'
            or nullif(btrim(item -> 'campos' ->> key), '') is null
            or char_length(item -> 'campos' ->> key) > case key
              when 'repeticiones' then 40
              when 'peso_sugerido' then 60
              when 'rpe' then 12
              else 2000
            end
          )
      )
  ) then
    raise exception using
      errcode = 'P0001',
      message = 'El formato de los ejercicios de entrenamiento no es válido';
  end if;

  if exists (
    select 1
    from (
      select value ->> 'id' as id, count(*) as n
      from jsonb_array_elements(coalesce(p_sesiones, '[]'::jsonb)) value
      group by value ->> 'id'
    ) duplicados
    where duplicados.n > 1
  ) or exists (
    select 1
    from (
      select value ->> 'id' as id, count(*) as n
      from jsonb_array_elements(coalesce(p_ejercicios, '[]'::jsonb)) value
      group by value ->> 'id'
    ) duplicados
    where duplicados.n > 1
  ) then
    raise exception using
      errcode = 'P0001',
      message = 'La actualización contiene targets duplicados';
  end if;

  if exists (
    select 1
    from jsonb_array_elements(coalesce(p_sesiones, '[]'::jsonb)) item
    where nullif(item->>'id', '') is null
      or not exists (
        select 1
        from public.sesiones_entrenamiento s
        where s.id = (item->>'id')::uuid
          and s.plan_id = p_plan_id
      )
  ) then
    raise exception using
      errcode = 'P0001',
      message = 'Una sesión no pertenece al plan de entrenamiento activo';
  end if;

  if exists (
    select 1
    from jsonb_array_elements(coalesce(p_ejercicios, '[]'::jsonb)) item
    where nullif(item->>'id', '') is null
      or not exists (
        select 1
        from public.sesion_ejercicios se
        join public.sesiones_entrenamiento s on s.id = se.sesion_id
        where se.id = (item->>'id')::uuid
          and s.plan_id = p_plan_id
      )
  ) then
    raise exception using
      errcode = 'P0001',
      message = 'Un ejercicio no pertenece a las sesiones del plan activo';
  end if;

  for v_sesion_id in
    select (value ->> 'id')::uuid
    from jsonb_array_elements(coalesce(p_sesiones, '[]'::jsonb)) value
  loop
    perform 1
    from public.sesiones_entrenamiento s
    where s.id = v_sesion_id
      and s.plan_id = p_plan_id
    for update;

    if not found then
      raise exception using
        errcode = 'P0001',
        message = 'Una sesión no pertenece al plan de entrenamiento activo';
    end if;
  end loop;

  for v_ejercicio_id in
    select (value ->> 'id')::uuid
    from jsonb_array_elements(coalesce(p_ejercicios, '[]'::jsonb)) value
  loop
    perform 1
    from public.sesion_ejercicios se
    join public.sesiones_entrenamiento s on s.id = se.sesion_id
    where se.id = v_ejercicio_id
      and s.plan_id = p_plan_id
    for update of se;

    if not found then
      raise exception using
        errcode = 'P0001',
        message = 'Un ejercicio no pertenece a las sesiones del plan activo';
    end if;
  end loop;

  select count(*) into v_expected_sesiones
  from jsonb_array_elements(coalesce(p_sesiones, '[]'::jsonb));

  select count(*) into v_expected_ejercicios
  from jsonb_array_elements(coalesce(p_ejercicios, '[]'::jsonb));

  if coalesce(p_campos_plan, '{}'::jsonb) <> '{}'::jsonb then
    update public.planes_entrenamiento
    set
      descripcion = case
        when p_campos_plan ? 'descripcion_append' then concat_ws(
          E'\n\n',
          nullif(btrim(descripcion), ''),
          p_campos_plan ->> 'descripcion_append'
        )
        else descripcion
      end,
      duracion_semanas = coalesce((p_campos_plan->>'duracion_semanas')::integer, duracion_semanas)
    where id = p_plan_id;

    get diagnostics v_row_count = row_count;
    if v_row_count <> 1 then
      raise exception using
        errcode = 'P0001',
        message = 'No se ha actualizado el plan de entrenamiento activo';
    end if;
  end if;

  if v_expected_sesiones > 0 then
    update public.sesiones_entrenamiento s
    set
      notas = case
        when item.campos ? 'notas_append' then concat_ws(
          E'\n\n',
          nullif(btrim(s.notas), ''),
          item.campos ->> 'notas_append'
        )
        else s.notas
      end,
      duracion_estimada_min = coalesce((item.campos->>'duracion_estimada_min')::integer, s.duracion_estimada_min),
      contexto_ia = case
        when item.campos ? 'contexto_ia_append' then concat_ws(
          E'\n\n',
          nullif(btrim(s.contexto_ia), ''),
          item.campos ->> 'contexto_ia_append'
        )
        else s.contexto_ia
      end
    from (
      select
        (value->>'id')::uuid as id,
        coalesce(value->'campos', '{}'::jsonb) as campos
      from jsonb_array_elements(coalesce(p_sesiones, '[]'::jsonb)) value
    ) item
    where s.id = item.id;

    get diagnostics v_row_count = row_count;
    if v_row_count <> v_expected_sesiones then
      raise exception using
        errcode = 'P0001',
        message = 'No se han actualizado todas las sesiones objetivo';
    end if;
  end if;

  if v_expected_ejercicios > 0 then
    update public.sesion_ejercicios se
    set
      series = coalesce((item.campos->>'series')::integer, se.series),
      repeticiones = coalesce(item.campos->>'repeticiones', se.repeticiones),
      descanso_segundos = coalesce((item.campos->>'descanso_segundos')::integer, se.descanso_segundos),
      peso_sugerido = coalesce(item.campos->>'peso_sugerido', se.peso_sugerido),
      rpe = coalesce(item.campos->>'rpe', se.rpe),
      notas = case
        when item.campos ? 'notas_append' then concat_ws(
          E'\n\n',
          nullif(btrim(se.notas), ''),
          item.campos ->> 'notas_append'
        )
        else se.notas
      end,
      instruccion_ejercicio = case
        when item.campos ? 'instruccion_ejercicio_append' then concat_ws(
          E'\n\n',
          nullif(btrim(se.instruccion_ejercicio), ''),
          item.campos ->> 'instruccion_ejercicio_append'
        )
        else se.instruccion_ejercicio
      end
    from (
      select
        (value->>'id')::uuid as id,
        coalesce(value->'campos', '{}'::jsonb) as campos
      from jsonb_array_elements(coalesce(p_ejercicios, '[]'::jsonb)) value
    ) item
    where se.id = item.id;

    get diagnostics v_row_count = row_count;
    if v_row_count <> v_expected_ejercicios then
      raise exception using
        errcode = 'P0001',
        message = 'No se han actualizado todos los ejercicios objetivo';
    end if;
  end if;

  if nullif(btrim(p_mensaje), '') is not null then
    insert into public.chat_mensajes (
      cliente_id,
      remitente,
      contenido,
      leido
    ) values (
      p_cliente_id,
      'coach',
      p_mensaje,
      false
    );
  end if;

  update public.agente_tareas
  set
    estado = 'aplicado',
    aplicado_at = now(),
    error_aplicacion = null
  where id = p_tarea_id;

  get diagnostics v_row_count = row_count;
  if v_row_count <> 1 then
    raise exception using
      errcode = 'P0001',
      message = 'No se ha podido marcar la tarea de entrenamiento como aplicada';
  end if;
end;
$$;

create or replace function public.aplicar_mensaje_cliente_seguro(
  p_tarea_id uuid,
  p_cliente_id uuid,
  p_mensaje text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_estado text;
  v_row_count integer;
begin
  select t.estado
  into v_estado
  from public.agente_tareas t
  where t.id = p_tarea_id
    and t.cliente_id = p_cliente_id
  for update;

  if not found then
    raise exception using
      errcode = 'P0001',
      message = 'La tarea no pertenece al cliente indicado';
  end if;

  if v_estado not in ('aprobado', 'modificado') then
    raise exception using
      errcode = 'P0001',
      message = 'La tarea no está aprobada ni modificada';
  end if;

  if nullif(btrim(p_mensaje), '') is null then
    raise exception using
      errcode = 'P0001',
      message = 'No hay mensaje para enviar al cliente';
  end if;

  insert into public.chat_mensajes (cliente_id, remitente, contenido, leido)
  values (p_cliente_id, 'coach', p_mensaje, false);

  update public.agente_tareas
  set
    estado = 'aplicado',
    aplicado_at = now(),
    error_aplicacion = null
  where id = p_tarea_id;

  get diagnostics v_row_count = row_count;
  if v_row_count <> 1 then
    raise exception using
      errcode = 'P0001',
      message = 'No se ha podido marcar la tarea de mensaje como aplicada';
  end if;
end;
$$;

revoke all on function public.aplicar_ajuste_macros_seguro(uuid, uuid, jsonb)
  from public, anon, authenticated;
revoke all on function public.aplicar_actualizacion_entreno_segura(uuid, uuid, uuid, jsonb, jsonb, jsonb, text)
  from public, anon, authenticated;
revoke all on function public.aplicar_mensaje_cliente_seguro(uuid, uuid, text)
  from public, anon, authenticated;

grant execute on function public.aplicar_ajuste_macros_seguro(uuid, uuid, jsonb)
  to service_role;
grant execute on function public.aplicar_actualizacion_entreno_segura(uuid, uuid, uuid, jsonb, jsonb, jsonb, text)
  to service_role;
grant execute on function public.aplicar_mensaje_cliente_seguro(uuid, uuid, text)
  to service_role;
