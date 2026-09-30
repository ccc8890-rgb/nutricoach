begin;

create temporary table fase0_fencing_fixture (
  actor_id uuid not null,
  cliente_profile_id uuid not null,
  cliente_id uuid not null,
  plan_nutricion_activo_id uuid not null,
  plan_entrenamiento_activo_id uuid not null,
  nutricion_a_id uuid not null,
  entrenamiento_a_id uuid not null,
  nutricion_b_id uuid not null,
  entrenamiento_b_id uuid not null,
  generacion_id uuid,
  token_a uuid,
  token_b uuid
) on commit drop;

insert into fase0_fencing_fixture
select
  gen_random_uuid(), gen_random_uuid(), gen_random_uuid(), gen_random_uuid(),
  gen_random_uuid(), gen_random_uuid(), gen_random_uuid(), gen_random_uuid(),
  gen_random_uuid(), null, null, null;

insert into auth.users (id, email, raw_user_meta_data)
select actor_id, concat('fase0-fencing-coach+', actor_id, '@example.test'),
  jsonb_build_object('role', 'coach', 'nombre', 'Coach Fencing')
from fase0_fencing_fixture
union all
select cliente_profile_id, concat('fase0-fencing-cliente+', cliente_profile_id, '@example.test'),
  jsonb_build_object('role', 'cliente', 'nombre', 'Cliente Fencing')
from fase0_fencing_fixture;

insert into public.profiles (id, role, nombre, email)
select actor_id, 'coach', 'Coach Fencing', concat('fase0-fencing-coach+', actor_id, '@example.test')
from fase0_fencing_fixture
union all
select cliente_profile_id, 'cliente', 'Cliente Fencing', concat('fase0-fencing-cliente+', cliente_profile_id, '@example.test')
from fase0_fencing_fixture;

insert into public.clientes (id, profile_id, coach_id, activo)
select cliente_id, cliente_profile_id, actor_id, true from fase0_fencing_fixture;

insert into public.planes_nutricion (id, coach_id, cliente_id, nombre, activo)
select plan_nutricion_activo_id, actor_id, cliente_id, 'Nutricion activa fencing', true
from fase0_fencing_fixture;

insert into public.planes_entrenamiento (id, coach_id, cliente_id, nombre, activo)
select plan_entrenamiento_activo_id, actor_id, cliente_id, 'Entrenamiento activo fencing', true
from fase0_fencing_fixture;

select plan(25);

select has_column('public', 'generaciones_plan_inicial', 'intento_token', 'generacion guarda lease vigente');
select has_column('public', 'planes_nutricion', 'generacion_intento_token', 'nutricion guarda lease del intento');
select has_column('public', 'planes_entrenamiento', 'generacion_intento_token', 'entrenamiento guarda lease del intento');
select has_function('public', 'limpiar_borradores_generacion', array['uuid', 'uuid']);
select has_function('public', 'marcar_generacion_inicial_fallida', array['uuid', 'uuid', 'text', 'text']);
select has_function('public', 'activar_planes_generacion', array['uuid', 'uuid', 'uuid', 'uuid']);

with claim as (
  select c.*
  from fase0_fencing_fixture f,
  lateral public.claim_generacion_plan_inicial(f.cliente_id, 'fase0:fencing:misma-clave', f.actor_id) c
)
update fase0_fencing_fixture f
set generacion_id = c.generacion_id, token_a = c.intento_token
from claim c;

select ok(
  (select generacion_id is not null and token_a is not null from fase0_fencing_fixture),
  'worker A recibe lease opaca'
);

insert into public.planes_nutricion (
  id, coach_id, cliente_id, nombre, activo, generacion_inicial_id, generacion_intento_token
)
select nutricion_a_id, actor_id, cliente_id, 'Borrador nutricion A', false, generacion_id, token_a
from fase0_fencing_fixture;

insert into public.planes_entrenamiento (
  id, coach_id, cliente_id, nombre, activo, generacion_inicial_id, generacion_intento_token
)
select entrenamiento_a_id, actor_id, cliente_id, 'Borrador entrenamiento A', false, generacion_id, token_a
from fase0_fencing_fixture;

update public.generaciones_plan_inicial g
set updated_at = now() - interval '6 minutes'
from fase0_fencing_fixture f
where g.id = f.generacion_id;

with claim as (
  select c.*
  from fase0_fencing_fixture f,
  lateral public.claim_generacion_plan_inicial(f.cliente_id, 'fase0:fencing:misma-clave', f.actor_id) c
)
update fase0_fencing_fixture f
set token_b = c.intento_token
from claim c;

select ok(
  (select token_b is not null and token_b <> token_a from fase0_fencing_fixture),
  'worker B recupera la misma generacion con lease nueva'
);

select ok(
  (select c.accion = 'esperar' and c.intento_token is null
   from fase0_fencing_fixture f,
   lateral public.claim_generacion_plan_inicial(f.cliente_id, 'fase0:fencing:misma-clave', f.actor_id) c),
  'esperar no filtra la lease vigente'
);

select lives_ok(
  $$insert into public.planes_nutricion (
      id, coach_id, cliente_id, nombre, activo, generacion_inicial_id, generacion_intento_token
    )
    select nutricion_b_id, actor_id, cliente_id, 'Borrador nutricion B', false, generacion_id, token_b
    from fase0_fencing_fixture$$,
  'borradores de nutricion de dos intentos pueden coexistir'
);

