// app/api/integraciones/garmin-connect/route.ts
// Guardar credenciales Garmin Connect del cliente (cifradas AES-256-CBC)
// POST { email, password } → verifica login → guarda en integraciones_cliente

import { NextRequest, NextResponse } from 'next/server'
import { createApiSupabase } from '@/lib/supabase-server'
import { createServiceSupabase } from '@/lib/supabase-server'
import { cifrarCredenciales, verificarCredencialesGarmin } from '@/lib/integraciones/garmin-connect-perclient'
import { autorizarCliente, type ClienteLookup } from '@/lib/integraciones/autorizar-cliente'

// Construye el lookup de autorización sobre el cliente service-role.
function crearLookup(db: ReturnType<typeof createServiceSupabase>): ClienteLookup {
  return {
    async porId(clienteId) {
      const { data, error } = await db
        .from('clientes')
        .select('id, coach_id, profile_id')
        .eq('id', clienteId)
        .maybeSingle()
      if (error) throw error
      return data ?? null
    },
    async porCodigo(codigo) {
      const { data: plan, error } = await db
        .from('planes_nutricion')
        .select('cliente_id')
        .eq('codigo_publico', codigo)
        .maybeSingle()
      if (error) throw error
      if (!plan?.cliente_id) return null
      const { data, error: errCliente } = await db
        .from('clientes')
        .select('id, coach_id, profile_id')
        .eq('id', plan.cliente_id)
        .maybeSingle()
      if (errCliente) throw errCliente
      return data ?? null
    },
    async porProfileId(userId) {
      const { data, error } = await db
        .from('clientes')
        .select('id, coach_id, profile_id')
        .eq('profile_id', userId)
        .maybeSingle()
      if (error) throw error
      return data ?? null
    },
    async rolDePerfil(userId) {
      const { data, error } = await db
        .from('profiles')
        .select('role')
        .eq('id', userId)
        .maybeSingle()
      if (error) throw error
      return data?.role ?? null
    },
  }
}

export async function POST(req: NextRequest) {
  const supabase = createApiSupabase(req)
  const { data: { user } } = await supabase.auth.getUser()

  // Autenticación ANTES de parsear el body.
  if (!user) {
    return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
  }

  let body: { email?: string; password?: string; cliente_id?: string; codigo?: string }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'JSON inválido' }, { status: 400 })
  }
  const { email, password, cliente_id: clienteIdParam, codigo } = body

  // Autenticar y autorizar ANTES de validar credenciales o producir efectos.
  const db = createServiceSupabase()
  const auth = await autorizarCliente(
    { userId: user.id, clienteIdParam, codigo },
    crearLookup(db)
  )
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status })
  }
  const clienteId = auth.clienteId

  if (!email || !password) {
    return NextResponse.json({ error: 'email y password requeridos' }, { status: 400 })
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
    console.error('[garmin-connect] upsert error:', upsertError)
    return NextResponse.json({ error: 'No se pudieron guardar las credenciales' }, { status: 500 })
  }

  return NextResponse.json({ ok: true, displayName })
}

export async function DELETE(req: NextRequest) {
  const supabase = createApiSupabase(req)
  const { data: { user } } = await supabase.auth.getUser()

  // Autenticación ANTES de parsear el body.
  if (!user) {
    return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
  }

  let body: { cliente_id?: string; codigo?: string }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'JSON inválido' }, { status: 400 })
  }
  const { cliente_id, codigo } = body

  const db = createServiceSupabase()
  const auth = await autorizarCliente(
    { userId: user.id, clienteIdParam: cliente_id, codigo },
    crearLookup(db)
  )
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status })
  }
  const clienteId = auth.clienteId

  const { error } = await db
    .from('integraciones_cliente')
    .delete()
    .eq('cliente_id', clienteId)
    .eq('proveedor', 'garmin_connect')

  if (error) {
    console.error('[garmin-connect] delete error:', error)
    return NextResponse.json({ error: 'No se pudo desconectar Garmin' }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
