import { NextRequest, NextResponse } from 'next/server'
import { createServiceSupabase } from '@/lib/supabase-server'
import { ejecutarAnalisisRendimiento } from '@/lib/agentes/analisis-rendimiento'

export const maxDuration = 300

/** Máximo de atletas por pasada: cada análisis es una llamada a la IA. */
const MAX_ATLETAS = 15

function autorizado(req: NextRequest): boolean {
  const secreto = process.env.CRON_SECRET
  if (!secreto) return false
  const auth = req.headers.get('authorization')
  if (auth?.startsWith('Bearer ')) return auth.slice(7) === secreto
  return req.headers.get('x-cron-secret') === secreto
}

/** Cada lunes: un análisis de rendimiento por atleta con entrenos en las últimas 4 semanas. */
export async function GET(req: NextRequest) {
  if (!autorizado(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const db = createServiceSupabase()
  const desde = new Date(Date.now() - 28 * 86_400_000).toISOString().slice(0, 10)
  const { data: filas } = await db.from('entrenos_realizados').select('cliente_id').gte('fecha', desde)
  const atletas = [...new Set((filas ?? []).map(f => f.cliente_id as string))].slice(0, MAX_ATLETAS)

  const resumen = { atletas: atletas.length, generados: 0, omitidos: [] as string[] }
  for (const id of atletas) {
    const r = await ejecutarAnalisisRendimiento(id)
    if (r.ok) resumen.generados++
    else resumen.omitidos.push(`${id.slice(0, 8)}: ${r.motivo}`)
  }
  return NextResponse.json(resumen)
}
