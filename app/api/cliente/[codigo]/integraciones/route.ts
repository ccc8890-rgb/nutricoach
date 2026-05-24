import { NextRequest, NextResponse } from 'next/server'
import { createServiceSupabase } from '@/lib/supabase-server'

export async function GET(_req: NextRequest, { params }: { params: Promise<{ codigo: string }> }) {
  const { codigo } = await params
  const db = createServiceSupabase()

  const { data: plan } = await db
    .from('planes_nutricion').select('cliente_id').eq('codigo_publico', codigo).eq('activo', true).single()
  if (!plan) return NextResponse.json({ error: 'Cliente no encontrado' }, { status: 404 })
  const clienteId = plan.cliente_id

  const [{ data: integraciones }, { data: garminRow }] = await Promise.all([
    db.from('integraciones_cliente')
      .select('proveedor, activa, ultima_sync, error_ultimo')
      .eq('cliente_id', clienteId),
    // Garmin Connect usa unofficial API (email/password), no tiene fila en integraciones_cliente
    // Detectamos su presencia por si hay filas en actividad_externa_cliente
    db.from('actividad_externa_cliente')
      .select('fecha, body_battery_end, training_readiness, pasos, stress_avg, rhr, hrv, calorias_totales')
      .eq('cliente_id', clienteId)
      .eq('proveedor', 'garmin_connect')
      .order('fecha', { ascending: false })
      .limit(1)
      .single(),
  ])

  const garminConnect = garminRow
    ? {
        activa: true,
        ultima_sync: garminRow.fecha,
        datos_hoy: {
          body_battery_end: garminRow.body_battery_end,
          training_readiness: garminRow.training_readiness,
          pasos: garminRow.pasos,
          stress_avg: garminRow.stress_avg,
          rhr: garminRow.rhr,
          hrv: garminRow.hrv,
          calorias_totales: garminRow.calorias_totales,
        },
      }
    : { activa: false, ultima_sync: null, datos_hoy: null }

  return NextResponse.json({ integraciones: integraciones ?? [], garmin_connect: garminConnect })
}
