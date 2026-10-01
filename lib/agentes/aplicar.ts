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
    sesiones?: SesionEntrenoPayload[] | null
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

export interface SesionEntrenoActual {
  id: string
  nombre: string | null
  dia_semana: string | null
  notas: string | null
  duracion_estimada_min?: number | null
  contexto_ia?: string | null
  ejercicios?: EjercicioSesionActual[] | null
}

export interface EjercicioSesionActual {
  id: string
  ejercicio_id?: string | null
  ejercicio_nombre?: string | null
  series?: number | null
  repeticiones?: string | null
  descanso_segundos?: number | null
  peso_sugerido?: string | null
  rpe?: string | null
  notas?: string | null
  instruccion_ejercicio?: string | null
}

export interface SesionEntrenoPayload {
  id?: string | null
  nombre?: string | null
  dia_semana?: string | null
  duracion_estimada_min?: number | null
  notas?: string | null
  foco?: string | null
  contexto_ia?: string | null
  ejercicios?: EjercicioSesionPayload[] | null
}

export interface EjercicioSesionPayload {
  id?: string | null
  ejercicio_id?: string | null
  ejercicio_nombre?: string | null
  series?: number | null
  repeticiones?: string | number | null
  descanso_segundos?: number | null
  peso_sugerido?: string | null
  rpe?: string | number | null
  notas?: string | null
  instruccion_ejercicio?: string | null
}

export interface SesionesEntrenoUpdatesSeguros {
  sesiones: Array<{
    id: string
    campos: {
      notas?: string
      duracion_estimada_min?: number
      contexto_ia?: string
    }
  }>
  ejercicios: Array<{
    id: string
    campos: {
      series?: number
      repeticiones?: string
      descanso_segundos?: number
      peso_sugerido?: string
      rpe?: string
      notas?: string
      instruccion_ejercicio?: string
    }
  }>
  noAplicados: string[]
  resumen: string
}

function normalizarClave(value?: string | null): string {
  return (value ?? '').trim().toLowerCase()
}

function numeroEnRango(value: number | null | undefined, min: number, max: number): number | undefined {
  if (value == null || !Number.isFinite(value)) return undefined
  const rounded = Math.round(value)
  if (rounded < min || rounded > max) return undefined
  return rounded
}

function textoSeguro(value: string | number | null | undefined, max = 240): string | undefined {
  if (value == null) return undefined
  const text = String(value).trim()
  if (!text) return undefined
  return text.slice(0, max)
}

function appendIaNote(actual: string | null | undefined, nota: string | null | undefined): string | undefined {
  const safe = textoSeguro(nota, 500)
  if (!safe) return undefined
  const iaNote = `[IA coach] ${safe}`
  const base = actual?.trim()
  if (base?.includes(iaNote)) return base
  return [base, iaNote].filter(Boolean).join('\n\n')
}

function matchSesion(sesiones: SesionEntrenoActual[], payload: SesionEntrenoPayload): SesionEntrenoActual | undefined {
  if (payload.id) {
    const byId = sesiones.find(s => s.id === payload.id)
    if (byId) return byId
  }
  const dia = normalizarClave(payload.dia_semana)
  if (dia) {
    const byDia = sesiones.find(s => normalizarClave(s.dia_semana) === dia)
    if (byDia) return byDia
  }
  const nombre = normalizarClave(payload.nombre)
  if (nombre) {
    return sesiones.find(s => normalizarClave(s.nombre) === nombre)
  }
  return undefined
}

function matchEjercicio(ejercicios: EjercicioSesionActual[], payload: EjercicioSesionPayload): EjercicioSesionActual | undefined {
  if (payload.id) {
    const byId = ejercicios.find(e => e.id === payload.id)
    if (byId) return byId
  }
  if (payload.ejercicio_id) {
    const byExerciseId = ejercicios.find(e => e.ejercicio_id === payload.ejercicio_id)
    if (byExerciseId) return byExerciseId
  }
  const nombre = normalizarClave(payload.ejercicio_nombre)
  if (nombre) {
    return ejercicios.find(e => normalizarClave(e.ejercicio_nombre).includes(nombre) || nombre.includes(normalizarClave(e.ejercicio_nombre)))
  }
  return undefined
}

