// lib/integraciones/terra.ts
// Terra API — agregador unificado de wearables y plataformas de entrenamiento
// Docs: https://docs.tryterra.co
// Proveedores soportados: TrainingPeaks, Coros, Whoop, Garmin, Strava, Polar, Wahoo, Suunto...

import type { ActividadExterna } from './types'

const API_KEY = process.env.TERRA_API_KEY!
const DEV_ID = process.env.TERRA_DEV_ID!
const TERRA_BASE = 'https://api.tryterra.co/v2'

// ─── Tipo de actividad Terra → normalizado ────────────────────────────────────

const ACTIVITY_TYPE_MAP: Record<number, string> = {
  0: 'workout',
  1: 'run',
  2: 'ride',
  3: 'ski',
  4: 'ski',
  5: 'swim',
  6: 'hike',
  7: 'walk',
  8: 'run',          // trail run
  9: 'ride',         // virtual ride
  10: 'strength',
  11: 'yoga',
  12: 'swim',        // open water
  13: 'rowing',
  14: 'triathlon',
  15: 'elliptical',
  16: 'cardio',
  17: 'workout',
  18: 'run',         // treadmill
  19: 'ride',        // indoor cycling
  20: 'strength',    // pilates
  21: 'crossfit',
  22: 'tennis',
  23: 'basketball',
  24: 'soccer',
  25: 'run',         // race
  26: 'multisport',
}

// ─── Widget session ───────────────────────────────────────────────────────────

export async function generarWidgetSession(referenceId: string): Promise<string> {
  const res = await fetch(`${TERRA_BASE}/auth/generateWidgetSession`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'dev-id': DEV_ID,
      'x-api-key': API_KEY,
    },
    body: JSON.stringify({
      reference_id: referenceId,   // nuestro cliente_id
      language: 'es',
      show_disconnect: true,
      // Proveedores que queremos mostrar en el widget
      providers: 'TRAININGPEAKS,COROS,WHOOP,GARMIN,POLAR,WAHOO,SUUNTO,WITHINGS,OURA',
      auth_success_redirect_url: process.env.NEXT_PUBLIC_APP_URL + '/api/integraciones/terra/callback',
    }),
    signal: AbortSignal.timeout(10_000),
  })

  if (!res.ok) throw new Error(`Terra widget session error: ${await res.text()}`)
  const data = await res.json()
  return data.url as string
}

// ─── Desconectar un usuario Terra ────────────────────────────────────────────

export async function desconectarTerraUser(terraUserId: string): Promise<void> {
  await fetch(`${TERRA_BASE}/auth/deauthenticateUser?user_id=${terraUserId}`, {
    method: 'DELETE',
    headers: { 'dev-id': DEV_ID, 'x-api-key': API_KEY },
    signal: AbortSignal.timeout(10_000),
  }).catch(() => {}) // fire and forget
}

// ─── Verificar firma webhook ──────────────────────────────────────────────────

export function verificarFirmaWebhook(body: string, signature: string | null): boolean {
  if (!signature) return false
  try {
    const crypto = require('crypto') as typeof import('crypto')
    const expected = crypto
      .createHmac('sha256', API_KEY)
      .update(body)
      .digest('hex')
    return crypto.timingSafeEqual(
      Buffer.from(expected, 'hex'),
      Buffer.from(signature, 'hex')
    )
  } catch {
    return false
  }
}

// ─── Normalización payload activity ──────────────────────────────────────────

