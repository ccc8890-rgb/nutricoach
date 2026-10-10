import { NextRequest, NextResponse } from 'next/server'
import { createApiSupabase, createServiceSupabase } from '@/lib/supabase-server'
import { autorizarCoachCliente } from '@/lib/auth/autorizar-coach-cliente'
import { leerUmbrales } from '@/lib/rendimiento/garmin-entrenos'
import { leerIntervenciones } from '@/lib/rendimiento/intervenciones'
import { evaluarCambio, indicadoresVentana, VENTANA_DIAS } from '@/lib/rendimiento/seguimiento'
import type { EntrenoPanel } from '@/lib/rendimiento/panel'

/** Qué ha pasado con el atleta después de cada cambio aplicado al plan, más su línea base de hoy. */
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: clienteId } = await params

  const authClient = createApiSupabase(request)
  const { data: { user } } = await authClient.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const db = createServiceSupabase()
  const autorizacion = await autorizarCoachCliente(db, { userId: user.id, clienteId })
  if (!autorizacion.ok) return NextResponse.json({ error: autorizacion.mensaje }, { status: autorizacion.status })

  const hoy = new Date().toISOString().slice(0, 10)
  const [{ data: entrenos }, umbrales, intervenciones] = await Promise.all([
    db.from('entrenos_realizados')
      .select('fecha,tipo,nombre,duracion_s,distancia_m,ritmo_medio_s_km,fc_media,tss,tss_metodo,carga_garmin,vo2max,tiempo_zona_fc,mejores_parciales,vueltas,raw')
      .eq('cliente_id', clienteId)
      .order('fecha', { ascending: true }),
    leerUmbrales(db, clienteId),
    leerIntervenciones(db, clienteId),
  ])
  const todos = (entrenos ?? []) as EntrenoPanel[]

  const desdeBase = new Date(Date.now() - (VENTANA_DIAS - 1) * 86_400_000).toISOString().slice(0, 10)
  return NextResponse.json({
    hoy,
    fcUmbral: umbrales.fcUmbral,
    lineaBase: { desde: desdeBase, hasta: hoy, indicadores: indicadoresVentana(todos, desdeBase, hoy, umbrales.fcUmbral) },
    intervenciones: intervenciones.map(i => ({
      ...i,
      evaluacion: evaluarCambio(todos, i.fecha, hoy, umbrales.fcUmbral, { objetivo: i.objetivo }),
    })),
  })
}
