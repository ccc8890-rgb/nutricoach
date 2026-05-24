// Strava envía GET para verificar el endpoint, y POST para cada actividad nueva
import { NextRequest, NextResponse } from 'next/server'
import { createServiceSupabase } from '@/lib/supabase-server'
import { stravaProvider } from '@/lib/integraciones/strava'
import { persistirActividades } from '@/lib/integraciones/normalizer'

const VERIFY_TOKEN = process.env.STRAVA_WEBHOOK_VERIFY_TOKEN!

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl
  const mode = searchParams.get('hub.mode')
  const token = searchParams.get('hub.verify_token')
  const challenge = searchParams.get('hub.challenge')

  if (mode === 'subscribe' && token === VERIFY_TOKEN && challenge) {
    return NextResponse.json({ 'hub.challenge': challenge })
  }
  return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
}

export async function POST(req: NextRequest) {
  const body = await req.json()
  if (body.object_type !== 'activity') return NextResponse.json({ ok: true })
  if (!['create', 'update'].includes(body.aspect_type)) return NextResponse.json({ ok: true })

  const db = createServiceSupabase()
  const stravaUserId = String(body.owner_id)

  const { data: integracion } = await db
    .from('integraciones_cliente')
    .select('*')
    .eq('proveedor', 'strava')
    .eq('proveedor_user_id', stravaUserId)
    .single()

  if (!integracion) return NextResponse.json({ ok: true })

  try {
    const desde = new Date(Date.now() - 2 * 60 * 60 * 1000) // últimas 2h
    const acts = await stravaProvider.syncActivities(integracion as never, desde)
    if (acts.length > 0) await persistirActividades(db, acts)
  } catch (err) {
    console.error('[strava-webhook]', err)
  }

  return NextResponse.json({ ok: true })
}
