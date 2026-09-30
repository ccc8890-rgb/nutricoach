export type GenerationAction = 'generar' | 'esperar' | 'reutilizar'

export interface GenerationClaim {
  generacionId: string
  intentoToken: string | null
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

interface GenerationClaimRow {
  generacion_id: string
  intento_token: string | null
  accion: GenerationAction
  estado: GenerationClaim['estado']
  plan_nutricion_id: string | null
  plan_entrenamiento_id: string | null
  error_codigo: string | null
  error_mensaje: string | null
}

interface GenerationDb {
  rpc(
    name: string,
    args: Record<string, unknown>,
  ): PromiseLike<{ data: GenerationClaimRow[] | GenerationClaimRow | null; error: { message: string } | null }>
}

export async function reclamarGeneracionInicial(
  db: GenerationDb,
  input: { clienteId: string; clave: string; actorId: string },
): Promise<GenerationClaim> {
  const { data, error } = await db.rpc('claim_generacion_plan_inicial', {
    p_cliente_id: input.clienteId,
    p_clave: input.clave,
    p_actor_id: input.actorId,
  })

  if (error) throw new Error(`CLAIM_FAILED:${error.message}`)

  const row = Array.isArray(data) ? data[0] : data
  if (!row) throw new Error('CLAIM_FAILED:respuesta vacía')
  if (row.accion === 'generar' && !row.intento_token) {
    throw new Error('CLAIM_FAILED:lease de intento ausente')
  }

  return {
    generacionId: row.generacion_id,
    intentoToken: row.intento_token,
    accion: row.accion,
    estado: row.estado,
    planNutricionId: row.plan_nutricion_id,
    planEntrenamientoId: row.plan_entrenamiento_id,
    error: row.error_mensaje
      ? { codigo: row.error_codigo, mensaje: row.error_mensaje }
      : null,
  }
}

export async function marcarGeneracionFallida(
  db: GenerationDb,
  input: { generacionId: string; intentoToken: string; codigo: string; mensaje: string },
): Promise<void> {
  const { error } = await db.rpc('marcar_generacion_inicial_fallida', {
    p_generacion_id: input.generacionId,
    p_intento_token: input.intentoToken,
    p_error_codigo: input.codigo,
    p_error_mensaje: input.mensaje.slice(0, 500),
  })

  if (error) throw new Error(`MARK_GENERATION_FAILED:${error.message}`)
}

export async function limpiarBorradoresGeneracion(
  db: GenerationDb,
  input: { generacionId: string; intentoToken: string },
): Promise<void> {
  const { error } = await db.rpc('limpiar_borradores_generacion', {
    p_generacion_id: input.generacionId,
    p_intento_token: input.intentoToken,
  })

  if (error) throw new Error(`DRAFT_CLEANUP_FAILED:${error.message}`)
}
