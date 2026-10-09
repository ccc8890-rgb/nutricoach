/**
 * Trae el histórico de entrenos de Garmin de un cliente a entrenos_realizados.
 *   npx tsx --env-file=.env.local scripts/rendimiento-backfill.ts <cliente_id> [limite=300]
 * Idempotente: se puede repetir (upsert por actividad). También recalcula el TSS con los umbrales actuales.
 */
import { createClient } from '@supabase/supabase-js'
import { descifrarConexionGarmin } from '../lib/integraciones/garmin-connect-perclient'
import { sincronizarEntrenosGarmin } from '../lib/rendimiento/garmin-entrenos'

async function main() {
  const clienteId = process.argv[2]
  const limite = Number(process.argv[3] ?? 300)
  if (!clienteId) throw new Error('Falta cliente_id')
  const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } })
  const { data } = await db.from('integraciones_cliente').select('credenciales_json').eq('cliente_id', clienteId).eq('proveedor', 'garmin_connect').single()
  const c = descifrarConexionGarmin(data!.credenciales_json as string)
  const { GarminConnect } = await import('garmin-connect')
  const gc = new GarminConnect({ username: c.email, password: c.password })
  gc.loadToken(c.oauth1!, c.oauth2!)
  console.log('entrenos guardados:', await sincronizarEntrenosGarmin(db, clienteId, gc, limite))
}
main().catch(e => { console.error(e); process.exit(1) })
