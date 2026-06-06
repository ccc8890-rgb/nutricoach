import { NextRequest, NextResponse } from 'next/server'
import { createApiSupabase, createServiceSupabase } from '@/lib/supabase-server'

function startOfWeek() {
  const now = new Date()
  const day = now.getDay()
  // Monday-first week
  const diff = (day === 0 ? -6 : 1 - day)
  const monday = new Date(now)
  monday.setDate(now.getDate() + diff)
  monday.setHours(0, 0, 0, 0)
  return monday
}

function toISODate(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

export async function GET(request: NextRequest) {
  const supabase = createApiSupabase(request)
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  const admin = createServiceSupabase()

  const { data: clienteData } = await admin
    .from('clientes')
    .select('id')
    .eq('profile_id', user.id)
    .single()

  if (!clienteData) return NextResponse.json({ error: 'Cliente no encontrado' }, { status: 404 })

  const { data: planEntreno } = await admin
    .from('planes_entrenamiento')
    .select('id, nombre')
    .eq('cliente_id', clienteData.id)
    .eq('activo', true)
    .order('created_at', { ascending: false })
    .limit(1)
    .single()

  if (!planEntreno) return NextResponse.json({ sesiones: [], plan_nombre: '' })

  const { data: sesData } = await admin
    .from('sesiones_entrenamiento')
    .select('id, nombre, dia_semana, duracion_estimada_min, contexto_ia')
    .eq('plan_id', planEntreno.id)
    .order('orden')

  if (!sesData || sesData.length === 0) {
    return NextResponse.json({ sesiones: [], plan_nombre: planEntreno.nombre })
  }

  const sesIds = sesData.map(s => s.id)

  const { data: ejData } = await admin
    .from('sesion_ejercicios')
    .select('id, sesion_id')
    .in('sesion_id', sesIds)

  const ejCountBySesion: Record<string, number> = {}
  const ejIdsBySesion: Record<string, string[]> = {}
  for (const ej of ejData ?? []) {
    ejCountBySesion[ej.sesion_id] = (ejCountBySesion[ej.sesion_id] ?? 0) + 1
    if (!ejIdsBySesion[ej.sesion_id]) ejIdsBySesion[ej.sesion_id] = []
    ejIdsBySesion[ej.sesion_id].push(ej.id)
  }

  const allEjIds = (ejData ?? []).map(e => e.id)
  const weekStart = startOfWeek()
  const weekEnd = new Date(weekStart)
  weekEnd.setDate(weekStart.getDate() + 6)

  const { data: registros } = allEjIds.length > 0
    ? await admin
        .from('registros_sets')
        .select('sesion_ejercicio_id, fecha')
        .eq('cliente_id', clienteData.id)
        .gte('fecha', toISODate(weekStart))
        .lte('fecha', toISODate(weekEnd))
        .in('sesion_ejercicio_id', allEjIds)
    : { data: [] }

  // Count registros per sesion_id
  const registrosPorSesion: Record<string, number> = {}
  for (const r of registros ?? []) {
    const ejSesId = (ejData ?? []).find(e => e.id === r.sesion_ejercicio_id)?.sesion_id
    if (ejSesId) registrosPorSesion[ejSesId] = (registrosPorSesion[ejSesId] ?? 0) + 1
  }

  const today = toISODate(new Date())
  const DIAS_ORDER: Record<string, number> = {
    Lunes: 0, Martes: 1, Miércoles: 2, Jueves: 3, Viernes: 4, Sábado: 5, Domingo: 6,
  }

  const sesiones = sesData.map(s => {
    const diaOffset = DIAS_ORDER[s.dia_semana ?? ''] ?? 0
    const fecha = toISODate(new Date(weekStart.getTime() + diaOffset * 86400000))
    return {
      id: s.id,
      nombre: s.nombre,
      dia_semana: s.dia_semana ?? '',
      duracion_estimada_min: s.duracion_estimada_min ?? null,
      contexto_ia: s.contexto_ia ?? null,
      ejercicios_count: ejCountBySesion[s.id] ?? 0,
      fecha,
      registros_count: registrosPorSesion[s.id] ?? 0,
      completada: (registrosPorSesion[s.id] ?? 0) > 0,
      esHoy: fecha === today,
    }
  })

  return NextResponse.json({ sesiones, plan_nombre: planEntreno.nombre })
}
