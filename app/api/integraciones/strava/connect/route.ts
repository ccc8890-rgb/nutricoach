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
    const { data: plan } = await db
      .from('planes_nutricion').select('cliente_id').eq('codigo_publico', codigo).eq('activo', true).single()
    if (!plan) return NextResponse.json({ error: 'Cliente no encontrado' }, { status: 404 })
    resolvedClienteId = plan.cliente_id
  }

  if (!resolvedClienteId) return NextResponse.json({ error: 'cliente_id requerido' }, { status: 400 })

  const url = stravaProvider.getAuthUrl(resolvedClienteId, 'portal')
  return NextResponse.redirect(url)
}
