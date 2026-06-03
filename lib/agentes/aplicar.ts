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

  let sesionesResumen: string | null = null
  if (payload.plan_update?.sesiones?.length) {
    if (!planActual?.id) {
      return { ok: false, mensaje: 'Sin plan de entrenamiento activo para aplicar sesiones' }
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
      return { ok: false, mensaje: sesionesError.message }
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

    const updatesSesiones = crearSesionesEntrenoUpdatesSeguros({
      sesionesActuales,
      sesionesPayload: payload.plan_update.sesiones,
    })

    for (const sesionUpdate of updatesSesiones.sesiones) {
      const { error } = await db
        .from('sesiones_entrenamiento')
        .update(sesionUpdate.campos)
        .eq('id', sesionUpdate.id)

      if (error) {
        console.error('[aplicar] Error actualizando sesión entrenamiento:', error)
        return { ok: false, mensaje: error.message }
      }
    }

    for (const ejercicioUpdate of updatesSesiones.ejercicios) {
      const { error } = await db
        .from('sesion_ejercicios')
        .update(ejercicioUpdate.campos)
        .eq('id', ejercicioUpdate.id)

      if (error) {
        console.error('[aplicar] Error actualizando ejercicio sesión:', error)
        return { ok: false, mensaje: error.message }
      }
    }

    sesionesResumen = updatesSesiones.noAplicados.length
      ? `${updatesSesiones.resumen}. No aplicados: ${updatesSesiones.noAplicados.join(', ')}`
      : updatesSesiones.resumen
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

  const mensajes = [
    Object.keys(updateSeguro.campos).length ? updateSeguro.mensaje : null,
    sesionesResumen,
  ].filter(Boolean)

  return { ok: true, mensaje: mensajes.length ? mensajes.join(' · ') : 'Actualización de plan registrada' }
}
