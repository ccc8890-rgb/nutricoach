import { NextRequest, NextResponse } from 'next/server'
import { createApiSupabase, createServiceSupabase } from '@/lib/supabase-server'
import { validarMarcas } from '@/lib/entrenos/marcas'
import { guardarMarcasPerfil } from '@/lib/entrenos/guardar-marcas'

async function clienteDeLaSesion(request: NextRequest) {
  const { data: { user } } = await createApiSupabase(request).auth.getUser()
  if (!user) return null
  const admin = createServiceSupabase()
  const { data } = await admin.from('clientes').select('id').eq('profile_id', user.id).maybeSingle()
  return data ? { admin, clienteId: data.id as string } : null
}

/** «Mis marcas» del propio atleta. */
export async function GET(request: NextRequest) {
  const c = await clienteDeLaSesion(request)
  if (!c) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
  const { data } = await c.admin.from('perfil_entreno_cliente').select('marcas').eq('cliente_id', c.clienteId).maybeSingle()
  return NextResponse.json({ existe: !!data, marcas: (data?.marcas as Record<string, number> | null) ?? {} })
}

export async function PUT(request: NextRequest) {
  const c = await clienteDeLaSesion(request)
  if (!c) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
  const body = await request.json().catch(() => null) as { marcas?: unknown } | null
  const v = validarMarcas(body?.marcas)
  if (!v.ok) return NextResponse.json({ error: v.error }, { status: 400 })

  const r = await guardarMarcasPerfil(c.admin, c.clienteId, v.marcas)
  if (!r.ok) return NextResponse.json({ error: r.status === 404 ? 'Tu coach aún no ha creado tu perfil de atleta' : r.error }, { status: r.status })
  return NextResponse.json({ ok: true, marcas: r.marcas })
}
