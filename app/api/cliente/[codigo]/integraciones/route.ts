import { NextRequest, NextResponse } from 'next/server'
import { createServiceSupabase } from '@/lib/supabase-server'

export async function GET(_req: NextRequest, { params }: { params: Promise<{ codigo: string }> }) {
  const { codigo } = await params
  const db = createServiceSupabase()

  const { data: cliente } = await db
    .from('clientes').select('id').eq('codigo_publico', codigo).single()
  if (!cliente) return NextResponse.json({ error: 'Cliente no encontrado' }, { status: 404 })

  const { data: integraciones } = await db
    .from('integraciones_cliente')
    .select('proveedor, activa, ultima_sync, error_ultimo')
    .eq('cliente_id', cliente.id)

  return NextResponse.json({ integraciones: integraciones ?? [] })
}
