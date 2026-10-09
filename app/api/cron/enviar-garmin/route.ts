import { NextRequest, NextResponse } from 'next/server'
import { createServiceSupabase } from '@/lib/supabase-server'
import { enviarSesionAGarmin, ErrorGarmin } from '@/lib/integraciones/garmin-workouts'
import { decidirEnvio, huellaPasos } from '@/lib/entrenos/garmin-auto'

export const maxDuration = 300

/** Máximo de entrenos enviados por pasada, para no saturar Garmin ni agotar el tiempo. */
const MAX_ENVIOS = 30

function autorizado(req: NextRequest): boolean {
  const secreto = process.env.CRON_SECRET
  if (!secreto) return false
  const auth = req.headers.get('authorization')
  if (auth?.startsWith('Bearer ')) return auth.slice(7) === secreto
  return req.headers.get('x-cron-secret') === secreto
}

export async function GET(req: NextRequest) {
  if (!autorizado(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const db = createServiceSupabase()
  const resumen = { clientes: 0, enviados: 0, al_dia: 0, errores: [] as string[] }

  const { data: conexiones } = await db
    .from('integraciones_cliente')
    .select('cliente_id')
    .eq('proveedor', 'garmin_connect')
    .eq('activa', true)

  for (const { cliente_id: clienteId } of conexiones ?? []) {
    if (resumen.enviados >= MAX_ENVIOS) break
    resumen.clientes++

    const { data: planes } = await db.from('planes_entrenamiento').select('id').eq('cliente_id', clienteId).eq('activo', true)
    const planIds = (planes ?? []).map(p => p.id as string)
    if (!planIds.length) continue

    const { data: perfil } = await db.from('perfil_entreno_cliente').select('vdot').eq('cliente_id', clienteId).maybeSingle()
    const vdot = perfil?.vdot ? Number(perfil.vdot) : null

    const { data: sesiones } = await db
      .from('sesiones_entrenamiento')
      .select('id, nombre, dia_semana, pasos, garmin_workout_id, garmin_programado_fecha, garmin_pasos_hash')
      .in('plan_id', planIds)
      .not('pasos', 'is', null)

    for (const s of sesiones ?? []) {
      if (resumen.enviados >= MAX_ENVIOS) break
      const { enviar, fecha } = decidirEnvio(s, huellaPasos(s.pasos, vdot))
      if (!enviar || !fecha) { resumen.al_dia++; continue }
      try {
        await enviarSesionAGarmin(db, s.id, fecha)
        resumen.enviados++
      } catch (e) {
        const msg = e instanceof ErrorGarmin ? e.mensaje : 'error inesperado'
        resumen.errores.push(`${s.nombre}: ${msg}`)
      }
    }
  }

  return NextResponse.json(resumen)
}
