begin;

create temporary table fase0_aplicacion_ids (
  coach_id uuid not null,
  cliente_profile_id uuid not null,
  cliente_id uuid not null,
  plan_nutricion_id uuid not null,
  plan_entrenamiento_id uuid not null,
  plan_entrenamiento_ajeno_id uuid not null,
  sesion_id uuid not null,
  sesion_ajena_id uuid not null,
  ejercicio_catalogo_id uuid not null,
  ejercicio_sesion_id uuid not null,
  ejercicio_ajeno_sesion_id uuid not null,
  tarea_macros_id uuid not null,
  tarea_pendiente_id uuid not null,
  tarea_entreno_id uuid not null,
  tarea_chat_error_id uuid not null,
  tarea_concurrente_a_id uuid not null,
  tarea_concurrente_b_id uuid not null
) on commit drop;

insert into fase0_aplicacion_ids
select
  gen_random_uuid(), gen_random_uuid(), gen_random_uuid(), gen_random_uuid(),
  gen_random_uuid(), gen_random_uuid(), gen_random_uuid(), gen_random_uuid(),
  gen_random_uuid(), gen_random_uuid(), gen_random_uuid(), gen_random_uuid(),
  gen_random_uuid(), gen_random_uuid(), gen_random_uuid(), gen_random_uuid(),
  gen_random_uuid();

insert into auth.users (id, email, raw_user_meta_data)
select coach_id, concat('fase0-aplicar-coach+', coach_id, '@example.test'),
  jsonb_build_object('role', 'coach', 'nombre', 'Coach Aplicacion')
from fase0_aplicacion_ids
union all
select cliente_profile_id, concat('fase0-aplicar-cliente+', cliente_profile_id, '@example.test'),
  jsonb_build_object('role', 'cliente', 'nombre', 'Cliente Aplicacion')
from fase0_aplicacion_ids;

insert into public.profiles (id, role, nombre, email)
select coach_id, 'coach', 'Coach Aplicacion', concat('fase0-aplicar-coach+', coach_id, '@example.test')
from fase0_aplicacion_ids
union all
select cliente_profile_id, 'cliente', 'Cliente Aplicacion', concat('fase0-aplicar-cliente+', cliente_profile_id, '@example.test')
from fase0_aplicacion_ids
on conflict (id) do update
set role = excluded.role, nombre = excluded.nombre, email = excluded.email;

insert into public.clientes (id, profile_id, coach_id, activo)
select cliente_id, cliente_profile_id, coach_id, true
from fase0_aplicacion_ids;

insert into public.planes_nutricion (
  id, coach_id, cliente_id, nombre, activo,
  kcal_objetivo, proteinas_objetivo, carbohidratos_objetivo, grasas_objetivo
)
select plan_nutricion_id, coach_id, cliente_id, 'Plan nutricion atomico', false,
  2000, 130, 240, 65
from fase0_aplicacion_ids;

insert into public.planes_entrenamiento (
  id, coach_id, cliente_id, nombre, descripcion, duracion_semanas, activo
)
select plan_entrenamiento_id, coach_id, cliente_id,
  'Plan entrenamiento atomico', 'Descripcion original', 6, true
from fase0_aplicacion_ids
union all
select plan_entrenamiento_ajeno_id, coach_id, cliente_id,
  'Plan entrenamiento no activo', 'No modificar', 4, false
from fase0_aplicacion_ids;

insert into public.sesiones_entrenamiento (
  id, plan_id, nombre, dia_semana, orden, notas, duracion_estimada_min
)
select sesion_id, plan_entrenamiento_id, 'Sesion propia', 'Lunes', 1,
  'Notas originales', 60
from fase0_aplicacion_ids
union all
select sesion_ajena_id, plan_entrenamiento_ajeno_id, 'Sesion ajena', 'Martes', 1,
  'No modificar', 50
from fase0_aplicacion_ids;

