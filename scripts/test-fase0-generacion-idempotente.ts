import assert from 'node:assert/strict'
import {
  limpiarBorradoresGeneracion,
  marcarGeneracionFallida,
  reclamarGeneracionInicial,
} from '../lib/planes/generacion-inicial'

type RpcRow = {
  generacion_id: string
  intento_token: string | null
  accion: 'generar' | 'esperar' | 'reutilizar'
  estado: 'procesando' | 'completada' | 'fallida'
  plan_nutricion_id: string | null
  plan_entrenamiento_id: string | null
  error_codigo: string | null
  error_mensaje: string | null
}

const calls: Array<{ name: string; args: Record<string, unknown> }> = []
const responses: RpcRow[] = [
  {
    generacion_id: 'gen-1',
    intento_token: 'token-a',
    accion: 'generar',
    estado: 'procesando',
    plan_nutricion_id: null,
    plan_entrenamiento_id: null,
    error_codigo: null,
    error_mensaje: null,
  },
  {
    generacion_id: 'gen-1',
    intento_token: null,
    accion: 'esperar',
    estado: 'procesando',
    plan_nutricion_id: null,
    plan_entrenamiento_id: null,
    error_codigo: null,
    error_mensaje: null,
  },
  {
    generacion_id: 'gen-1',
    intento_token: null,
    accion: 'reutilizar',
    estado: 'completada',
    plan_nutricion_id: 'nutri-1',
    plan_entrenamiento_id: 'entreno-1',
    error_codigo: null,
    error_mensaje: null,
  },
  {
    generacion_id: 'gen-1',
    intento_token: 'token-b',
    accion: 'generar',
    estado: 'procesando',
    plan_nutricion_id: null,
    plan_entrenamiento_id: null,
    error_codigo: null,
    error_mensaje: null,
  },
]

let generationState = 'procesando'
const db = {
  async rpc(name: string, args: Record<string, unknown>) {
    calls.push({ name, args })
    if (name === 'claim_generacion_plan_inicial') {
      return { data: [responses.shift()], error: null }
    }
    if (args.p_intento_token !== 'token-b') {
      return { data: null, error: { message: 'LEASE_MISMATCH' } }
    }
    if (name === 'marcar_generacion_inicial_fallida') generationState = 'fallida'
    return { data: null, error: null }
  },
}

const input = {
  clienteId: 'cliente-1',
  clave: 'onboarding:cliente-1',
  actorId: 'user-1',
}

async function main() {
  assert.deepEqual(await reclamarGeneracionInicial(db, input), {
    generacionId: 'gen-1',
    intentoToken: 'token-a',
    accion: 'generar',
    estado: 'procesando',
    planNutricionId: null,
    planEntrenamientoId: null,
    error: null,
  })
  assert.equal((await reclamarGeneracionInicial(db, input)).accion, 'esperar')
  assert.equal((await reclamarGeneracionInicial(db, input)).accion, 'reutilizar')
  assert.deepEqual(calls[0], {
    name: 'claim_generacion_plan_inicial',
    args: { p_cliente_id: 'cliente-1', p_clave: 'onboarding:cliente-1', p_actor_id: 'user-1' },
  })

  const retryClaim = await reclamarGeneracionInicial(db, input)
  assert.equal(retryClaim.accion, 'generar')
  assert.equal(retryClaim.intentoToken, 'token-b')

  await assert.rejects(
    limpiarBorradoresGeneracion(db, { generacionId: 'gen-1', intentoToken: 'token-a' }),
    /LEASE_MISMATCH/,
  )
  await assert.rejects(
    marcarGeneracionFallida(db, {
      generacionId: 'gen-1',
      intentoToken: 'token-a',
      codigo: 'GENERATION_FAILED',
      mensaje: 'worker A',
    }),
    /LEASE_MISMATCH/,
  )
  assert.equal(generationState, 'procesando')

  await limpiarBorradoresGeneracion(db, {
    generacionId: retryClaim.generacionId,
    intentoToken: retryClaim.intentoToken,
  })
  await marcarGeneracionFallida(db, {
    generacionId: retryClaim.generacionId,
    intentoToken: retryClaim.intentoToken,
    codigo: 'GENERATION_FAILED',
    mensaje: `seguro${'x'.repeat(600)}`,
  })
  assert.equal(generationState, 'fallida')
  assert.deepEqual(calls.at(-2), {
    name: 'limpiar_borradores_generacion',
    args: { p_generacion_id: 'gen-1', p_intento_token: 'token-b' },
  })
  assert.deepEqual(calls.at(-1), {
    name: 'marcar_generacion_inicial_fallida',
    args: {
      p_generacion_id: 'gen-1',
      p_intento_token: 'token-b',
      p_error_codigo: 'GENERATION_FAILED',
      p_error_mensaje: `seguro${'x'.repeat(494)}`,
    },
  })

  console.log('fase0 generation idempotency tests passed')
}

main().catch(error => {
  console.error(error)
  process.exitCode = 1
})
