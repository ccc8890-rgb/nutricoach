import { NextRequest, NextResponse } from 'next/server'
import { createApiSupabase, createServiceSupabase } from '@/lib/supabase-server'
import { copiarSesionesPlantillaAPlan } from '@/lib/entrenos/copiar-plan'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authSupabase = createApiSupabase(request)
    const { data: { user }, error: authError } = await authSupabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    const { id } = await params
    const body = await request.json()
    const clienteId = typeof body.cliente_id === 'string' ? body.cliente_id : ''
    const nombre = typeof body.nombre === 'string' ? body.nombre.trim() : ''

    if (!clienteId || !nombre) {
      return NextResponse.json({ error: 'cliente_id y nombre son obligatorios' }, { status: 400 })
    }

    const admin = createServiceSupabase()

    const { data: plantilla, error: plantillaError } = await admin
      .from('plantillas_entrenamiento')
      .select('id, coach_id, descripcion, duracion_semanas')
      .eq('id', id)
      .single()

    if (plantillaError || !plantilla) {
      return NextResponse.json({ error: 'Plantilla no encontrada' }, { status: 404 })
    }

    if (plantilla.coach_id !== user.id) {
      return NextResponse.json({ error: 'No tienes permiso sobre esta plantilla' }, { status: 403 })
    }

    const { data: cliente } = await admin
      .from('clientes')
      .select('id, coach_id')
      .eq('id', clienteId)
      .single()

    if (!cliente || cliente.coach_id !== user.id) {
      return NextResponse.json({ error: 'Cliente no encontrado' }, { status: 404 })
    }

    // Un solo plan activo por cliente: el nuevo sustituye al anterior.
    await admin.from('planes_entrenamiento').update({ activo: false }).eq('cliente_id', clienteId).eq('activo', true)

    const { data: plan, error: planError } = await admin
      .from('planes_entrenamiento')
      .insert({
        coach_id: user.id,
        cliente_id: clienteId,
        nombre,
        descripcion: plantilla.descripcion ?? null,
        duracion_semanas: plantilla.duracion_semanas ?? null,
        activo: true,
      })
      .select('id')
      .single()

    if (planError || !plan) {
      return NextResponse.json({ error: 'Error al crear el plan' }, { status: 500 })
    }

    // Copia completa: ejercicios, pasos de Garmin, fase del bloque y notas del coach.
    const copia = await copiarSesionesPlantillaAPlan(admin, id, plan.id)
    if (!copia.ok) {
      await admin.from('planes_entrenamiento').delete().eq('id', plan.id)
      return NextResponse.json({ error: 'La plantilla no tiene sesiones o no se pudieron copiar' }, { status: 400 })
    }

    return NextResponse.json({ ok: true, plan_id: plan.id })
  } catch (error) {
    console.error('Error POST /api/plantillas-entreno/[id]/asignar:', error)
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
  }
}
