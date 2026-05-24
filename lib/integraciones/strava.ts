// lib/integraciones/strava.ts
import type { IntegracionCliente, ActividadExterna, ProveedorIntegracion } from './types'
import { createServiceSupabase } from '@/lib/supabase-server'

const BASE = 'https://www.strava.com'
const CLIENT_ID = process.env.STRAVA_CLIENT_ID!
const CLIENT_SECRET = process.env.STRAVA_CLIENT_SECRET!
const APP_URL = process.env.NEXT_PUBLIC_APP_URL!

// Mapa tipo actividad Strava → nombre normalizado
const TIPO_MAP: Record<string, string> = {
  Run: 'run', Ride: 'ride', Swim: 'swim', Walk: 'walk', Hike: 'hike',
  WeightTraining: 'strength', Workout: 'strength', Crossfit: 'strength',
  VirtualRide: 'ride', TrailRun: 'run', Triathlon: 'triathlon',
}

export const stravaProvider: ProveedorIntegracion = {
  proveedor: 'strava',

  getAuthUrl(clienteId: string, coachId: string): string {
    const state = Buffer.from(JSON.stringify({ clienteId, coachId })).toString('base64url')
    const params = new URLSearchParams({
      client_id: CLIENT_ID,
      redirect_uri: `${APP_URL}/api/integraciones/strava/callback`,
      response_type: 'code',
      approval_prompt: 'auto',
      scope: 'read,activity:read_all',
      state,
    })
    return `${BASE}/oauth/authorize?${params}`
  },

  async handleCallback(code: string, _state: string): Promise<Partial<IntegracionCliente>> {
    const res = await fetch(`${BASE}/oauth/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        client_id: CLIENT_ID,
        client_secret: CLIENT_SECRET,
        code,
        grant_type: 'authorization_code',
      }),
    })
    if (!res.ok) throw new Error(`Strava token exchange failed: ${await res.text()}`)
    const data = await res.json()
    return {
      access_token: data.access_token,
      refresh_token: data.refresh_token,
      token_expires_at: new Date(data.expires_at * 1000).toISOString(),
      proveedor_user_id: String(data.athlete?.id),
      scope: 'activity:read_all',
      activa: true,
    }
  },

  async revokeToken(integracion: IntegracionCliente): Promise<void> {
    if (!integracion.access_token) return
    await fetch(`${BASE}/oauth/deauthorize`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${integracion.access_token}` },
    }).catch(() => {}) // fire and forget
  },

  async syncActivities(integracion: IntegracionCliente, desde: Date): Promise<ActividadExterna[]> {
    const token = await refreshStravaTokenIfNeeded(integracion)
    const after = Math.floor(desde.getTime() / 1000)

    const res = await fetch(
      `${BASE}/api/v3/athlete/activities?after=${after}&per_page=30`,
      { headers: { Authorization: `Bearer ${token}` } }
    )
    if (!res.ok) throw new Error(`Strava activities fetch failed: ${res.status}`)
    const acts: Record<string, unknown>[] = await res.json()

    return acts.map(a => normalizeStravaActivity(integracion.cliente_id, a))
  },
}

async function refreshStravaTokenIfNeeded(integracion: IntegracionCliente): Promise<string> {
  if (!integracion.token_expires_at) return integracion.access_token!
  const expiresAt = new Date(integracion.token_expires_at)
  if (expiresAt > new Date(Date.now() + 5 * 60 * 1000)) return integracion.access_token!

  const res = await fetch(`${BASE}/oauth/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      client_id: CLIENT_ID,
      client_secret: CLIENT_SECRET,
      grant_type: 'refresh_token',
      refresh_token: integracion.refresh_token,
    }),
  })
  if (!res.ok) throw new Error('Strava refresh token failed')
  const data = await res.json()

  const db = createServiceSupabase()
  await db.from('integraciones_cliente').update({
    access_token: data.access_token,
    refresh_token: data.refresh_token,
    token_expires_at: new Date(data.expires_at * 1000).toISOString(),
  }).eq('id', integracion.id)

  return data.access_token
}

function normalizeStravaActivity(
  clienteId: string,
  a: Record<string, unknown>
): ActividadExterna {
  const duracionS = (a.moving_time as number) ?? 0
  const fecha = ((a.start_date_local as string) ?? '').split('T')[0]

  // TSS proxy: suffer_score × 0.4 (TSS real requiere FTP)
  const tss = a.suffer_score
    ? (a.suffer_score as number) * 0.4
    : undefined

  return {
    cliente_id: clienteId,
    proveedor: 'strava',
    fecha,
    tipo_entreno: TIPO_MAP[a.type as string] ?? String(a.type ?? ''),
    duracion_min: Math.round(duracionS / 60),
    distancia_entreno_km: a.distance ? parseFloat(((a.distance as number) / 1000).toFixed(2)) : undefined,
    calorias_activas: a.calories as number | undefined,
    fc_media: a.average_heartrate as number | undefined,
    fc_max: a.max_heartrate as number | undefined,
    tss,
    pace_min_km: a.average_speed && (a.type === 'Run')
      ? parseFloat((1000 / (a.average_speed as number) / 60).toFixed(2))
      : undefined,
    proveedor_activity_id: String(a.id),
    raw_data: a,
  }
}
