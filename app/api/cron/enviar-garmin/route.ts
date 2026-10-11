import { NextRequest, NextResponse } from 'next/server'
import { createServiceSupabase } from '@/lib/supabase-server'
import { enviarSesionAGarmin, ErrorGarmin } from '@/lib/integraciones/garmin-workouts'
import { finHorizonteEnvio, huellaPasos, planearEnvioGarmin } from '@/lib/entrenos/garmin-auto'
import { ocurrenciasDelDia, sumarDias, type Ajuste } from '@/lib/entrenos/calendario-ajustes'
import { plantillaActivaEn } from '@/lib/entrenos/ventana-plan'

export const maxDuration = 300

function fechaLocalISO(d: Date = new Date()): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

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

    const { data: planes } = await db.from('planes_entrenamiento').select('id, created_at, duracion_semanas').eq('cliente_id', clienteId).eq('activo', true)
    const planIds = (planes ?? []).map(p => p.id as string)
    if (!planIds.length) continue

    const { data: perfil } = await db.from('perfil_entreno_cliente').select('vdot').eq('cliente_id', clienteId).maybeSingle()
    const vdot = perfil?.vdot ? Number(perfil.vdot) : null

    const { data: sesiones } = await db
      .from('sesiones_entrenamiento')
      .select('id, plan_id, nombre, dia_semana, pasos, garmin_workout_id, garmin_programado_fecha, garmin_fechas, garmin_pasos_hash')
      .in('plan_id', planIds)
      .not('pasos', 'is', null)

    // Sesiones que el coach movió o quitó en una fecha concreta del calendario: el envío sigue su fecha real.
    const { data: ajustesBD } = await db
      .from('calendario_entreno_ajustes')
      .select('id, sesion_id, tipo, fecha_origen, fecha')
      .in('plan_id', planIds)
    const ajustes = (ajustesBD ?? []) as Ajuste[]
    const hoy = fechaLocalISO()

    const fin = finHorizonteEnvio(hoy)
    const dias: string[] = []
    for (let f = hoy; f <= fin; f = sumarDias(f, 1)) dias.push(f)

    for (const s of sesiones ?? []) {
      if (resumen.enviados >= MAX_ENVIOS) break
      // Fechas reales de la sesión: plantilla semanal dentro del bloque + lo movido, copiado o quitado en el calendario.
      const plan = (planes ?? []).find(p => p.id === s.plan_id)
      const activa = plan ? plantillaActivaEn(plan.created_at, plan.duracion_semanas as number | null) : () => true
      const delPlan = (sesiones ?? []).filter(x => x.plan_id === s.plan_id)
      const deseadas = dias.filter(f => ocurrenciasDelDia(f, delPlan, ajustes, activa(f)).some(o => o.sesion.id === s.id))
      const decision = planearEnvioGarmin({ ...s, garmin_fechas: Array.isArray(s.garmin_fechas) ? s.garmin_fechas : [] }, huellaPasos(s.pasos, vdot), deseadas, hoy)
      if (decision.accion === 'nada') { resumen.al_dia++; continue }
      try {
        await enviarSesionAGarmin(db, s.id, undefined, { modo: decision.accion, fechas: decision.accion === 'borrar' ? [] : decision.fechas })
        resumen.enviados++
      } catch (e) {
        const msg = e instanceof ErrorGarmin ? e.mensaje : 'error inesperado'
        resumen.errores.push(`${s.nombre}: ${msg}`)
      }
    }
  }

  return NextResponse.json(resumen)
}
