import { NextRequest, NextResponse } from 'next/server'
import { createServiceSupabase } from '@/lib/supabase-server'

// GET /api/cliente/[codigo]/garmin-resumen
// Devuelve últimos 7 días de datos Garmin Connect para visualización en portal
export async function GET(_req: NextRequest, { params }: { params: Promise<{ codigo: string }> }) {
  const { codigo } = await params
  const db = createServiceSupabase()

  const { data: plan } = await db
    .from('planes_nutricion').select('cliente_id').eq('codigo_publico', codigo).eq('activo', true).single()
  if (!plan) return NextResponse.json({ error: 'Cliente no encontrado' }, { status: 404 })

  const hace7dias = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]

  const { data: rows } = await db
    .from('actividad_externa_cliente')
    .select('fecha, pasos, calorias_activas, calorias_totales, rhr, hrv, body_battery_max, body_battery_min, body_battery_end, stress_avg, training_readiness, distancia_km, sueno_h, sueno_calidad, minutos_activo, minutos_alta_intensidad')
    .eq('cliente_id', plan.cliente_id)
    .eq('proveedor', 'garmin_connect')
    .gte('fecha', hace7dias)
    .order('fecha', { ascending: false })

  if (!rows || rows.length === 0) {
    return NextResponse.json({ dias: [], tiene_datos: false })
  }

  const avg = (arr: number[]) => arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : 0
  const vals = (key: keyof typeof rows[0]) => rows.map(r => r[key]).filter(v => v != null) as number[]

  const promedios = {
    pasos: Math.round(avg(vals('pasos'))),
    calorias_totales: Math.round(avg(vals('calorias_totales'))),
    rhr: Math.round(avg(vals('rhr'))),
    hrv: vals('hrv').length ? parseFloat(avg(vals('hrv')).toFixed(1)) : null,
    body_battery_end: vals('body_battery_end').length ? Math.round(avg(vals('body_battery_end'))) : null,
    stress_avg: vals('stress_avg').length ? Math.round(avg(vals('stress_avg'))) : null,
    training_readiness: vals('training_readiness').length ? Math.round(avg(vals('training_readiness'))) : null,
  }

  return NextResponse.json({ dias: rows, promedios, tiene_datos: true })
}
