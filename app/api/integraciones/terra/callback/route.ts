// Terra redirige aquí tras conectar un proveedor en el widget
// Recibe: user_id (terra), reference_id (nuestro cliente_id), resource, provider
import { NextRequest, NextResponse } from 'next/server'
import { createServiceSupabase } from '@/lib/supabase-server'

const APP_URL = process.env.NEXT_PUBLIC_APP_URL!

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl
  const terraUserId = searchParams.get('user_id')
  const referenceId = searchParams.get('reference_id')  // nuestro cliente_id
  const provider = searchParams.get('resource')?.toUpperCase() ?? searchParams.get('provider')?.toUpperCase() ?? ''
  const status = searchParams.get('status')

  if (status === 'error' || !terraUserId || !referenceId) {
    return NextResponse.redirect(`${APP_URL}/?error=terra_denegado`)
  }

  const db = createServiceSupabase()

  // Buscar codigo_publico para redirigir al portal
  const { data: plan } = await db
    .from('planes_nutricion').select('codigo_publico').eq('cliente_id', referenceId).eq('activo', true).single()
  const portalUrl = plan?.codigo_publico ? `${APP_URL}/cliente/${plan.codigo_publico}` : `${APP_URL}/`

  try {
    await db.from('terra_usuarios').upsert(
      {
        terra_user_id: terraUserId,
        cliente_id: referenceId,
        provider,
        activa: true,
        ultima_sync: new Date().toISOString(),
      },
      { onConflict: 'terra_user_id' }
    )
  } catch (err) {
    console.error('[terra-callback]', err)
    return NextResponse.redirect(`${portalUrl}?error=terra_error`)
  }

  return NextResponse.redirect(`${portalUrl}?connected=terra_${provider.toLowerCase()}`)
}
