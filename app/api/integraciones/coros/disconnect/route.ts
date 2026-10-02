import { NextRequest, NextResponse } from 'next/server'
import { createServiceSupabase } from '@/lib/supabase-server'
import { autorizarAccesoCliente } from '@/lib/cliente/autorizar-acceso-cliente'

export async function DELETE(req: NextRequest) {
  const auth = await autorizarAccesoCliente(req, {
    clienteId: req.nextUrl.searchParams.get('cliente_id'),
    codigo: req.nextUrl.searchParams.get('codigo'),
  })
  if (auth instanceof NextResponse) return auth

  const db = createServiceSupabase()
  await db.from('integraciones_cliente').delete()
    .eq('cliente_id', auth.clienteId).eq('proveedor', 'coros')

  return NextResponse.json({ ok: true })
}
