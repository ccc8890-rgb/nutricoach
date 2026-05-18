import { NextRequest, NextResponse } from 'next/server'
import { createApiSupabase, createServiceSupabase } from '@/lib/supabase-server'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ clienteId: string }> }
) {
  const supabase = createApiSupabase(request)
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const { clienteId } = await params
  const db = createServiceSupabase()

  const { data, error } = await db
    .from('perfil_entreno_cliente')
    .select('*')
    .eq('cliente_id', clienteId)
    .single()

  if (error && error.code !== 'PGRST116') {
    return NextResponse.json({ error: error.message }, { status: 500 })
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

  const { data, error } = await db
    .from('perfil_entreno_cliente')
    .upsert(
      { ...body, cliente_id: clienteId, updated_at: new Date().toISOString() },
      { onConflict: 'cliente_id' }
    )
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ perfil: data })
}
