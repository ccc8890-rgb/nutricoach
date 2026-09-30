begin;

select plan(7);

select has_table(
  'public'::name,
  'generaciones_plan_inicial'::name,
  'existe generaciones_plan_inicial'
);
select has_function('public', 'claim_generacion_plan_inicial', array['uuid', 'text', 'uuid']);
select has_function('public', 'activar_planes_generacion', array['uuid', 'uuid', 'uuid']);
select has_index(
  'public'::name,
  'planes_nutricion'::name,
  'uq_plan_nutricion_activo_cliente'::name,
  'existe indice unico de nutricion activa'
);
select has_index(
  'public'::name,
  'planes_entrenamiento'::name,
  'uq_plan_entrenamiento_activo_cliente'::name,
  'existe indice unico de entrenamiento activo'
);

with c as (
  select id, coach_id
  from public.clientes
  order by created_at
  limit 1
), a as (
  select *
  from public.claim_generacion_plan_inicial(
    (select id from c),
    'fase0:test:misma-clave',
    (select coach_id from c)
  )
), b as (
  select *
  from public.claim_generacion_plan_inicial(
    (select id from c),
    'fase0:test:misma-clave',
    (select coach_id from c)
  )
)
select is(
  (select generacion_id from a),
  (select generacion_id from b),
  'misma clave conserva generacion'
);

select throws_ok(
  $$
    insert into public.planes_nutricion (coach_id, cliente_id, nombre, activo)
    select coach_id, id, 'duplicado fase0', true
    from public.clientes
    where exists (
      select 1
      from public.planes_nutricion p
      where p.cliente_id = clientes.id
        and p.activo
    )
    limit 1
  $$,
  '23505',
  null,
  'no admite dos planes nutricionales activos'
);

select * from finish();

rollback;
