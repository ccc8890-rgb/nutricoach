import { NextRequest, NextResponse } from 'next/server'
import { createServiceSupabase } from '@/lib/supabase-server'

export async function GET(_req: NextRequest, { params }: { params: Promise<{ codigo: string }> }) {
  const { codigo } = await params
  const db = createServiceSupabase()

  const { data: plan } = await db
    .from('planes_nutricion').select('cliente_id').eq('codigo_publico', codigo).eq('activo', true).single()
  if (!plan) return NextResponse.json({ error: 'Cliente no encontrado' }, { status: 404 })
  const clienteId = plan.cliente_id

  const desde14dias = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]

  const [{ data: integraciones }, { data: garminRow }, { data: stravaRows }, { data: actividadRows }] = await Promise.all([
    db.from('integraciones_cliente')
      .select('proveedor, activa, ultima_sync, error_ultimo')
      .eq('cliente_id', clienteId),
    // Garmin Connect usa unofficial API (email/password), no tiene fila en integraciones_cliente
    // Detectamos su presencia por si hay filas en actividad_externa_cliente
    db.from('actividad_externa_cliente')
      .select('fecha, body_battery_end, training_readiness, pasos, stress_avg, rhr, hrv, calorias_totales, raw_data')
      .eq('cliente_id', clienteId)
      .eq('proveedor', 'garmin_connect')
      .order('fecha', { ascending: false })
      .limit(1)
      .single(),
    db.from('actividad_externa_cliente')
      .select('fecha, tipo_entreno, duracion_min, distancia_entreno_km, calorias_activas, fc_media, fc_max, tss, pace_min_km')
      .eq('cliente_id', clienteId)
      .eq('proveedor', 'strava')
      .gte('fecha', desde14dias)
      .order('fecha', { ascending: false })
      .limit(6),
    db.from('actividad_externa_cliente')
      .select('proveedor, fecha, pasos, distancia_km, calorias_activas, calorias_totales, minutos_activo, duracion_min, distancia_entreno_km, tipo_entreno, hrv, rhr, sueno_h, sueno_calidad')
      .eq('cliente_id', clienteId)
      .gte('fecha', desde14dias)
      .order('fecha', { ascending: false }),
  ])

  const garminIntegration = (integraciones ?? []).find(i => i.proveedor === 'garmin_connect')
  const garminRaw = garminRow?.raw_data as Record<string, unknown> | null | undefined
  const garminConnect = garminRow
    ? {
        activa: true,
        ultima_sync: garminIntegration?.ultima_sync ?? garminRow.fecha,
        error_ultimo: garminIntegration?.error_ultimo ?? null,
        datos_hoy: {
          body_battery_end: garminRow.body_battery_end,
          training_readiness: garminRow.training_readiness,
          pasos: garminRow.pasos,
          stress_avg: garminRow.stress_avg,
          rhr: garminRow.rhr,
          hrv: garminRow.hrv,
          calorias_totales: garminRow.calorias_totales,
          vo2max_running: asNumber(garminRaw?.vo2max_running),
          vo2max_cycling: asNumber(garminRaw?.vo2max_cycling),
          lactate_threshold_hr: asNumber(garminRaw?.lactate_threshold_hr),
          training_acute_load: asNumber(garminRaw?.training_acute_load),
          training_recovery_time_h: normalizeRecoveryHours(asNumber(garminRaw?.training_recovery_time_h)),
        },
      }
    : {
        activa: garminIntegration?.activa ?? false,
        ultima_sync: garminIntegration?.ultima_sync ?? null,
        error_ultimo: garminIntegration?.error_ultimo ?? null,
        datos_hoy: null,
      }

  const stravaResumen = {
    actividades: stravaRows ?? [],
    sesiones_14d: stravaRows?.length ?? 0,
    minutos_14d: (stravaRows ?? []).reduce((acc, row) => acc + (row.duracion_min ?? 0), 0),
    distancia_14d: Number((stravaRows ?? []).reduce((acc, row) => acc + Number(row.distancia_entreno_km ?? 0), 0).toFixed(1)),
  }

  const integracionesPorProveedor = new Map((integraciones ?? []).map(i => [i.proveedor, i]))
  const actividadPorProveedor = new Map<string, NonNullable<typeof actividadRows>>()

  for (const row of actividadRows ?? []) {
    const key = row.proveedor
    const current = actividadPorProveedor.get(key) ?? []
    current.push(row)
    actividadPorProveedor.set(key, current)
  }

  const proveedores = new Set<string>([
    ...Array.from(integracionesPorProveedor.keys()),
    ...Array.from(actividadPorProveedor.keys()),
  ])

  const resumenes_proveedor = Array.from(proveedores).map(proveedor => {
    const rows = actividadPorProveedor.get(proveedor) ?? []
    const integracion = integracionesPorProveedor.get(proveedor)
    const ultima = rows[0] ?? null
    return {
      proveedor,
      activa: integracion?.activa ?? rows.length > 0,
      ultima_sync: integracion?.ultima_sync ?? ultima?.fecha ?? null,
      error_ultimo: integracion?.error_ultimo ?? null,
      registros_14d: rows.length,
      minutos_14d: rows.reduce((acc, row) => acc + (row.duracion_min ?? row.minutos_activo ?? 0), 0),
      distancia_14d: Number(rows.reduce((acc, row) => acc + Number(row.distancia_entreno_km ?? row.distancia_km ?? 0), 0).toFixed(1)),
      calorias_14d: rows.reduce((acc, row) => acc + (row.calorias_activas ?? 0), 0),
      ultimo: ultima,
    }
  })

  return NextResponse.json({ integraciones: integraciones ?? [], garmin_connect: garminConnect, strava_resumen: stravaResumen, resumenes_proveedor })
}

function asNumber(value: unknown): number | null {
  const n = Number(value)
  return Number.isFinite(n) ? n : null
}

function normalizeRecoveryHours(value: number | null): number | null {
  if (value === null) return null
  // Garmin suele devolver recoveryTime en minutos en Garmin Connect.
  const hours = value > 300 ? value / 60 : value
  return Math.round(hours)
}
