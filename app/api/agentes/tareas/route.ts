import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabase, createServiceSupabase } from '@/lib/supabase-server'
import { registrarAprendizaje } from '@/lib/agentes/executor'
import { aplicarTarea } from '@/lib/agentes/aplicar'
import { autorizarCoachCliente } from '@/lib/auth/autorizar-coach-cliente'
import type { AgenteTarea } from '@/lib/agentes/types'

export const AGENTE_TAREAS_SELECT = `
  *,
  clientes!inner (
    id,
    coach_id,
    profile:profiles!profile_id ( nombre, apellidos )
  )
`

export async function GET(request: NextRequest) {
  try {
    const supabase = await createServerSupabase()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }
    const db = createServiceSupabase()

    const { searchParams } = new URL(request.url)
    const estado = searchParams.get('estado')
    const tipo = searchParams.get('tipo')
    const agente = searchParams.get('agente')
    const limite = parseInt(searchParams.get('limite') || '50', 10)

    let query = db
      .from('agente_tareas')
      .select(AGENTE_TAREAS_SELECT)
      .eq('clientes.coach_id', user.id)
      .order('prioridad', { ascending: true })
      .order('created_at', { ascending: false })
      .limit(limite)

    if (estado) {
      query = query.eq('estado', estado)
    }
    if (tipo) {
      query = query.eq('tipo', tipo)
    }
    if (agente) {
      query = query.eq('agente', agente)
    }

    const { data: tareas, error } = await query

    if (error) {
      console.error('Error al obtener tareas:', error)
      return NextResponse.json({ error: 'Error al obtener tareas' }, { status: 500 })
    }

    return NextResponse.json({ tareas })
  } catch (error) {
    console.error('Error en GET tareas:', error)
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const supabase = await createServerSupabase()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }
    const db = createServiceSupabase()

    const body = await request.json().catch(() => null) as Record<string, unknown> | null
    const tarea_id = typeof body?.tarea_id === 'string' ? body.tarea_id.trim() : ''
    const decision = typeof body?.decision === 'string' ? body.decision : ''
    const comentario_coach = typeof body?.comentario_coach === 'string'
      ? body.comentario_coach
      : undefined
    const propuesta_final = typeof body?.propuesta_final === 'string'
      ? body.propuesta_final
      : undefined

    if (!tarea_id || !['aprobado', 'rechazado', 'modificado'].includes(decision)) {
      return NextResponse.json({ error: 'Faltan campos requeridos' }, { status: 400 })
    }

    const decisionValidada = decision as 'aprobado' | 'rechazado' | 'modificado'

    const { data: tareaInicial, error: tareaError } = await db
      .from('agente_tareas')
      .select('id,cliente_id,estado')
      .eq('id', tarea_id)
      .single()

    if (tareaError?.code === 'PGRST116' || (!tareaError && !tareaInicial)) {
      return NextResponse.json({ error: 'Tarea no encontrada', codigo: 'TASK_NOT_FOUND' }, { status: 404 })
    }
    if (tareaError || !tareaInicial) {
      console.error('Error al cargar tarea:', tareaError)
      return NextResponse.json({ error: 'Error al cargar tarea' }, { status: 500 })
    }
    if (!tareaInicial.cliente_id) {
      return NextResponse.json({
        error: 'La tarea no está asociada a un cliente.',
        codigo: 'TASK_CLIENT_REQUIRED',
      }, { status: 409 })
    }

    const autorizacion = await autorizarCoachCliente(db, {
      userId: user.id,
      clienteId: tareaInicial.cliente_id,
    })
    if (!autorizacion.ok) {
      return NextResponse.json({
        error: autorizacion.mensaje,
        codigo: autorizacion.codigo,
      }, { status: autorizacion.status })
    }

    if (tareaInicial.estado === 'aplicado' || tareaInicial.estado === 'rechazado') {
      return NextResponse.json({
        error: 'La tarea ya está cerrada y no admite otra decisión.',
        codigo: 'TASK_ALREADY_FINAL',
      }, { status: 409 })
    }

    const updateData: Record<string, unknown> = {
      estado: decisionValidada,
      comentario_coach: comentario_coach || null,
      revisado_at: new Date().toISOString(),
      revisado_por: user.id,
      error_aplicacion: null,
    }

    if (decisionValidada === 'modificado' && propuesta_final !== undefined) {
      updateData.propuesta = propuesta_final
    }

    const { data: tareaCompleta, error: updateError } = await db
      .from('agente_tareas')
      .update(updateData)
      .eq('id', tarea_id)
      .eq('estado', tareaInicial.estado)
      .select('*')
      .single()

    if (updateError?.code === 'PGRST116' || (!updateError && !tareaCompleta)) {
      const { data: tareaActual } = await db
        .from('agente_tareas')
        .select('estado')
        .eq('id', tarea_id)
        .maybeSingle()
      const estadoFinal = tareaActual?.estado === 'aplicado' || tareaActual?.estado === 'rechazado'

      return NextResponse.json({
        error: estadoFinal
          ? 'La tarea ya está cerrada y no admite otra decisión.'
          : 'La tarea cambió mientras se procesaba la decisión.',
        codigo: estadoFinal ? 'TASK_ALREADY_FINAL' : 'STATE_CONFLICT',
        accion: estadoFinal ? null : 'Recarga la tarea antes de volver a decidir.',
      }, { status: 409 })
    }

    if (updateError) {
      console.error('Error al actualizar tarea:', updateError)
      return NextResponse.json({ error: 'Error al actualizar tarea' }, { status: 500 })
    }

    if (tareaCompleta) {
      const tarea = tareaCompleta as AgenteTarea

      // Si aprobado o modificado → esperar la acción real antes de responder.
      if (decisionValidada === 'aprobado' || decisionValidada === 'modificado') {
        let resultadoAplicacion: Awaited<ReturnType<typeof aplicarTarea>>
        try {
          resultadoAplicacion = await aplicarTarea(tarea)
        } catch (error) {
          console.error('[tareas] Error aplicando tarea:', error)
          resultadoAplicacion = {
            ok: false,
            codigo: 'DB_ERROR',
            mensaje: 'Error inesperado al aplicar la tarea',
          }
        }

        if (!resultadoAplicacion.ok) {
          const errorAplicacion = resultadoAplicacion.mensaje ?? 'No se pudo aplicar la tarea'
          const { error: persistError } = await db
            .from('agente_tareas')
            .update({ error_aplicacion: errorAplicacion })
            .eq('id', tarea_id)

          if (persistError) {
            console.error('[tareas] Error guardando fallo de aplicación:', persistError)
          }

          registrarAprendizaje(tarea, decisionValidada, propuesta_final, comentario_coach).catch(() => null)
          const statusAplicacion = resultadoAplicacion.codigo === 'INVALID_PAYLOAD' ? 422 : 409
          return NextResponse.json({
            error: 'La decisión se guardó, pero no se pudo aplicar.',
            codigo: resultadoAplicacion.codigo,
            accion: 'Revisa el error de aplicación de la tarea y reintenta.',
          }, { status: statusAplicacion })
        }
      }

      // Registrar señal de aprendizaje (fire-and-forget)
      registrarAprendizaje(tarea, decisionValidada, propuesta_final, comentario_coach).catch(() => null)
    }

    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('Error en PATCH tareas:', error)
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
  }
}
