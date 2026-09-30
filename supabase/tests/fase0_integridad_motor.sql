begin;

create temporary table fase0_fixture_ids (
  actor_id uuid not null,
  cliente_profile_id uuid not null,
  cliente_id uuid not null,
  plan_nutricion_activo_id uuid not null,
  plan_entrenamiento_activo_id uuid not null,
  generacion_completada_id uuid not null,
  generacion_completada_token uuid not null,
  generacion_nutricion_activa_id uuid not null,
  generacion_nutricion_activa_token uuid not null,
  generacion_entrenamiento_activo_id uuid not null,
  generacion_entrenamiento_activo_token uuid not null,
  nutricion_completada_id uuid not null,
  entrenamiento_completado_id uuid not null,
  nutricion_activa_id uuid not null,
  entrenamiento_borrador_id uuid not null,
  nutricion_borrador_id uuid not null,
  entrenamiento_activo_id uuid not null
) on commit drop;

insert into fase0_fixture_ids
select
  gen_random_uuid(), gen_random_uuid(), gen_random_uuid(), gen_random_uuid(),
  gen_random_uuid(), gen_random_uuid(), gen_random_uuid(), gen_random_uuid(),
  gen_random_uuid(), gen_random_uuid(), gen_random_uuid(), gen_random_uuid(),
  gen_random_uuid(), gen_random_uuid(), gen_random_uuid(), gen_random_uuid(),
  gen_random_uuid();

insert into auth.users (id, email, raw_user_meta_data)
select actor_id, concat('fase0-coach+', actor_id, '@example.test'),
  jsonb_build_object('role', 'coach', 'nombre', 'Coach Fase 0')
from fase0_fixture_ids
union all
select cliente_profile_id, concat('fase0-cliente+', cliente_profile_id, '@example.test'),
  jsonb_build_object('role', 'cliente', 'nombre', 'Cliente Fase 0')
from fase0_fixture_ids;

insert into public.profiles (id, role, nombre, email)
select actor_id, 'coach', 'Coach Fase 0', concat('fase0-coach+', actor_id, '@example.test')
from fase0_fixture_ids
union all
select cliente_profile_id, 'cliente', 'Cliente Fase 0', concat('fase0-cliente+', cliente_profile_id, '@example.test')
from fase0_fixture_ids
on conflict (id) do update
set role = excluded.role, nombre = excluded.nombre, email = excluded.email;

insert into public.clientes (id, profile_id, coach_id, activo)
select cliente_id, cliente_profile_id, actor_id, true from fase0_fixture_ids;

insert into public.planes_nutricion (id, coach_id, cliente_id, nombre, activo)
select plan_nutricion_activo_id, actor_id, cliente_id, 'Activo nutricion fase0', true
from fase0_fixture_ids;

insert into public.planes_entrenamiento (id, coach_id, cliente_id, nombre, activo)
select plan_entrenamiento_activo_id, actor_id, cliente_id, 'Activo entrenamiento fase0', true
from fase0_fixture_ids;

insert into public.generaciones_plan_inicial (
  id, cliente_id, clave_idempotencia, solicitada_por, estado, completed_at, intento_token
)
select generacion_completada_id, cliente_id, 'fase0:test:completada', actor_id, 'completada', now(), generacion_completada_token
from fase0_fixture_ids
union all
select generacion_nutricion_activa_id, cliente_id, 'fase0:test:nutricion-activa', actor_id, 'procesando', null, generacion_nutricion_activa_token
from fase0_fixture_ids
union all
select generacion_entrenamiento_activo_id, cliente_id, 'fase0:test:entrenamiento-activo', actor_id, 'procesando', null, generacion_entrenamiento_activo_token
from fase0_fixture_ids;

insert into public.planes_nutricion (
  id, coach_id, cliente_id, nombre, activo, generacion_inicial_id, generacion_intento_token
)
select nutricion_completada_id, actor_id, cliente_id, 'Borrador nutricion completada', false, generacion_completada_id, generacion_completada_token
from fase0_fixture_ids
union all
select nutricion_activa_id, actor_id, cliente_id, 'Candidato nutricion activo', false, generacion_nutricion_activa_id, generacion_nutricion_activa_token
from fase0_fixture_ids
union all
select nutricion_borrador_id, actor_id, cliente_id, 'Borrador nutricion', false, generacion_entrenamiento_activo_id, generacion_entrenamiento_activo_token
from fase0_fixture_ids;

insert into public.planes_entrenamiento (
  id, coach_id, cliente_id, nombre, activo, generacion_inicial_id, generacion_intento_token
)
select entrenamiento_completado_id, actor_id, cliente_id, 'Borrador entrenamiento completado', false, generacion_completada_id, generacion_completada_token
from fase0_fixture_ids
union all
select entrenamiento_borrador_id, actor_id, cliente_id, 'Borrador entrenamiento', false, generacion_nutricion_activa_id, generacion_nutricion_activa_token
from fase0_fixture_ids
union all
select entrenamiento_activo_id, actor_id, cliente_id, 'Candidato entrenamiento activo', false, generacion_entrenamiento_activo_id, generacion_entrenamiento_activo_token
from fase0_fixture_ids;

select plan(14);

select has_table('public'::name, 'generaciones_plan_inicial'::name, 'existe generaciones_plan_inicial');
select has_function('public', 'claim_generacion_plan_inicial', array['uuid', 'text', 'uuid']);
select has_function('public', 'activar_planes_generacion', array['uuid', 'uuid', 'uuid', 'uuid']);
select has_index(
  'public'::name, 'planes_nutricion'::name, 'uq_plan_nutricion_activo_cliente'::name,
  'existe indice unico de nutricion activa'
);
select has_index(
  'public'::name, 'planes_entrenamiento'::name, 'uq_plan_entrenamiento_activo_cliente'::name,
  'existe indice unico de entrenamiento activo'
);

