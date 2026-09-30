import assert from 'node:assert/strict'
import {
  GenerationClientError,
  generarPlanInicialDesdeCliente,
  type FetchImpl,
} from '../lib/planes/generation-client'

type RequestRecord = { url: string; init?: RequestInit }

function response(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

async function expectClientError(
  status: number,
  expected: Pick<GenerationClientError, 'codigo' | 'accion' | 'retryable'>,
) {
  const fetchImpl: FetchImpl = async () => response({ error: { mensaje: 'Error de prueba' } }, status)

  await assert.rejects(
    () => generarPlanInicialDesdeCliente({
      cliente_id: 'cliente-1',
      idempotency_key: 'onboarding:cliente-1',
      fetchImpl,
    }),
    (error: unknown) => {
      assert.ok(error instanceof GenerationClientError)
      assert.equal(error.codigo, expected.codigo)
      assert.equal(error.accion, expected.accion)
      assert.equal(error.retryable, expected.retryable)
      return true
    },
  )
}

async function main() {
  const requests: RequestRecord[] = []
  const fetchImpl: FetchImpl = async (url, init) => {
    requests.push({ url: String(url), init })
    return response({
      ok: true,
      generacion_id: 'generation-1',
      estado: 'procesando',
      reutilizada: false,
      plan_nutricion_id: null,
      plan_entrenamiento_id: null,
    }, 202)
  }
  const input = {
    cliente_id: 'cliente-1',
    idempotency_key: 'onboarding:cliente-1',
    fetchImpl,
  }

  const first = await generarPlanInicialDesdeCliente(input)
  const retry = await generarPlanInicialDesdeCliente(input)

  assert.equal(first.estado, 'procesando')
  assert.equal(retry.estado, 'procesando')
  assert.equal(requests.length, 2)
  assert.equal(requests[0].url, '/api/generar-plan-inicial')
  assert.equal(requests[0].init?.credentials, 'include')
  assert.equal(requests[0].init?.method, 'POST')
  assert.equal(requests[0].body, requests[1].body)
  assert.deepEqual(JSON.parse(String(requests[0].init?.body)), {
    cliente_id: 'cliente-1',
    idempotency_key: 'onboarding:cliente-1',
    origen: 'onboarding',
  })

  await expectClientError(401, {
    codigo: 'AUTH_EXPIRED',
    accion: 'Vuelve a iniciar sesión y reintenta.',
    retryable: false,
  })
  await expectClientError(403, {
    codigo: 'FORBIDDEN',
    accion: 'No tienes permiso para generar este plan.',
    retryable: false,
  })
  await expectClientError(429, {
    codigo: 'RATE_LIMITED',
    accion: 'Espera un momento y reintenta.',
    retryable: true,
  })
  await expectClientError(500, {
    codigo: 'SERVER_ERROR',
    accion: 'Reintenta; tu plan anterior sigue activo.',
    retryable: true,
  })

  console.log('fase0 onboarding generation tests passed')
}

main().catch(error => {
  console.error(error)
  process.exitCode = 1
})
