# Motor Integrado Fase 0 — Integridad Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Cerrar los fallos de integridad del flujo actual para que onboarding, generación, aprobación, aplicación y lectura de fuentes sean autenticados, idempotentes, autorizados, atómicos dentro de las capacidades actuales y observables.

**Architecture:** La Fase 0 conserva el generador y las tablas de negocio actuales, pero añade una envolvente de integridad: una ejecución de generación identificada por clave, planes construidos como borrador y activados al final, autorización coach–cliente centralizada y RPC transaccionales para aplicar cambios. La UI inicia la generación desde el navegador autenticado y muestra estados tipados; las fuentes se clasifican por salud y frescura sin interpretar ausencia de sincronización como inactividad.

**Tech Stack:** Next.js 16.2.4 Route Handlers, React 19.2.4, TypeScript 5, Supabase/PostgreSQL, `@supabase/ssr`, `@supabase/supabase-js`, scripts de prueba con `tsx` y `node:assert/strict`.

**Spec:** `docs/superpowers/specs/2026-09-30-motor-inicial-recalculo-integrado-design.md`

## Global Constraints

- Alcance exclusivo: Fase 0 de la especificación; no crear perfil versionado, señal canónica, motor de confianza, snapshots, rollback, base científica ni recálculo integral de Fases 1–9.
- La aprobación del coach es obligatoria para todos los cambios; eliminar el camino actual `requiere_aprobacion:false → aplicarTarea()`.
- No confiar en ningún `cliente_id`, `tarea_id` o `plan_id` recibido sin verificar la relación coach–cliente.
- Un fallo de autenticación, generación, persistencia, sincronización o aplicación debe conservar el último plan activo y devolver un estado/error tipado visible.
- Nunca desactivar el plan anterior antes de haber construido por completo el sustituto.
- Como máximo puede existir un plan activo por `(cliente_id, dominio)`; los duplicados históricos se desactivan conservando el registro más reciente, nunca se borran.
- No exponer `access_token`, `refresh_token`, credenciales Garmin, payloads brutos ni mensajes internos de base de datos en respuestas o logs de cliente.
- Mantener compatibilidad con `planes_nutricion`, `planes_entrenamiento`, `registros_ia`, `agente_tareas`, `integraciones_cliente` y `actividad_externa_cliente`; no crear una segunda fuente de verdad.
- Usar cambios quirúrgicos: no sustituir DeepSeek, no rediseñar planes ni tocar algoritmos nutricionales/de entrenamiento en esta fase.
- Las migraciones se aplican primero en Supabase local y después, con revisión explícita, en remoto; ninguna tarea ejecuta el director sobre clientes reales.
- Fechas visibles en formato español; timestamps persistidos en ISO/`timestamptz` UTC.
- Cada tarea termina con pruebas, lint de los archivos tocados y un commit pequeño; el plan no autoriza `git push` ni despliegue.

## Review Focus

1. **Dos peticiones simultáneas con la misma clave:** solo una obtiene permiso para generar y ambas terminan señalando la misma ejecución/planes; fijado contra PostgreSQL/Supabase local real por `scripts/test-fase0-generacion-concurrente-local.ts` en Task 2 (el mock `test-fase0-generacion-idempotente.ts` prueba únicamente el contrato TypeScript).
2. **Coach autenticado intenta aprobar o aplicar una tarea de otro coach:** recibe `403`, la tarea y el cliente no cambian; fijado por `scripts/test-fase0-ownership.ts` en Task 4.
3. **Fallo en la segunda mutación de una aplicación de entrenamiento:** PostgreSQL revierte plan, sesiones, ejercicios, mensaje y estado de tarea; fijado por `supabase/tests/fase0_aplicacion_atomica.sql` en Task 5.
4. **Integración activa sin `ultima_sync`, con error o desactualizada:** se muestra `sin_datos`, `error` o `desactualizada` y no la etiqueta “actividad baja”; fijado por `scripts/test-fase0-salud-fuentes.ts` en Task 6.
5. **Onboarding guardado pero generación devuelve `401`, `403`, `429` o `500`:** el usuario permanece en onboarding, ve una acción concreta y puede reintentar con la misma clave sin duplicar; fijado por `scripts/test-fase0-onboarding-generation.ts` en Task 3.

---

## File map

- `supabase/migrations/20260930130000_fase0_integridad_motor.sql`: ejecuciones idempotentes, unicidad de planes activos, campos de auditoría de tareas y RPC de activación/aplicación.
- `supabase/tests/fase0_integridad_motor.sql`: invariantes de esquema, deduplicación histórica y reclamación de generaciones.
- `supabase/tests/fase0_aplicacion_atomica.sql`: rollback transaccional y precondiciones de aplicación.
- `lib/auth/autorizar-coach-cliente.ts`: única comprobación server-side de propiedad coach–cliente.
- `lib/planes/generacion-inicial.ts`: tipos de ejecución y funciones `reclamar`, `completar` y `fallar` una generación.
- `app/api/generar-plan-inicial/route.ts`: usa autorización dual controlada, claim idempotente, borradores y activación final.
- `app/api/onboarding/completo/route.ts`: guarda onboarding y devuelve la clave inicial; deja de hacer self-fetch sin sesión.
- `app/api/onboarding/perfil/route.ts`: elimina el segundo self-fetch legado y devuelve el mismo contrato.
- `app/onboarding/page.tsx`: llama al generador con cookies, interpreta estados y muestra reintento.
- `app/api/aprobar-cliente/route.ts`: valida propiedad y planes activos antes de activar al cliente.
- `app/api/agentes/tareas/route.ts`: lista y decide solo tareas de clientes propios; espera el resultado de aplicación.
- `lib/agentes/executor.ts`: todas las tareas nacen pendientes; no autoaplica.
- `lib/agentes/aplicar.ts`: preflight completo y RPC atómicas; nunca marca aplicado tras una mutación parcial.
- `lib/integraciones/salud-fuente.ts`: estado operativo determinista por fuente.
- `lib/actividad/coach-insights.ts`: devuelve salud por fuente y bloquea falsos flags de inactividad.
- `components/clientes/ActividadClientePanel.tsx`: muestra error de carga/sync, frescura, estado y acción concreta.
- `app/api/cliente/[codigo]/integraciones/route.ts`: añade estado/frescura sin exponer secretos.
- `components/PortalCliente/IntegracionesPanel.tsx`: presenta el mismo estado al cliente.
- `scripts/test-fase0-*.ts`: pruebas unitarias/contrato sin tocar producción.
- `scripts/test-fase0-generacion-concurrente-local.ts`: prueba de carrera real contra Supabase local; se niega a ejecutar contra hosts remotos.

