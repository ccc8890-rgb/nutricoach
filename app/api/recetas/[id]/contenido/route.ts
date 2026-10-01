import { NextRequest, NextResponse } from 'next/server'
import { createApiSupabase, createServiceSupabase } from '@/lib/supabase-server'

const ESTADOS = ['para_grabar', 'grabada', null] as const

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const supabase = createApiSupabase(request)
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
  const admin = createServiceSupabase()
  const { data: profile } = await admin.from('profiles').select('role').eq('id', user.id).single()
  if (profile?.role !== 'coach') return NextResponse.json({ error: 'Acceso restringido al coach' }, { status: 403 })

  const { id } = await params
  const body = await request.json().catch(() => null) as { contenido_estado?: string | null } | null
  const estado = body?.contenido_estado ?? null
  if (!ESTADOS.includes(estado as typeof ESTADOS[number])) return NextResponse.json({ error: 'Estado no válido' }, { status: 400 })

  const { error } = await admin.from('recetas').update({ contenido_estado: estado }).eq('id', id)
  if (error) return NextResponse.json({ error: 'No se pudo actualizar' }, { status: 500 })
  return NextResponse.json({ ok: true, contenido_estado: estado })
}
