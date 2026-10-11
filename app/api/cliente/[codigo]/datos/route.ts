import { NextRequest, NextResponse } from 'next/server'
import { createServiceSupabase } from '@/lib/supabase-server'
import { autorizarAccesoPlan } from '@/lib/cliente/autorizar-escritura-plan'
import { construirPanel, type DiaBienestar, type EntrenoPanel } from '@/lib/rendimiento/panel'
import { construirDatosCliente, type FilaReloj } from '@/lib/rendimiento/datos-cliente'
import { leerUmbrales } from '@/lib/rendimiento/garmin-entrenos'

// GET /api/cliente/[codigo]/datos — resumen de datos del reloj y del entrenamiento para la pestaña «Datos» del cliente.
export async function GET(req: NextRequest, { params }: { params: Promise<{ codigo: string }> }) {
  const { codigo } = await params
  const auth = await autorizarAccesoPlan(req, codigo)
  if (auth instanceof NextResponse) return auth
  const { clienteId } = auth
  const db = createServiceSupabase()

  const hoy = new Date().toISOString().slice(0, 10)
  const desde = new Date(Date.now() - 90 * 86_400_000).toISOString().slice(0, 10)

  const [{ data: entrenos }, { data: dias }, umbrales] = await Promise.all([
    db.from('entrenos_realizados')
      .select('fecha,tipo,nombre,duracion_s,distancia_m,ritmo_medio_s_km,fc_media,tss,tss_metodo,carga_garmin,vo2max,tiempo_zona_fc,mejores_parciales,vueltas,raw')
      .eq('cliente_id', clienteId)
      .order('fecha', { ascending: true }),
    db.from('actividad_externa_cliente')
      .select('fecha,rhr,hrv,training_readiness,body_battery_max,stress_avg,sueno_h,sueno_calidad,raw_data')
      .eq('cliente_id', clienteId)
      .eq('proveedor', 'garmin_connect')
      .gte('fecha', desde)
      .order('fecha', { ascending: true }),
    leerUmbrales(db, clienteId),
  ])

  const filas = (dias ?? []) as FilaReloj[]
  const bienestar: DiaBienestar[] = filas.map(d => ({
    fecha: d.fecha, rhr: d.rhr, readiness: d.training_readiness, body_battery_max: d.body_battery_max, sueno_h: d.sueno_h, stress_avg: d.stress_avg,
  }))
  const panel = construirPanel((entrenos ?? []) as EntrenoPanel[], bienestar, hoy, 90, umbrales.fcUmbral, umbrales.fcMax)
  return NextResponse.json(construirDatosCliente(panel, filas, hoy))
}