insert into public.ejercicios (id, nombre, grupo_muscular, tipo, descripcion)
select ejercicio_catalogo_id, 'Ejercicio atomico', 'Pierna', 'fuerza', 'Fixture fase 0'
from fase0_aplicacion_ids;

insert into public.sesion_ejercicios (
  id, sesion_id, ejercicio_id, series, repeticiones, descanso_segundos, orden
)
select ejercicio_sesion_id, sesion_id, ejercicio_catalogo_id, 4, '8', 120, 1
from fase0_aplicacion_ids
union all
select ejercicio_ajeno_sesion_id, sesion_ajena_id, ejercicio_catalogo_id, 5, '5', 150, 1
from fase0_aplicacion_ids;

insert into public.agente_tareas (
  id, tipo, cliente_id, agente, estado, prioridad, payload, propuesta
)
select tarea_macros_id, 'ajuste_macros', cliente_id, 'revisor_semanal',
  'aprobado', 2, '{}'::jsonb, 'Ajustar macros'
from fase0_aplicacion_ids
union all
select tarea_pendiente_id, 'ajuste_macros', cliente_id, 'revisor_semanal',
  'pendiente', 2, '{}'::jsonb, 'No autorizada'
from fase0_aplicacion_ids
union all
select tarea_entreno_id, 'actualizacion_plan', cliente_id, 'revisor_semanal',
  'modificado', 2, '{}'::jsonb, 'Actualizar entrenamiento'
from fase0_aplicacion_ids
union all
select tarea_chat_error_id, 'actualizacion_plan', cliente_id, 'revisor_semanal',
  'aprobado', 2, '{}'::jsonb, 'Forzar fallo de chat'
from fase0_aplicacion_ids
union all
select tarea_concurrente_a_id, 'actualizacion_plan', cliente_id, 'revisor_semanal',
  'aprobado', 2, '{}'::jsonb, 'Append A'
from fase0_aplicacion_ids
union all
select tarea_concurrente_b_id, 'actualizacion_plan', cliente_id, 'revisor_semanal',
  'aprobado', 2, '{}'::jsonb, 'Append B'
from fase0_aplicacion_ids;

create function public.fase0_forzar_error_chat_aplicacion()
returns trigger
language plpgsql
as $$
begin
  if new.contenido = 'Forzar error chat atomico' then
    raise exception using errcode = 'P0001', message = 'Fallo de chat forzado para prueba';
  end if;
  return new;
end;
$$;

create trigger fase0_forzar_error_chat_aplicacion
before insert on public.chat_mensajes
for each row execute function public.fase0_forzar_error_chat_aplicacion();

select plan(30);

select has_function(
  'public', 'aplicar_ajuste_macros_seguro', array['uuid', 'uuid', 'jsonb']
);
select has_function(
  'public', 'aplicar_actualizacion_entreno_segura',
  array['uuid', 'uuid', 'uuid', 'jsonb', 'jsonb', 'jsonb', 'text']
);
select has_function(
  'public', 'aplicar_mensaje_cliente_seguro', array['uuid', 'uuid', 'text']
);

select throws_ok(
  $test$select public.aplicar_ajuste_macros_seguro(
    tarea_macros_id, cliente_id, '{"kcal_objetivo":2100}'::jsonb
  ) from fase0_aplicacion_ids$test$,
  'P0001', null, 'rechaza macros sin plan nutricional activo'
);

select ok(
  (select pn.kcal_objetivo = 2000 and t.estado = 'aprobado' and t.aplicado_at is null
   from fase0_aplicacion_ids f
   join public.planes_nutricion pn on pn.id = f.plan_nutricion_id
   join public.agente_tareas t on t.id = f.tarea_macros_id),
  'el rechazo sin plan no muta plan ni tarea'
);

update public.planes_nutricion pn set activo = true
from fase0_aplicacion_ids f where pn.id = f.plan_nutricion_id;

