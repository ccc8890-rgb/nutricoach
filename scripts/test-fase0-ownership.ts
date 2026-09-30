import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import type { SupabaseClient } from '@supabase/supabase-js'
import { autorizarCoachCliente } from '../lib/auth/autorizar-coach-cliente'

type ClienteRow = {
  id: string
  coach_id: string
  profile_id: string | null
}

type LookupResult = {
  data: ClienteRow | null
  error: { code?: string; message: string } | null
}

function fakeSupabase(result: LookupResult): SupabaseClient {
  const builder = {
    select(columns: string) {
      assert.equal(columns, 'id,coach_id,profile_id')
      return builder
    },
    eq(column: string, value: string) {
      assert.equal(column, 'id')
      assert.equal(value, 'cliente-1')
      return builder
    },
    single: async () => result,
  }

  return {
    from(table: string) {
      assert.equal(table, 'clientes')
      return builder
    },
  } as unknown as SupabaseClient
}

async function probarHelper() {
  const cliente = { id: 'cliente-1', coach_id: 'coach-1', profile_id: 'profile-1' }

  assert.deepEqual(
    await autorizarCoachCliente(fakeSupabase({ data: cliente, error: null }), {
      userId: 'coach-1',
      clienteId: 'cliente-1',
    }),
    { ok: true, cliente },
  )

  assert.deepEqual(
    await autorizarCoachCliente(fakeSupabase({ data: cliente, error: null }), {
      userId: 'coach-ajeno',
      clienteId: 'cliente-1',
    }),
    {
      ok: false,
      status: 403,
      codigo: 'CLIENT_NOT_OWNED',
      mensaje: 'No tienes permiso para gestionar este cliente.',
    },
  )

  assert.deepEqual(
    await autorizarCoachCliente(fakeSupabase({
      data: null,
      error: { code: 'PGRST116', message: 'The result contains 0 rows' },
    }), {
      userId: 'coach-1',
      clienteId: 'cliente-1',
    }),
    {
      ok: false,
      status: 404,
      codigo: 'CLIENT_NOT_FOUND',
      mensaje: 'Cliente no encontrado.',
    },
  )

  assert.deepEqual(
    await autorizarCoachCliente(fakeSupabase({
      data: null,
      error: { code: 'XX000', message: 'database unavailable' },
    }), {
      userId: 'coach-1',
      clienteId: 'cliente-1',
    }),
    {
      ok: false,
      status: 500,
      codigo: 'AUTH_LOOKUP_FAILED',
      mensaje: 'No se pudo verificar el acceso al cliente.',
    },
  )
}

async function probarAutorizacionAntesDeMutar() {
  for (const routePath of ['app/api/agentes/tareas/route.ts']) {
    const source = await readFile(new URL(`../${routePath}`, import.meta.url), 'utf8')
    const importIndex = source.indexOf("@/lib/auth/autorizar-coach-cliente")
    const authorizationIndex = source.indexOf('await autorizarCoachCliente(')
    const mutationIndex = source.indexOf('.update(')

    assert.ok(importIndex >= 0, `${routePath} debe importar autorizarCoachCliente`)
    assert.ok(authorizationIndex > importIndex, `${routePath} debe autorizar el ownership`)
    assert.ok(mutationIndex > authorizationIndex, `${routePath} debe autorizar antes de mutar`)
  }
}

async function main() {
  await probarHelper()
  await probarAutorizacionAntesDeMutar()
  console.log('fase0 ownership tests passed')
}

main().catch(error => {
  console.error(error)
  process.exitCode = 1
})
