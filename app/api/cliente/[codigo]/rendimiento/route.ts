import { NextRequest, NextResponse } from 'next/server'
import { createServiceSupabase } from '@/lib/supabase-server'
import { autorizarAccesoPlan } from '@/lib/cliente/autorizar-escritura-plan'
import { construirPanel, type DiaBienestar, type EntrenoPanel } from '@/lib/rendimiento/panel'
import { leerUmbrales } from '@/lib/rendimiento/garmin-entrenos'
import { construirEjecucion } from '@/lib/rendimiento/ejecucion'
import { deporteDe } from '@/lib/rendimiento/deportes'

// GET /api/cliente/[codigo]/rendimiento?dias=90 — panel de rendimiento de entrenamiento del atleta (solo lectura) para la pestaña «Datos».
export async function GET(req: NextRequest, { params }: { params: Promise<{ codigo: string }> }) {
  const { codigo } = await params
  const auth = await autorizarAccesoPlan(req, codigo)
  if (auth instanceof NextResponse) return auth
  const { clienteId } = auth
  const db = createServiceSupabase()

  const dias = Math.min(Math.max(Number(req.nextUrl.searchParams.get('dias')) || 90, 14), 365)
  const hoy = new Date().toISOString().slice(0, 10)
  const desde = new Date(Date.now() - dias * 86_400_000).toISOString().slice(0, 10)

  const [{ data: entrenos }, { data: dBien }, umbrales, ejecucion] = await Promise.all([
    db.from('entrenos_realizados')
      .select('fecha,tipo,nombre,duracion_s,distancia_m,ritmo_medio_s_km,fc_media,tss,tss_metodo,carga_garmin,vo2max,tiempo_zona_fc,mejores_parciales,vueltas,raw')
      .eq('cliente_id', clienteId)
      .order('fecha', { ascending: true }),
    db.from('actividad_externa_cliente')
      .select('fecha,rhr,training_readiness,body_battery_max,sueno_h,stress_avg')
      .eq('cliente_id', clienteId)
      .eq('proveedor', 'garmin_connect')
      .gte('fecha', desde)
      .order('fecha', { ascending: true }),
    leerUmbrales(db, clienteId),
    construirEjecucion(db, clienteId, hoy),
  ])

  const bienestar: DiaBienestar[] = (dBien ?? []).map(d => ({
    fecha: d.fecha as string, rhr: d.rhr ?? null, readiness: d.training_readiness ?? null,
    body_battery_max: d.body_battery_max ?? null, sueno_h: d.sueno_h ?? null, stress_avg: d.stress_avg ?? null,
  }))

  const lista = (entrenos ?? []) as EntrenoPanel[]
  const panel = construirPanel(lista, bienestar, hoy, dias, umbrales.fcUmbral, umbrales.fcMax)

  // Sesiones del rango, en versión ligera, para los gráficos por sesión y el mapa de actividad.
  const desdeMapa = dias > 126 ? desde : new Date(Date.now() - 126 * 86_400_000).toISOString().slice(0, 10)
  const sesiones = lista.filter(e => e.fecha >= (desde < desdeMapa ? desde : desdeMapa)).map(e => ({
    fecha: e.fecha,
    nombre: e.nombre,
    tipo: e.tipo,
    deporte: deporteDe(e.tipo),
    min: Math.round((e.duracion_s ?? 0) / 60),
    km: e.distancia_m ? Math.round(e.distancia_m / 100) / 10 : null,
    ritmo: e.ritmo_medio_s_km ?? null,
    fc: e.fc_media ? Math.round(e.fc_media) : null,
    tss: e.tss !== null && e.tss !== undefined ? Math.round(e.tss) : null,
    pot: e.raw?.potencia_media ?? null,
    potNorm: e.raw?.potencia_normalizada ?? null,
    zonas: e.tiempo_zona_fc ?? null,
  }))

  return NextResponse.json({ ...panel, umbrales, ejecucion, hoy, sesiones })
}
