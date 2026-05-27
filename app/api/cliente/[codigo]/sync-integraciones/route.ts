import { NextRequest, NextResponse } from 'next/server'
import { createServiceSupabase } from '@/lib/supabase-server'
import { syncGarminClientDays } from '@/lib/integraciones/garmin-connect-perclient'
import { syncGarminDay, persistirGarminDays } from '@/lib/integraciones/garmin-connect-sync'
import { stravaProvider } from '@/lib/integraciones/strava'
import { googleFitProvider } from '@/lib/integraciones/google-fit'
import { whoopProvider } from '@/lib/integraciones/whoop'
import { persistirActividades } from '@/lib/integraciones/normalizer'
import type { IntegracionCliente, ProveedorIntegracion } from '@/lib/integraciones/types'

type SyncResult = {
  proveedor: string
  ok: boolean
  sincronizados: number
  error?: string
}

const SYNC_PROVIDERS: Record<string, ProveedorIntegracion> = {
  strava: stravaProvider,
  google_fit: googleFitProvider,
  whoop: whoopProvider,
}

async function resolverClientePorCodigo(codigo: string) {
  const db = createServiceSupabase()
  const { data: plan } = await db
    .from('planes_nutricion')
    .select('cliente_id')
    .eq('codigo_publico', codigo)
    .eq('activo', true)
    .maybeSingle()

  return { db, clienteId: plan?.cliente_id as string | null | undefined }
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ codigo: string }> }) {
  const { codigo } = await params
  const body = await request.json().catch(() => ({})) as { dias?: number }
  const dias = Math.min(Math.max(Number(body.dias ?? 3), 1), 14)
  const { db, clienteId } = await resolverClientePorCodigo(codigo)

  if (!clienteId) {
    return NextResponse.json({ error: 'Cliente no encontrado' }, { status: 404 })
  }

  const { data: integraciones } = await db
    .from('integraciones_cliente')
    .select('*')
    .eq('cliente_id', clienteId)
    .eq('activa', true)
    .in('proveedor', ['garmin_connect', 'strava', 'google_fit', 'whoop'])

  const results: SyncResult[] = []
  const now = new Date().toISOString()

  for (const integracion of integraciones ?? []) {
    if (integracion.proveedor === 'garmin_connect') {
      try {
        if (!integracion.credenciales_json) continue
        const sincronizados = await syncGarminClientDays(db, clienteId, integracion.credenciales_json, dias)
        await db
          .from('integraciones_cliente')
          .update({ ultima_sync: now, error_ultimo: null })
          .eq('id', integracion.id)
        results.push({ proveedor: 'garmin_connect', ok: true, sincronizados })
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Error sincronizando Garmin Connect'
        await db
          .from('integraciones_cliente')
          .update({ error_ultimo: message })
          .eq('id', integracion.id)
        results.push({ proveedor: 'garmin_connect', ok: false, sincronizados: 0, error: message })
      }
    }

    if (integracion.proveedor !== 'garmin_connect') {
      const provider = SYNC_PROVIDERS[integracion.proveedor]
      if (!provider) continue
      try {
        const desde = new Date(Date.now() - dias * 24 * 60 * 60 * 1000)
        const actividades = await provider.syncActivities(integracion as IntegracionCliente, desde)
        const sincronizados = await persistirActividades(db, actividades)
        await db
          .from('integraciones_cliente')
          .update({ ultima_sync: now, error_ultimo: null })
          .eq('id', integracion.id)
        results.push({ proveedor: integracion.proveedor, ok: true, sincronizados })
      } catch (error) {
        const message = error instanceof Error ? error.message : `Error sincronizando ${integracion.proveedor}`
        await db
          .from('integraciones_cliente')
          .update({ error_ultimo: message })
          .eq('id', integracion.id)
        results.push({ proveedor: integracion.proveedor, ok: false, sincronizados: 0, error: message })
      }
    }
  }

  const tieneGarminPerClient = (integraciones ?? []).some(i => i.proveedor === 'garmin_connect' && i.credenciales_json)
  const tieneStrava = (integraciones ?? []).some(i => i.proveedor === 'strava')
  if (!tieneGarminPerClient && tieneStrava && process.env.GARMIN_EMAIL && process.env.GARMIN_PASSWORD) {
    try {
      const hoy = new Date().toISOString().split('T')[0]
      const ayer = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString().split('T')[0]
      const days = await Promise.all([syncGarminDay(hoy), syncGarminDay(ayer)])
      const validos = days.filter(Boolean) as NonNullable<typeof days[0]>[]
      const sincronizados = validos.length > 0 ? await persistirGarminDays(db, clienteId, validos) : 0
      await db
        .from('integraciones_cliente')
        .upsert(
          {
            cliente_id: clienteId,
            proveedor: 'garmin_connect',
            activa: true,
            ultima_sync: now,
            error_ultimo: null,
            updated_at: now,
          },
          { onConflict: 'cliente_id,proveedor' }
        )
      results.push({ proveedor: 'garmin_connect', ok: true, sincronizados })
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Error sincronizando Garmin Connect'
      await db
        .from('integraciones_cliente')
        .upsert(
          {
            cliente_id: clienteId,
            proveedor: 'garmin_connect',
            activa: true,
            error_ultimo: message,
            updated_at: now,
          },
          { onConflict: 'cliente_id,proveedor' }
        )
      results.push({ proveedor: 'garmin_connect', ok: false, sincronizados: 0, error: message })
    }
  }

  return NextResponse.json({
    ok: results.every(r => r.ok),
    results,
    updated_at: now,
  })
}