### Task 1: Añadir invariantes de base de datos y registro idempotente

**Files:**
- Create: `supabase/tests/fase0_integridad_motor.sql`
- Create: `supabase/migrations/20260930130000_fase0_integridad_motor.sql`

**Interfaces:**
- Consumes: tablas existentes `clientes`, `planes_nutricion`, `planes_entrenamiento`, `agente_tareas`.
- Produces: `generaciones_plan_inicial`, `claim_generacion_plan_inicial(uuid,text,uuid)`, `activar_planes_generacion(uuid,uuid,uuid)`, índices `uq_plan_nutricion_activo_cliente` y `uq_plan_entrenamiento_activo_cliente`.

- [ ] **Step 1: Escribir la prueba SQL fallida de invariantes**

Crear `supabase/tests/fase0_integridad_motor.sql` con una transacción que compruebe que existe la tabla, que dos claims con la misma clave devuelven la misma ejecución y que los índices parciales rechazan dos planes activos. La prueba debe usar clientes/planes temporales y terminar siempre con `rollback`:

```sql
begin;
select plan(7);

select has_table('public', 'generaciones_plan_inicial');
select has_function('public', 'claim_generacion_plan_inicial', array['uuid','text','uuid']);
select has_function('public', 'activar_planes_generacion', array['uuid','uuid','uuid']);
select has_index('public', 'planes_nutricion', 'uq_plan_nutricion_activo_cliente');
select has_index('public', 'planes_entrenamiento', 'uq_plan_entrenamiento_activo_cliente');

with c as (
  select id, coach_id from clientes order by created_at limit 1
), a as (
  select * from claim_generacion_plan_inicial((select id from c), 'fase0:test:misma-clave', (select coach_id from c))
), b as (
  select * from claim_generacion_plan_inicial((select id from c), 'fase0:test:misma-clave', (select coach_id from c))
)
select is((select generacion_id from a), (select generacion_id from b), 'misma clave conserva generacion');

select throws_ok(
  $$insert into planes_nutricion (coach_id, cliente_id, nombre, activo)
    select coach_id, id, 'duplicado fase0', true from clientes
    where exists (select 1 from planes_nutricion p where p.cliente_id = clientes.id and p.activo)
    limit 1$$,
  '23505', null, 'no admite dos planes nutricionales activos'
);

select * from finish();
rollback;
```

- [ ] **Step 2: Ejecutar la prueba y confirmar el fallo**

Run: `supabase test db supabase/tests/fase0_integridad_motor.sql`

Expected: FAIL indicando que `generaciones_plan_inicial`, las funciones y los índices aún no existen.

- [ ] **Step 3: Crear el esquema mínimo de ejecución e integridad**

En `supabase/migrations/20260930130000_fase0_integridad_motor.sql`, crear:

```sql
create table public.generaciones_plan_inicial (
  id uuid primary key default gen_random_uuid(),
  cliente_id uuid not null references public.clientes(id) on delete cascade,
  clave_idempotencia text not null,
  solicitada_por uuid not null references auth.users(id),
  estado text not null default 'procesando'
    check (estado in ('procesando','completada','fallida')),
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

alter table public.planes_nutricion
  add column if not exists generacion_inicial_id uuid references public.generaciones_plan_inicial(id) on delete set null;
alter table public.planes_entrenamiento
  add column if not exists generacion_inicial_id uuid references public.generaciones_plan_inicial(id) on delete set null;

alter table public.agente_tareas
  add column if not exists revisado_por uuid references auth.users(id),
  add column if not exists error_aplicacion text,
  add column if not exists aplicacion_intentos integer not null default 0;
```

Antes de crear los índices, conservar el plan activo más reciente y desactivar los anteriores:

```sql
with ranked as (
  select id, row_number() over (partition by cliente_id order by created_at desc, id desc) as rn
  from public.planes_nutricion where activo
)
update public.planes_nutricion p set activo = false
from ranked r where p.id = r.id and r.rn > 1;

with ranked as (
  select id, row_number() over (partition by cliente_id order by created_at desc, id desc) as rn
  from public.planes_entrenamiento where activo
)
update public.planes_entrenamiento p set activo = false
from ranked r where p.id = r.id and r.rn > 1;

create unique index uq_plan_nutricion_activo_cliente
  on public.planes_nutricion(cliente_id) where activo;
create unique index uq_plan_entrenamiento_activo_cliente
  on public.planes_entrenamiento(cliente_id) where activo;
create unique index uq_plan_nutricion_generacion
  on public.planes_nutricion(generacion_inicial_id) where generacion_inicial_id is not null;
create unique index uq_plan_entrenamiento_generacion
  on public.planes_entrenamiento(generacion_inicial_id) where generacion_inicial_id is not null;
```

- [ ] **Step 4: Implementar claim y activación atómicos**

