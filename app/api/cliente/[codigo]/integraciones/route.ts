import { NextRequest, NextResponse } from 'next/server'
import { createServiceSupabase } from '@/lib/supabase-server'

export async function GET(_req: NextRequest, { params }: { params: Promise<{ codigo: string }> }) {
  const { codigo } = await params
  const db = createServiceSupabase()

  const { data: plan } = await db
    .from('planes_nutricion').select('cliente_id').eq('codigo_publico', codigo).eq('activo', true).single()
  if (!plan) return NextResponse.json({ error: 'Cliente no encontrado' }, { status: 404 })
  const cliente = { id: plan.cliente_id }

  const { data: integraciones } = await db
    .from('integraciones_cliente')
    .select('proveedor, activa, ultima_sync, error_ultimo')
    .eq('cliente_id', cliente.id)

  return NextResponse.json({ integraciones: integraciones ?? [] })
}
