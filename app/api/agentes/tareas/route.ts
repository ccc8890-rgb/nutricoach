import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabase } from '@/lib/supabase-server'
import { registrarAprendizaje } from '@/lib/agentes/executor'

export async function GET(request: NextRequest) {
  try {
    const supabase = await createServerSupabase()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const estado = searchParams.get('estado')
    const limite = parseInt(searchParams.get('limite') || '50', 10)

    let query = supabase
      .from('agente_tareas')
      .select(`
        *,
        clientes!cliente_id (
          id,
          profiles ( nombre, apellidos )
        )
      `)
      .order('prioridad', { ascending: true })
      .order('created_at', { ascending: false })
      .limit(limite)

    if (estado) {
      query = query.eq('estado', estado)
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

    const body = await request.json()
    const { tarea_id, decision, comentario_coach, propuesta_final } = body as {
      tarea_id: string
      decision: 'aprobado' | 'rechazado' | 'modificado'
      comentario_coach?: string
      propuesta_final?: string
    }

    if (!tarea_id || !decision) {
      return NextResponse.json({ error: 'Faltan campos requeridos' }, { status: 400 })
    }

    const updateData: Record<string, unknown> = {
      estado: decision,
      comentario_coach: comentario_coach || null,
      revisado_at: new Date().toISOString(),
    }

    if (decision === 'modificado' && propuesta_final !== undefined) {
      updateData.propuesta = propuesta_final
    }

    const { error: updateError } = await supabase
      .from('agente_tareas')
      .update(updateData)
      .eq('id', tarea_id)

    if (updateError) {
      console.error('Error al actualizar tarea:', updateError)
      return NextResponse.json({ error: 'Error al actualizar tarea' }, { status: 500 })
    }

    // Registrar aprendizaje
    try {
      await registrarAprendizaje(tarea_id, decision, comentario_coach)
    } catch (err) {
      console.error('Error al registrar aprendizaje (no bloqueante):', err)
    }

    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('Error en PATCH tareas:', error)
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
  }
}