Añadir funciones `security definer`, `set search_path = public`, revocadas a `anon/authenticated`. `claim_generacion_plan_inicial` debe insertar con `on conflict do nothing`, bloquear la fila `for update` y devolver `accion='generar'` solo para fila nueva, fallida o `procesando` con `updated_at < now() - interval '5 minutes'`; devolver `accion='esperar'` para ejecución reciente y `accion='reutilizar'` para completada. `activar_planes_generacion` debe validar que ambos planes pertenecen al cliente y a la generación, desactivar los activos anteriores, activar ambos borradores y marcar la generación completada en una sola transacción PostgreSQL.

Firma exacta:

```sql
returns table (
  generacion_id uuid,
  accion text,
  estado text,
  plan_nutricion_id uuid,
  plan_entrenamiento_id uuid,
  error_codigo text,
  error_mensaje text
)
```

La activación debe abortar con `raise exception using errcode = 'P0001'` si falta cualquiera de los dos borradores; no se desactiva ningún plan previo en ese caso.

- [ ] **Step 5: Resetear Supabase local y pasar la prueba**

Run: `supabase db reset && supabase test db supabase/tests/fase0_integridad_motor.sql`

Expected: migraciones aplicadas; `1..7`, siete checks `ok`, cero `not ok`.

- [ ] **Step 6: Verificar que no quedan activos duplicados**

Run:

```bash
psql 'postgresql://postgres:postgres@127.0.0.1:54322/postgres' -c "select 'nutricion' dominio, cliente_id, count(*) from planes_nutricion where activo group by cliente_id having count(*) > 1 union all select 'entrenamiento', cliente_id, count(*) from planes_entrenamiento where activo group by cliente_id having count(*) > 1;"
```

Expected: `0 rows`.

- [ ] **Step 7: Commit**

```bash
git add supabase/migrations/20260930130000_fase0_integridad_motor.sql supabase/tests/fase0_integridad_motor.sql
git commit -m "fix: enforce plan generation integrity"
```

### Task 2: Hacer idempotente y recuperable la generación inicial

**Files:**
- Create: `lib/planes/generacion-inicial.ts`
- Create: `scripts/test-fase0-generacion-idempotente.ts`
- Create: `scripts/test-fase0-generacion-concurrente-local.ts`
- Modify: `app/api/generar-plan-inicial/route.ts:169-253,255-344,1137-1375`

**Interfaces:**
- Consumes: RPC `claim_generacion_plan_inicial` y `activar_planes_generacion` de Task 1.
- Produces: `GenerationClaim`, `reclamarGeneracionInicial(db,input)`, `marcarGeneracionFallida(db,input)` y respuesta HTTP `GeneracionInicialResponse`.

- [ ] **Step 1: Escribir la prueba unitaria fallida del contrato de claim**

Crear `scripts/test-fase0-generacion-idempotente.ts` con un cliente Supabase falso que devuelva consecutivamente `generar`, `esperar` y `reutilizar`. Afirmar:

```ts
assert.deepEqual(await reclamarGeneracionInicial(db, input), {
  generacionId: 'gen-1', accion: 'generar', estado: 'procesando',
  planNutricionId: null, planEntrenamientoId: null, error: null,
})
assert.equal((await reclamarGeneracionInicial(db, input)).accion, 'esperar')
assert.equal((await reclamarGeneracionInicial(db, input)).accion, 'reutilizar')
assert.deepEqual(calls[0], {
  name: 'claim_generacion_plan_inicial',
  args: { p_cliente_id: 'cliente-1', p_clave: 'onboarding:cliente-1', p_actor_id: 'user-1' },
})
```

- [ ] **Step 2: Ejecutar la prueba y confirmar el fallo**

Run: `npx tsx scripts/test-fase0-generacion-idempotente.ts`

Expected: FAIL `Cannot find module '../lib/planes/generacion-inicial'`.

- [ ] **Step 3: Implementar el adaptador tipado de generación**

Crear `lib/planes/generacion-inicial.ts` con:

```ts
export type GenerationAction = 'generar' | 'esperar' | 'reutilizar'

export interface GenerationClaim {
  generacionId: string
  accion: GenerationAction
  estado: 'procesando' | 'completada' | 'fallida'
  planNutricionId: string | null
  planEntrenamientoId: string | null
  error: { codigo: string | null; mensaje: string } | null
}

export interface GeneracionInicialResponse {
  ok: boolean
  generacion_id: string
  estado: 'procesando' | 'completada' | 'fallida'
  reutilizada: boolean
  plan_nutricion_id?: string | null
  plan_entrenamiento_id?: string | null
  error?: { codigo: string; mensaje: string; accion: string }
}
```

`marcarGeneracionFallida` actualizará exclusivamente `estado`, `error_codigo`, `error_mensaje` sanitizado a 500 caracteres y `updated_at`; no incluirá stack ni payloads.

- [ ] **Step 4: Ejecutar la prueba del adaptador**

Run: `npx tsx scripts/test-fase0-generacion-idempotente.ts`

Expected: `fase0 generation idempotency tests passed`.

- [ ] **Step 5: Integrar claim y autorización dual acotada en el route handler**

En `POST`, parsear `{ cliente_id, idempotency_key, origen }`, exigir una clave de 8–160 caracteres y cargar `clientes.id,coach_id,profile_id`. Autorizar:

```ts
const esCoachPropietario = cliente.coach_id === user.id
const esClienteInicial = cliente.profile_id === user.id
  && origen === 'onboarding'
  && idempotency_key === `onboarding:${cliente.id}`
if (!esCoachPropietario && !esClienteInicial) {
  return NextResponse.json({ error: { codigo: 'FORBIDDEN_CLIENT', mensaje: 'No puedes generar el plan de este cliente.' } }, { status: 403 })
}
```

Ejecutar el claim antes de DeepSeek. Para `esperar`, devolver `202`; para `reutilizar`, devolver `200` con los IDs existentes; solo `generar` continúa.

