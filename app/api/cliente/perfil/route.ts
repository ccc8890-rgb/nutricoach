import { NextRequest, NextResponse } from 'next/server'
import { createApiSupabase, createServiceSupabase } from '@/lib/supabase-server'

export async function PATCH(request: NextRequest) {
  const authDb = createApiSupabase(request)
  const { data: { user } } = await authDb.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  const body = await request.json().catch(() => ({}))
  const { telefono, restricciones_alimentarias } = body as { telefono?: string; restricciones_alimentarias?: string }

  const admin = createServiceSupabase()

  if (telefono !== undefined) {
    const { error } = await admin.from('profiles').update({ telefono: telefono || null }).eq('id', user.id)
    if (error) return NextResponse.json({ error: 'No se pudo actualizar el teléfono' }, { status: 500 })
  }

  if (restricciones_alimentarias !== undefined) {
    const { error } = await admin
      .from('clientes')
      .update({ restricciones_alimentarias: restricciones_alimentarias || null })
      .eq('profile_id', user.id)
    if (error) return NextResponse.json({ error: 'No se pudieron actualizar las restricciones' }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
