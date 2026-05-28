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

  // NOTA: El fallback a credenciales globales del coach (GARMIN_EMAIL/GARMIN_PASSWORD) fue
  // eliminado porque persistía datos de actividad del coach bajo el ID del cliente,
  // mezclando datos privados. Garmin solo se sincroniza si el cliente tiene sus propias
  // credenciales vinculadas en integraciones_cliente.credenciales_json.

  return NextResponse.json({
    ok: results.every(r => r.ok),
    results,
    updated_at: now,
  })
}