- [ ] **Step 6: Construir ambos planes como borradores**

En nutrición, eliminar la desactivación anticipada de `planes_nutricion:1147-1154`, insertar el nuevo plan con `activo:false` y `generacion_inicial_id:claim.generacionId`. Cambiar cada `continue` por `throw new Error` cuando falle una comida o no exista receta candidata; si falla `aplicarRecetaAComida`, propagar el error.

En `crearPlanEntrenoDesdePlantilla`, eliminar la desactivación de `planes_entrenamiento:189-197`, aceptar `generacionId`, insertar con `activo:false` y `generacion_inicial_id`. Mantener la limpieza del borrador si falla una sesión/ejercicio.

- [ ] **Step 7: Activar solo tras construir dieta y entrenamiento completos**

Después de obtener ambos IDs, llamar:

```ts
const { error: activationError } = await supabase.rpc('activar_planes_generacion', {
  p_generacion_id: claim.generacionId,
  p_plan_nutricion_id: planId,
  p_plan_entrenamiento_id: planEntrenoId,
})
if (activationError) throw new Error(`ACTIVATION_FAILED:${activationError.message}`)
```

En el `catch` superior, borrar únicamente borradores de esa generación, llamar `marcarGeneracionFallida` y responder `500` con `codigo:'GENERATION_FAILED'`, mensaje seguro y acción “Reintenta; tu plan anterior sigue activo”. No insertar `registros_ia` ni marcar `revisado_por_coach=false` hasta después de la activación.

- [ ] **Step 8: Crear una prueba de concurrencia real exclusiva para Supabase local**

Crear `scripts/test-fase0-generacion-concurrente-local.ts`. Esta prueba no sustituye al mock unitario: abre dos llamadas RPC reales y simultáneas contra la misma base PostgreSQL local. Debe abortar antes de crear el cliente Supabase si falta una variable o si la URL no apunta a loopback:

```ts
import assert from 'node:assert/strict'
import { createClient } from '@supabase/supabase-js'

const url = process.env.SUPABASE_LOCAL_URL
const serviceKey = process.env.SUPABASE_LOCAL_SERVICE_ROLE_KEY
assert.ok(url, 'SUPABASE_LOCAL_URL requerida')
assert.ok(serviceKey, 'SUPABASE_LOCAL_SERVICE_ROLE_KEY requerida')

const parsed = new URL(url)
assert.ok(
  parsed.hostname === '127.0.0.1' || parsed.hostname === 'localhost',
  `Prueba bloqueada: solo admite Supabase local, recibido ${parsed.hostname}`,
)

const dbA = createClient(url, serviceKey, { auth: { persistSession: false } })
const dbB = createClient(url, serviceKey, { auth: { persistSession: false } })

const { data: cliente, error: clienteError } = await dbA
  .from('clientes')
  .select('id, coach_id')
  .not('coach_id', 'is', null)
  .order('created_at')
  .limit(1)
  .single()
assert.ifError(clienteError)
assert.ok(cliente?.id && cliente.coach_id, 'El seed local necesita un cliente con coach')

const clave = `fase0:concurrencia:${crypto.randomUUID()}`
const args = {
  p_cliente_id: cliente.id,
  p_clave: clave,
  p_actor_id: cliente.coach_id,
}

const [a, b] = await Promise.all([
  dbA.rpc('claim_generacion_plan_inicial', args),
  dbB.rpc('claim_generacion_plan_inicial', args),
])
assert.ifError(a.error)
assert.ifError(b.error)

const resultados = [a.data?.[0], b.data?.[0]]
assert.ok(resultados.every(Boolean))
assert.equal(new Set(resultados.map(r => r.generacion_id)).size, 1)
assert.equal(resultados.filter(r => r.accion === 'generar').length, 1)
assert.equal(resultados.filter(r => r.accion === 'esperar').length, 1)

const generacionId = resultados[0].generacion_id
const { error: cleanupError } = await dbA
  .from('generaciones_plan_inicial')
  .delete()
  .eq('id', generacionId)
assert.ifError(cleanupError)

console.log('fase0 local concurrent generation test passed')
```

La clave contiene un UUID para no colisionar con otras pruebas. La limpieza borra solo la fila creada por este script y únicamente después de las aserciones.

- [ ] **Step 9: Ejecutar primero el mock de contrato**

Run: `npx tsx scripts/test-fase0-generacion-idempotente.ts`

Expected: `fase0 generation idempotency tests passed`. Este resultado demuestra mapeo de argumentos/respuestas, no serialización concurrente en base de datos.

- [ ] **Step 10: Ejecutar la carrera real contra Supabase local**

Run:

```bash
eval "$(supabase status -o env)"
SUPABASE_LOCAL_URL="$API_URL" SUPABASE_LOCAL_SERVICE_ROLE_KEY="$SERVICE_ROLE_KEY" npx tsx scripts/test-fase0-generacion-concurrente-local.ts
```

Expected: `fase0 local concurrent generation test passed`; las dos RPC devuelven el mismo `generacion_id`, exactamente una devuelve `accion='generar'` y exactamente una `accion='esperar'`. Si `API_URL` no es loopback, el script aborta sin hacer ninguna llamada.

- [ ] **Step 11: Ejecutar lint**

Run: `npx eslint lib/planes/generacion-inicial.ts app/api/generar-plan-inicial/route.ts scripts/test-fase0-generacion-idempotente.ts scripts/test-fase0-generacion-concurrente-local.ts`

Expected: ESLint sin errores.

- [ ] **Step 12: Commit**

```bash
git add lib/planes/generacion-inicial.ts app/api/generar-plan-inicial/route.ts scripts/test-fase0-generacion-idempotente.ts scripts/test-fase0-generacion-concurrente-local.ts
git commit -m "fix: make initial plan generation idempotent"
```