select throws_ok(
  $test$select public.aplicar_ajuste_macros_seguro(
    tarea_pendiente_id, cliente_id, '{"kcal_objetivo":2100}'::jsonb
  ) from fase0_aplicacion_ids$test$,
  'P0001', null, 'rechaza tarea pendiente'
);

select ok(
  (select pn.kcal_objetivo = 2000 and t.estado = 'pendiente' and t.aplicado_at is null
   from fase0_aplicacion_ids f
   join public.planes_nutricion pn on pn.id = f.plan_nutricion_id
   join public.agente_tareas t on t.id = f.tarea_pendiente_id),
  'el rechazo por estado no muta plan ni tarea'
);

select throws_ok(
  $test$select public.aplicar_ajuste_macros_seguro(
    tarea_macros_id, cliente_id,
    '{"campo_prohibido":99}'::jsonb
  ) from fase0_aplicacion_ids$test$,
  'P0001', null, 'rechaza macros sin claves permitidas'
);

select ok(
  (select pn.kcal_objetivo = 2000 and pn.proteinas_objetivo = 130
      and t.estado = 'aprobado' and t.aplicado_at is null
   from fase0_aplicacion_ids f
   join public.planes_nutricion pn on pn.id = f.plan_nutricion_id
   join public.agente_tareas t on t.id = f.tarea_macros_id),
  'las claves de macros no permitidas no mutan ni marcan aplicada la tarea'
);

select throws_ok(
  $test$select public.aplicar_ajuste_macros_seguro(
    tarea_macros_id, cliente_id, '{"grasas_objetivo":null}'::jsonb
  ) from fase0_aplicacion_ids$test$,
  'P0001', null, 'rechaza macro null'
);

select throws_ok(
  $test$select public.aplicar_ajuste_macros_seguro(
    tarea_macros_id, cliente_id, '{"kcal_objetivo":-1}'::jsonb
  ) from fase0_aplicacion_ids$test$,
  'P0001', null, 'rechaza macro fuera de rango'
);

select ok(
  (select pn.kcal_objetivo = 2000 and pn.grasas_objetivo = 65
      and t.estado = 'aprobado' and t.aplicado_at is null
   from fase0_aplicacion_ids f
   join public.planes_nutricion pn on pn.id = f.plan_nutricion_id
   join public.agente_tareas t on t.id = f.tarea_macros_id),
  'un macro inválido no deja cambios parciales'
);

select lives_ok(
  $test$select public.aplicar_ajuste_macros_seguro(
    tarea_macros_id, cliente_id,
    '{"kcal_objetivo":2100,"proteinas_objetivo":140}'::jsonb
  ) from fase0_aplicacion_ids$test$,
  'aplica macros permitidos en una transaccion'
);

select ok(
  (select pn.kcal_objetivo = 2100 and pn.proteinas_objetivo = 140
      and pn.carbohidratos_objetivo = 240 and pn.grasas_objetivo = 65
      and t.estado = 'aplicado' and t.aplicado_at is not null
      and t.error_aplicacion is null
   from fase0_aplicacion_ids f
   join public.planes_nutricion pn on pn.id = f.plan_nutricion_id
   join public.agente_tareas t on t.id = f.tarea_macros_id),
  'macros validos y tarea se actualizan juntos'
);

select throws_ok(
  $test$select public.aplicar_actualizacion_entreno_segura(
    tarea_entreno_id,
    cliente_id,
    plan_entrenamiento_id,
    '{"descripcion_append":"Descripcion nueva","duracion_semanas":8}'::jsonb,
    jsonb_build_array(jsonb_build_object(
      'id', sesion_ajena_id,
      'campos', jsonb_build_object('duracion_estimada_min', 45)
    )),
    '[]'::jsonb,
    null
  ) from fase0_aplicacion_ids$test$,
  'P0001', null, 'rechaza una sesion que no pertenece al plan activo'
);

