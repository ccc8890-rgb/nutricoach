import { NextRequest, NextResponse } from 'next/server'
import { createApiSupabase, createServiceSupabase } from '@/lib/supabase-server'

export async function GET(request: NextRequest) {
  const supabase = createApiSupabase(request)
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  const admin = createServiceSupabase()

  const { data: planes } = await admin
    .from('planes_entrenamiento')
    .select('cliente_id')
    .eq('coach_id', user.id)
    .eq('activo', true)

  const clienteIds = (planes ?? []).map(p => p.cliente_id).filter(Boolean) as string[]
  if (!clienteIds.length) return NextResponse.json({ clientes: [] })

  const hoy = new Date()
  const dayOfWeek = (hoy.getDay() + 6) % 7
  const lunes = new Date(hoy)
  lunes.setDate(hoy.getDate() - dayOfWeek)
  const hace7d = new Date(hoy)
  hace7d.setDate(hoy.getDate() - 6)
  const hace7dStr = hace7d.toISOString().split('T')[0]

  const { data: registros } = await admin
    .from('registros_sets')
    .select('cliente_id, fecha')
    .in('cliente_id', clienteIds)
    .gte('fecha', hace7dStr)

  const porCliente = new Map<string, Set<string>>()
  for (const cid of clienteIds) porCliente.set(cid, new Set())
  for (const r of registros ?? []) {
    if (r.cliente_id && r.fecha) porCliente.get(r.cliente_id)?.add(r.fecha)
  }

  const result = clienteIds.map(cid => {
    const fechas = porCliente.get(cid) ?? new Set<string>()

    const dots: boolean[] = Array.from({ length: 7 }, (_, i) => {
      const dia = new Date(lunes)
      dia.setDate(lunes.getDate() + i)
      return fechas.has(dia.toISOString().split('T')[0])
    })

    const sesiones7d = fechas.size
    const fatiga = sesiones7d >= 5

    return { cliente_id: cid, dots, sesiones7d, fatiga }
  })

  return NextResponse.json({ clientes: result })
}
