import { NextRequest, NextResponse } from 'next/server'
import { createServiceSupabase } from '@/lib/supabase-server'
import { sincronizarTodosProveedores } from '@/lib/integraciones/sync'
import { syncGarminDay, persistirGarminDays } from '@/lib/integraciones/garmin-connect-sync'

export async function GET(req: NextRequest) {
  const secret = req.headers.get('x-cron-secret') ?? req.nextUrl.searchParams.get('secret')
  if (secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const db = createServiceSupabase()

  // Sync Strava/Garmin OAuth/Google Fit
  const resultOAuth = await sincronizarTodosProveedores()

  // Sync Garmin Connect (wellness diario) para todos los clientes con integración activa
  const garminConnectResult: Record<string, unknown> = { sincronizados: 0, errores: [] }
  if (process.env.GARMIN_EMAIL && process.env.GARMIN_PASSWORD) {
    const { data: clientes } = await db
      .from('integraciones_cliente')
      .select('cliente_id')
      .eq('proveedor', 'strava')
      .eq('activa', true)

    const hoy = new Date().toISOString().split('T')[0]
    const ayer = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString().split('T')[0]

    for (const { cliente_id } of clientes ?? []) {
      try {
        // Sync hoy y ayer (para tener datos completos del día anterior)
        const days = await Promise.all([
          syncGarminDay(hoy),
          syncGarminDay(ayer),
        ])
        const validos = days.filter(Boolean) as NonNullable<typeof days[0]>[]
        if (validos.length > 0) {
          await persistirGarminDays(db, cliente_id, validos)
          ;(garminConnectResult.sincronizados as number) += validos.length
        }
      } catch (e) {
        ;(garminConnectResult.errores as string[]).push(`${cliente_id}: ${(e as Error).message}`)
      }
    }
  }

  return NextResponse.json({ ...resultOAuth, garmin_connect: garminConnectResult })
}
