// Webhook Terra — recibe datos en tiempo real cuando el usuario sincroniza en su app
// Tipos de payload: activity, daily, sleep, body, athlete
// Docs: https://docs.tryterra.co/webhooks
import { NextRequest, NextResponse } from 'next/server'
import { createServiceSupabase } from '@/lib/supabase-server'
import { verificarFirmaWebhook, normalizarTerraActivity, normalizarTerraDaily, normalizarTerraSleep } from '@/lib/integraciones/terra'
import { persistirActividades } from '@/lib/integraciones/normalizer'
import type { ActividadExterna, Proveedor } from '@/lib/integraciones/types'

export async function POST(req: NextRequest) {
  const rawBody = await req.text()
  const signature = req.headers.get('terra-signature')

  // Verificar firma (no bloquear si no está configurada aún — dev mode)
  if (process.env.NODE_ENV === 'production' && process.env.TERRA_API_KEY) {
    if (!verificarFirmaWebhook(rawBody, signature)) {
      console.warn('[terra-webhook] Firma inválida')
      return NextResponse.json({ error: 'Firma inválida' }, { status: 401 })
    }
  }

  let payload: Record<string, unknown>
  try {
    payload = JSON.parse(rawBody)
  } catch {
    return NextResponse.json({ error: 'JSON inválido' }, { status: 400 })
  }

  const tipo = String(payload.type ?? '')                       // "activity", "daily", "sleep", "body"
  const user = payload.user as Record<string, unknown> | null
  const terraUserId = String(user?.user_id ?? '')
  const provider = String(user?.provider ?? '').toUpperCase()

  if (!terraUserId) return NextResponse.json({ ok: true })      // ping de Terra

  const db = createServiceSupabase()

  // Lookup cliente_id desde terra_user_id
  const { data: conn } = await db
    .from('terra_usuarios')
    .select('cliente_id, provider')
    .eq('terra_user_id', terraUserId)
    .eq('activa', true)
    .single()

  if (!conn) {
    // Terra puede enviar datos antes de que el callback se procese — guardar la conexión
    console.warn(`[terra-webhook] terra_user_id no encontrado: ${terraUserId}`)
    return NextResponse.json({ ok: true })
  }

  const clienteId = conn.cliente_id
  // Proveedor normalizado para guardar en actividad_externa_cliente
  const proveedorNorm = (provider || conn.provider || 'terra').toLowerCase() as Proveedor

  const actividades: ActividadExterna[] = []

  if (tipo === 'activity') {
    const items = (payload.data as Record<string, unknown>[]) ?? []
    for (const act of items) {
      const normalizada = normalizarTerraActivity(clienteId, proveedorNorm, act)
      normalizada.proveedor = proveedorNorm
      actividades.push(normalizada)
    }
  }

  if (tipo === 'daily') {
    const items = (payload.data as Record<string, unknown>[]) ?? []
    for (const day of items) {
      const normalizada = normalizarTerraDaily(clienteId, day)
      normalizada.proveedor = proveedorNorm
      actividades.push(normalizada)
    }
  }

  if (tipo === 'sleep') {
    const items = (payload.data as Record<string, unknown>[]) ?? []
    for (const s of items) {
      const normalizada = normalizarTerraSleep(clienteId, s)
      if (normalizada) {
        normalizada.proveedor = proveedorNorm
        actividades.push(normalizada)
      }
    }
  }

  if (actividades.length > 0) {
    await persistirActividades(db, actividades)
  }

  // Actualizar ultima_sync
  await db.from('terra_usuarios')
    .update({ ultima_sync: new Date().toISOString() })
    .eq('terra_user_id', terraUserId)

  return NextResponse.json({ ok: true, procesados: actividades.length })
}

// Terra también hace GET para verificar que el endpoint está activo
export async function GET() {
  return NextResponse.json({ ok: true, service: 'terra-webhook' })
}
