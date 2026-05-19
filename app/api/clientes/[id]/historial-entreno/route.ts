import { NextRequest, NextResponse } from 'next/server'
import { createApiSupabase, createServiceSupabase } from '@/lib/supabase-server'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = createApiSupabase(request)
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  const { id: clienteId } = await params
  const url = new URL(request.url)
  const dias = parseInt(url.searchParams.get('dias') ?? '60')

  const admin = createServiceSupabase()

  // Verify coach owns this client
  const { data: clienteData } = await admin
    .from('clientes')
    .select('id, coach_id')
    .eq('id', clienteId)
    .single()

  if (!clienteData || clienteData.coach_id !== user.id) {
    return NextResponse.json({ error: 'Sin acceso' }, { status: 403 })
  }

  const desde = new Date()
  desde.setDate(desde.getDate() - dias)
  const desdeStr = desde.toISOString().split('T')[0]

  const [registrosRes, prsRes] = await Promise.all([
    admin
      .from('registros_sets')
      .select('id, fecha, sets_ejecutados, duracion_sesion_s, esfuerzo_percibido, notas, ejercicio:ejercicios(id, nombre, grupo_muscular)')
      .eq('cliente_id', clienteId)
      .gte('fecha', desdeStr)
      .order('fecha', { ascending: false })
      .order('created_at', { ascending: true }),
    admin
      .from('prs_por_ejercicio')
      .select('ejercicio_id, fecha, peso_max_kg, reps_en_pr, volumen_pr')
      .eq('cliente_id', clienteId)
      .not('peso_max_kg', 'is', null)
      .order('volumen_pr', { ascending: false })
      .limit(20),
  ])

  // Fetch exercise names for PRs
  const prEjercicioIds = (prsRes.data ?? []).map(p => p.ejercicio_id)
  const { data: ejerciciosMeta } = prEjercicioIds.length
    ? await admin.from('ejercicios').select('id, nombre, grupo_muscular').in('id', prEjercicioIds)
    : { data: [] }

  const ejMap: Record<string, { nombre: string; grupo_muscular: string }> = {}
  for (const e of ejerciciosMeta ?? []) ejMap[e.id] = { nombre: e.nombre, grupo_muscular: e.grupo_muscular }

  const prs = (prsRes.data ?? []).map(p => ({
    ejercicio_id: p.ejercicio_id,
    ejercicio_nombre: ejMap[p.ejercicio_id]?.nombre ?? '—',
    grupo_muscular: ejMap[p.ejercicio_id]?.grupo_muscular ?? '',
    peso_max_kg: p.peso_max_kg,
    reps_en_pr: p.reps_en_pr,
    volumen_pr: p.volumen_pr,
    fecha: p.fecha,
  }))

  // Group registros by date
  const byFecha: Record<string, typeof registrosRes.data> = {}
  for (const r of registrosRes.data ?? []) {
    if (!byFecha[r.fecha]) byFecha[r.fecha] = []
    byFecha[r.fecha]!.push(r)
  }

  const sesiones = Object.entries(byFecha).map(([fecha, regs]) => ({
    fecha,
    duracion_sesion_s: regs![0]?.duracion_sesion_s ?? null,
    esfuerzo_percibido: regs![0]?.esfuerzo_percibido ?? null,
    ejercicios: regs!.map(r => {
      type EjRow = { id: string; nombre: string; grupo_muscular: string }
      const ej = (Array.isArray(r.ejercicio) ? r.ejercicio[0] : r.ejercicio) as EjRow | null
      return {
        id: r.id,
        ejercicio_id: ej?.id ?? '',
        ejercicio_nombre: ej?.nombre ?? '—',
        grupo_muscular: ej?.grupo_muscular ?? '',
        sets_ejecutados: r.sets_ejecutados as { set_num: number; reps?: number; peso_kg?: number }[],
      }
    }),
  }))

  return NextResponse.json({ prs, sesiones })
}
