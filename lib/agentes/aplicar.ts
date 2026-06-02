// ================================================================
// APLICAR ACCIONES — Motor de ejecución tras aprobación del coach
//
// Cuando el coach aprueba una tarea en el kanban, esta función
// ejecuta la acción real en BD. Sin esto el kanban es decorativo.
// ================================================================

import { createServiceSupabase } from '@/lib/supabase-server'
import type { AgenteTarea } from './types'

export interface PlanEntrenoUpdateInput {
  descripcionActual: string | null
  planUpdate?: {
    sesiones_por_semana?: number | null
    duracion_semanas?: number | null
  }
  propuesta?: string | null
}

export interface PlanEntrenoUpdateSeguro {
  campos: {
    descripcion?: string
    duracion_semanas?: number
  }
  mensaje: string
}

export function crearPlanEntrenoUpdateSeguro(input: PlanEntrenoUpdateInput): PlanEntrenoUpdateSeguro {
  const campos: PlanEntrenoUpdateSeguro['campos'] = {}
  const notas: string[] = []

  if (input.planUpdate?.duracion_semanas != null) {
    campos.duracion_semanas = input.planUpdate.duracion_semanas
  }

  if (input.planUpdate?.sesiones_por_semana != null) {
    notas.push(`[IA coach] Objetivo operativo: ${input.planUpdate.sesiones_por_semana} sesiones/semana`)
  }
  if (input.propuesta) {
    notas.push(`[IA coach] ${input.propuesta}`)
  }

  if (notas.length > 0) {
    campos.descripcion = [input.descripcionActual, ...notas]
      .filter((item): item is string => Boolean(item?.trim()))
      .join('\n\n')
  }

  const touched = Object.keys(campos)
  return {
    campos,
    mensaje: touched.length
      ? `Plan de entrenamiento anotado: ${[
          campos.duracion_semanas != null ? 'duración' : null,
          campos.descripcion ? 'objetivo semanal operativo' : null,
        ].filter(Boolean).join(' y ')}`
      : 'Sin actualización estructural segura',
  }
}

export async function aplicarTarea(tarea: AgenteTarea): Promise<{ ok: boolean; mensaje?: string }> {
  const db = createServiceSupabase()

  switch (tarea.tipo) {
    case 'ajuste_macros':
    case 'revision_semanal':
    case 'ajuste_nutricion_carga':
      return aplicarAjusteMacros(db, tarea)

    case 'alerta_riesgo':
    case 'alerta_riesgo_entreno':
    case 'mensaje_motivacion':
    case 'revision_semanal_entreno':
    case 'alerta_readiness':
      return aplicarMensajeCliente(db, tarea)

    case 'actualizacion_plan':
      return aplicarActualizacionPlan(db, tarea)

    default:
      return { ok: true, mensaje: 'Tipo sin acción automática — registrado como aprobado' }
  }
}

// ── Actualizar macros del plan activo ─────────────────────────
async function aplicarAjusteMacros(
  db: ReturnType<typeof createServiceSupabase>,
  tarea: AgenteTarea
): Promise<{ ok: boolean; mensaje?: string }> {
  if (!tarea.cliente_id) return { ok: false, mensaje: 'Sin cliente_id' }

  const payload = tarea.payload as {
    ajustes?: {
      kcal?: number | null
      proteinas?: number | null
      carbohidratos?: number | null
      grasas?: number | null
    }
  }

  const ajustes = payload.ajustes ?? {}
  const campos: Record<string, number> = {}

  if (ajustes.kcal != null) campos.kcal_objetivo = ajustes.kcal
  if (ajustes.proteinas != null) campos.proteinas_objetivo = ajustes.proteinas
  if (ajustes.carbohidratos != null) campos.carbohidratos_objetivo = ajustes.carbohidratos
  if (ajustes.grasas != null) campos.grasas_objetivo = ajustes.grasas

  if (!Object.keys(campos).length) {
    return { ok: true, mensaje: 'Sin ajustes numéricos en el payload' }
  }

  const { error } = await db
    .from('planes_nutricion')
    .update(campos)
    .eq('cliente_id', tarea.cliente_id)
    .eq('activo', true)

  if (error) {
    console.error('[aplicar] Error ajuste macros:', error)
    return { ok: false, mensaje: error.message }
  }

  // Marcar como aplicado
  await db
    .from('agente_tareas')
    .update({ estado: 'aplicado', aplicado_at: new Date().toISOString() })
    .eq('id', tarea.id)

  return { ok: true, mensaje: `Plan actualizado: ${JSON.stringify(campos)}` }
}