export function normalizarTerraActivity(
  clienteId: string,
  provider: string,
  activity: Record<string, unknown>
): ActividadExterna {
  const dist = (activity.distance_data as Record<string, unknown> | null) ?? {}
  const hr = (activity.heart_rate_data as Record<string, unknown> | null) ?? {}
  const cal = (activity.calories_data as Record<string, unknown> | null) ?? {}
  const dur = (activity.active_durations_data as Record<string, unknown> | null) ?? {}
  const mov = (activity.movement_data as Record<string, unknown> | null) ?? {}

  const startTime = String(activity.start_time ?? '')
  const fecha = startTime ? startTime.split('T')[0] : new Date().toISOString().split('T')[0]
  const tipoNum = Number(activity.type ?? 0)
  const tipoNombre = ACTIVITY_TYPE_MAP[tipoNum] ?? 'workout'

  const distanciaM = Number((dist as Record<string, unknown>).distance_meters ?? 0)
  const duracionSeg = Number((dur as Record<string, unknown>).activity_seconds ?? 0)

  let pace: number | undefined
  if (distanciaM > 0 && duracionSeg > 0) {
    const secPerKm = (duracionSeg / distanciaM) * 1000
    pace = Math.round((secPerKm / 60) * 100) / 100
  }

  return {
    cliente_id: clienteId,
    proveedor: 'strava',    // se sobreescribe con el proveedor real al guardar
    proveedor_activity_id: String(activity.id ?? (activity.metadata as Record<string, unknown>)?.id ?? ''),
    fecha,
    tipo_entreno: tipoNombre,
    duracion_min: duracionSeg > 0 ? Math.round(duracionSeg / 60) : undefined,
    distancia_entreno_km: distanciaM > 0 ? Number((distanciaM / 1000).toFixed(2)) : undefined,
    calorias_activas: Number((cal as Record<string, unknown>).total_burned_calories ?? 0) || undefined,
    fc_media: Number((hr as Record<string, unknown>).avg_hr_bpm ?? 0) || undefined,
    fc_max: Number((hr as Record<string, unknown>).max_hr_bpm ?? 0) || undefined,
    pace_min_km: pace,
    raw_data: activity,
  }
}

// ─── Normalización payload daily ──────────────────────────────────────────────

export function normalizarTerraDaily(
  clienteId: string,
  daily: Record<string, unknown>
): ActividadExterna {
  const dist = (daily.distance_data as Record<string, unknown> | null) ?? {}
  const hr = (daily.heart_rate_data as Record<string, unknown> | null) ?? {}
  const cal = (daily.calories_data as Record<string, unknown> | null) ?? {}
  const hrv = (hr as Record<string, unknown>).hrv_rmssd_data as Record<string, unknown> | null

  const fecha = String(daily.date ?? new Date().toISOString().split('T')[0])

  return {
    cliente_id: clienteId,
    proveedor: 'strava',  // placeholder, se sobreescribe
    fecha: fecha.split('T')[0],
    pasos: Number((dist as Record<string, unknown>).steps ?? 0) || undefined,
    distancia_km: Number((dist as Record<string, unknown>).distance_meters ?? 0) > 0
      ? Number((Number((dist as Record<string, unknown>).distance_meters) / 1000).toFixed(2))
      : undefined,
    calorias_totales: Number((cal as Record<string, unknown>).total_burned_calories ?? 0) || undefined,
    calorias_activas: Number((cal as Record<string, unknown>).active_burned_calories ?? 0) || undefined,
    rhr: Number((hr as Record<string, unknown>).resting_hr_bpm ?? 0) || undefined,
    hrv: hrv ? Number(hrv.avg_hrv_rmssd ?? 0) || undefined : undefined,
    raw_data: daily,
  }
}

// ─── Normalización payload sleep ──────────────────────────────────────────────

export function normalizarTerraSleep(
  clienteId: string,
  sleep: Record<string, unknown>
): ActividadExterna | null {
  const dur = (sleep.sleep_durations_data as Record<string, unknown> | null) ?? {}
  const asleep = (dur as Record<string, unknown>).asleep as Record<string, unknown> | null

  const endTime = String(sleep.end_time ?? '')
  if (!endTime) return null

  const fecha = endTime.split('T')[0]
  const totalSeg = Number((asleep as Record<string, unknown> | null)?.duration_asleep_state_seconds ?? 0)
  const sueno_h = totalSeg > 0 ? Number((totalSeg / 3600).toFixed(2)) : undefined

  const score = (sleep as Record<string, unknown>).sleep_quality_data as Record<string, unknown> | null
  const sueno_calidad = score ? Number((score as Record<string, unknown>).overall ?? 0) || undefined : undefined

  return {
    cliente_id: clienteId,
    proveedor: 'strava',  // placeholder
    fecha,
    sueno_h,
    sueno_calidad,
    raw_data: sleep,
  }
}
