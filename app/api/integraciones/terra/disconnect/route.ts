import { NextRequest, NextResponse } from 'next/server'
import { createServiceSupabase } from '@/lib/supabase-server'
import { desconectarTerraUser } from '@/lib/integraciones/terra'
import { autorizarAccesoCliente } from '@/lib/cliente/autorizar-acceso-cliente'

export async function DELETE(req: NextRequest) {
  const terraUserId = req.nextUrl.searchParams.get('terra_user_id')
  if (!terraUserId) return NextResponse.json({ error: 'terra_user_id requerido' }, { status: 400 })

  const auth = await autorizarAccesoCliente(req, {
    clienteId: req.nextUrl.searchParams.get('cliente_id'),
    codigo: req.nextUrl.searchParams.get('codigo'),
  })
  if (auth instanceof NextResponse) return auth

  const db = createServiceSupabase()

  // El terra_user_id debe pertenecer a ese cliente (antes se omitía si no llegaba cliente_id ni codigo).
  const { data: conn } = await db
    .from('terra_usuarios').select('cliente_id').eq('terra_user_id', terraUserId).single()
  if (conn?.cliente_id !== auth.clienteId) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
  }

  await desconectarTerraUser(terraUserId)
  await db.from('terra_usuarios').update({ activa: false }).eq('terra_user_id', terraUserId)

  return NextResponse.json({ ok: true })
}
