import { NextRequest, NextResponse } from 'next/server'
import { createApiSupabase, createServiceSupabase } from '@/lib/supabase-server'
import { autorizarCoachCliente } from '@/lib/auth/autorizar-coach-cliente'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ clienteId: string }> }
) {
  const supabase = createApiSupabase(request)
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const { clienteId } = await params
  const db = createServiceSupabase()
  // Solo el coach propietario del cliente (antes bastaba con tener sesión: cualquier usuario podía leer o escribir el perfil de otro).
  const acceso = await autorizarCoachCliente(db, { userId: user.id, clienteId })
  if (!acceso.ok) return NextResponse.json({ error: acceso.mensaje }, { status: acceso.status })

  const { data, error } = await db
    .from('perfil_entreno_cliente')
    .select('*')
    .eq('cliente_id', clienteId)
    .single()

  if (error && error.code !== 'PGRST116') {
    console.error('perfil-entreno GET:', error.message)
    return NextResponse.json({ error: 'No se pudo leer el perfil' }, { status: 500 })
  }

  return NextResponse.json({ perfil: data ?? null })
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ clienteId: string }> }
) {
  const supabase = createApiSupabase(request)
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const { clienteId } = await params
  const body = await request.json()
  const db = createServiceSupabase()
  const acceso = await autorizarCoachCliente(db, { userId: user.id, clienteId })
  if (!acceso.ok) return NextResponse.json({ error: acceso.mensaje }, { status: acceso.status })
  // `marcas` las escribe el atleta (al guardar este formulario no deben pisarse con una copia vieja) y las claves de identidad no se cambian.
  delete body.marcas; delete body.id; delete body.cliente_id; delete body.created_at

  const { data, error } = await db
    .from('perfil_entreno_cliente')
    .upsert(
      { ...body, cliente_id: clienteId, updated_at: new Date().toISOString() },
      { onConflict: 'cliente_id' }
    )
    .select()
    .single()

  if (error) {
    console.error('perfil-entreno PUT:', error.message)
    return NextResponse.json({ error: 'No se pudo guardar el perfil' }, { status: 500 })
  }

  return NextResponse.json({ perfil: data })
}
