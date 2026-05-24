import { NextRequest, NextResponse } from 'next/server'
import { createServiceSupabase } from '@/lib/supabase-server'
import { stravaProvider } from '@/lib/integraciones/strava'

export async function GET(req: NextRequest) {
  const clienteId = req.nextUrl.searchParams.get('cliente_id')
  const codigo = req.nextUrl.searchParams.get('codigo')

  let resolvedClienteId = clienteId

  // Soporte para llamada desde portal cliente (sin sesión de coach)
  if (!resolvedClienteId && codigo) {
    const db = createServiceSupabase()
    const { data: cliente } = await db
      .from('clientes').select('id').eq('codigo_portal', codigo).single()
    if (!cliente) return NextResponse.json({ error: 'Cliente no encontrado' }, { status: 404 })
    resolvedClienteId = cliente.id
  }

  if (!resolvedClienteId) return NextResponse.json({ error: 'cliente_id requerido' }, { status: 400 })

  const url = stravaProvider.getAuthUrl(resolvedClienteId, 'portal')
  return NextResponse.redirect(url)
}
