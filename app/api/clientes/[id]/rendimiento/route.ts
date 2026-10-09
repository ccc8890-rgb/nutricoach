import { NextRequest, NextResponse } from 'next/server'
import { createApiSupabase, createServiceSupabase } from '@/lib/supabase-server'
import { autorizarCoachCliente } from '@/lib/auth/autorizar-coach-cliente'
import { construirPanel, type DiaBienestar, type EntrenoPanel } from '@/lib/rendimiento/panel'
import { leerUmbrales } from '@/lib/rendimiento/garmin-entrenos'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: clienteId } = await params

  const authClient = createApiSupabase(request)
  const { data: { user } } = await authClient.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const db = createServiceSupabase()
  const autorizacion = await autorizarCoachCliente(db, { userId: user.id, clienteId })
  if (!autorizacion.ok) return NextResponse.json({ error: autorizacion.mensaje }, { status: autorizacion.status })

  const dias = Math.min(Math.max(Number(request.nextUrl.searchParams.get('dias')) || 180, 14), 730)
  const hoy = new Date().toISOString().slice(0, 10)
  const desdeBienestar = new Date(Date.now() - dias * 86_400_000).toISOString().slice(0, 10)

  const [{ data: entrenos }, { data: dBien }, umbrales] = await Promise.all([
    db.from('entrenos_realizados')
      .select('fecha,tipo,nombre,duracion_s,distancia_m,ritmo_medio_s_km,fc_media,tss,tss_metodo,carga_garmin,vo2max,tiempo_zona_fc,mejores_parciales,raw')
      .eq('cliente_id', clienteId)
      .order('fecha', { ascending: true }),
    db.from('actividad_externa_cliente')
      .select('fecha,hrv,rhr,training_readiness,body_battery_max,sueno_h,stress_avg')
      .eq('cliente_id', clienteId)
      .eq('proveedor', 'garmin_connect')
      .gte('fecha', desdeBienestar)
      .order('fecha', { ascending: true }),
    leerUmbrales(db, clienteId),
  ])

  const bienestar: DiaBienestar[] = (dBien ?? []).map(d => ({
    fecha: d.fecha as string,
    hrv: d.hrv ?? null,
    rhr: d.rhr ?? null,
    readiness: d.training_readiness ?? null,
    body_battery_max: d.body_battery_max ?? null,
    sueno_h: d.sueno_h ?? null,
    stress_avg: d.stress_avg ?? null,
  }))

  const panel = construirPanel((entrenos ?? []) as EntrenoPanel[], bienestar, hoy, dias)
  return NextResponse.json({ ...panel, umbrales, hoy })
}