select lives_ok(
  $$insert into public.planes_entrenamiento (
      id, coach_id, cliente_id, nombre, activo, generacion_inicial_id, generacion_intento_token
    )
    select entrenamiento_b_id, actor_id, cliente_id, 'Borrador entrenamiento B', false, generacion_id, token_b
    from fase0_fencing_fixture$$,
  'borradores de entrenamiento de dos intentos pueden coexistir'
);

select throws_ok(
  $test$do $attempt$
  begin
    perform public.limpiar_borradores_generacion(generacion_id, null)
    from fase0_fencing_fixture;
  end
  $attempt$$test$,
  'P0001', 'La lease del intento de generación es obligatoria',
  'limpieza rechaza explicitamente una lease NULL'
);

select throws_ok(
  $test$do $attempt$
  begin
    perform public.marcar_generacion_inicial_fallida(
      generacion_id, null, 'NULL_LEASE', 'lease ausente'
    ) from fase0_fencing_fixture;
  end
  $attempt$$test$,
  'P0001', 'La lease del intento de generación es obligatoria',
  'marcar fallo rechaza explicitamente una lease NULL'
);

select throws_ok(
  $test$do $attempt$
  begin
    perform public.activar_planes_generacion(
      generacion_id, null, nutricion_b_id, entrenamiento_b_id
    ) from fase0_fencing_fixture;
  end
  $attempt$$test$,
  'P0001', 'La lease del intento de generación es obligatoria',
  'activacion rechaza explicitamente una lease NULL'
);

select throws_ok(
  $$insert into public.planes_nutricion (
      coach_id, cliente_id, nombre, activo, generacion_inicial_id, generacion_intento_token
    )
    select actor_id, cliente_id, 'Escritura tardia A', false, generacion_id, token_a
    from fase0_fencing_fixture$$,
  'P0001', null, 'worker A no puede escribir tras perder la lease'
);

select throws_ok(
  $test$do $attempt$
  begin
    perform public.limpiar_borradores_generacion(generacion_id, token_a)
    from fase0_fencing_fixture;
  end
  $attempt$$test$,
  'P0001', null, 'worker A no puede limpiar borradores tras perder la lease'
);

select throws_ok(
  $test$do $attempt$
  begin
    perform public.marcar_generacion_inicial_fallida(
      generacion_id, token_a, 'OLD_WORKER', 'worker A'
    ) from fase0_fencing_fixture;
  end
  $attempt$$test$,
  'P0001', null, 'worker A no puede marcar fallida la generacion de B'
);

select throws_ok(
  $test$do $attempt$
  begin
    perform public.activar_planes_generacion(
      generacion_id, token_a, nutricion_b_id, entrenamiento_b_id
    ) from fase0_fencing_fixture;
  end
  $attempt$$test$,
  'P0001', null, 'worker A no puede activar los borradores de B tras perder la lease'
);

select ok(
  (select g.estado = 'procesando'
      and g.intento_token = f.token_b
      and not pn.activo
      and not pe.activo
    from fase0_fencing_fixture f
    join public.generaciones_plan_inicial g on g.id = f.generacion_id
    join public.planes_nutricion pn on pn.id = f.nutricion_b_id
    join public.planes_entrenamiento pe on pe.id = f.entrenamiento_b_id),
  'intentos obsoletos no alteran la generacion ni borradores de B'
);

select lives_ok(
  $test$do $attempt$
  begin
    perform public.activar_planes_generacion(
      generacion_id, token_b, nutricion_b_id, entrenamiento_b_id
    ) from fase0_fencing_fixture;
  end
  $attempt$$test$,
  'worker B activa con la lease vigente'
);

select ok(
  (select g.estado = 'completada'
      and g.intento_token = f.token_b
      and pn.activo
      and pe.activo
    from fase0_fencing_fixture f
    join public.generaciones_plan_inicial g on g.id = f.generacion_id
    join public.planes_nutricion pn on pn.id = f.nutricion_b_id
    join public.planes_entrenamiento pe on pe.id = f.entrenamiento_b_id),
  'activacion valida completa B y activa ambos planes'
);

select is(
  (select count(*)::integer
   from fase0_fencing_fixture f
   join public.planes_nutricion pn on pn.generacion_inicial_id = f.generacion_id
   where pn.generacion_intento_token = f.token_a),
  0, 'activacion valida limpia nutricion obsoleta de A'
);

select is(
  (select count(*)::integer
   from fase0_fencing_fixture f
   join public.planes_entrenamiento pe on pe.generacion_inicial_id = f.generacion_id
   where pe.generacion_intento_token = f.token_a),
  0, 'activacion valida limpia entrenamiento obsoleto de A'
);

select ok(
  (select c.accion = 'reutilizar' and c.intento_token is null
   from fase0_fencing_fixture f,
   lateral public.claim_generacion_plan_inicial(f.cliente_id, 'fase0:fencing:misma-clave', f.actor_id) c),
  'reutilizar no filtra la lease completada'
);

delete from public.generaciones_plan_inicial g
using fase0_fencing_fixture f
where g.id = f.generacion_id;

select ok(
  (select pn.generacion_inicial_id is null
      and pn.generacion_intento_token is null
      and pe.generacion_inicial_id is null
      and pe.generacion_intento_token is null
    from fase0_fencing_fixture f
    join public.planes_nutricion pn on pn.id = f.nutricion_b_id
    join public.planes_entrenamiento pe on pe.id = f.entrenamiento_b_id),
  'borrar la generacion desvincula generacion y lease de ambos planes'
);

select * from finish();

rollback;
