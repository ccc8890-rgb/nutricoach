import { NextRequest, NextResponse } from 'next/server'
import { createApiSupabase, createServiceSupabase } from '@/lib/supabase-server'
import { calcularAdherencia } from '@/lib/adherencia/score'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: clienteId } = await params

  const authClient = createApiSupabase(request)
  const { data: { user } } = await authClient.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const db = createServiceSupabase()

  // Check-ins semanales (auto-reportados)
  const { data: checkins } = await db
    .from('checkins')
    .select('fecha, adherencia, energia, sueno')
    .eq('cliente_id', clienteId)
    .order('fecha', { ascending: false })
    .limit(20)

  // Registros de comidas diarios (últimos 14 días)
  const hace14d = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
  const { data: registros } = await db
    .from('registro_comidas_dia')
    .select('fecha, comida_id, estado')
    .eq('cliente_id', clienteId)
    .gte('fecha', hace14d)
    .order('fecha', { ascending: false })

  // Calcular adherencia diaria por día (% comidas hechas vs total)
  const porDia: Record<string, { hechas: number; total: number }> = {}
  for (const r of (registros ?? [])) {
    if (!porDia[r.fecha]) porDia[r.fecha] = { hechas: 0, total: 0 }
    porDia[r.fecha].total++
    if (r.estado === 'hecha' || r.estado === 'cambiada') porDia[r.fecha].hechas++
  }

  const diasConRegistro = Object.entries(porDia)
    .map(([fecha, { hechas, total }]) => ({
      fecha,
      pct: total > 0 ? Math.round((hechas / total) * 100) : 0,
      hechas,
      total,
    }))
    .sort((a, b) => b.fecha.localeCompare(a.fecha))

  const score = calcularAdherencia(checkins ?? [])

  // Enriquecer con datos de registro diario
  const mediaRegistroDiario = diasConRegistro.length > 0
    ? Math.round(diasConRegistro.reduce((s, d) => s + d.pct, 0) / diasConRegistro.length)
    : null

  return NextResponse.json({
    ...score,
    registro_diario: diasConRegistro,
    media_registro_diario: mediaRegistroDiario,
    dias_con_registro: diasConRegistro.length,
  })
}
