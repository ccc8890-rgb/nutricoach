import { NextRequest, NextResponse } from 'next/server'
import { createServiceSupabase } from '@/lib/supabase-server'
import { generarAvisoRendimiento } from '@/lib/rendimiento/avisos'

export const maxDuration = 120

const MAX_ATLETAS = 50
const PRESUPUESTO_MS = 100_000

function autorizado(req: NextRequest): boolean {
  const secreto = process.env.CRON_SECRET
  if (!secreto) return false
  const auth = req.headers.get('authorization')
  if (auth?.startsWith('Bearer ')) return auth.slice(7) === secreto
  return req.headers.get('x-cron-secret') === secreto
}

/** Cada día, tras la sincronización con Garmin: avisa al coach de las alertas altas nuevas. */
export async function GET(req: NextRequest) {
  if (!autorizado(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const db = createServiceSupabase()
  const desde = new Date(Date.now() - 28 * 86_400_000).toISOString().slice(0, 10)
  const { data: filas } = await db.from('entrenos_realizados').select('cliente_id').gte('fecha', desde)
  const atletas = [...new Set((filas ?? []).map(f => f.cliente_id as string))].slice(0, MAX_ATLETAS)

  const inicio = Date.now()
  const resumen = { atletas: atletas.length, avisos: 0, errores: 0 }
  for (const id of atletas) {
    if (Date.now() - inicio > PRESUPUESTO_MS) break
    try {
      const r = await generarAvisoRendimiento(id)
      if (r.ok) resumen.avisos++
    } catch (e) {
      resumen.errores++
      console.error('[avisos-rendimiento]', id.slice(0, 8), e instanceof Error ? e.message : e)
    }
  }
  return NextResponse.json(resumen)
}
