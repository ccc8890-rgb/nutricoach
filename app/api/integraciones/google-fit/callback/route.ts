import { NextRequest, NextResponse } from 'next/server'
import { createServiceSupabase } from '@/lib/supabase-server'
import { googleFitProvider } from '@/lib/integraciones/google-fit'
import { persistirActividades } from '@/lib/integraciones/normalizer'

const APP_URL = process.env.NEXT_PUBLIC_APP_URL!

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl
  const code = searchParams.get('code')
  const state = searchParams.get('state')
  if (!code || !state) return NextResponse.redirect(`${APP_URL}/cliente/integraciones?error=gfit_denegado`)

  let clienteId: string
  try { clienteId = JSON.parse(Buffer.from(state, 'base64url').toString()).clienteId }
  catch { return NextResponse.redirect(`${APP_URL}/cliente/integraciones?error=state_invalido`) }

  const db = createServiceSupabase()
  try {
    const tokens = await googleFitProvider.handleCallback(code, state)
    await db.from('integraciones_cliente').upsert(
      { cliente_id: clienteId, proveedor: 'google_fit', ...tokens },
      { onConflict: 'cliente_id,proveedor' }
    )
    const { data: intg } = await db.from('integraciones_cliente').select('*')
      .eq('cliente_id', clienteId).eq('proveedor', 'google_fit').single()
    if (intg) {
      const acts = await googleFitProvider.syncActivities(intg as never, new Date(Date.now() - 7 * 24 * 60 * 60 * 1000))
      if (acts.length > 0) await persistirActividades(db, acts)
    }
  } catch (err) {
    console.error('[gfit-callback]', err)
    return NextResponse.redirect(`${APP_URL}/cliente/integraciones?error=gfit_error`)
  }
  return NextResponse.redirect(`${APP_URL}/cliente/integraciones?connected=google_fit`)
}
