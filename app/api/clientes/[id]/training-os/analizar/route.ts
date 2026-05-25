import { NextRequest, NextResponse } from 'next/server'
import { createApiSupabase, createServiceSupabase } from '@/lib/supabase-server'
import { ejecutarAgenteReadiness } from '@/lib/agentes/readiness'
import { ejecutarAgenteRiesgoEntreno } from '@/lib/agentes/riesgo-entreno'
import { ejecutarRevisorSemanalEntreno } from '@/lib/agentes/revisor-semanal-entreno'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = createApiSupabase(request)
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  const { id: clienteId } = await params
  const admin = createServiceSupabase()

  const { data: cliente } = await admin
    .from('clientes')
    .select('id, coach_id')
    .eq('id', clienteId)
    .single()

  if (!cliente || cliente.coach_id !== user.id) {
    return NextResponse.json({ error: 'Sin acceso' }, { status: 403 })
  }

  const body = await request.json().catch(() => ({}))
  const semanal = body?.semanal === true

  await ejecutarAgenteReadiness(clienteId)
  await ejecutarAgenteRiesgoEntreno(clienteId)
  if (semanal) await ejecutarRevisorSemanalEntreno(clienteId)

  return NextResponse.json({ ok: true })
}
