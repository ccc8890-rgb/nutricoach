import { NextRequest, NextResponse } from 'next/server'
import { createApiSupabase, createServiceSupabase } from '@/lib/supabase-server'
import { googleFitProvider } from '@/lib/integraciones/google-fit'

export async function DELETE(req: NextRequest) {
  const supabase = createApiSupabase(req)
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
  const clienteId = req.nextUrl.searchParams.get('cliente_id')
  if (!clienteId) return NextResponse.json({ error: 'cliente_id requerido' }, { status: 400 })
  const db = createServiceSupabase()
  const { data: intg } = await db.from('integraciones_cliente').select('*')
    .eq('cliente_id', clienteId).eq('proveedor', 'google_fit').single()
  if (intg) {
    await googleFitProvider.revokeToken(intg as never)
    await db.from('integraciones_cliente').delete()
      .eq('cliente_id', clienteId).eq('proveedor', 'google_fit')
  }
  return NextResponse.json({ ok: true })
}
