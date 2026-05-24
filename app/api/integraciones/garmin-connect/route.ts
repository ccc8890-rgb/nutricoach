// app/api/integraciones/garmin-connect/route.ts
// Guardar credenciales Garmin Connect del cliente (cifradas AES-256-CBC)
// POST { email, password } → verifica login → guarda en integraciones_cliente

import { NextRequest, NextResponse } from 'next/server'
import { createApiSupabase } from '@/lib/supabase-server'
import { createServiceSupabase } from '@/lib/supabase-server'
import { cifrarCredenciales, verificarCredencialesGarmin } from '@/lib/integraciones/garmin-connect-perclient'

export async function POST(req: NextRequest) {
  const supabase = createApiSupabase(req)
  const { data: { user } } = await supabase.auth.getUser()

  // Puede llamarlo el coach (para vincular cuenta de un cliente)
  // o el propio cliente si tiene sesión activa
  // Identificamos al cliente por cliente_id en el body (si lo envía el coach)
  // o por el session user si es el propio cliente
  const body = await req.json()
  const { email, password, cliente_id: clienteIdParam, codigo } = body

  if (!email || !password) {
    return NextResponse.json({ error: 'email y password requeridos' }, { status: 400 })
  }

  // Determinar cliente_id:
  // 1) Si viene codigo del portal → buscar en planes_nutricion
  // 2) Si viene cliente_id directo (coach autenticado)
  // 3) Si hay user autenticado y es el propio cliente (fallback)
  const db = createServiceSupabase()
  let clienteId: string | null = null

  if (codigo) {
    const { data: plan } = await db
      .from('planes_nutricion')
      .select('cliente_id')
      .eq('codigo_publico', codigo)
      .maybeSingle()
    clienteId = plan?.cliente_id ?? null
  } else if (clienteIdParam) {
    // Sólo coaches autenticados pueden vincular por cliente_id directo
    if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    clienteId = clienteIdParam
  }

  if (!clienteId) {
    return NextResponse.json({ error: 'No se pudo identificar el cliente' }, { status: 400 })
  }

  // Verificar que las credenciales son válidas antes de guardar
  let displayName: string
  try {
    displayName = await verificarCredencialesGarmin(email, password)
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Credenciales inválidas'
    return NextResponse.json({ error: `Error de login Garmin: ${msg}` }, { status: 422 })
  }

  // Cifrar y guardar
  const cifrado = cifrarCredenciales(email, password)

  const { error: upsertError } = await db
    .from('integraciones_cliente')
    .upsert(
      {
        cliente_id: clienteId,
        proveedor: 'garmin_connect',
        activa: true,
        credenciales_json: cifrado,
        ultima_sync: null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'cliente_id,proveedor' }
    )

  if (upsertError) {
    return NextResponse.json({ error: upsertError.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true, displayName })
}

export async function DELETE(req: NextRequest) {
  const body = await req.json()
  const { cliente_id, codigo } = body

  const db = createServiceSupabase()
  let clienteId: string | null = cliente_id ?? null

  if (!clienteId && codigo) {
    const { data: plan } = await db
      .from('planes_nutricion')
      .select('cliente_id')
      .eq('codigo_publico', codigo)
      .maybeSingle()
    clienteId = plan?.cliente_id ?? null
  }

  if (!clienteId) {
    return NextResponse.json({ error: 'cliente no encontrado' }, { status: 400 })
  }

  await db
    .from('integraciones_cliente')
    .delete()
    .eq('cliente_id', clienteId)
    .eq('proveedor', 'garmin_connect')

  return NextResponse.json({ ok: true })
}
