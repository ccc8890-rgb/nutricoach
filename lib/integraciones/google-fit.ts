// lib/integraciones/google-fit.ts
// Google Fit REST API — https://developers.google.com/fit/rest
import type { IntegracionCliente, ActividadExterna, ProveedorIntegracion } from './types'
import { createServiceSupabase } from '@/lib/supabase-server'

const OAUTH_BASE = 'https://accounts.google.com/o/oauth2/v2/auth'
const TOKEN_URL = 'https://oauth2.googleapis.com/token'
const FIT_API = 'https://www.googleapis.com/fitness/v1/users/me'
const CLIENT_ID = process.env.GOOGLE_FIT_CLIENT_ID!
const CLIENT_SECRET = process.env.GOOGLE_FIT_CLIENT_SECRET!
const APP_URL = process.env.NEXT_PUBLIC_APP_URL!

const SCOPES = [
  'https://www.googleapis.com/auth/fitness.activity.read',
  'https://www.googleapis.com/auth/fitness.heart_rate.read',
  'https://www.googleapis.com/auth/fitness.sleep.read',
  'https://www.googleapis.com/auth/fitness.body.read',
].join(' ')

export const googleFitProvider: ProveedorIntegracion = {
  proveedor: 'google_fit',

  getAuthUrl(clienteId: string, _coachId: string): string {
    const state = Buffer.from(JSON.stringify({ clienteId })).toString('base64url')
    const params = new URLSearchParams({
      client_id: CLIENT_ID,
      redirect_uri: `${APP_URL}/api/integraciones/google-fit/callback`,
      response_type: 'code',
      scope: SCOPES,
      access_type: 'offline',
      prompt: 'consent',
      state,
    })
    return `${OAUTH_BASE}?${params}`
  },

  async handleCallback(code: string, _state: string): Promise<Partial<IntegracionCliente>> {
    const res = await fetch(TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code, client_id: CLIENT_ID, client_secret: CLIENT_SECRET,
        redirect_uri: `${APP_URL}/api/integraciones/google-fit/callback`,
        grant_type: 'authorization_code',
      }).toString(),
    })
    if (!res.ok) throw new Error(`Google Fit token exchange failed: ${await res.text()}`)
    const data = await res.json()
    return {
      access_token: data.access_token,
      refresh_token: data.refresh_token,
      token_expires_at: new Date(Date.now() + data.expires_in * 1000).toISOString(),
      scope: SCOPES,
      activa: true,
    }
  },

  async revokeToken(integracion: IntegracionCliente): Promise<void> {
    if (!integracion.access_token) return
    await fetch(`https://oauth2.googleapis.com/revoke?token=${integracion.access_token}`, {
      method: 'POST',
    }).catch(() => {})
  },

  async syncActivities(integracion: IntegracionCliente, desde: Date): Promise<ActividadExterna[]> {
    const token = await refreshGoogleToken(integracion)
    const startMs = desde.getTime()
    const endMs = Date.now()

    const STREAMS = [
      { dataSourceId: 'derived:com.google.step_count.delta:com.google.android.gms:estimated_steps', field: 'pasos' },
      { dataSourceId: 'derived:com.google.calories.expended:com.google.android.gms:from_activities', field: 'calorias' },
      { dataSourceId: 'derived:com.google.active_minutes:com.google.android.gms:merge_active_minutes', field: 'minutos' },
    ]

    const results: Record<string, number> = {}
    for (const { dataSourceId, field } of STREAMS) {
      const res = await fetch(
        `${FIT_API}/dataSources/${encodeURIComponent(dataSourceId)}/datasets/${startMs * 1000000}-${endMs * 1000000}`,
        { headers: { Authorization: `Bearer ${token}` } }
      )
      if (res.ok) {
        const data = await res.json()
        const total = (data.point ?? []).reduce((acc: number, p: Record<string, unknown>) => {
          const val = (p.value as { intVal?: number; fpVal?: number }[])?.[0]
          return acc + (val?.intVal ?? val?.fpVal ?? 0)
        }, 0)
        results[field] = total
      }
    }

    const fecha = new Date(startMs).toISOString().split('T')[0]
    return [{
      cliente_id: integracion.cliente_id,
      proveedor: 'google_fit',
      fecha,
      pasos: results['pasos'] ? Math.round(results['pasos']) : undefined,
      calorias_activas: results['calorias'] ? Math.round(results['calorias']) : undefined,
      minutos_activo: results['minutos'] ? Math.round(results['minutos']) : undefined,
      proveedor_activity_id: `${fecha}_aggregate`,
      raw_data: results,
    }]
  },
}

async function refreshGoogleToken(integracion: IntegracionCliente): Promise<string> {
  if (!integracion.token_expires_at) return integracion.access_token!
  if (new Date(integracion.token_expires_at) > new Date(Date.now() + 5 * 60 * 1000)) {
    return integracion.access_token!
  }
  const res = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      refresh_token: integracion.refresh_token!,
      client_id: CLIENT_ID, client_secret: CLIENT_SECRET,
      grant_type: 'refresh_token',
    }).toString(),
  })
  if (!res.ok) throw new Error('Google Fit refresh failed')
  const data = await res.json()
  const db = createServiceSupabase()
  await db.from('integraciones_cliente').update({
    access_token: data.access_token,
    token_expires_at: new Date(Date.now() + data.expires_in * 1000).toISOString(),
  }).eq('id', integracion.id)
  return data.access_token
}
