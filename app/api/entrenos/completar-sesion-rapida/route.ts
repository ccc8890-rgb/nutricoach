import { NextRequest, NextResponse } from 'next/server'
import { createApiSupabase, createServiceSupabase } from '@/lib/supabase-server'

export async function POST(request: NextRequest) {
  const supabase = createApiSupabase(request)
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  let body: { sesion_id: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Body inválido' }, { status: 400 })
  }

  const { sesion_id } = body
  if (!sesion_id) {
    return NextResponse.json({ error: 'Falta sesion_id' }, { status: 400 })
  }

  const admin = createServiceSupabase()

  // Resolve cliente_id
  const { data: clienteData } = await admin
    .from('clientes')
    .select('id')
    .eq('profile_id', user.id)
    .single()

  if (!clienteData) {
    return NextResponse.json({ error: 'Cliente no encontrado' }, { status: 404 })
  }
  const cliente_id = clienteData.id

  // Verify session belongs to this client
  const { data: sesionData } = await admin
    .from('sesiones_entrenamiento')
    .select('id, plan:planes_entrenamiento!inner(cliente_id)')
    .eq('id', sesion_id)
    .single()

  if (!sesionData) {
    return NextResponse.json({ error: 'Sesión no encontrada' }, { status: 404 })
  }

  const sesionPlan = sesionData.plan as unknown as { cliente_id: string } | null
  if (!sesionPlan || sesionPlan.cliente_id !== cliente_id) {
    return NextResponse.json({ error: 'Sin acceso a esta sesión' }, { status: 403 })
  }

  const fecha = new Date().toISOString().split('T')[0]

  // Check if already completed today
  const { data: existentes } = await admin
    .from('registros_sets')
    .select('sesion_ejercicio_id')
    .eq('fecha', fecha)
    .eq('cliente_id', cliente_id)
    .in('sesion_ejercicio_id', (
      await admin
        .from('sesion_ejercicios')
        .select('id')
        .eq('sesion_id', sesion_id)
    ).data?.map(e => e.id) ?? [])
    .limit(1)

  if (existentes && existentes.length > 0) {
    return NextResponse.json({ ok: true, ya_completada: true })
  }

  // Get all exercises in this session
  const { data: ejercicios } = await admin
    .from('sesion_ejercicios')
    .select('id, ejercicio_id')
    .eq('sesion_id', sesion_id)

  if (!ejercicios || ejercicios.length === 0) {
    return NextResponse.json({ error: 'La sesión no tiene ejercicios' }, { status: 400 })
  }

  // Insert one row per exercise with empty sets marker
  const rows = ejercicios.map(ej => ({
    cliente_id,
    sesion_ejercicio_id: ej.id,
    ejercicio_id: ej.ejercicio_id,
    fecha,
    sets_ejecutados: [], // empty = completed without detailed data
  }))

  const { error } = await admin
    .from('registros_sets')
    .insert(rows)

  if (error) {
    console.error('[completar-sesion-rapida]', error)
    return NextResponse.json({ error: 'Error al guardar' }, { status: 500 })
  }

  return NextResponse.json({ ok: true, ya_completada: false })
}