export function crearSesionesEntrenoUpdatesSeguros(input: {
  sesionesActuales: SesionEntrenoActual[]
  sesionesPayload?: SesionEntrenoPayload[] | null
}): SesionesEntrenoUpdatesSeguros {
  const sesiones: SesionesEntrenoUpdatesSeguros['sesiones'] = []
  const ejercicios: SesionesEntrenoUpdatesSeguros['ejercicios'] = []
  const noAplicados: string[] = []

  for (const payloadSesion of input.sesionesPayload ?? []) {
    const sesionActual = matchSesion(input.sesionesActuales, payloadSesion)
    if (!sesionActual) {
      noAplicados.push(payloadSesion.nombre || payloadSesion.dia_semana || payloadSesion.id || 'sesión sin identificar')
      continue
    }

    const camposSesion: SesionesEntrenoUpdatesSeguros['sesiones'][number]['campos'] = {}
    const duracion = numeroEnRango(payloadSesion.duracion_estimada_min, 10, 180)
    if (duracion != null) camposSesion.duracion_estimada_min = duracion

    const notas = appendIaNote(sesionActual.notas, payloadSesion.notas)
    if (notas) camposSesion.notas = notas

    const contexto = appendIaNote(sesionActual.contexto_ia, payloadSesion.contexto_ia || payloadSesion.foco)
    if (contexto) camposSesion.contexto_ia = contexto

    if (Object.keys(camposSesion).length) {
      sesiones.push({ id: sesionActual.id, campos: camposSesion })
    }

    const ejerciciosActuales = sesionActual.ejercicios ?? []
    for (const payloadEjercicio of payloadSesion.ejercicios ?? []) {
      const ejercicioActual = matchEjercicio(ejerciciosActuales, payloadEjercicio)
      if (!ejercicioActual) {
        noAplicados.push(`${sesionActual.nombre || sesionActual.dia_semana || sesionActual.id}: ${payloadEjercicio.ejercicio_nombre || payloadEjercicio.id || 'ejercicio sin identificar'}`)
        continue
      }

      const camposEjercicio: SesionesEntrenoUpdatesSeguros['ejercicios'][number]['campos'] = {}
      const series = numeroEnRango(payloadEjercicio.series, 1, 12)
      const descanso = numeroEnRango(payloadEjercicio.descanso_segundos, 15, 600)
      const repeticiones = textoSeguro(payloadEjercicio.repeticiones, 40)
      const rpe = textoSeguro(payloadEjercicio.rpe, 12)
      const peso = textoSeguro(payloadEjercicio.peso_sugerido, 60)
      const notasEjercicio = appendIaNote(ejercicioActual.notas, payloadEjercicio.notas)
      const instruccion = appendIaNote(ejercicioActual.instruccion_ejercicio, payloadEjercicio.instruccion_ejercicio)

      if (series != null) camposEjercicio.series = series
      if (descanso != null) camposEjercicio.descanso_segundos = descanso
      if (repeticiones) camposEjercicio.repeticiones = repeticiones
      if (rpe) camposEjercicio.rpe = rpe
      if (peso) camposEjercicio.peso_sugerido = peso
      if (notasEjercicio) camposEjercicio.notas = notasEjercicio
      if (instruccion) camposEjercicio.instruccion_ejercicio = instruccion

      if (Object.keys(camposEjercicio).length) {
        ejercicios.push({ id: ejercicioActual.id, campos: camposEjercicio })
      }
    }
  }

  const partes = [
    sesiones.length ? `${sesiones.length} ${sesiones.length === 1 ? 'sesión' : 'sesiones'}` : null,
    ejercicios.length ? `${ejercicios.length} ${ejercicios.length === 1 ? 'ejercicio' : 'ejercicios'}` : null,
  ].filter(Boolean)

  return {
    sesiones,
    ejercicios,
    noAplicados,
    resumen: partes.length ? `${partes.join(' y ')} ajustados` : 'Sin ajustes de sesiones aplicables',
  }
}

export type AplicarTareaResult =
  | { ok: true; codigo: 'APPLIED' | 'NO_MUTATION'; mensaje: string }
  | {
      ok: false
      codigo: 'NO_CLIENT' | 'NO_ACTIVE_PLAN' | 'TASK_NOT_APPROVED' | 'UNMATCHED_TARGET' | 'DB_ERROR'
      mensaje: string
    }

type AplicarTareaErrorCode = Extract<AplicarTareaResult, { ok: false }>['codigo']

function codigoErrorRpc(mensaje: string): AplicarTareaErrorCode {
  const normalizado = mensaje.toLowerCase()
  if (normalizado.includes('plan') && normalizado.includes('activo')) return 'NO_ACTIVE_PLAN'
  if (normalizado.includes('aprobada') || normalizado.includes('modificada')) return 'TASK_NOT_APPROVED'
  if (normalizado.includes('pertenece')) return 'UNMATCHED_TARGET'
  return 'DB_ERROR'
}

