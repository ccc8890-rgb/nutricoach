import { NextRequest, NextResponse } from 'next/server'
import { createServiceSupabase } from '@/lib/supabase-server'
import { sincronizarTodosProveedores } from '@/lib/integraciones/sync'
import { syncGarminDay, persistirGarminDays, dateRange } from '@/lib/integraciones/garmin-connect-sync'
import { syncGarminClientDays } from '@/lib/integraciones/garmin-connect-perclient'

export const maxDuration = 300
import { descifrarCredenciales } from '@/lib/integraciones/garmin-connect-perclient'

export async function GET(req: NextRequest) {
  const secret = req.headers.get('x-cron-secret') ?? req.nextUrl.searchParams.get('secret')
  if (secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const db = createServiceSupabase()

  // Sync Strava/Garmin OAuth/Google Fit (OAuth providers)
  const resultOAuth = await sincronizarTodosProveedores()

  // Sync Garmin Connect por cliente (credenciales propias)
  const gcClientResult: { sincronizados: number; errores: string[] } = { sincronizados: 0, errores: [] }
  const { data: gcRows } = await db
    .from('integraciones_cliente')
    .select('cliente_id, credenciales_json')
    .eq('proveedor', 'garmin_connect')
    .eq('activa', true)

  for (const row of gcRows ?? []) {
    if (!row.credenciales_json) continue
    try {
      const n = await syncGarminClientDays(db, row.cliente_id, row.credenciales_json, 2)
      gcClientResult.sincronizados += n
      // Actualizar ultima_sync
      await db
        .from('integraciones_cliente')
        .update({ ultima_sync: new Date().toISOString() })
        .eq('cliente_id', row.cliente_id)
        .eq('proveedor', 'garmin_connect')
    } catch (e) {
      gcClientResult.errores.push(`${row.cliente_id}: ${(e as Error).message}`)
    }
  }

  // Sync Garmin Connect con credenciales del coach (legacy — para el cliente del coach mismo)
  const gcCoachResult: { sincronizados: number; errores: string[] } = { sincronizados: 0, errores: [] }
  if (process.env.GARMIN_EMAIL && process.env.GARMIN_PASSWORD) {
    // Solo para clientes que tienen strava activo Y no tienen garmin_connect per-client
    const gcClientIds = new Set((gcRows ?? []).map(r => r.cliente_id))
    const { data: stravaClientes } = await db
      .from('integraciones_cliente')
      .select('cliente_id')
      .eq('proveedor', 'strava')
      .eq('activa', true)

    const hoy = new Date().toISOString().split('T')[0]
    const ayer = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString().split('T')[0]

    for (const { cliente_id } of stravaClientes ?? []) {
      if (gcClientIds.has(cliente_id)) continue // ya tiene garmin_connect per-client
      try {
        const days = await Promise.all([syncGarminDay(hoy), syncGarminDay(ayer)])
        const validos = days.filter(Boolean) as NonNullable<typeof days[0]>[]
        if (validos.length > 0) {
          await persistirGarminDays(db, cliente_id, validos)
          gcCoachResult.sincronizados += validos.length
        }
      } catch (e) {
        gcCoachResult.errores.push(`${cliente_id}: ${(e as Error).message}`)
      }
    }
  }

  return NextResponse.json({
    ...resultOAuth,
    garmin_connect_perclient: gcClientResult,
    garmin_connect_coach: gcCoachResult,
  })
}
