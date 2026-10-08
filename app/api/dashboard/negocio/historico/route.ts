import { NextRequest, NextResponse } from 'next/server'
import { createApiSupabase, createServiceSupabase } from '@/lib/supabase-server'

// Serie diaria de las cifras de negocio del coach autenticado (por defecto 90 días, máximo 365).
export async function GET(request: NextRequest) {
  const { data: { user } } = await createApiSupabase(request).auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const pedidos = Number(request.nextUrl.searchParams.get('dias'))
  const dias = Number.isInteger(pedidos) && pedidos > 0 ? Math.min(pedidos, 365) : 90
  const desde = new Date(Date.now() - dias * 86_400_000).toISOString().slice(0, 10)

  const { data, error } = await createServiceSupabase()
    .from('negocio_snapshots')
    .select('fecha, clientes_activos, clientes_membresia_activa, clientes_sin_membresia, mrr_estimado, ingresos_mes_actual, ingresos_30d')
    .eq('coach_id', user.id)
    .gte('fecha', desde)
    .order('fecha', { ascending: true })
  if (error) {
    console.error('[dashboard/negocio/historico]', error)
    return NextResponse.json({ error: 'No se pudo cargar el histórico' }, { status: 500 })
  }
  return NextResponse.json({ serie: data ?? [] })
}
