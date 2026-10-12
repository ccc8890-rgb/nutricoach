import { NextRequest, NextResponse } from 'next/server'
import { createServiceSupabase } from '@/lib/supabase-server'
import { registrarCron } from '@/lib/sistema/registrar-cron'
import { DIAS_ENFRIAMIENTO_PROPUESTA_AUTO, debeProponerAutomaticamente, leerModoPlanificacion, planificarConIA } from '@/lib/entrenos/planificar-con-ia'

export const maxDuration = 300

/**
 * Máximo de propuestas por ejecución (cada una es una llamada a la IA) y último instante en que se puede EMPEZAR una.
 * Una propuesta con Opus tarda 140-250 s y `maxDuration` es 300 s: solo se empieza si caben entera. En la práctica, una por ejecución;
 * las demás se hacen en los días siguientes (el enfriamiento y la tarea pendiente evitan repetir).
 */
const MAX_PROPUESTAS = 5
const LIMITE_INICIO_MS = 40_000

function autorizado(req: NextRequest): boolean {
  const secreto = process.env.CRON_SECRET
  if (!secreto) return false
  const auth = req.headers.get('authorization')
  if (auth?.startsWith('Bearer ')) return auth.slice(7) === secreto
  return req.headers.get('x-cron-secret') === secreto
}

/**
 * Cada día, tras sincronizar los relojes: cuando a un atleta le quedan 7 días o menos de bloque, deja preparada la propuesta del siguiente
 * (como tarea pendiente; nunca cambia el plan). Solo atletas con entrenos del reloj en los últimos 28 días: los clientes de prueba sin reloj no
 * reciben propuestas solas.
 */
export async function GET(req: NextRequest) {
  if (!autorizado(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const db = createServiceSupabase()
  const desde = new Date(Date.now() - 28 * 86_400_000).toISOString().slice(0, 10)
  const { data: filas } = await db.from('entrenos_realizados').select('cliente_id').gte('fecha', desde)
  const atletas = [...new Set((filas ?? []).map(f => f.cliente_id as string))]

  const inicio = Date.now()
  const resumen = { atletas: atletas.length, propuestas: 0, omitidos: 0, errores: 0 }
  const hace = new Date(Date.now() - DIAS_ENFRIAMIENTO_PROPUESTA_AUTO * 86_400_000).toISOString()
  for (const id of atletas) {
    if (resumen.propuestas >= MAX_PROPUESTAS || Date.now() - inicio > LIMITE_INICIO_MS) break
    try {
      const decision = await leerModoPlanificacion(db, id)
      const { count } = await db.from('agente_tareas').select('id', { count: 'exact', head: true }).eq('cliente_id', id).eq('tipo', 'plan_entreno_ia').gte('created_at', hace)
      if (!debeProponerAutomaticamente(decision, count ?? 0)) { resumen.omitidos++; continue }
      const r = await planificarConIA(db, { clienteId: id })
      if (r.ok) resumen.propuestas++
      else { resumen.errores++; console.error('[proponer-bloques]', id.slice(0, 8), r.codigo) }
    } catch (e) {
      resumen.errores++
      console.error('[proponer-bloques]', id.slice(0, 8), e instanceof Error ? e.message : e)
    }
  }
  await registrarCron(db, 'proponer-bloques', resumen.errores, `${resumen.atletas} atletas, ${resumen.propuestas} propuestas`)
  return NextResponse.json(resumen)
}
