import assert from 'node:assert/strict'
import {
  limpiarBorradoresGeneracion,
  marcarGeneracionFallida,
  reclamarGeneracionInicial,
} from '../lib/planes/generacion-inicial'

type RpcRow = {
  generacion_id: string
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
    accion: 'generar',
    estado: 'procesando',
    plan_nutricion_id: null,
    plan_entrenamiento_id: null,
    error_codigo: null,
    error_mensaje: null,
  },
  {
    generacion_id: 'gen-1',
    accion: 'esperar',
    estado: 'procesando',
    plan_nutricion_id: null,
    plan_entrenamiento_id: null,
    error_codigo: null,
    error_mensaje: null,
  },
  {
    generacion_id: 'gen-1',
    accion: 'reutilizar',
    estado: 'completada',
    plan_nutricion_id: 'nutri-1',
    plan_entrenamiento_id: 'entreno-1',
    error_codigo: null,
    error_mensaje: null,
  },
  {
    generacion_id: 'gen-1',
    accion: 'generar',
    estado: 'procesando',
    plan_nutricion_id: null,
    plan_entrenamiento_id: null,
    error_codigo: null,
    error_mensaje: null,
  },
]

const failureUpdates: Array<Record<string, unknown>> = []
const db = {
  async rpc(name: string, args: Record<string, unknown>) {
    calls.push({ name, args })
    return { data: [responses.shift()], error: null }
  },
  from(table: string) {
    assert.equal(table, 'generaciones_plan_inicial')
    return {
      update(values: Record<string, unknown>) {
        failureUpdates.push(values)
        return {
          eq(column: string, value: string) {
            assert.equal(column, 'id')
            assert.equal(value, 'gen-1')
            return Promise.resolve({ error: null })
          },
        }
      },
    }
  },
}

const input = {
  clienteId: 'cliente-1',
  clave: 'onboarding:cliente-1',
  actorId: 'user-1',
}

type Draft = { id: string; generacion_inicial_id: string; activo: boolean }
const drafts: Record<string, Draft[]> = {
  planes_nutricion: [
    { id: 'nutri-huerfano', generacion_inicial_id: 'gen-1', activo: false },
    { id: 'nutri-activo', generacion_inicial_id: 'gen-1', activo: true },
    { id: 'nutri-otro', generacion_inicial_id: 'gen-2', activo: false },
  ],
  planes_entrenamiento: [
    { id: 'entreno-huerfano', generacion_inicial_id: 'gen-1', activo: false },
    { id: 'entreno-activo', generacion_inicial_id: 'gen-1', activo: true },
  ],
}
const cleanupDb = {
  from(table: string) {
    const filters: Record<string, unknown> = {}
    const query = {
      delete() {
        return query
      },
      eq(column: string, value: unknown) {
        filters[column] = value
        return query
      },
      then(resolve: (value: { error: null }) => void) {
        drafts[table] = drafts[table].filter(row =>
          !Object.entries(filters).every(([column, value]) => row[column as keyof Draft] === value)
        )
        resolve({ error: null })
      },
    }
    return query
  },
}

async function main() {
  assert.deepEqual(await reclamarGeneracionInicial(db, input), {
    generacionId: 'gen-1',
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

  await marcarGeneracionFallida(db, {
    generacionId: 'gen-1',
    codigo: 'GENERATION_FAILED',
    mensaje: `seguro${'x'.repeat(600)}`,
  })
  assert.equal(failureUpdates.length, 1)
  assert.deepEqual(Object.keys(failureUpdates[0]).sort(), [
    'error_codigo',
    'error_mensaje',
    'estado',
    'updated_at',
  ])
  assert.equal(failureUpdates[0].estado, 'fallida')
  assert.equal((failureUpdates[0].error_mensaje as string).length, 500)

  const retryClaim = await reclamarGeneracionInicial(db, input)
  assert.equal(retryClaim.accion, 'generar')
  await limpiarBorradoresGeneracion(cleanupDb, retryClaim.generacionId)
  assert.deepEqual(drafts.planes_nutricion.map(row => row.id), ['nutri-activo', 'nutri-otro'])
  assert.deepEqual(drafts.planes_entrenamiento.map(row => row.id), ['entreno-activo'])

  console.log('fase0 generation idempotency tests passed')
}

main().catch(error => {
  console.error(error)
  process.exitCode = 1
})
