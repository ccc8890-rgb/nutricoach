import { NextRequest, NextResponse } from 'next/server'
import { createServiceSupabase } from '@/lib/supabase-server'
import { syncGarminDay, persistirGarminDays, dateRange } from '@/lib/integraciones/garmin-connect-sync'

// POST /api/integraciones/garmin-connect/sync
// Body: { cliente_id, dias? (default 7) }  — o llamado desde cron con CRON_SECRET
export async function POST(req: NextRequest) {
  const authHeader = req.headers.get('authorization')
  const isCron = authHeader === `Bearer ${process.env.CRON_SECRET}`

  if (!isCron) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  }

  const body = await req.json().catch(() => ({}))
  const clienteId: string = body.cliente_id
  const dias: number = body.dias ?? 7

  if (!clienteId) return NextResponse.json({ error: 'cliente_id requerido' }, { status: 400 })

  const db = createServiceSupabase()
  const hasta = new Date()
  const desde = new Date(Date.now() - dias * 24 * 60 * 60 * 1000)
  const fechas = dateRange(desde, hasta)

  const resultados: string[] = []
  const errores: string[] = []

  for (const fecha of fechas) {
    try {
      const data = await syncGarminDay(fecha)
      if (data) {
        await persistirGarminDays(db, clienteId, [data])
        resultados.push(fecha)
      }
    } catch (e) {
      errores.push(`${fecha}: ${(e as Error).message}`)
    }
    // Respetar rate limit Garmin
    await new Promise(r => setTimeout(r, 500))
  }

  return NextResponse.json({ ok: true, sincronizados: resultados.length, fechas: resultados, errores })
}