export async function aplicarTarea(tarea: AgenteTarea): Promise<AplicarTareaResult> {
  if (!tarea.cliente_id) {
    return { ok: false, codigo: 'NO_CLIENT', mensaje: 'Sin cliente_id' }
  }
  if (tarea.estado !== 'aprobado' && tarea.estado !== 'modificado') {
    return {
      ok: false,
      codigo: 'TASK_NOT_APPROVED',
      mensaje: 'La tarea debe estar aprobada o modificada antes de aplicarse',
    }
  }

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
      return {
        ok: true,
        codigo: 'NO_MUTATION',
        mensaje: 'Tipo sin acción automática — registrado como aprobado',
      }
  }
}

// ── Actualizar macros del plan activo ─────────────────────────
async function aplicarAjusteMacros(
  db: ReturnType<typeof createServiceSupabase>,
  tarea: AgenteTarea
): Promise<AplicarTareaResult> {
  if (!tarea.cliente_id) return { ok: false, codigo: 'NO_CLIENT', mensaje: 'Sin cliente_id' }

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
    return { ok: true, codigo: 'NO_MUTATION', mensaje: 'Sin ajustes numéricos en el payload' }
  }

  const { error } = await db.rpc('aplicar_ajuste_macros_seguro', {
    p_tarea_id: tarea.id,
    p_cliente_id: tarea.cliente_id,
    p_campos: campos,
  })

  if (error) {
    console.error('[aplicar] Error ajuste macros:', error)
    return { ok: false, codigo: codigoErrorRpc(error.message), mensaje: error.message }
  }

  return { ok: true, codigo: 'APPLIED', mensaje: `Plan actualizado: ${JSON.stringify(campos)}` }
}

// ── Enviar mensaje al cliente via chat_mensajes ───────────────
async function aplicarMensajeCliente(
  db: ReturnType<typeof createServiceSupabase>,
  tarea: AgenteTarea
): Promise<AplicarTareaResult> {
  if (!tarea.cliente_id) return { ok: false, codigo: 'NO_CLIENT', mensaje: 'Sin cliente_id' }
  const payload = tarea.payload as { mensaje_cliente?: string }
  // `tarea.propuesta` es la recomendación interna para el coach (kanban),
  // nunca debe usarse como fallback: se filtró al chat real de un cliente
  // (auditoría 28-09-2026) con texto como "Contacta urgentemente al
  // cliente... no ajustes el plan hasta comprender la situación".
  const contenido = payload.mensaje_cliente
  if (!contenido) {
    return {
      ok: true,
      codigo: 'NO_MUTATION',
      mensaje: 'Sin mensaje_cliente en el payload — no se envía la propuesta interna al chat',
    }
  }

  const { error } = await db.rpc('aplicar_mensaje_cliente_seguro', {
    p_tarea_id: tarea.id,
    p_cliente_id: tarea.cliente_id,
    p_mensaje: contenido,
  })

  if (error) {
    console.error('[aplicar] Error mensaje cliente:', error)
    return { ok: false, codigo: 'DB_ERROR', mensaje: error.message }
  }

  return { ok: true, codigo: 'APPLIED', mensaje: 'Mensaje enviado al cliente' }
}

export function evaluarPreflightActualizacionPlan(input: {
  planId: string | null | undefined
  updates: SesionesEntrenoUpdatesSeguros
  camposPlan: PlanEntrenoUpdateSeguro['campos']
  mensajeCliente?: string | null
}): AplicarTareaResult | null {
  if (!input.planId) {
    return {
      ok: false,
      codigo: 'NO_ACTIVE_PLAN',
      mensaje: 'Sin plan de entrenamiento activo para aplicar la actualización',
    }
  }

  if (input.updates.noAplicados.length > 0) {
    return {
      ok: false,
      codigo: 'UNMATCHED_TARGET',
      mensaje: `No se encontraron todos los targets: ${input.updates.noAplicados.join(', ')}`,
    }
  }

  const hayMutacion = Object.keys(input.camposPlan).length > 0
    || input.updates.sesiones.length > 0
    || input.updates.ejercicios.length > 0
    || Boolean(input.mensajeCliente?.trim())

  if (!hayMutacion) {
    return {
      ok: true,
      codigo: 'NO_MUTATION',
      mensaje: 'La actualización no contiene cambios aplicables',
    }
  }

  return null
}

