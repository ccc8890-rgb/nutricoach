// lib/integraciones/whoop.ts
// WHOOP API v1 — https://developer.whoop.com/api
// NOTA: requiere aprobación de partner program antes de usar en producción
// OAuth2 credentials obtenidas en: https://developer.whoop.com/
import type { IntegracionCliente, ActividadExterna, ProveedorIntegracion } from './types'

const BASE = 'https://api.prod.whoop.com/developer'
const AUTH_URL = 'https://api.prod.whoop.com/oauth/oauth2/auth'
const TOKEN_URL = 'https://api.prod.whoop.com/oauth/oauth2/token'
const CLIENT_ID = process.env.WHOOP_CLIENT_ID ?? ''
const CLIENT_SECRET = process.env.WHOOP_CLIENT_SECRET ?? ''
const APP_URL = process.env.NEXT_PUBLIC_APP_URL!

export const whoopProvider: ProveedorIntegracion = {
  proveedor: 'whoop',

  getAuthUrl(clienteId: string, _coachId: string): string {
    const state = Buffer.from(JSON.stringify({ clienteId })).toString('base64url')
    const params = new URLSearchParams({
      client_id: CLIENT_ID,
      redirect_uri: `${APP_URL}/api/integraciones/whoop/callback`,
      response_type: 'code',
      scope: 'read:recovery read:sleep read:workout read:body_measurement',
      state,
    })
    return `${AUTH_URL}?${params}`
  },

  async handleCallback(code: string, _state: string): Promise<Partial<IntegracionCliente>> {
    const res = await fetch(TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'authorization_code', code,
        client_id: CLIENT_ID, client_secret: CLIENT_SECRET,
        redirect_uri: `${APP_URL}/api/integraciones/whoop/callback`,
      }).toString(),
    })
    if (!res.ok) throw new Error(`Whoop token exchange failed: ${await res.text()}`)
    const data = await res.json()
    return {
      access_token: data.access_token,
      refresh_token: data.refresh_token,
      token_expires_at: new Date(Date.now() + data.expires_in * 1000).toISOString(),
      scope: data.scope,
      activa: true,
    }
  },

  async revokeToken(integracion: IntegracionCliente): Promise<void> {
    if (!integracion.access_token) return
    await fetch(`${TOKEN_URL}/revoke`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${integracion.access_token}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({ token: integracion.access_token }).toString(),
    }).catch(() => {})
  },

  async syncActivities(integracion: IntegracionCliente, desde: Date): Promise<ActividadExterna[]> {
    const token = integracion.access_token!
    const start = desde.toISOString()
    const end = new Date().toISOString()

    // Recovery (HRV, RHR, sleep performance)
    const recRes = await fetch(
      `${BASE}/v1/recovery/collection?start=${start}&end=${end}`,
      { headers: { Authorization: `Bearer ${token}` } }
    )
    if (!recRes.ok) throw new Error(`Whoop recovery failed: ${recRes.status}`)
    const recData = await recRes.json()

    const recoveries: ActividadExterna[] = (recData.records ?? []).map((r: Record<string, unknown>) => {
      const score = r.score as Record<string, unknown> | undefined
      return {
        cliente_id: integracion.cliente_id,
        proveedor: 'whoop' as const,
        fecha: String(r.created_at ?? '').split('T')[0],
        hrv: score?.hrv_rmssd_on_sleep as number | undefined,
        rhr: score?.resting_heart_rate as number | undefined,
        sueno_calidad: score?.recovery_score as number | undefined,
        proveedor_activity_id: `recovery_${r.id}`,
        raw_data: r,
      }
    })

    return recoveries
  },
}
