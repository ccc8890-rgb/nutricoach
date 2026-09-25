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

  const { data: clienteData, error: clienteError } = await admin
    .from('clientes')
    .select('id')
    .eq('profile_id', user.id)
    .maybeSingle()

  if (clienteError) return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  if (!clienteData) return NextResponse.json({ error: 'Cliente no encontrado' }, { status: 404 })

  const { data: planData, error: planError } = await admin
    .from('planes_entrenamiento')
    .select('id, cliente_id')
    .eq('id', planId)
    .maybeSingle()

  if (planError) return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  if (!planData || planData.cliente_id !== clienteData.id) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
  }

  const { data: sesData, error: sesError } = await admin
    .from('sesiones_entrenamiento')
    .select('id, nombre, dia_semana, orden, duracion_estimada_min, contexto_ia')
    .eq('plan_id', planId)
    .order('orden')

  if (sesError) return NextResponse.json({ error: 'Error interno' }, { status: 500 })

  const sesionesRaw = sesData ?? []
  const sesIds = sesionesRaw.map(s => s.id)

  let ejData: { id: string; sesion_id: string }[] = []
  if (sesIds.length > 0) {
    const { data, error } = await admin
      .from('sesion_ejercicios')
      .select('id, sesion_id')
      .in('sesion_id', sesIds)
    if (error) return NextResponse.json({ error: 'Error interno' }, { status: 500 })
    ejData = data ?? []
  }

  const ejCountBySesion: Record<string, number> = {}
  for (const ej of ejData) {
    ejCountBySesion[ej.sesion_id] = (ejCountBySesion[ej.sesion_id] ?? 0) + 1
  }

  const today = new Date().toISOString().split('T')[0]
  const allEjIds = ejData.map(e => e.id)
  let completadasHoy: string[] = []
  let registradasSemana: string[] = []

  if (allEjIds.length > 0) {
    const { data: registros, error: regError } = await admin
      .from('registros_sets')
      .select('sesion_ejercicio_id, fecha')
      .eq('cliente_id', clienteData.id)
      .eq('fecha', today)
      .in('sesion_ejercicio_id', allEjIds)

    if (regError) return NextResponse.json({ error: 'Error interno' }, { status: 500 })

    const conRegistro = new Set(registros?.map(r => r.sesion_ejercicio_id) ?? [])
    const sesCompletadas = new Set<string>()
    for (const ej of ejData) {
      if (conRegistro.has(ej.id)) sesCompletadas.add(ej.sesion_id)
    }
    completadasHoy = Array.from(sesCompletadas)

    const now = new Date()
    const dayOfWeek = now.getUTCDay()
    const diffToMonday = (dayOfWeek + 6) % 7
    const monday = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()))
    monday.setUTCDate(monday.getUTCDate() - diffToMonday)
    const nextMonday = new Date(monday)
    nextMonday.setUTCDate(nextMonday.getUTCDate() + 7)
    const mondayStr = monday.toISOString().split('T')[0]
    const nextMondayStr = nextMonday.toISOString().split('T')[0]

    const { data: registrosSemana, error: regSemError } = await admin
      .from('registros_sets')
      .select('sesion_ejercicio_id, fecha')
      .eq('cliente_id', clienteData.id)
      .gte('fecha', mondayStr)
      .lt('fecha', nextMondayStr)
      .in('sesion_ejercicio_id', allEjIds)

    if (regSemError) return NextResponse.json({ error: 'Error interno' }, { status: 500 })

    const ejToSesion = new Map<string, string>()
    for (const ej of ejData) ejToSesion.set(ej.id, ej.sesion_id)

    const sesSemana = new Set<string>()
    for (const r of registrosSemana ?? []) {
      const sesId = ejToSesion.get(r.sesion_ejercicio_id)
      if (sesId) sesSemana.add(sesId)
    }
    registradasSemana = Array.from(sesSemana)
  }

  const sesiones = sesionesRaw.map(s => ({
    id: s.id,
    nombre: s.nombre,
    dia_semana: s.dia_semana ?? '',
    orden: s.orden,
    duracion_estimada_min: s.duracion_estimada_min ?? null,
    contexto_ia: s.contexto_ia ?? null,
    ejercicios_count: ejCountBySesion[s.id] ?? 0,
  }))

  return NextResponse.json({ sesiones, completadas_hoy: completadasHoy, registradas_semana: registradasSemana })
}
