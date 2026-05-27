// lib/integraciones/garmin-connect-sync.ts
// Sync de datos Garmin Connect (wellness diario) via unofficial API
// Datos: pasos, TDEE, RHR, body battery, estrés, sueño, training readiness, HRV

import type { SupabaseClient } from '@supabase/supabase-js'

const GC_API = 'https://connectapi.garmin.com'

interface GarminDailySummary {
  totalSteps?: number
  totalKilocalories?: number
  bmrKilocalories?: number
  activeKilocalories?: number
  restingHeartRate?: number
  averageStressLevel?: number
  maxStressLevel?: number
  bodyBatteryHighestValue?: number
  bodyBatteryLowestValue?: number
  bodyBatteryMostRecentValue?: number
  moderateIntensityMinutes?: number
  vigorousIntensityMinutes?: number
  highlyActiveSeconds?: number
  sedentarySeconds?: number
  totalDistanceMeters?: number
  floorsAscended?: number
  lowStressPercentage?: number
  mediumStressPercentage?: number
  highStressPercentage?: number
  calendarDate?: string
}

interface GarminTrainingReadiness {
  score?: number
  level?: string
  feedbackShort?: string
  feedbackLong?: string
  recoveryTime?: number
  acuteLoad?: number
  hrvWeeklyAverage?: number
  calendarDate?: string
}

interface GarminSleepData {
  dailySleepDTO?: {
    sleepTimeSeconds?: number
    deepSleepSeconds?: number
    lightSleepSeconds?: number
    remSleepSeconds?: number
    awakeSleepSeconds?: number
    sleepScores?: { overall?: { value?: number } }
    restingHeartRate?: number
    spO2Average?: number
    averageRespirationValue?: number
    avgSleepStress?: number
  }
}

interface GarminUserSettings {
  userData?: {
    vo2MaxRunning?: number | null
    vo2MaxCycling?: number | null
    lactateThresholdHeartRate?: number | null
    lactateThresholdSpeed?: number | null
    ftpAutoDetected?: boolean | null
    thresholdHeartRateAutoDetected?: boolean | null
  }
}

// Autenticación vía garmin-connect (unofficial, username/password)
async function getGarminClient() {
  // Importación dinámica para evitar problemas en build de Next.js
  const { GarminConnect } = await import('garmin-connect')
  const gc = new GarminConnect({
    username: process.env.GARMIN_EMAIL!,
    password: process.env.GARMIN_PASSWORD!,
  })
  await gc.login()
  return gc
}

async function getDailyDisplayName(gc: Awaited<ReturnType<typeof getGarminClient>>): Promise<string> {
  const profile = await gc.getUserProfile()
  return (profile as unknown as Record<string, string>).displayName
}

async function getDailySummary(gc: Awaited<ReturnType<typeof getGarminClient>>, displayName: string, date: string): Promise<GarminDailySummary | null> {
  try {
    const data = await gc.get(`${GC_API}/usersummary-service/usersummary/daily/${displayName}?calendarDate=${date}`)
    return data as GarminDailySummary
  } catch {
    return null
  }
}

async function getTrainingReadiness(gc: Awaited<ReturnType<typeof getGarminClient>>, date: string): Promise<GarminTrainingReadiness | null> {
  try {
    const data = await gc.get(`${GC_API}/metrics-service/metrics/trainingreadiness/${date}`) as GarminTrainingReadiness[]
    // Coger la lectura más reciente del día (primer elemento = más tarde en el día)
    return Array.isArray(data) && data.length > 0 ? data[0] : null
  } catch {
    return null
  }
}

async function getSleepData(gc: Awaited<ReturnType<typeof getGarminClient>>, date: string): Promise<GarminSleepData['dailySleepDTO'] | null> {
  try {
    const data = await gc.getSleepData(new Date(date)) as GarminSleepData
    return data?.dailySleepDTO ?? null
  } catch {
    return null
  }
}

async function getUserSettings(gc: Awaited<ReturnType<typeof getGarminClient>>): Promise<GarminUserSettings | null> {
  try {
    return await gc.getUserSettings() as GarminUserSettings
  } catch {
    return null
  }
}