### Task 3: Sustituir el self-fetch 401 por un flujo autenticado y visible

**Files:**
- Create: `lib/planes/generation-client.ts`
- Create: `scripts/test-fase0-onboarding-generation.ts`
- Modify: `app/api/onboarding/completo/route.ts:119-133`
- Modify: `app/api/onboarding/perfil/route.ts:105-119`
- Modify: `app/onboarding/page.tsx:119-259`

**Interfaces:**
- Consumes: `GeneracionInicialResponse` de Task 2.
- Produces: `generarPlanInicialDesdeCliente(input): Promise<GeneracionInicialResponse>` y respuesta onboarding `{ cliente_id, generation: { idempotency_key, estado:'pendiente' } }`.

- [ ] **Step 1: Escribir la prueba fallida del cliente HTTP**

Crear `scripts/test-fase0-onboarding-generation.ts`; inyectar un `fetchImpl` falso y verificar que se usa `credentials:'include'`, la clave se conserva en el reintento y los estados se traducen así:

```ts
assert.equal(error401.codigo, 'AUTH_EXPIRED')
assert.equal(error401.accion, 'Vuelve a iniciar sesión y reintenta.')
assert.equal(error429.codigo, 'RATE_LIMITED')
assert.equal(error500.accion, 'Reintenta; tu plan anterior sigue activo.')
assert.equal(requests[0].body, requests[1].body)
```

- [ ] **Step 2: Ejecutar la prueba y confirmar el fallo**

Run: `npx tsx scripts/test-fase0-onboarding-generation.ts`

Expected: FAIL por módulo inexistente.

- [ ] **Step 3: Implementar el cliente tipado**

Crear `lib/planes/generation-client.ts` con una función que haga POST a `/api/generar-plan-inicial`, incluya `credentials:'include'`, `origen:'onboarding'` y no convierta errores HTTP en éxito. Mapear 401, 403, 429 y 5xx a `GenerationClientError { codigo, mensaje, accion, retryable }`; aceptar `fetchImpl` opcional para la prueba.

- [ ] **Step 4: Eliminar ambos self-fetch sin cookies**

En los dos endpoints de onboarding eliminar `NEXT_PUBLIC_APP_URL` y el `fetch` no esperado que llama a `/api/generar-plan-inicial` y silencia su rechazo con `.catch`. Tras guardar con éxito, devolver exactamente:

```ts
return NextResponse.json({
  cliente_id: cliente.id,
  generation: {
    idempotency_key: `onboarding:${cliente.id}`,
    estado: 'pendiente' as const,
  },
})
```

- [ ] **Step 5: Hacer visible la generación en onboarding**

En `handleSubmit`, después del POST de onboarding, llamar `generarPlanInicialDesdeCliente`. Solo redirigir si devuelve `completada` o `procesando`; para `procesando`, redirigir con `?onboarding=completo&generacion=procesando`. En error, mantener el formulario y mostrar debajo del mensaje un botón “Reintentar creación del plan” que reutiliza `generation.idempotency_key`. El texto debe diferenciar sesión caducada, límite temporal y fallo recuperable.

- [ ] **Step 6: Ejecutar prueba y lint**

Run: `npx tsx scripts/test-fase0-onboarding-generation.ts && npx eslint lib/planes/generation-client.ts app/api/onboarding/completo/route.ts app/api/onboarding/perfil/route.ts app/onboarding/page.tsx`

Expected: `fase0 onboarding generation tests passed`; ESLint sin errores.

- [ ] **Step 7: Commit**

```bash
git add lib/planes/generation-client.ts scripts/test-fase0-onboarding-generation.ts app/api/onboarding/completo/route.ts app/api/onboarding/perfil/route.ts app/onboarding/page.tsx
git commit -m "fix: surface authenticated onboarding generation"
```

### Task 4: Centralizar ownership y exigirlo al aprobar o aplicar

**Files:**
- Create: `lib/auth/autorizar-coach-cliente.ts`
- Create: `scripts/test-fase0-ownership.ts`
- Modify: `app/api/aprobar-cliente/route.ts:5-47`
- Modify: `app/api/agentes/tareas/route.ts:15-125`
- Modify: `app/api/generar-plan-inicial/route.ts:269-282`
- Modify: `app/clientes/[id]/revisar-plan/page.tsx:333-346`

**Interfaces:**
- Consumes: usuario autenticado y tabla `clientes` vía service client.
- Produces: `autorizarCoachCliente(db,{userId,clienteId}): Promise<CoachClienteAuthorization>`.

- [ ] **Step 1: Escribir la prueba fallida de autorización**

Crear `scripts/test-fase0-ownership.ts` con un builder Supabase falso y estos casos: propietario → `{ok:true,cliente}`, coach ajeno → `{ok:false,status:403,codigo:'CLIENT_NOT_OWNED'}`, cliente inexistente → `404`, error de BD → `500`. Añadir una prueba estática que confirme que `aprobar-cliente` y `agentes/tareas` importan el helper antes de mutar.

- [ ] **Step 2: Ejecutar la prueba y confirmar el fallo**

Run: `npx tsx scripts/test-fase0-ownership.ts`

Expected: FAIL por helper inexistente.

- [ ] **Step 3: Implementar el helper común**

```ts
export type CoachClienteAuthorization =
  | { ok: true; cliente: { id: string; coach_id: string; profile_id: string | null } }
  | { ok: false; status: 403 | 404 | 500; codigo: 'CLIENT_NOT_OWNED' | 'CLIENT_NOT_FOUND' | 'AUTH_LOOKUP_FAILED'; mensaje: string }

export async function autorizarCoachCliente(
  db: SupabaseClient,
  input: { userId: string; clienteId: string },
): Promise<CoachClienteAuthorization>
```

La consulta selecciona `id,coach_id,profile_id`; nunca toma el rol del body.

