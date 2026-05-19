import { NextRequest, NextResponse } from 'next/server'
import { createApiSupabase, createServiceSupabase } from '@/lib/supabase-server'

interface SetEjecutado {
  set_num: number
  reps?: number
  peso_kg?: number
  rpe?: number
  tiempo_s?: number
  distancia_m?: number
}

interface EjercicioRegistro {
  sesion_ejercicio_id: string
  ejercicio_id: string
  sets_ejecutados: SetEjecutado[]
}

export async function POST(request: NextRequest) {
  const supabase = createApiSupabase(request)
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  let body: {
    sesion_id: string
    ejercicios: EjercicioRegistro[]
    duracion_sesion_s?: number
    esfuerzo_percibido?: number
    notas?: string
  }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Body inválido' }, { status: 400 })
  }

  const { sesion_id, ejercicios, duracion_sesion_s, esfuerzo_percibido, notas } = body
  if (!sesion_id || !ejercicios?.length) {
    return NextResponse.json({ error: 'Faltan datos requeridos' }, { status: 400 })
  }

  const admin = createServiceSupabase()

  // Resolve cliente_id from the authenticated user
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
    .select('id, plan:planes_entrenamiento(cliente_id)')
    .eq('id', sesion_id)
    .single()

  if (!sesionData) {
    return NextResponse.json({ error: 'Sesión no encontrada' }, { status: 404 })
  }

  const planClienteId = Array.isArray(sesionData.plan)
    ? sesionData.plan[0]?.cliente_id
    : (sesionData.plan as { cliente_id: string } | null)?.cliente_id

  if (planClienteId !== cliente_id) {
    return NextResponse.json({ error: 'Sin acceso a esta sesión' }, { status: 403 })
  }

  const fecha = new Date().toISOString().split('T')[0]

  // Insert one row per exercise
  const rows = ejercicios.map(ej => ({
    cliente_id,
    sesion_ejercicio_id: ej.sesion_ejercicio_id || null,
    ejercicio_id: ej.ejercicio_id,
    fecha,
    sets_ejecutados: ej.sets_ejecutados,
    duracion_sesion_s: duracion_sesion_s ?? null,
    esfuerzo_percibido: esfuerzo_percibido ?? null,
    notas: notas ?? null,
  }))

  const { data: insertedRows, error } = await admin
    .from('registros_sets')
    .insert(rows)
    .select('id')

  if (error) {
    console.error('[registrar-sesion]', error)
    return NextResponse.json({ error: 'Error al guardar los registros' }, { status: 500 })
  }

  return NextResponse.json({
    ok: true,
    registros: insertedRows?.length ?? rows.length,
    fecha,
  })
}