export interface GarminDayData {
  fecha: string
  pasos?: number
  calorias_activas?: number
  calorias_totales?: number
  minutos_activo?: number
  minutos_alta_intensidad?: number
  rhr?: number
  hrv?: number
  sueno_h?: number
  sueno_calidad?: number
  body_battery_max?: number
  body_battery_min?: number
  body_battery_end?: number
  stress_avg?: number
  training_readiness?: number
  distancia_km?: number
  raw_data: Record<string, unknown>
}

// gc y displayName opcionales: si se pasan se reutiliza el cliente (per-client sync)
// Si no se pasan, se crea un cliente con las credenciales del coach (GARMIN_EMAIL/GARMIN_PASSWORD)
export async function syncGarminDay(
  date: string,
  gcInstance?: Awaited<ReturnType<typeof getGarminClient>>,
  displayNameOverride?: string
): Promise<GarminDayData | null> {
  const gc = gcInstance ?? await getGarminClient()
  const displayName = displayNameOverride ?? await getDailyDisplayName(gc)

  const [summary, readiness, sleep, settings] = await Promise.all([
    getDailySummary(gc, displayName, date),
    getTrainingReadiness(gc, date),
    getSleepData(gc, date),
    getUserSettings(gc),
  ])

  if (!summary) return null

  // HRV: la media semanal de HRV viene en training readiness (en décimas de ms, dividir por 10)
  const hrvWeekly = readiness?.hrvWeeklyAverage
    ? parseFloat((readiness.hrvWeeklyAverage / 10).toFixed(1))
    : undefined

  const sueno_h = sleep?.sleepTimeSeconds
    ? parseFloat((sleep.sleepTimeSeconds / 3600).toFixed(1))
    : undefined

  return {
    fecha: date,
    pasos: summary.totalSteps ?? undefined,
    calorias_activas: summary.activeKilocalories ?? undefined,
    calorias_totales: summary.totalKilocalories ?? undefined,
    minutos_activo: summary.moderateIntensityMinutes ?? undefined,
    minutos_alta_intensidad: summary.vigorousIntensityMinutes ?? undefined,
    rhr: summary.restingHeartRate ?? sleep?.restingHeartRate ?? undefined,
    hrv: hrvWeekly,
    sueno_h,
    sueno_calidad: sleep?.sleepScores?.overall?.value ?? undefined,
    body_battery_max: summary.bodyBatteryHighestValue ?? undefined,
    body_battery_min: summary.bodyBatteryLowestValue ?? undefined,
    body_battery_end: summary.bodyBatteryMostRecentValue ?? undefined,
    stress_avg: summary.averageStressLevel ?? undefined,
    training_readiness: readiness?.score ?? undefined,
    distancia_km: summary.totalDistanceMeters
      ? parseFloat((summary.totalDistanceMeters / 1000).toFixed(2))
      : undefined,
    raw_data: {
      // Daily summary
      tdee_kcal: summary.totalKilocalories,
      bmr_kcal: summary.bmrKilocalories,
      active_kcal: summary.activeKilocalories,
      pasos: summary.totalSteps,
      rhr: summary.restingHeartRate,
      distancia_km: summary.totalDistanceMeters ? summary.totalDistanceMeters / 1000 : null,
      pisos: summary.floorsAscended,
      sedentario_s: summary.sedentarySeconds,
      muy_activo_s: summary.highlyActiveSeconds,
      min_moderada: summary.moderateIntensityMinutes,
      min_intensa: summary.vigorousIntensityMinutes,
      // Estrés
      stress_avg: summary.averageStressLevel,
      stress_max: summary.maxStressLevel,
      stress_pct_bajo: summary.lowStressPercentage,
      stress_pct_medio: summary.mediumStressPercentage,
      stress_pct_alto: summary.highStressPercentage,
      // Body battery
      body_battery_max: summary.bodyBatteryHighestValue,
      body_battery_min: summary.bodyBatteryLowestValue,
      body_battery_end: summary.bodyBatteryMostRecentValue,
      // Training readiness
      training_readiness_score: readiness?.score,
      training_readiness_level: readiness?.level,
      training_readiness_feedback: readiness?.feedbackShort,
      training_readiness_feedback_largo: readiness?.feedbackLong,
      training_recovery_time_h: readiness?.recoveryTime,
      training_acute_load: readiness?.acuteLoad,
      hrv_weekly_avg_ms: readiness?.hrvWeeklyAverage ? readiness.hrvWeeklyAverage / 10 : null,
      // Perfil de rendimiento Garmin
      vo2max_running: settings?.userData?.vo2MaxRunning ?? null,
      vo2max_cycling: settings?.userData?.vo2MaxCycling ?? null,
      lactate_threshold_hr: settings?.userData?.lactateThresholdHeartRate ?? null,
      lactate_threshold_speed: settings?.userData?.lactateThresholdSpeed ?? null,
      ftp_auto_detected: settings?.userData?.ftpAutoDetected ?? null,
      threshold_hr_auto_detected: settings?.userData?.thresholdHeartRateAutoDetected ?? null,
      // Sueño (si disponible)
      sueno_h: sueno_h ?? null,
      sueno_calidad: sleep?.sleepScores?.overall?.value ?? null,
      sueno_deep_h: sleep?.deepSleepSeconds ? sleep.deepSleepSeconds / 3600 : null,
      sueno_light_h: sleep?.lightSleepSeconds ? sleep.lightSleepSeconds / 3600 : null,
      sueno_rem_h: sleep?.remSleepSeconds ? sleep.remSleepSeconds / 3600 : null,
      sueno_despertar_h: sleep?.awakeSleepSeconds ? sleep.awakeSleepSeconds / 3600 : null,
      sueno_rhr: sleep?.restingHeartRate ?? null,
      sueno_spo2: sleep?.spO2Average ?? null,
      sueno_respiracion: sleep?.averageRespirationValue ?? null,
      sueno_estres_medio: sleep?.avgSleepStress ?? null,
    },
  }
}