- [ ] **Step 4: Proteger aprobación de cliente y exigir planes activos**

En `aprobar-cliente`, autenticar, autorizar con el helper y consultar un plan activo de cada dominio. Si falta alguno devolver `409` con `codigo:'ACTIVE_PLANS_REQUIRED'`; solo entonces actualizar `clientes`. Comprobar `error` y `count` de la actualización. El correo sigue siendo no bloqueante, pero su fallo se registra como warning y la respuesta incluye `warnings:['WELCOME_EMAIL_FAILED']` sin email ni stack.

- [ ] **Step 5: Proteger lectura y decisión de tareas**

En GET de `agentes/tareas`, usar `clientes!inner(coach_id)` y `.eq('clientes.coach_id', user.id)`. En PATCH, cargar primero `tarea_id,cliente_id,estado` sin mutar; rechazar tareas sin cliente (`409`) y autorizar ownership. Rechazar transición desde `aplicado/rechazado` con `409`. Guardar `revisado_por:user.id`.

Para aprobado/modificado, esperar `await aplicarTarea(tarea)`; si `ok:false`, conservar `estado:'aprobado'|'modificado'`, persistir `error_aplicacion` y devolver `409`. No usar fire-and-forget.

- [ ] **Step 6: Reutilizar el helper en generación coach**

Sustituir la comparación manual de `generar-plan-inicial` para el caso coach por `autorizarCoachCliente`; mantener exclusivamente la excepción acotada del propio cliente durante onboarding definida en Task 2.

- [ ] **Step 7: Mostrar fallo de aprobación en revisar-plan**

En `aprobar`, leer `res.ok` y JSON; si falla, no navegar y mostrar `errorAprobacion` con la acción devuelta. Añadir `finally { setAprobando(false) }`.

- [ ] **Step 8: Ejecutar pruebas y lint**

Run: `npx tsx scripts/test-fase0-ownership.ts && npx eslint lib/auth/autorizar-coach-cliente.ts app/api/aprobar-cliente/route.ts app/api/agentes/tareas/route.ts app/api/generar-plan-inicial/route.ts 'app/clientes/[id]/revisar-plan/page.tsx'`

Expected: `fase0 ownership tests passed`; ESLint sin errores.

- [ ] **Step 9: Commit**

```bash
git add lib/auth/autorizar-coach-cliente.ts scripts/test-fase0-ownership.ts app/api/aprobar-cliente/route.ts app/api/agentes/tareas/route.ts app/api/generar-plan-inicial/route.ts 'app/clientes/[id]/revisar-plan/page.tsx'
git commit -m "fix: enforce coach client ownership"
```

### Task 5: Aplicar recomendaciones de forma atómica y nunca sin plan activo

**Files:**
- Create: `supabase/tests/fase0_aplicacion_atomica.sql`
- Modify: `supabase/migrations/20260930130000_fase0_integridad_motor.sql`
- Modify: `lib/agentes/aplicar.ts:267-528`
- Modify: `lib/agentes/executor.ts:264-306`
- Modify: `scripts/test-agentes-aplicar-training.ts:1-85`

**Interfaces:**
- Consumes: tareas en estado `aprobado|modificado`, un único plan activo y updates seguros ya calculados.
- Produces: RPC `aplicar_ajuste_macros_seguro(uuid,uuid,jsonb)` y `aplicar_actualizacion_entreno_segura(uuid,uuid,uuid,jsonb,jsonb,jsonb,text)`; `AplicarTareaResult` tipado.

- [ ] **Step 1: Escribir la prueba SQL fallida de atomicidad**

Crear `supabase/tests/fase0_aplicacion_atomica.sql`. Dentro de `begin/rollback`, preparar cliente, plan, tarea aprobada, sesión y ejercicio. Comprobar: sin plan activo lanza `P0001`; tarea pendiente lanza; una sesión que no pertenece al plan lanza; tras cada excepción plan/tarea no cambian; el caso válido actualiza plan/sesión/ejercicio y tarea a `aplicado`.

- [ ] **Step 2: Ejecutar y confirmar el fallo**

Run: `supabase test db supabase/tests/fase0_aplicacion_atomica.sql`

Expected: FAIL porque las RPC aún no existen.

- [ ] **Step 3: Implementar RPC transaccional de macros**

La función debe bloquear la tarea y el único plan activo `for update`, validar estado y aplicar solo las claves permitidas:

```sql
update public.planes_nutricion set
  kcal_objetivo = coalesce((p_campos->>'kcal_objetivo')::numeric, kcal_objetivo),
  proteinas_objetivo = coalesce((p_campos->>'proteinas_objetivo')::numeric, proteinas_objetivo),
  carbohidratos_objetivo = coalesce((p_campos->>'carbohidratos_objetivo')::numeric, carbohidratos_objetivo),
  grasas_objetivo = coalesce((p_campos->>'grasas_objetivo')::numeric, grasas_objetivo)
where id = v_plan_id;
```

Después marca aplicado y limpia `error_aplicacion`; cualquier `raise` revierte todo.

- [ ] **Step 4: Implementar RPC transaccional de entrenamiento**

Validar previamente con `jsonb_array_elements` que todos los IDs de sesión pertenecen a `p_plan_id` y que todos los ejercicios pertenecen a esas sesiones. Solo tras validar todos, actualizar plan, sesiones y ejercicios, insertar `chat_mensajes` si `p_mensaje` no es null y marcar la tarea aplicada. Un ID ajeno debe lanzar antes de la primera escritura.

- [ ] **Step 5: Endurecer el resultado de aplicación en TypeScript**

Definir y usar:

```ts
export type AplicarTareaResult =
  | { ok: true; codigo: 'APPLIED' | 'NO_MUTATION'; mensaje: string }
  | { ok: false; codigo: 'NO_CLIENT' | 'NO_ACTIVE_PLAN' | 'TASK_NOT_APPROVED' | 'UNMATCHED_TARGET' | 'DB_ERROR'; mensaje: string }
```

