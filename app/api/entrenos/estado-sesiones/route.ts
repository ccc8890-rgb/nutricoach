import { NextRequest, NextResponse } from 'next/server'
import { createApiSupabase, createServiceSupabase } from '@/lib/supabase-server'

export async function GET(request: NextRequest) {
  const supabase = createApiSupabase(request)
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const planId = searchParams.get('plan_id')
  if (!planId) {
    return NextResponse.json({ error: 'Falta plan_id' }, { status: 400 })
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

  // Get all sesion_ejercicios for this plan's sessions
  const { data: ejercicios } = await admin
    .from('sesion_ejercicios')
    .select('id, sesion_id')
    .in('sesion_id', (
      await admin
        .from('sesiones_entrenamiento')
        .select('id')
        .eq('plan_id', planId)
    ).data?.map(s => s.id) ?? [])
    .limit(500)

  if (!ejercicios || ejercicios.length === 0) {
    return NextResponse.json({ completadas_hoy: [] })
  }

  const sesionEjIds = ejercicios.map(e => e.id)
  const fecha = new Date().toISOString().split('T')[0]

  // Get today's registros for these ejercicios
  const { data: registros } = await admin
    .from('registros_sets')
    .select('sesion_ejercicio_id, ejercicio_id')
    .eq('fecha', fecha)
    .eq('cliente_id', cliente_id)
    .in('sesion_ejercicio_id', sesionEjIds)
    .limit(500)

  // Map: sesion_id → true if it has at least one registro today
  const ejerciciosConRegistro = new Set(registros?.map(r => r.sesion_ejercicio_id) ?? [])
  const sesionesCompletadas = new Set<string>()

  for (const ej of ejercicios) {
    if (ejerciciosConRegistro.has(ej.id)) {
      sesionesCompletadas.add(ej.sesion_id)
    }
  }

  return NextResponse.json({
    completadas_hoy: Array.from(sesionesCompletadas),
  })
}