export async function persistirGarminDays(
  db: SupabaseClient,
  clienteId: string,
  days: GarminDayData[]
): Promise<number> {
  if (days.length === 0) return 0

  // Borrar días existentes de garmin para re-insertar frescos
  const fechas = days.map(d => d.fecha)
  await db
    .from('actividad_externa_cliente')
    .delete()
    .eq('cliente_id', clienteId)
    .eq('proveedor', 'garmin_connect')
    .in('fecha', fechas)

  const rows = days.map(d => {
    const row: Record<string, unknown> = {
      cliente_id: clienteId,
      proveedor: 'garmin_connect',
      fecha: d.fecha,
      raw_data: d.raw_data,
    }
    // Solo añadir campos con valor (no null/undefined)
    const numerics: (keyof GarminDayData)[] = [
      'pasos', 'calorias_activas', 'calorias_totales', 'minutos_activo',
      'minutos_alta_intensidad', 'rhr', 'hrv', 'sueno_h', 'sueno_calidad',
      'body_battery_max', 'body_battery_min', 'body_battery_end',
      'stress_avg', 'training_readiness', 'distancia_km',
    ]
    for (const k of numerics) {
      if (d[k] !== undefined && d[k] !== null) row[k] = d[k]
    }
    return row
  })

  const { error } = await db.from('actividad_externa_cliente').insert(rows)
  if (error) throw new Error(`persistirGarminDays: ${error.message}`)
  return rows.length
}

// Genera rango de fechas [desde, hasta] en formato YYYY-MM-DD
export function dateRange(desde: Date, hasta: Date): string[] {
  const dates: string[] = []
  const cur = new Date(desde)
  cur.setHours(0, 0, 0, 0)
  const end = new Date(hasta)
  end.setHours(0, 0, 0, 0)
  while (cur <= end) {
    dates.push(cur.toISOString().split('T')[0])
    cur.setDate(cur.getDate() + 1)
  }
  return dates
}