`aplicarAjusteMacros` debe llamar una sola RPC. `aplicarActualizacionPlan` realiza todas las lecturas/preflight, rechaza si no hay plan incluso si solo existe `mensaje_cliente`, rechaza si `noAplicados.length > 0` y llama una sola RPC con los arrays completos. Eliminar todos los `.update()`/`.insert()` secuenciales de aplicación.

- [ ] **Step 6: Eliminar autoaplicación sin coach**

En `guardarTareaAgente`, persistir siempre `estado:'pendiente'` y eliminar el bloque que comprueba `!resultado.requiere_aprobacion` para llamar a `aplicarTarea(tarea)`. Conservar `requiere_aprobacion` en el payload si hace falta para explicar prioridad, nunca para autorizar.

- [ ] **Step 7: Ampliar el test TypeScript existente**

En `scripts/test-agentes-aplicar-training.ts`, añadir preflight con plan ausente, target no encontrado y payload vacío. Verificar códigos `NO_ACTIVE_PLAN`, `UNMATCHED_TARGET`, `NO_MUTATION`; mantener los asserts existentes de sanitización.

- [ ] **Step 8: Ejecutar SQL, tests y lint**

Run: `supabase db reset && supabase test db supabase/tests/fase0_integridad_motor.sql supabase/tests/fase0_aplicacion_atomica.sql && npx tsx scripts/test-agentes-aplicar-training.ts && npx eslint lib/agentes/aplicar.ts lib/agentes/executor.ts`

Expected: todas las pruebas SQL `ok`; `agentes aplicar training tests passed`; ESLint limpio.

- [ ] **Step 9: Commit**

```bash
git add supabase/migrations/20260930130000_fase0_integridad_motor.sql supabase/tests/fase0_aplicacion_atomica.sql lib/agentes/aplicar.ts lib/agentes/executor.ts scripts/test-agentes-aplicar-training.ts
git commit -m "fix: apply approved plan changes atomically"
```

### Task 6: Exponer salud y errores de Garmin/Strava sin falsos positivos

**Files:**
- Create: `lib/integraciones/salud-fuente.ts`
- Create: `scripts/test-fase0-salud-fuentes.ts`
- Modify: `lib/actividad/coach-insights.ts:3-44,98-125,185-233`
- Modify: `components/clientes/ActividadClientePanel.tsx:68-81,112-145,163-213,248-252`
- Modify: `app/api/cliente/[codigo]/integraciones/route.ts:13-129`
- Modify: `components/PortalCliente/IntegracionesPanel.tsx:180-232,647-692`

**Interfaces:**
- Consumes: `activa`, `ultima_sync`, `error_ultimo`, última fecha con datos y reloj inyectable.
- Produces: `SaludFuente` y `evaluarSaludFuente(input): SaludFuente`.

- [ ] **Step 1: Escribir la prueba fallida de clasificación**

Crear `scripts/test-fase0-salud-fuentes.ts` con reloj fijo `2026-09-30T12:00:00Z` y asserts para `desconectada`, `sin_datos`, `saludable` (≤48 h), `retrasada` (>48 h y ≤168 h), `desactualizada` (>168 h) y `error` (prioridad sobre frescura). Comprobar que `calcularFlagsActividad` no emite `actividad_baja` cuando todas las fuentes están `error|sin_datos|desactualizada`.

- [ ] **Step 2: Ejecutar y confirmar el fallo**

Run: `npx tsx scripts/test-fase0-salud-fuentes.ts`

Expected: FAIL por módulo inexistente.

- [ ] **Step 3: Implementar el estado operativo determinista**

```ts
export type EstadoSaludFuente = 'desconectada' | 'sin_datos' | 'saludable' | 'retrasada' | 'desactualizada' | 'error'

export interface SaludFuente {
  estado: EstadoSaludFuente
  ultimaRecepcion: string | null
  antiguedadHoras: number | null
  puedeInterpretarAusencia: boolean
  mensaje: string
  accion: string | null
}
```

Umbrales operativos explícitos: saludable hasta 48 h, retrasada hasta 168 h, desactualizada después. `puedeInterpretarAusencia` solo es `true` para `saludable|retrasada`; documentar que son umbrales de operación, no clínicos.

- [ ] **Step 4: Incluir salud por fuente en API coach y flags**

Cambiar `ActividadCoachData.integraciones` a un tipo que incluya `salud`. Calcular la última recepción como el máximo de `ultima_sync` y última fila de actividad del proveedor. En `calcularFlagsActividad`, producir `sync_inactiva` por cada fuente degradada, incluir su acción y no producir `actividad_baja` cuando `puedeInterpretarAusencia` sea falso para todas las fuentes conectadas.

- [ ] **Step 5: Mostrar errores de carga y sincronización al coach**

En `ActividadClientePanel`, añadir `errorCarga` y `errorSync`; si `fetch` no es ok, leer `{error}` y mostrar card roja con botón “Reintentar”. En `syncNow`, comprobar el status y el array `errores`; no recargar como si hubiera éxito. Los chips mostrarán estado, antigüedad, `error_ultimo` sanitizado y la acción de recuperación.

- [ ] **Step 6: Compartir salud con el portal cliente**

En el endpoint público por código, añadir `salud` a cada integración/resumen usando el helper; no devolver tokens ni `raw_data`. En `IntegracionesPanel`, mostrar “Conectado”, “Retrasado”, “Desactualizado”, “Sin datos” o “Error”, con la acción. Un Strava activo sin actividad reciente no se presenta como “sin entrenos” sin añadir el estado de sync.

- [ ] **Step 7: Ejecutar prueba y lint**

