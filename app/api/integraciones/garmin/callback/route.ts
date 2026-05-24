import { NextRequest, NextResponse } from 'next/server'
import { createServiceSupabase } from '@/lib/supabase-server'
import { garminProvider } from '@/lib/integraciones/garmin'
import { persistirActividades } from '@/lib/integraciones/normalizer'

const APP_URL = process.env.NEXT_PUBLIC_APP_URL!

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl
  const code = searchParams.get('code')
  const state = searchParams.get('state')
  if (!code || !state) return NextResponse.redirect(`${APP_URL}/cliente/integraciones?error=garmin_denegado`)

  let clienteId: string
  try { clienteId = JSON.parse(Buffer.from(state, 'base64url').toString()).clienteId }
  catch { return NextResponse.redirect(`${APP_URL}/cliente/integraciones?error=state_invalido`) }

  const db = createServiceSupabase()
  try {
    const tokens = await garminProvider.handleCallback(code, state)
    await db.from('integraciones_cliente').upsert(
      { cliente_id: clienteId, proveedor: 'garmin', ...tokens },
      { onConflict: 'cliente_id,proveedor' }
    )
    const { data: integracion } = await db
      .from('integraciones_cliente').select('*')
      .eq('cliente_id', clienteId).eq('proveedor', 'garmin').single()
    if (integracion) {
      const acts = await garminProvider.syncActivities(integracion as never, new Date(Date.now() - 14 * 24 * 60 * 60 * 1000))
      if (acts.length > 0) await persistirActividades(db, acts)
    }
  } catch (err) {
    console.error('[garmin-callback]', err)
    return NextResponse.redirect(`${APP_URL}/cliente/integraciones?error=garmin_error`)
  }
  return NextResponse.redirect(`${APP_URL}/cliente/integraciones?connected=garmin`)
}
