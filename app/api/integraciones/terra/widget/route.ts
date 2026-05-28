// Genera la URL del widget de Terra para que el cliente conecte su proveedor
import { NextRequest, NextResponse } from 'next/server'
import { createServiceSupabase } from '@/lib/supabase-server'
import { generarWidgetSession } from '@/lib/integraciones/terra'

export async function GET(req: NextRequest) {
  const codigo = req.nextUrl.searchParams.get('codigo')
  const clienteId = req.nextUrl.searchParams.get('cliente_id')

  const db = createServiceSupabase()
  let resolvedClienteId = clienteId

  if (!resolvedClienteId && codigo) {
    const { data: plan } = await db
      .from('planes_nutricion').select('cliente_id').eq('codigo_publico', codigo).eq('activo', true).single()
    if (!plan) return NextResponse.json({ error: 'Cliente no encontrado' }, { status: 404 })
    resolvedClienteId = plan.cliente_id
  }

  if (!resolvedClienteId) return NextResponse.json({ error: 'cliente_id requerido' }, { status: 400 })

  const provider = req.nextUrl.searchParams.get('provider') ?? undefined

  try {
    const url = await generarWidgetSession(resolvedClienteId, provider)
    return NextResponse.redirect(url)
  } catch (err) {
    console.error('[terra-widget]', err)
    return NextResponse.json({ error: 'Error generando sesión Terra' }, { status: 500 })
  }
}
