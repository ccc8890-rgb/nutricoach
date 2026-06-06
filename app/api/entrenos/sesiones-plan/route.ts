import { NextRequest, NextResponse } from 'next/server'
import { createApiSupabase, createServiceSupabase } from '@/lib/supabase-server'

export async function GET(request: NextRequest) {
  const supabase = createApiSupabase(request)
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const planId = searchParams.get('plan_id')
  if (!planId) return NextResponse.json({ error: 'Falta plan_id' }, { status: 400 })

  const admin = createServiceSupabase()

  const { data: clienteData } = await admin
    .from('clientes')
    .select('id')
    .eq('profile_id', user.id)
    .single()

  if (!clienteData) return NextResponse.json({ error: 'Cliente no encontrado' }, { status: 404 })

  const { data: sesData } = await admin
    .from('sesiones_entrenamiento')
    .select('id, nombre, dia_semana, orden, duracion_estimada_min, contexto_ia')
    .eq('plan_id', planId)
    .order('orden')

  if (!sesData) return NextResponse.json({ sesiones: [] })

  const sesIds = sesData.map(s => s.id)

  // Get ejercicio counts per session
  const { data: ejData } = await admin
    .from('sesion_ejercicios')
    .select('id, sesion_id')
    .in('sesion_id', sesIds)

  const ejCountBySesion: Record<string, number> = {}
  for (const ej of ejData ?? []) {
    ejCountBySesion[ej.sesion_id] = (ejCountBySesion[ej.sesion_id] ?? 0) + 1
  }

  // Get today's completions
  const today = new Date().toISOString().split('T')[0]
  const allEjIds = (ejData ?? []).map(e => e.id)
  let completadasHoy: string[] = []

  if (allEjIds.length > 0) {
    const { data: registros } = await admin
      .from('registros_sets')
      .select('sesion_ejercicio_id')
      .eq('cliente_id', clienteData.id)
      .eq('fecha', today)
      .in('sesion_ejercicio_id', allEjIds)

    const conRegistro = new Set(registros?.map(r => r.sesion_ejercicio_id) ?? [])
    const sesCompletadas = new Set<string>()
    for (const ej of ejData ?? []) {
      if (conRegistro.has(ej.id)) sesCompletadas.add(ej.sesion_id)
    }
    completadasHoy = Array.from(sesCompletadas)
  }

  const sesiones = sesData.map(s => ({
    id: s.id,
    nombre: s.nombre,
    dia_semana: s.dia_semana ?? '',
    orden: s.orden,
    duracion_estimada_min: s.duracion_estimada_min ?? null,
    contexto_ia: s.contexto_ia ?? null,
    ejercicios_count: ejCountBySesion[s.id] ?? 0,
  }))

  return NextResponse.json({ sesiones, completadas_hoy: completadasHoy })
}
