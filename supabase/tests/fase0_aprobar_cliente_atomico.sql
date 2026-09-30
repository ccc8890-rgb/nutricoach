begin;

create temporary table fase0_aprobacion_fixture (
  actor_id uuid not null,
  actor_ajeno_id uuid not null,
  cliente_profile_id uuid not null,
  cliente_id uuid not null,
  plan_nutricion_id uuid not null,
  plan_entrenamiento_id uuid not null
) on commit drop;

insert into fase0_aprobacion_fixture
select gen_random_uuid(), gen_random_uuid(), gen_random_uuid(), gen_random_uuid(),
  gen_random_uuid(), gen_random_uuid();

insert into auth.users (id, email, raw_user_meta_data)
select actor_id, concat('fase0-aprobar-coach+', actor_id, '@example.test'),
  jsonb_build_object('role', 'coach', 'nombre', 'Coach propietario')
from fase0_aprobacion_fixture
union all
select actor_ajeno_id, concat('fase0-aprobar-ajeno+', actor_ajeno_id, '@example.test'),
  jsonb_build_object('role', 'coach', 'nombre', 'Coach ajeno')
from fase0_aprobacion_fixture
union all
select cliente_profile_id, concat('fase0-aprobar-cliente+', cliente_profile_id, '@example.test'),
  jsonb_build_object('role', 'cliente', 'nombre', 'Cliente')
from fase0_aprobacion_fixture;

insert into public.profiles (id, role, nombre, email)
select actor_id, 'coach', 'Coach propietario', concat('fase0-aprobar-coach+', actor_id, '@example.test')
from fase0_aprobacion_fixture
union all
select actor_ajeno_id, 'coach', 'Coach ajeno', concat('fase0-aprobar-ajeno+', actor_ajeno_id, '@example.test')
from fase0_aprobacion_fixture
union all
select cliente_profile_id, 'cliente', 'Cliente', concat('fase0-aprobar-cliente+', cliente_profile_id, '@example.test')
from fase0_aprobacion_fixture;

insert into public.clientes (
  id, profile_id, coach_id, activo, revisado_por_coach
)
select cliente_id, cliente_profile_id, actor_id, false, false
from fase0_aprobacion_fixture;

select plan(10);

select has_function('public', 'aprobar_cliente_atomico', array['uuid', 'uuid']);

select ok(
  not has_function_privilege('anon', 'public.aprobar_cliente_atomico(uuid,uuid)', 'EXECUTE')
  and not has_function_privilege('authenticated', 'public.aprobar_cliente_atomico(uuid,uuid)', 'EXECUTE')
  and has_function_privilege('service_role', 'public.aprobar_cliente_atomico(uuid,uuid)', 'EXECUTE'),
  'la RPC solo puede ejecutarla service_role'
);

select is(
  (select r.codigo
   from fase0_aprobacion_fixture f,
   lateral public.aprobar_cliente_atomico(f.cliente_id, f.actor_ajeno_id) r),
  'CLIENT_NOT_OWNED',
  'rechaza al coach ajeno antes de activar'
);

select is(
  (select r.codigo
   from fase0_aprobacion_fixture f,
   lateral public.aprobar_cliente_atomico(f.cliente_id, null) r),
  'CLIENT_NOT_OWNED',
  'rechaza actor nulo aunque la llamada use service_role'
);

select is(
  (select r.codigo
   from fase0_aprobacion_fixture f,
   lateral public.aprobar_cliente_atomico(f.cliente_id, f.actor_id) r),
  'ACTIVE_PLANS_REQUIRED',
  'rechaza aprobación sin ambos planes activos'
);

select ok(
  (select not c.activo and not c.revisado_por_coach
   from fase0_aprobacion_fixture f
   join public.clientes c on c.id = f.cliente_id),
  'un rechazo no activa ni marca revisado al cliente'
);

insert into public.planes_nutricion (id, coach_id, cliente_id, nombre, activo)
select plan_nutricion_id, actor_id, cliente_id, 'Nutrición activa', true
from fase0_aprobacion_fixture;

select is(
  (select r.codigo
   from fase0_aprobacion_fixture f,
   lateral public.aprobar_cliente_atomico(f.cliente_id, f.actor_id) r),
  'ACTIVE_PLANS_REQUIRED',
  'un solo dominio activo sigue siendo insuficiente'
);

insert into public.planes_entrenamiento (id, coach_id, cliente_id, nombre, activo)
select plan_entrenamiento_id, actor_id, cliente_id, 'Entrenamiento activo', true
from fase0_aprobacion_fixture;

select is(
  (select r.codigo
   from fase0_aprobacion_fixture f,
   lateral public.aprobar_cliente_atomico(f.cliente_id, f.actor_id) r),
  'CLIENT_APPROVED',
  'aprueba con ownership y ambos planes activos'
);

select ok(
  (select c.activo and c.revisado_por_coach
   from fase0_aprobacion_fixture f
   join public.clientes c on c.id = f.cliente_id),
  'la aprobación activa y marca revisado al cliente'
);

select is(
  (select r.cliente_profile_id
   from fase0_aprobacion_fixture f,
   lateral public.aprobar_cliente_atomico(f.cliente_id, f.actor_id) r),
  (select cliente_profile_id from fase0_aprobacion_fixture),
  'la RPC devuelve el profile_id tipado para el email post-commit'
);

select * from finish();

rollback;
