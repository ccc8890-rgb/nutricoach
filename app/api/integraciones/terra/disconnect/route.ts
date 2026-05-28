import { NextRequest, NextResponse } from 'next/server'
import { createServiceSupabase } from '@/lib/supabase-server'
import { desconectarTerraUser } from '@/lib/integraciones/terra'

export async function DELETE(req: NextRequest) {
  const terraUserId = req.nextUrl.searchParams.get('terra_user_id')
  const codigo = req.nextUrl.searchParams.get('codigo')
  const clienteId = req.nextUrl.searchParams.get('cliente_id')

  if (!terraUserId) return NextResponse.json({ error: 'terra_user_id requerido' }, { status: 400 })

  const db = createServiceSupabase()

  // Verificar que el terra_user_id pertenece al cliente correcto
  let resolvedClienteId = clienteId
  if (!resolvedClienteId && codigo) {
    const { data: plan } = await db
      .from('planes_nutricion').select('cliente_id').eq('codigo_publico', codigo).eq('activo', true).single()
    resolvedClienteId = plan?.cliente_id ?? null
  }

  if (resolvedClienteId) {
    const { data: conn } = await db
      .from('terra_usuarios').select('cliente_id').eq('terra_user_id', terraUserId).single()
    if (conn?.cliente_id !== resolvedClienteId) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
    }
  }

  await desconectarTerraUser(terraUserId)
  await db.from('terra_usuarios').update({ activa: false }).eq('terra_user_id', terraUserId)

  return NextResponse.json({ ok: true })
}