select ok(
  (select pe.descripcion = 'Descripcion original' and pe.duracion_semanas = 6
      and sa.duracion_estimada_min = 50 and t.estado = 'modificado'
      and t.aplicado_at is null
   from fase0_aplicacion_ids f
   join public.planes_entrenamiento pe on pe.id = f.plan_entrenamiento_id
   join public.sesiones_entrenamiento sa on sa.id = f.sesion_ajena_id
   join public.agente_tareas t on t.id = f.tarea_entreno_id),
  'el rechazo de target conserva plan, sesion ajena y tarea'
);

select throws_ok(
  $test$select public.aplicar_actualizacion_entreno_segura(
    tarea_entreno_id,
    cliente_id,
    plan_entrenamiento_id,
    '{"descripcion_append":null}'::jsonb,
    '[]'::jsonb,
    '[]'::jsonb,
    null
  ) from fase0_aplicacion_ids$test$,
  'P0001', null, 'rechaza delta de plan null'
);

select throws_ok(
  $test$select public.aplicar_actualizacion_entreno_segura(
    tarea_entreno_id,
    cliente_id,
    plan_entrenamiento_id,
    '{"descripcion_append":"No debe persistir"}'::jsonb,
    '[]'::jsonb,
    jsonb_build_array(jsonb_build_object(
      'id', ejercicio_ajeno_sesion_id,
      'campos', jsonb_build_object('series', 3)
    )),
    null
  ) from fase0_aplicacion_ids$test$,
  'P0001', null, 'rechaza un ejercicio que no pertenece al plan activo'
);

select throws_ok(
  $test$select public.aplicar_actualizacion_entreno_segura(
    tarea_chat_error_id,
    cliente_id,
    plan_entrenamiento_id,
    '{"descripcion_append":"No debe persistir"}'::jsonb,
    jsonb_build_array(jsonb_build_object(
      'id', sesion_id,
      'campos', jsonb_build_object('duracion_estimada_min', 44)
    )),
    jsonb_build_array(jsonb_build_object(
      'id', ejercicio_sesion_id,
      'campos', jsonb_build_object('series', 2)
    )),
    'Forzar error chat atomico'
  ) from fase0_aplicacion_ids$test$,
  'P0001', null, 'un error al insertar chat revierte toda la aplicacion'
);

select ok(
  (select pe.descripcion = 'Descripcion original'
      and s.duracion_estimada_min = 60 and se.series = 4
      and t.estado = 'aprobado'
      and t.aplicado_at is null
   from fase0_aplicacion_ids f
   join public.planes_entrenamiento pe on pe.id = f.plan_entrenamiento_id
   join public.sesiones_entrenamiento s on s.id = f.sesion_id
   join public.sesion_ejercicios se on se.id = f.ejercicio_sesion_id
   join public.agente_tareas t on t.id = f.tarea_chat_error_id),
  'el fallo de chat no deja plan, sesion, ejercicio ni tarea parcialmente aplicados'
);

select lives_ok(
  $test$select public.aplicar_actualizacion_entreno_segura(
    tarea_entreno_id,
    cliente_id,
    plan_entrenamiento_id,
    '{"descripcion_append":"Descripcion nueva","duracion_semanas":8}'::jsonb,
    jsonb_build_array(jsonb_build_object(
      'id', sesion_id,
      'campos', jsonb_build_object(
        'notas_append', 'Notas nuevas',
        'duracion_estimada_min', 45,
        'contexto_ia_append', 'Descarga'
      )
    )),
    jsonb_build_array(jsonb_build_object(
      'id', ejercicio_sesion_id,
      'campos', jsonb_build_object(
        'series', 3,
        'repeticiones', '6',
        'descanso_segundos', 90,
        'rpe', '6'
      )
    )),
    'Mensaje atomico al cliente'
  ) from fase0_aplicacion_ids$test$,
  'aplica entrenamiento completo en una transaccion'
);

