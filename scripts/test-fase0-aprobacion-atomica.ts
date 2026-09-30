import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

async function probarAprobacionPorRpc() {
  const route = await readFile(
    new URL('../app/api/aprobar-cliente/route.ts', import.meta.url),
    'utf8',
  )

  const authIndex = route.indexOf('supabase.auth.getUser()')
  const rpcIndex = route.indexOf(".rpc('aprobar_cliente_atomico'")
  const emailIndex = route.indexOf('sendPlanListoEmail(')

  assert.ok(authIndex >= 0, 'aprobar-cliente debe autenticar la sesión')
  assert.ok(rpcIndex > authIndex, 'aprobar-cliente debe aprobar mediante la RPC después de autenticar')
  assert.ok(emailIndex > rpcIndex, 'el email debe ejecutarse después de confirmar la transacción')
  assert.equal(
    route.includes(".from('planes_nutricion')"),
    false,
    'la ruta no debe comprobar planes fuera de la transacción',
  )
  assert.equal(
    route.includes('.update('),
    false,
    'la ruta no debe activar el cliente fuera de la RPC',
  )
}

async function probarContratoMigracion() {
  const migration = await readFile(
    new URL('../supabase/migrations/20261001110000_aprobar_cliente_atomico.sql', import.meta.url),
    'utf8',
  )

  const nutritionLookupIndex = migration.indexOf('from public.planes_nutricion')
  const trainingLookupIndex = migration.indexOf('from public.planes_entrenamiento')

  assert.match(migration, /create or replace function public\.aprobar_cliente_atomico\s*\(/i)
  assert.match(migration, /from public\.clientes[\s\S]*for update/i)
  assert.match(migration, /if p_actor_id is null or v_coach_id is distinct from p_actor_id/i)
  assert.match(
    migration.slice(nutritionLookupIndex, trainingLookupIndex),
    /and p\.activo[\s\S]*for update/i,
  )
  assert.match(migration.slice(trainingLookupIndex), /and p\.activo[\s\S]*for update/i)
  assert.match(migration, /ACTIVE_PLANS_REQUIRED/)
  assert.match(migration, /update public\.clientes[\s\S]*revisado_por_coach\s*=\s*true/i)
  assert.match(migration, /revoke all on function[\s\S]*from public, anon, authenticated/i)
  assert.match(migration, /grant execute on function[\s\S]*to service_role/i)
}

async function probarConflictoDeEstado() {
  const route = await readFile(
    new URL('../app/api/agentes/tareas/route.ts', import.meta.url),
    'utf8',
  )
  const conditionalUpdateIndex = route.indexOf(".eq('estado', tareaInicial.estado)")
  const afterConditionalUpdate = route.slice(conditionalUpdateIndex)
  const conflictIndex = afterConditionalUpdate.indexOf("updateError?.code === 'PGRST116'")
  const conflictCodeIndex = afterConditionalUpdate.indexOf("'STATE_CONFLICT'")
  const genericErrorIndex = afterConditionalUpdate.indexOf('if (updateError)')

  assert.ok(conditionalUpdateIndex >= 0, 'PATCH debe conservar el compare-and-set por estado')
  assert.ok(conflictIndex >= 0, 'PATCH debe detectar PGRST116 tras el update condicional')
  assert.ok(conflictCodeIndex > conflictIndex, 'PATCH debe devolver STATE_CONFLICT')
  assert.ok(genericErrorIndex > conflictIndex, 'el conflicto debe resolverse antes que el error 500 genérico')
}

async function main() {
  await probarAprobacionPorRpc()
  await probarContratoMigracion()
  await probarConflictoDeEstado()
  console.log('fase0 atomic approval contract tests passed')
}

main().catch(error => {
  console.error(error)
  process.exitCode = 1
})