// ── Actualización estructural del plan ────────────────────────
async function aplicarActualizacionPlan(
  db: ReturnType<typeof createServiceSupabase>,
  tarea: AgenteTarea
): Promise<AplicarTareaResult> {
  if (!tarea.cliente_id) return { ok: false, codigo: 'NO_CLIENT', mensaje: 'Sin cliente_id' }

  const payload = tarea.payload as {
    plan_update?: {
      sesiones_por_semana?: number
      duracion_semanas?: number
      sesiones?: SesionEntrenoPayload[]
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
    return { ok: false, codigo: 'DB_ERROR', mensaje: planError.message }
  }

  const updateSeguro = crearPlanEntrenoUpdateSeguro({
    descripcionActual: (planActual?.descripcion as string | null) ?? null,
    planUpdate: payload.plan_update,
    propuesta: tarea.propuesta,
  })

  let updatesSesiones: SesionesEntrenoUpdatesSeguros = {
    sesiones: [],
    ejercicios: [],
    noAplicados: [],
    resumen: 'Sin ajustes de sesiones aplicables',
  }
  if (payload.plan_update?.sesiones?.length) {
    if (!planActual?.id) {
      return {
        ok: false,
        codigo: 'NO_ACTIVE_PLAN',
        mensaje: 'Sin plan de entrenamiento activo para aplicar sesiones',
      }
    }

    const { data: sesionesData, error: sesionesError } = await db
      .from('sesiones_entrenamiento')
      .select(`
        id,
        nombre,
        dia_semana,
        notas,
        duracion_estimada_min,
        contexto_ia,
        ejercicios:sesion_ejercicios(
          id,
          ejercicio_id,
          series,
          repeticiones,
          descanso_segundos,
          peso_sugerido,
          rpe,
          notas,
          instruccion_ejercicio,
          ejercicio:ejercicios(nombre)
        )
      `)
      .eq('plan_id', planActual.id)
      .order('orden')

    if (sesionesError) {
      console.error('[aplicar] Error leyendo sesiones entrenamiento:', sesionesError)
      return { ok: false, codigo: 'DB_ERROR', mensaje: sesionesError.message }
    }

    const sesionesActuales = ((sesionesData ?? []) as Array<{
      id: string
      nombre: string | null
      dia_semana: string | null
      notas: string | null
      duracion_estimada_min: number | null
      contexto_ia: string | null
      ejercicios?: Array<EjercicioSesionActual & { ejercicio?: { nombre?: string | null } | null }>
    }>).map(sesion => ({
      ...sesion,
      ejercicios: (sesion.ejercicios ?? []).map(ejercicio => ({
        ...ejercicio,
        ejercicio_nombre: ejercicio.ejercicio_nombre ?? ejercicio.ejercicio?.nombre ?? null,
      })),
    }))

    updatesSesiones = crearSesionesEntrenoUpdatesSeguros({
      sesionesActuales,
      sesionesPayload: payload.plan_update.sesiones,
    })
  }

  const preflight = evaluarPreflightActualizacionPlan({
    planId: planActual?.id,
    updates: updatesSesiones,
    camposPlan: updateSeguro.campos,
    mensajeCliente: payload.mensaje_cliente,
  })
  if (preflight) return preflight

  const { error } = await db.rpc('aplicar_actualizacion_entreno_segura', {
    p_tarea_id: tarea.id,
    p_cliente_id: tarea.cliente_id,
    p_plan_id: planActual!.id,
    p_campos_plan: updateSeguro.campos,
    p_sesiones: updatesSesiones.sesiones,
    p_ejercicios: updatesSesiones.ejercicios,
    p_mensaje: payload.mensaje_cliente?.trim() || null,
  })

  if (error) {
    console.error('[aplicar] Error actualización atómica de entrenamiento:', error)
    return { ok: false, codigo: codigoErrorRpc(error.message), mensaje: error.message }
  }

  const mensajes = [
    Object.keys(updateSeguro.campos).length ? updateSeguro.mensaje : null,
    updatesSesiones.sesiones.length || updatesSesiones.ejercicios.length
      ? updatesSesiones.resumen
      : null,
    payload.mensaje_cliente?.trim() ? 'Mensaje enviado al cliente' : null,
  ].filter(Boolean)

  return {
    ok: true,
    codigo: 'APPLIED',
    mensaje: mensajes.length ? mensajes.join(' · ') : 'Actualización de plan aplicada',
  }
}
