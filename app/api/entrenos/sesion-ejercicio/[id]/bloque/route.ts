import { NextRequest, NextResponse } from 'next/server'
import { createApiSupabase, createServiceSupabase } from '@/lib/supabase-server'
import { resolverActualizacionBloque } from '@/lib/training/session-block-update'

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { data: { user }, error: authError } = await createApiSupabase(request).auth.getUser()
    if (authError || !user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

    const body: unknown = await request.json().catch(() => null)
    const bloque = body && typeof body === 'object' && !Array.isArray(body)
      ? (body as Record<string, unknown>).bloque
      : undefined

    const { id } = await params
    const admin = createServiceSupabase()
    const { data: ejercicio, error: ejercicioError } = await admin
      .from('sesion_ejercicios')
      .select('id, sesion_id')
      .eq('id', id)
      .maybeSingle()
    if (ejercicioError) throw new Error('No se pudo consultar el ejercicio de la sesión')
    if (!ejercicio) return NextResponse.json({ error: 'Ejercicio no encontrado' }, { status: 404 })

    const { data: sesion, error: sesionError } = await admin
      .from('sesiones_entrenamiento')
      .select('plan_id')
      .eq('id', ejercicio.sesion_id)
      .maybeSingle()
    if (sesionError) throw new Error('No se pudo consultar la sesión')
    if (!sesion) return NextResponse.json({ error: 'Ejercicio no encontrado' }, { status: 404 })

    const { data: plan, error: planError } = await admin
      .from('planes_entrenamiento')
      .select('coach_id')
      .eq('id', sesion.plan_id)
      .maybeSingle()
    if (planError) throw new Error('No se pudo consultar el plan')
    if (!plan) return NextResponse.json({ error: 'Ejercicio no encontrado' }, { status: 404 })

    const decision = resolverActualizacionBloque({
      solicitado: bloque,
      coachId: user.id,
      propietarioId: plan.coach_id,
    })
    if (!decision.ok) return NextResponse.json({ error: decision.error }, { status: decision.status })

    const { data: actualizado, error: updateError } = await admin
      .from('sesion_ejercicios')
      .update({ bloque: decision.bloque })
      .eq('id', ejercicio.id)
      .select('bloque')
      .single()
    if (updateError) throw new Error('No se pudo actualizar el bloque')

    return NextResponse.json({ ok: true, bloque: actualizado.bloque })
  } catch (error) {
    console.error('Error PATCH /api/entrenos/sesion-ejercicio/[id]/bloque:', error)
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
  }
}
