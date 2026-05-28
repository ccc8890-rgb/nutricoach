import { NextRequest, NextResponse } from 'next/server'
import { createServiceSupabase } from '@/lib/supabase-server'

export async function DELETE(req: NextRequest) {
  const clienteId = req.nextUrl.searchParams.get('cliente_id')
  const codigo = req.nextUrl.searchParams.get('codigo')

  const db = createServiceSupabase()

  let resolvedClienteId = clienteId
  if (!resolvedClienteId && codigo) {
    const { data: plan } = await db
      .from('planes_nutricion').select('cliente_id').eq('codigo_publico', codigo).eq('activo', true).single()
    if (!plan) return NextResponse.json({ error: 'Cliente no encontrado' }, { status: 404 })
    resolvedClienteId = plan.cliente_id
  }

  if (!resolvedClienteId) return NextResponse.json({ error: 'cliente_id requerido' }, { status: 400 })

  await db.from('integraciones_cliente').delete()
    .eq('cliente_id', resolvedClienteId).eq('proveedor', 'coros')

  return NextResponse.json({ ok: true })
}
