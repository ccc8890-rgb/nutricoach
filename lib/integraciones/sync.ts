// lib/integraciones/sync.ts
// Orquesta la sincronización de todos los proveedores para todos los clientes
import { createServiceSupabase } from '@/lib/supabase-server'
import { persistirActividades } from './normalizer'
import { garminProvider } from './garmin'
import { googleFitProvider } from './google-fit'
import { whoopProvider } from './whoop'
import { corosProvider } from './coros'
import type { ProveedorIntegracion, IntegracionCliente } from './types'

const PROVEEDORES: ProveedorIntegracion[] = [
  garminProvider,
  googleFitProvider,
  whoopProvider,
  corosProvider,
  // stravaProvider usa webhook push, no polling
]

export async function sincronizarTodosProveedores(): Promise<{
  synced: number
  errors: string[]
}> {
  const db = createServiceSupabase()
  const desde = new Date(Date.now() - 25 * 60 * 60 * 1000) // últimas 25h (overlap)

  const { data: integraciones } = await db
    .from('integraciones_cliente')
    .select('*')
    .eq('activa', true)
    .not('proveedor', 'eq', 'strava') // strava usa webhook
    .not('proveedor', 'eq', 'manual')

  if (!integraciones || integraciones.length === 0) return { synced: 0, errors: [] }

  let synced = 0
  const errors: string[] = []

  for (const raw of integraciones) {
    const intg = raw as IntegracionCliente
    const proveedor = PROVEEDORES.find(p => p.proveedor === intg.proveedor)
    if (!proveedor) continue

    try {
      const acts = await proveedor.syncActivities(intg, desde)
      if (acts.length > 0) {
        await persistirActividades(db, acts)
        synced += acts.length
      }
      await db.from('integraciones_cliente').update({
        ultima_sync: new Date().toISOString(),
        error_ultimo: null,
      }).eq('id', intg.id)
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      errors.push(`${intg.proveedor}:${intg.cliente_id}: ${msg}`)
      await db.from('integraciones_cliente').update({ error_ultimo: msg }).eq('id', intg.id)
    }
  }

  return { synced, errors }
}
