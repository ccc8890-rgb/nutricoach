import { NextRequest, NextResponse } from 'next/server'
import { autorizarCoachCliente } from '@/lib/auth/autorizar-coach-cliente'
import { normalizarHoraInicio } from '@/lib/ajustes-coach-validacion'
import { createApiSupabase, createServiceSupabase } from '@/lib/supabase-server'

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { data: { user }, error: authError } = await createApiSupabase(request).auth.getUser()
    if (authError || !user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

    const body: unknown = await request.json().catch(() => null)
    const horaInicio = normalizarHoraInicio(
      body && typeof body === 'object' && !Array.isArray(body)
        ? (body as Record<string, unknown>).hora_inicio
        : undefined,
    )
    if (horaInicio === undefined) return NextResponse.json({ error: 'Hora de inicio inválida' }, { status: 400 })

    const { id } = await params
    const db = createServiceSupabase()
    const { data: perfil, error: perfilError } = await db.from('profiles').select('role').eq('id', user.id).maybeSingle()
    if (perfilError) throw new Error('No se pudo consultar el perfil')
    if (perfil?.role !== 'coach') return NextResponse.json({ error: 'Sin acceso' }, { status: 403 })

    const { data: sesion, error: sesionError } = await db
      .from('sesiones_entrenamiento')
      .select('id,plan_id')
      .eq('id', id)
      .maybeSingle()
    if (sesionError) throw new Error('No se pudo consultar la sesión')
    if (!sesion) return NextResponse.json({ error: 'Sesión no encontrada' }, { status: 404 })

    const { data: plan, error: planError } = await db
      .from('planes_entrenamiento')
      .select('cliente_id')
      .eq('id', sesion.plan_id)
      .maybeSingle()
    if (planError) throw new Error('No se pudo consultar el plan')
    if (!plan?.cliente_id) return NextResponse.json({ error: 'Sesión no encontrada' }, { status: 404 })

    const acceso = await autorizarCoachCliente(db, { userId: user.id, clienteId: plan.cliente_id })
    if (!acceso.ok) return NextResponse.json({ error: acceso.mensaje }, { status: acceso.status })

    const { data, error } = await db
      .from('sesiones_entrenamiento')
      .update({ hora_inicio: horaInicio })
      .eq('id', id)
      .select('id,hora_inicio')
      .single()
    if (error) throw new Error('No se pudo actualizar la sesión')

    return NextResponse.json({ data })
  } catch (error) {
    console.error('Error PATCH /api/entrenos/sesion/[id]/hora:', error)
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
  }
}
