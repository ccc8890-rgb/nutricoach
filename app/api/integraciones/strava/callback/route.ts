import { NextRequest, NextResponse } from 'next/server'
import { createServiceSupabase } from '@/lib/supabase-server'
import { stravaProvider } from '@/lib/integraciones/strava'
import { persistirActividades } from '@/lib/integraciones/normalizer'

const APP_URL = process.env.NEXT_PUBLIC_APP_URL!

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl
  const code = searchParams.get('code')
  const state = searchParams.get('state')
  const error = searchParams.get('error')

  if (error || !code || !state) {
    return NextResponse.redirect(`${APP_URL}/cliente/integraciones?error=strava_denegado`)
  }

  let clienteId: string
  try {
    const decoded = JSON.parse(Buffer.from(state, 'base64url').toString())
    clienteId = decoded.clienteId
  } catch {
    return NextResponse.redirect(`${APP_URL}/cliente/integraciones?error=state_invalido`)
  }

  const db = createServiceSupabase()
  try {
    const tokens = await stravaProvider.handleCallback(code, state)
    await db.from('integraciones_cliente').upsert(
      { cliente_id: clienteId, proveedor: 'strava', ...tokens },
      { onConflict: 'cliente_id,proveedor' }
    )
    const { data: integracion } = await db
      .from('integraciones_cliente')
      .select('*')
      .eq('cliente_id', clienteId)
      .eq('proveedor', 'strava')
      .single()
    if (integracion) {
      const desde = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000)
      const acts = await stravaProvider.syncActivities(integracion as never, desde)
      if (acts.length > 0) await persistirActividades(db, acts)
    }
  } catch (err) {
    console.error('[strava-callback]', err)
    return NextResponse.redirect(`${APP_URL}/cliente/integraciones?error=strava_error`)
  }

  return NextResponse.redirect(`${APP_URL}/cliente/integraciones?connected=strava`)
}
