// lib/integraciones/garmin.ts
// Garmin Health API — OAuth2
// Documentación: https://developer.garmin.com/gc-developer-program/health-api/
import type { IntegracionCliente, ActividadExterna, ProveedorIntegracion } from './types'
import { createServiceSupabase } from '@/lib/supabase-server'

const BASE = 'https://connect.garmin.com'
const API = 'https://apis.garmin.com'
const CLIENT_ID = process.env.GARMIN_CLIENT_ID!
const CLIENT_SECRET = process.env.GARMIN_CLIENT_SECRET!
const APP_URL = process.env.NEXT_PUBLIC_APP_URL!

export const garminProvider: ProveedorIntegracion = {
  proveedor: 'garmin',

  getAuthUrl(clienteId: string, _coachId: string): string {
    const state = Buffer.from(JSON.stringify({ clienteId })).toString('base64url')
    const params = new URLSearchParams({
      client_id: CLIENT_ID,
      redirect_uri: `${APP_URL}/api/integraciones/garmin/callback`,
      response_type: 'code',
      scope: 'ACTIVITY_EXPORT DAILY_SUMMARY',
      state,
    })
    return `${BASE}/oauth2/authorize?${params}`
  },

  async handleCallback(code: string, _state: string): Promise<Partial<IntegracionCliente>> {
    const body = new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      redirect_uri: `${APP_URL}/api/integraciones/garmin/callback`,
      client_id: CLIENT_ID,
      client_secret: CLIENT_SECRET,
    })
    const res = await fetch(`${BASE}/oauth2/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: body.toString(),
    })
    if (!res.ok) throw new Error(`Garmin token exchange failed: ${await res.text()}`)
    const data = await res.json()
    return {
      access_token: data.access_token,
      refresh_token: data.refresh_token,
      token_expires_at: new Date(Date.now() + data.expires_in * 1000).toISOString(),
      scope: 'ACTIVITY_EXPORT DAILY_SUMMARY',
      activa: true,
    }
  },

  async revokeToken(integracion: IntegracionCliente): Promise<void> {
    if (!integracion.access_token) return
    await fetch(`${BASE}/oauth2/token/revoke`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Authorization: `Bearer ${integracion.access_token}`,
      },
      body: new URLSearchParams({ token: integracion.access_token }).toString(),
    }).catch(() => {})
  },

  async syncActivities(integracion: IntegracionCliente, desde: Date): Promise<ActividadExterna[]> {
    const token = await refreshGarminToken(integracion)
    const uploadStartTimeInSeconds = Math.floor(desde.getTime() / 1000)

    const res = await fetch(
      `${API}/wellness-api/rest/dailies?uploadStartTimeInSeconds=${uploadStartTimeInSeconds}&uploadEndTimeInSeconds=${Math.floor(Date.now() / 1000)}`,
      { headers: { Authorization: `Bearer ${token}` } }
    )
    if (!res.ok) {
      if (res.status === 429) throw new Error('Garmin rate limit')
      throw new Error(`Garmin dailies failed: ${res.status}`)
    }
    const data = await res.json()
    const summaries: Record<string, unknown>[] = data.dailies ?? []

    return summaries.map(s => ({
      cliente_id: integracion.cliente_id,
      proveedor: 'garmin' as const,
      fecha: String(s.calendarDate ?? '').split('T')[0],
      pasos: s.totalSteps as number | undefined,
      calorias_activas: s.activeKilocalories as number | undefined,
      calorias_totales: (s.bmrKilocalories as number ?? 0) + (s.activeKilocalories as number ?? 0) || undefined,
      minutos_activo: s.moderateIntensityMinutes as number | undefined,
      minutos_alta_intensidad: s.vigorousIntensityMinutes as number | undefined,
      rhr: s.restingHeartRateInBeatsPerMinute as number | undefined,
      hrv: s.avgWakingRespirationValue as number | undefined,
      sueno_h: s.sleepingSeconds ? parseFloat(((s.sleepingSeconds as number) / 3600).toFixed(1)) : undefined,
      proveedor_activity_id: String(s.summaryId ?? s.calendarDate),
      raw_data: s,
    }))
  },
}

async function refreshGarminToken(integracion: IntegracionCliente): Promise<string> {
  if (!integracion.token_expires_at) return integracion.access_token!
  const expiresAt = new Date(integracion.token_expires_at)
  if (expiresAt > new Date(Date.now() + 5 * 60 * 1000)) return integracion.access_token!

  const body = new URLSearchParams({
    grant_type: 'refresh_token',
    refresh_token: integracion.refresh_token!,
    client_id: CLIENT_ID,
    client_secret: CLIENT_SECRET,
  })
  const res = await fetch(`${BASE}/oauth2/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  })
  if (!res.ok) throw new Error('Garmin refresh failed')
  const data = await res.json()

  const db = createServiceSupabase()
  await db.from('integraciones_cliente').update({
    access_token: data.access_token,
    refresh_token: data.refresh_token,
    token_expires_at: new Date(Date.now() + data.expires_in * 1000).toISOString(),
  }).eq('id', integracion.id)

  return data.access_token
}
