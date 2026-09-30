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

interface GenerationClaimRow {
  generacion_id: string
  accion: GenerationAction
  estado: GenerationClaim['estado']
  plan_nutricion_id: string | null
  plan_entrenamiento_id: string | null
  error_codigo: string | null
  error_mensaje: string | null
}

interface GenerationDb {
  rpc(
    name: 'claim_generacion_plan_inicial',
    args: { p_cliente_id: string; p_clave: string; p_actor_id: string },
  ): PromiseLike<{ data: GenerationClaimRow[] | GenerationClaimRow | null; error: { message: string } | null }>
  from(table: 'generaciones_plan_inicial'): {
    update(values: Record<string, unknown>): {
      eq(column: 'id', value: string): PromiseLike<{ error: { message: string } | null }>
    }
  }
}

interface GenerationDraftsDb {
  from(table: 'planes_nutricion' | 'planes_entrenamiento'): {
    delete(): {
      eq(column: 'generacion_inicial_id', value: string): {
        eq(column: 'activo', value: false): PromiseLike<{ error: { message: string } | null }>
      }
    }
  }
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

  return {
    generacionId: row.generacion_id,
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
  input: { generacionId: string; codigo: string; mensaje: string },
): Promise<void> {
  const { error } = await db
    .from('generaciones_plan_inicial')
    .update({
      estado: 'fallida',
      error_codigo: input.codigo,
      error_mensaje: input.mensaje.slice(0, 500),
      updated_at: new Date().toISOString(),
    })
    .eq('id', input.generacionId)

  if (error) throw new Error(`MARK_GENERATION_FAILED:${error.message}`)
}

export async function limpiarBorradoresGeneracion(
  db: GenerationDraftsDb,
  generacionId: string,
): Promise<void> {
  const [nutricion, entrenamiento] = await Promise.all([
    db
      .from('planes_nutricion')
      .delete()
      .eq('generacion_inicial_id', generacionId)
      .eq('activo', false),
    db
      .from('planes_entrenamiento')
      .delete()
      .eq('generacion_inicial_id', generacionId)
      .eq('activo', false),
  ])

  if (nutricion.error || entrenamiento.error) {
    throw new Error([
      nutricion.error?.message,
      entrenamiento.error?.message,
    ].filter(Boolean).join('; ') || 'DRAFT_CLEANUP_FAILED')
  }
}