with fixture as (
  select cliente_id, actor_id from fase0_fixture_ids
), a as (
  select * from public.claim_generacion_plan_inicial(
    (select cliente_id from fixture), 'fase0:test:misma-clave', (select actor_id from fixture)
  )
), b as (
  select * from public.claim_generacion_plan_inicial(
    (select cliente_id from fixture), 'fase0:test:misma-clave', (select actor_id from fixture)
  )
)
select is((select generacion_id from a), (select generacion_id from b), 'misma clave conserva generacion');

select throws_ok(
  $$insert into public.planes_nutricion (coach_id, cliente_id, nombre, activo)
    select actor_id, cliente_id, 'duplicado nutricion fase0', true from fase0_fixture_ids$$,
  '23505', null, 'no admite dos planes nutricionales activos'
);

select throws_ok(
  $$insert into public.planes_entrenamiento (coach_id, cliente_id, nombre, activo)
    select actor_id, cliente_id, 'duplicado entrenamiento fase0', true from fase0_fixture_ids$$,
  '23505', null, 'no admite dos planes de entrenamiento activos'
);

select throws_ok(
  $test$do $attempt$
  begin
    perform public.activar_planes_generacion(
      generacion_completada_id, generacion_completada_token,
      nutricion_completada_id, entrenamiento_completado_id
    ) from fase0_fixture_ids;
    raise exception using errcode = 'P0002', message = 'la activacion fue aceptada';
  end
  $attempt$$test$,
  'P0001', null, 'rechaza activar una generacion que no esta procesando'
);

select ok(
  (select pn_activo.activo and pe_activo.activo and not pn_borrador.activo
      and not pe_borrador.activo and g.estado = 'completada'
    from fase0_fixture_ids f
    join public.planes_nutricion pn_activo on pn_activo.id = f.plan_nutricion_activo_id
    join public.planes_entrenamiento pe_activo on pe_activo.id = f.plan_entrenamiento_activo_id
    join public.planes_nutricion pn_borrador on pn_borrador.id = f.nutricion_completada_id
    join public.planes_entrenamiento pe_borrador on pe_borrador.id = f.entrenamiento_completado_id
    join public.generaciones_plan_inicial g on g.id = f.generacion_completada_id),
  'rechazo por estado conserva planes y generacion'
);

update public.planes_nutricion p set activo = false
from fase0_fixture_ids f where p.id = f.plan_nutricion_activo_id;
update public.planes_nutricion p set activo = true
from fase0_fixture_ids f where p.id = f.nutricion_activa_id;

select throws_ok(
  $test$do $attempt$
  begin
    perform public.activar_planes_generacion(
      generacion_nutricion_activa_id, generacion_nutricion_activa_token,
      nutricion_activa_id, entrenamiento_borrador_id
    ) from fase0_fixture_ids;
    raise exception using errcode = 'P0002', message = 'la activacion fue aceptada';
  end
  $attempt$$test$,
  'P0001', null, 'rechaza candidato nutricional ya activo'
);

select ok(
  (select pn_candidato.activo and pe_activo.activo and not pe_borrador.activo
      and g.estado = 'procesando'
    from fase0_fixture_ids f
    join public.planes_nutricion pn_candidato on pn_candidato.id = f.nutricion_activa_id
    join public.planes_entrenamiento pe_activo on pe_activo.id = f.plan_entrenamiento_activo_id
    join public.planes_entrenamiento pe_borrador on pe_borrador.id = f.entrenamiento_borrador_id
    join public.generaciones_plan_inicial g on g.id = f.generacion_nutricion_activa_id),
  'rechazo de nutricion activa no muta entrenamiento ni generacion'
);

update public.planes_nutricion p set activo = false
from fase0_fixture_ids f where p.id = f.nutricion_activa_id;
update public.planes_nutricion p set activo = true
from fase0_fixture_ids f where p.id = f.plan_nutricion_activo_id;
update public.planes_entrenamiento p set activo = false
from fase0_fixture_ids f where p.id = f.plan_entrenamiento_activo_id;
update public.planes_entrenamiento p set activo = true
from fase0_fixture_ids f where p.id = f.entrenamiento_activo_id;

select throws_ok(
  $test$do $attempt$
  begin
    perform public.activar_planes_generacion(
      generacion_entrenamiento_activo_id, generacion_entrenamiento_activo_token,
      nutricion_borrador_id, entrenamiento_activo_id
    ) from fase0_fixture_ids;
    raise exception using errcode = 'P0002', message = 'la activacion fue aceptada';
  end
  $attempt$$test$,
  'P0001', null, 'rechaza candidato de entrenamiento ya activo'
);

select ok(
  (select pe_candidato.activo and pn_activo.activo and not pn_borrador.activo
      and g.estado = 'procesando'
    from fase0_fixture_ids f
    join public.planes_entrenamiento pe_candidato on pe_candidato.id = f.entrenamiento_activo_id
    join public.planes_nutricion pn_activo on pn_activo.id = f.plan_nutricion_activo_id
    join public.planes_nutricion pn_borrador on pn_borrador.id = f.nutricion_borrador_id
    join public.generaciones_plan_inicial g on g.id = f.generacion_entrenamiento_activo_id),
  'rechazo de entrenamiento activo no muta nutricion ni generacion'
);

select * from finish();

rollback;
