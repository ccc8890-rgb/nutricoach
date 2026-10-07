import { NextRequest, NextResponse } from 'next/server'
import { createApiSupabase, createServiceSupabase } from '@/lib/supabase-server'
import { autorizarCoachCliente } from '@/lib/auth/autorizar-coach-cliente'
import { informeMicronutrientesPlan } from '@/lib/micronutrientes/plan'

// Informe de micronutrientes (media diaria del plan activo) para el coach del cliente.
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: clienteId } = await params
  const { data: { user } } = await createApiSupabase(request).auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const db = createServiceSupabase()
  const auth = await autorizarCoachCliente(db, { userId: user.id, clienteId })
  if (!auth.ok) return NextResponse.json({ error: auth.mensaje }, { status: auth.status })

  const { data: plan } = await db.from('planes_nutricion').select('id, nombre, cliente_id')
    .eq('cliente_id', clienteId).eq('activo', true).order('created_at', { ascending: false }).limit(1).maybeSingle()
  if (!plan) return NextResponse.json({ error: 'Sin plan activo' }, { status: 404 })

  return NextResponse.json(await informeMicronutrientesPlan(db, plan))
}
