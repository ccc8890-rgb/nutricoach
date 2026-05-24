// scripts/backfill-garmin-connect.mjs
// Sincroniza los últimos N días de Garmin Connect para un cliente
// Uso: node scripts/backfill-garmin-connect.mjs [--dias 60] [--cliente-id UUID]

import { createClient } from '@supabase/supabase-js'
import { config } from 'dotenv'
import { GarminConnect } from 'garmin-connect'

config({ path: '.env.local' })

const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } })
const GC_API = 'https://connectapi.garmin.com'

const args = process.argv.slice(2)
const diasArg = args.indexOf('--dias')
const clienteArg = args.indexOf('--cliente-id')
const DIAS = diasArg !== -1 ? parseInt(args[diasArg + 1]) : 60
const CLIENTE_ID = clienteArg !== -1 ? args[clienteArg + 1] : 'b18d795f-d416-485b-aeca-8144f004420b'

function sleep(ms) { return new Promise(r => setTimeout(r, ms)) }

function dateRange(desde, hasta) {
  const dates = []
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

async function syncDay(gc, displayName, date) {
  const [summary, readinessRaw, sleepRaw] = await Promise.all([
    gc.get(`${GC_API}/usersummary-service/usersummary/daily/${displayName}?calendarDate=${date}`).catch(() => null),
    gc.get(`${GC_API}/metrics-service/metrics/trainingreadiness/${date}`).catch(() => null),
    gc.getSleepData(new Date(date)).catch(() => null),
  ])

  if (!summary) return null

  const readiness = Array.isArray(readinessRaw) && readinessRaw.length > 0 ? readinessRaw[0] : null
  const sleep = sleepRaw?.dailySleepDTO ?? null

  const hrvWeekly = readiness?.hrvWeeklyAverage
    ? parseFloat((readiness.hrvWeeklyAverage / 10).toFixed(1))
    : undefined

  const sueno_h = sleep?.sleepTimeSeconds
    ? parseFloat((sleep.sleepTimeSeconds / 3600).toFixed(1))
    : undefined

  const row = {
    cliente_id: CLIENTE_ID,
    proveedor: 'garmin_connect',
    fecha: date,
    pasos: summary.totalSteps ?? null,
    calorias_activas: summary.activeKilocalories ?? null,
    calorias_totales: summary.totalKilocalories ?? null,
    minutos_activo: summary.moderateIntensityMinutes ?? null,
    minutos_alta_intensidad: summary.vigorousIntensityMinutes ?? null,
    rhr: summary.restingHeartRate ?? sleep?.restingHeartRate ?? null,
    hrv: hrvWeekly ?? null,
    sueno_h: sueno_h ?? null,
    sueno_calidad: sleep?.sleepScores?.overall?.value ?? null,
    body_battery_max: summary.bodyBatteryHighestValue ?? null,
    body_battery_min: summary.bodyBatteryLowestValue ?? null,
    body_battery_end: summary.bodyBatteryMostRecentValue ?? null,
    stress_avg: summary.averageStressLevel ?? null,
    training_readiness: readiness?.score ?? null,
    distancia_km: summary.totalDistanceMeters ? parseFloat((summary.totalDistanceMeters / 1000).toFixed(2)) : null,
    raw_data: {
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
      stress_avg: summary.averageStressLevel,
      stress_max: summary.maxStressLevel,
      stress_pct_bajo: summary.lowStressPercentage,
      stress_pct_medio: summary.mediumStressPercentage,
      stress_pct_alto: summary.highStressPercentage,
      body_battery_max: summary.bodyBatteryHighestValue,
      body_battery_min: summary.bodyBatteryLowestValue,
      body_battery_end: summary.bodyBatteryMostRecentValue,
      training_readiness_score: readiness?.score,
      training_readiness_level: readiness?.level,
      training_readiness_feedback: readiness?.feedbackShort,
      training_readiness_feedback_largo: readiness?.feedbackLong,
      training_recovery_time_h: readiness?.recoveryTime,
      training_acute_load: readiness?.acuteLoad,
      hrv_weekly_avg_ms: readiness?.hrvWeeklyAverage ? readiness.hrvWeeklyAverage / 10 : null,
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
    }
  }

  // Limpiar nulls
  for (const k of Object.keys(row)) {
    if (row[k] === null && k !== 'raw_data') delete row[k]
  }

  return row
}

async function main() {
  console.log(`\n🏃 Backfill Garmin Connect — ${DIAS} días → cliente ${CLIENTE_ID}\n`)

  const gc = new GarminConnect({ username: process.env.GARMIN_EMAIL, password: process.env.GARMIN_PASSWORD })
  await gc.login()
  console.log('✅ Login Garmin Connect OK')

  const profile = await gc.getUserProfile()
  const displayName = profile.displayName
  console.log('👤 Display name:', displayName)

  const hasta = new Date()
  const desde = new Date(Date.now() - DIAS * 24 * 60 * 60 * 1000)
  const fechas = dateRange(desde, hasta)
  console.log(`📅 Rango: ${fechas[0]} → ${fechas[fechas.length - 1]} (${fechas.length} días)\n`)

  const rows = []
  let ok = 0, empty = 0, errors = 0

  for (const fecha of fechas) {
    try {
      const row = await syncDay(gc, displayName, fecha)
      if (row) {
        rows.push(row)
        const bb = row.body_battery_max != null ? `BB↑${row.body_battery_max}↓${row.body_battery_min}` : ''
        const tr = row.training_readiness != null ? `TR${row.training_readiness}` : ''
        const rhr = row.rhr != null ? `RHR${row.rhr}` : ''
        const steps = row.pasos != null ? `${row.pasos}pasos` : ''
        console.log(`  ✅ ${fecha} | ${steps} ${rhr} ${bb} ${tr} | sleep${row.sueno_h ?? '-'}h`)
        ok++
      } else {
        console.log(`  ⚪ ${fecha} — sin datos`)
        empty++
      }
      await sleep(400)
    } catch (e) {
      console.log(`  ❌ ${fecha} — ${e.message}`)
      errors++
    }
  }

  if (rows.length === 0) {
    console.log('\nNo hay filas que insertar.')
    return
  }

  // Borrar previos y reinsertar
  const fechasRows = rows.map(r => r.fecha)
  await db.from('actividad_externa_cliente').delete()
    .eq('cliente_id', CLIENTE_ID).eq('proveedor', 'garmin_connect').in('fecha', fechasRows)

  const { error } = await db.from('actividad_externa_cliente').insert(rows)
  if (error) { console.log('\n❌ Error insertar BD:', error.message); return }

  console.log(`\n✅ Insertados ${rows.length} días en BD`)
  console.log(`   OK: ${ok} | Sin datos: ${empty} | Errores: ${errors}`)
}

main().catch(e => { console.log('FATAL:', e.message); process.exit(1) })