// ── Enviar mensaje al cliente via chat_mensajes ───────────────
async function aplicarMensajeCliente(
  db: ReturnType<typeof createServiceSupabase>,
  tarea: AgenteTarea
): Promise<{ ok: boolean; mensaje?: string }> {
  if (!tarea.cliente_id) return { ok: false, mensaje: 'Sin cliente_id' }
  const payload = tarea.payload as { mensaje_cliente?: string }
  const contenido = payload.mensaje_cliente || tarea.propuesta
  if (!contenido) return { ok: false, mensaje: 'Sin propuesta/mensaje' }

  const { error } = await db.from('chat_mensajes').insert({
    cliente_id: tarea.cliente_id,
    remitente: 'coach',
    contenido,
    leido: false,
  })

  if (error) {
    console.error('[aplicar] Error mensaje cliente:', error)
    return { ok: false, mensaje: error.message }
  }

  await db
    .from('agente_tareas')
    .update({ estado: 'aplicado', aplicado_at: new Date().toISOString() })
    .eq('id', tarea.id)

  return { ok: true, mensaje: 'Mensaje enviado al cliente' }
}

// ── Actualización estructural del plan ────────────────────────
async function aplicarActualizacionPlan(
  db: ReturnType<typeof createServiceSupabase>,
  tarea: AgenteTarea
): Promise<{ ok: boolean; mensaje?: string }> {
  if (!tarea.cliente_id) return { ok: false, mensaje: 'Sin cliente_id' }

  const payload = tarea.payload as {
    plan_update?: {
      sesiones_por_semana?: number
      duracion_semanas?: number
    }
    mensaje_cliente?: string
  }

  const { data: planActual, error: planError } = await db
    .from('planes_entrenamiento')
    .select('id, descripcion')
    .eq('cliente_id', tarea.cliente_id)
    .eq('activo', true)
    .maybeSingle()

  if (planError) {
    console.error('[aplicar] Error leyendo plan entrenamiento:', planError)
    return { ok: false, mensaje: planError.message }
  }

  const updateSeguro = crearPlanEntrenoUpdateSeguro({
    descripcionActual: (planActual?.descripcion as string | null) ?? null,
    planUpdate: payload.plan_update,
    propuesta: tarea.propuesta,
  })

  if (Object.keys(updateSeguro.campos).length && !planActual?.id) {
    return { ok: false, mensaje: 'Sin plan de entrenamiento activo para aplicar actualización' }
  }

  if (Object.keys(updateSeguro.campos).length && planActual?.id) {
    const { error } = await db
      .from('planes_entrenamiento')
      .update(updateSeguro.campos)
      .eq('id', planActual?.id)

    if (error) {
      console.error('[aplicar] Error actualizacion plan:', error)
      return { ok: false, mensaje: error.message }
    }
  }

  if (payload.mensaje_cliente) {
    await db.from('chat_mensajes').insert({
      cliente_id: tarea.cliente_id,
      remitente: 'coach',
      contenido: payload.mensaje_cliente,
      leido: false,
    })
  }

  await db
    .from('agente_tareas')
    .update({ estado: 'aplicado', aplicado_at: new Date().toISOString() })
    .eq('id', tarea.id)

  return { ok: true, mensaje: Object.keys(updateSeguro.campos).length ? updateSeguro.mensaje : 'Actualización de plan registrada' }
}
