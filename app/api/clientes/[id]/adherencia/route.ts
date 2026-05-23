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

  const { data: checkins } = await db
    .from('checkins')
    .select('fecha, adherencia, energia, sueno')
    .eq('cliente_id', clienteId)
    .order('fecha', { ascending: false })
    .limit(20)

  const score = calcularAdherencia(checkins ?? [])
  return NextResponse.json(score)
}
