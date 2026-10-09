// app/api/entrenos/sesiones/[id]/garmin/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { createServiceSupabase } from '@/lib/supabase-server'
import { autorizarAccesoCliente } from '@/lib/cliente/autorizar-acceso-cliente'
import { enviarSesionAGarmin, ErrorGarmin } from '@/lib/integraciones/garmin-workouts'

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const admin = createServiceSupabase()

  const { data: sesion } = await admin.from('sesiones_entrenamiento').select('plan_id').eq('id', id).maybeSingle()
  if (!sesion) return NextResponse.json({ error: 'Sesión no encontrada' }, { status: 404 })
  const { data: plan } = await admin.from('planes_entrenamiento').select('cliente_id').eq('id', sesion.plan_id).maybeSingle()
  if (!plan) return NextResponse.json({ error: 'Sesión no encontrada' }, { status: 404 })

  const auth = await autorizarAccesoCliente(request, { clienteId: plan.cliente_id })
  if (auth instanceof NextResponse) return auth

  let fecha: string | undefined
  try {
    const body = await request.json()
    if (typeof body?.fecha === 'string') fecha = body.fecha
  } catch {
    /* sin cuerpo: se usa la próxima fecha del día de la sesión */
  }

  try {
    const r = await enviarSesionAGarmin(admin, id, fecha)
    return NextResponse.json(r)
  } catch (e) {
    if (e instanceof ErrorGarmin) return NextResponse.json({ error: e.mensaje }, { status: e.status })
    return NextResponse.json({ error: 'No se pudo enviar a Garmin' }, { status: 500 })
  }
}
