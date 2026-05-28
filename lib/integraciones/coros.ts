// lib/integraciones/coros.ts
// Coros Open Platform — OAuth 2.0 + actividades
// Docs: https://open.coros.com/
import type { IntegracionCliente, ActividadExterna, ProveedorIntegracion } from './types'
import { createServiceSupabase } from '@/lib/supabase-server'

const BASE_AUTH = 'https://open.coros.com'
const BASE_API = 'https://open.coros.com/v2/coros'
const CLIENT_ID = process.env.COROS_CLIENT_ID!
const CLIENT_SECRET = process.env.COROS_CLIENT_SECRET!
const APP_URL = process.env.NEXT_PUBLIC_APP_URL!

// Tipo actividad Coros → nombre normalizado
const TIPO_MAP: Record<number, string> = {
  100: 'run',
  101: 'trail_run',
  102: 'track_run',
  200: 'ride',
  201: 'indoor_ride',
  300: 'swim',
  301: 'open_water',
  400: 'triathlon',
  500: 'ski',
  600: 'strength',
  601: 'cardio',
  700: 'yoga',
  800: 'hike',
  900: 'walk',
  1000: 'multi_sport',
}

export const corosProvider: ProveedorIntegracion = {
  proveedor: 'coros',

  getAuthUrl(clienteId: string, _coachId: string): string {
    const state = Buffer.from(JSON.stringify({ clienteId })).toString('base64url')
    const params = new URLSearchParams({
      client_id: CLIENT_ID,
      redirect_uri: `${APP_URL}/api/integraciones/coros/callback`,
      response_type: 'code',
      state,
    })
    return `${BASE_AUTH}/oauth2/authorize?${params}`
  },

  async handleCallback(code: string, _state: string): Promise<Partial<IntegracionCliente>> {
    const res = await fetch(`${BASE_AUTH}/oauth2/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: CLIENT_ID,
        client_secret: CLIENT_SECRET,
        code,
        grant_type: 'authorization_code',
        redirect_uri: `${APP_URL}/api/integraciones/coros/callback`,
      }),
      signal: AbortSignal.timeout(15_000),
    })
    if (!res.ok) throw new Error(`Coros token exchange failed: ${await res.text()}`)
    const data = await res.json()
    return {
      access_token: data.access_token,
      refresh_token: data.refresh_token,
      token_expires_at: data.expires_in
        ? new Date(Date.now() + data.expires_in * 1000).toISOString()
        : null,
      proveedor_user_id: String(data.openId ?? data.userId ?? ''),
      scope: 'read',
      activa: true,
    }
  },

  async revokeToken(_integracion: IntegracionCliente): Promise<void> {
    // Coros no tiene endpoint de revocación público documentado — simplemente borramos localmente
  },

  async syncActivities(integracion: IntegracionCliente, desde: Date): Promise<ActividadExterna[]> {
    const token = await refreshCorosTokenIfNeeded(integracion)

    const startDate = formatCorosDate(desde)
    const endDate = formatCorosDate(new Date())

    const res = await fetch(
      `${BASE_API}/activity/list?size=30&pageNumber=1&startDate=${startDate}&endDate=${endDate}`,
      {
        headers: { Authorization: `Bearer ${token}` },
        signal: AbortSignal.timeout(15_000),
      }
    )
    if (!res.ok) throw new Error(`Coros activities fetch failed: ${res.status}`)
    const json = await res.json()

    if (json.apiCode !== '0000') throw new Error(`Coros API error: ${json.message}`)

    const items: Record<string, unknown>[] = json.result?.dataList ?? []
    return items.map(a => normalizeCorosActivity(integracion.cliente_id, a))
  },
}

async function refreshCorosTokenIfNeeded(integracion: IntegracionCliente): Promise<string> {
  if (!integracion.token_expires_at) return integracion.access_token!

  const expiresAt = new Date(integracion.token_expires_at)
  const margin = 5 * 60 * 1000 // 5 min antes de expirar
  if (Date.now() < expiresAt.getTime() - margin) return integracion.access_token!

  const res = await fetch(`${BASE_AUTH}/oauth2/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: CLIENT_ID,
      client_secret: CLIENT_SECRET,
      grant_type: 'refresh_token',
      refresh_token: integracion.refresh_token!,
    }),
    signal: AbortSignal.timeout(15_000),
  })
  if (!res.ok) throw new Error(`Coros token refresh failed: ${res.status}`)
  const data = await res.json()

  const db = createServiceSupabase()
  await db.from('integraciones_cliente').update({
    access_token: data.access_token,
    refresh_token: data.refresh_token ?? integracion.refresh_token,
    token_expires_at: data.expires_in
      ? new Date(Date.now() + data.expires_in * 1000).toISOString()
      : null,
  }).eq('id', integracion.id)

  return data.access_token
}

function formatCorosDate(d: Date): string {
  return d.toISOString().split('T')[0].replace(/-/g, '')
}

function normalizeCorosActivity(clienteId: string, a: Record<string, unknown>): ActividadExterna {
  const tipoNum = Number(a.type ?? a.sportType ?? 0)
  const tipoNombre = TIPO_MAP[tipoNum] ?? 'workout'

  const duracionSeg = Number(a.workoutTime ?? a.totalTime ?? 0)
  const distanciaM = Number(a.distance ?? 0)

  return {
    cliente_id: clienteId,
    proveedor: 'coros',
    proveedor_activity_id: String(a.labelId ?? a.activityId ?? ''),
    fecha: parseCorosDate(String(a.date ?? '')),
    tipo_entreno: tipoNombre,
    duracion_min: duracionSeg > 0 ? Math.round(duracionSeg / 60) : undefined,
    distancia_entreno_km: distanciaM > 0 ? Number((distanciaM / 1000).toFixed(2)) : undefined,
    calorias_activas: Number(a.calorie ?? a.calories ?? 0) || undefined,
    fc_media: Number(a.averageHeartRate ?? 0) || undefined,
    fc_max: Number(a.maxHeartRate ?? 0) || undefined,
    pace_min_km: parsePace(a),
    hrv: Number(a.hrv ?? 0) || undefined,
    raw_data: a,
  }
}

function parseCorosDate(s: string): string {
  // Coros devuelve fechas como "20240101" o "2024-01-01"
  if (s.includes('-')) return s.split('T')[0]
  if (s.length === 8) return `${s.slice(0, 4)}-${s.slice(4, 6)}-${s.slice(6, 8)}`
  return new Date().toISOString().split('T')[0]
}

function parsePace(a: Record<string, unknown>): number | undefined {
  const avgPace = Number(a.avgPace ?? 0)
  if (avgPace > 0) return Math.round(avgPace * 100) / 100

  // Calcular desde distancia y tiempo si están disponibles
  const durSeg = Number(a.workoutTime ?? 0)
  const distM = Number(a.distance ?? 0)
  if (durSeg > 0 && distM > 0) {
    const paceSecPerKm = (durSeg / distM) * 1000
    return Math.round((paceSecPerKm / 60) * 100) / 100
  }
  return undefined
}