select ok(
  (select pe.descripcion = E'Descripcion original\n\nDescripcion nueva' and pe.duracion_semanas = 8
      and s.notas = E'Notas originales\n\nNotas nuevas' and s.duracion_estimada_min = 45
      and s.contexto_ia = 'Descarga'
      and se.series = 3 and se.repeticiones = '6'
      and se.descanso_segundos = 90 and se.rpe = '6'
      and t.estado = 'aplicado' and t.aplicado_at is not null
   from fase0_aplicacion_ids f
   join public.planes_entrenamiento pe on pe.id = f.plan_entrenamiento_id
   join public.sesiones_entrenamiento s on s.id = f.sesion_id
   join public.sesion_ejercicios se on se.id = f.ejercicio_sesion_id
   join public.agente_tareas t on t.id = f.tarea_entreno_id),
  'plan, sesion, ejercicio y tarea cambian juntos'
);

select lives_ok(
  $test$select public.aplicar_actualizacion_entreno_segura(
    tarea_concurrente_a_id, cliente_id, plan_entrenamiento_id,
    '{"descripcion_append":"Append A"}'::jsonb,
    jsonb_build_array(jsonb_build_object(
      'id', sesion_id, 'campos', jsonb_build_object('notas_append', 'Nota A')
    )),
    '[]'::jsonb, null
  ) from fase0_aplicacion_ids$test$,
  'el primer delta se compone dentro de la RPC bloqueada'
);

select lives_ok(
  $test$select public.aplicar_actualizacion_entreno_segura(
    tarea_concurrente_b_id, cliente_id, plan_entrenamiento_id,
    '{"descripcion_append":"Append B"}'::jsonb,
    jsonb_build_array(jsonb_build_object(
      'id', sesion_id, 'campos', jsonb_build_object('notas_append', 'Nota B')
    )),
    '[]'::jsonb, null
  ) from fase0_aplicacion_ids$test$,
  'el segundo delta conserva el primero en una secuencia determinista'
);

select ok(
  (select pe.descripcion = E'Descripcion original\n\nDescripcion nueva\n\nAppend A\n\nAppend B'
      and s.notas = E'Notas originales\n\nNotas nuevas\n\nNota A\n\nNota B'
   from fase0_aplicacion_ids f
   join public.planes_entrenamiento pe on pe.id = f.plan_entrenamiento_id
   join public.sesiones_entrenamiento s on s.id = f.sesion_id),
  'deltas sucesivos no pierden descripción ni notas previas'
);

select is(
  (select count(*)::integer
   from public.chat_mensajes cm
   join fase0_aplicacion_ids f on f.cliente_id = cm.cliente_id
   where cm.contenido = 'Mensaje atomico al cliente'),
  1,
  'el mensaje se inserta dentro de la misma aplicacion'
);

select throws_ok(
  $test$select public.aplicar_mensaje_cliente_seguro(
    tarea_pendiente_id, cliente_id, 'Mensaje directo atomico'
  ) from fase0_aplicacion_ids$test$,
  'P0001', null, 'rechaza mensaje de una tarea sin aprobar'
);

select ok(
  (select count(*) = 0
   from public.chat_mensajes cm
   join fase0_aplicacion_ids f on f.cliente_id = cm.cliente_id
   where cm.contenido = 'Mensaje directo atomico'),
  'un mensaje rechazado no se inserta parcialmente'
);

select ok(
  (select sa.notas = 'No modificar' and sa.duracion_estimada_min = 50
   from fase0_aplicacion_ids f
   join public.sesiones_entrenamiento sa on sa.id = f.sesion_ajena_id),
  'la sesion ajena nunca se modifica'
);

select ok(
  (select count(*) = 0
   from public.agente_tareas
   where estado = 'aplicado' and aplicado_at is null),
  'ninguna tarea aplicada queda sin timestamp'
);

select * from finish();

rollback;