Run: `npx tsx scripts/test-fase0-salud-fuentes.ts && npx eslint lib/integraciones/salud-fuente.ts lib/actividad/coach-insights.ts components/clientes/ActividadClientePanel.tsx 'app/api/cliente/[codigo]/integraciones/route.ts' components/PortalCliente/IntegracionesPanel.tsx`

Expected: `fase0 source health tests passed`; ESLint sin errores.

- [ ] **Step 8: Commit**

```bash
git add lib/integraciones/salud-fuente.ts scripts/test-fase0-salud-fuentes.ts lib/actividad/coach-insights.ts components/clientes/ActividadClientePanel.tsx 'app/api/cliente/[codigo]/integraciones/route.ts' components/PortalCliente/IntegracionesPanel.tsx
git commit -m "fix: expose integration health and failures"
```

### Task 7: Cerrar la regresión completa de Fase 0

**Files:**
- Create: `scripts/test-fase0-integridad-static.ts`
- Modify: `scripts/test-flujo-completo.ts:289-305`

**Interfaces:**
- Consumes: todos los contratos de Tasks 1–6.
- Produces: una puerta local reproducible previa a revisión/despliegue.

- [ ] **Step 1: Escribir el test estático de invariantes**

Crear `scripts/test-fase0-integridad-static.ts` que lea los handlers reales y afirme:

```ts
assert.doesNotMatch(onboardingCompleto, /NEXT_PUBLIC_APP_URL[\s\S]*generar-plan-inicial/)
assert.doesNotMatch(onboardingPerfil, /NEXT_PUBLIC_APP_URL[\s\S]*generar-plan-inicial/)
assert.match(generador, /claim_generacion_plan_inicial/)
assert.match(generador, /activo:\s*false/)
assert.match(generador, /activar_planes_generacion/)
assert.doesNotMatch(executor, /if\s*\(!resultado\.requiere_aprobacion\)[\s\S]*aplicarTarea/)
assert.match(tareasRoute, /autorizarCoachCliente/)
assert.match(aprobarRoute, /ACTIVE_PLANS_REQUIRED/)
```

- [ ] **Step 2: Ejecutar y confirmar que cualquier integración incompleta falla**

Run: `npx tsx scripts/test-fase0-integridad-static.ts`

Expected antes de cerrar Tasks 1–6: al menos un assertion failure; después: `fase0 static integrity tests passed`.

- [ ] **Step 3: Actualizar el flujo completo existente**

En `scripts/test-flujo-completo.ts`, cambiar la comprobación del generador para enviar `idempotency_key:'test-flujo-completo:<cliente_id>'`, esperar respuesta tipada y fallar si no obtiene `estado` o `generacion_id`. Añadir consulta que compruebe máximo un plan activo por dominio.

- [ ] **Step 4: Ejecutar toda la suite específica**

Run:

```bash
supabase db reset
supabase test db supabase/tests/fase0_integridad_motor.sql supabase/tests/fase0_aplicacion_atomica.sql
npx tsx scripts/test-fase0-generacion-idempotente.ts
eval "$(supabase status -o env)"
SUPABASE_LOCAL_URL="$API_URL" SUPABASE_LOCAL_SERVICE_ROLE_KEY="$SERVICE_ROLE_KEY" npx tsx scripts/test-fase0-generacion-concurrente-local.ts
npx tsx scripts/test-fase0-onboarding-generation.ts
npx tsx scripts/test-fase0-ownership.ts
npx tsx scripts/test-agentes-aplicar-training.ts
npx tsx scripts/test-fase0-salud-fuentes.ts
npx tsx scripts/test-fase0-integridad-static.ts
```

Expected: migraciones limpias, todos los TAP checks `ok` y los siete mensajes `tests passed`.

- [ ] **Step 5: Ejecutar verificación global**

Run: `npx tsc --noEmit && npm run lint && npm run build`

Expected: TypeScript con 0 errores; ESLint sin errores nuevos; Next.js build completo con exit code 0.

- [ ] **Step 6: Prueba HTTP local sin mutaciones cruzadas**

Con `npm run dev`, realizar el flujo con un cliente sintético: completar onboarding, repetir dos veces el POST de generación con la misma clave y consultar BD. Expected: ambas respuestas comparten `generacion_id`; un plan activo de nutrición y uno de entrenamiento; cero borradores activos; el plan anterior sigue activo si se fuerza un fallo de receta.

- [ ] **Step 7: Revisar manualmente los cinco fallos de Review Focus**

Registrar en la descripción del commit final las salidas de: concurrencia idempotente, 403 coach ajeno, rollback RPC, fuente desactualizada y error visible de onboarding. No probar con los cuatro clientes activos reales ni ejecutar el director semanal.

- [ ] **Step 8: Commit**

```bash
git add scripts/test-fase0-integridad-static.ts scripts/test-flujo-completo.ts
git commit -m "test: gate motor phase zero integrity"
```

## Definition of done de Fase 0

- El navegador autenticado, no un self-fetch sin cookies, inicia la generación posterior al onboarding.
- Repetir o concurrir una generación con la misma clave no crea un segundo par de planes.
- Un plan anterior permanece activo hasta que dieta y entrenamiento nuevos estén completos.
- La base de datos impide dos planes activos del mismo dominio para un cliente.
- Solo el coach propietario puede listar, aprobar, modificar o aplicar tareas de ese cliente.
- Ninguna tarea se autoaplica por `requiere_aprobacion:false`.
- Macros y actualizaciones de entrenamiento se aplican mediante una única transacción y solo con plan activo.
- Los fallos dejan `error_aplicacion` o una generación `fallida`; no se convierten en éxito silencioso.
- Garmin/Strava muestran conexión, última recepción, frescura, error y acción; una fuente degradada no prueba inactividad.
- Pruebas específicas, TypeScript, lint y build pasan sin ejecutar cambios sobre clientes reales.
