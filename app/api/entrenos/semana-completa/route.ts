import { NextRequest, NextResponse } from 'next/server'
import { createApiSupabase, createServiceSupabase } from '@/lib/supabase-server'
import { calcularBloqueInfo, clasificarTipoSesion } from '@/lib/entrenos/bloques'

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

  // Plan activo y cliente en una sola consulta (join interno por profile_id).
  const { data: planEntreno } = await admin
    .from('planes_entrenamiento')
    .select('id, nombre, created_at, duracion_semanas, cliente_id, cliente:clientes!inner(profile_id)')
    .eq('cliente.profile_id', user.id)
    .eq('activo', true)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (!planEntreno) {
    // Sin plan: se distingue "no hay cliente" de "cliente sin plan" como antes.
    const { data: clienteData } = await admin.from('clientes').select('id').eq('profile_id', user.id).maybeSingle()
    if (!clienteData) return NextResponse.json({ error: 'Cliente no encontrado' }, { status: 404 })
    return NextResponse.json({ sesiones: [], plan_nombre: '' })
  }

  const weekStart = startOfWeek()
  const weekEnd = new Date(weekStart)
  weekEnd.setDate(weekStart.getDate() + 6)

  // Sesiones con sus ejercicios y registros de la semana en paralelo (no dependen entre sí).
  const [{ data: sesRaw }, { data: registros }] = await Promise.all([
    admin
      .from('sesiones_entrenamiento')
      .select('id, nombre, dia_semana, duracion_estimada_min, contexto_ia, fase_bloque, sesion_ejercicios(id, ejercicio:ejercicios(tipo))')
      .eq('plan_id', planEntreno.id)
      .order('orden')
      .order('id'),
    admin
      .from('registros_sets')
      .select('sesion_ejercicio_id, fecha')
      .eq('cliente_id', planEntreno.cliente_id)
      .gte('fecha', toISODate(weekStart))
      .lte('fecha', toISODate(weekEnd)),
  ])

  const sesData = sesRaw ?? []
  if (sesData.length === 0) {
    return NextResponse.json({ sesiones: [], plan_nombre: planEntreno.nombre })
  }

  // Aplanado equivalente al antiguo select sobre sesion_ejercicios (id, sesion_id, ejercicio)
  const ejData = sesData.flatMap(s =>
    ((s as unknown as { sesion_ejercicios: { id: string; ejercicio: { tipo: string | null } | { tipo: string | null }[] | null }[] }).sesion_ejercicios ?? [])
      .map(e => ({ id: e.id, sesion_id: s.id, ejercicio: Array.isArray(e.ejercicio) ? e.ejercicio[0] ?? null : e.ejercicio }))
  )

  const ejCountBySesion: Record<string, number> = {}
  for (const ej of ejData) ejCountBySesion[ej.sesion_id] = (ejCountBySesion[ej.sesion_id] ?? 0) + 1

  // Count registros per sesion_id
  const registrosPorSesion: Record<string, number> = {}
  for (const r of registros ?? []) {
    const ejSesId = ejData.find(e => e.id === r.sesion_ejercicio_id)?.sesion_id
    if (ejSesId) registrosPorSesion[ejSesId] = (registrosPorSesion[ejSesId] ?? 0) + 1
  }

  const today = toISODate(new Date())
  const DIAS_ORDER: Record<string, number> = {
    Lunes: 0, Martes: 1, Miércoles: 2, Jueves: 3, Viernes: 4, Sábado: 5, Domingo: 6,
  }

  const tiposPorSesion: Record<string, string[]> = {}
  for (const ej of ejData) {
    const tipo = ej.ejercicio?.tipo
    if (!tipo) continue
    if (!tiposPorSesion[ej.sesion_id]) tiposPorSesion[ej.sesion_id] = []
    tiposPorSesion[ej.sesion_id].push(tipo)
  }

  const faseBloqueDelPlan = sesData.find(s => s.fase_bloque)?.fase_bloque as string | undefined
  const bloque = calcularBloqueInfo(planEntreno.created_at, planEntreno.duracion_semanas, faseBloqueDelPlan)

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
      tipo_sesion: clasificarTipoSesion(tiposPorSesion[s.id] ?? []),
      fecha,
      registros_count: registrosPorSesion[s.id] ?? 0,
      completada: (registrosPorSesion[s.id] ?? 0) > 0,
      esHoy: fecha === today,
    }
  })

  return NextResponse.json({ sesiones, plan_nombre: planEntreno.nombre, bloque })
}
