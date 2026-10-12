import { NextRequest, NextResponse } from 'next/server'
import { createApiSupabase, createServiceSupabase } from '@/lib/supabase-server'
import { autorizarCoachCliente } from '@/lib/auth/autorizar-coach-cliente'

async function acceso(request: NextRequest, clienteId: string) {
  const { data: { user } } = await createApiSupabase(request).auth.getUser()
  if (!user) return { error: NextResponse.json({ error: 'No autorizado' }, { status: 401 }) }
  const db = createServiceSupabase()
  const a = await autorizarCoachCliente(db, { userId: user.id, clienteId })
  if (!a.ok) return { error: NextResponse.json({ error: a.mensaje }, { status: a.status }) }
  return { db }
}

/** Cambios que ha hecho el atleta en su plan y el coach aún no ha visto. */
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const a = await acceso(request, id)
  if ('error' in a) return a.error
  const { data } = await a.db.from('cambios_cliente').select('id, tipo, resumen, created_at').eq('cliente_id', id).eq('visto', false).order('created_at', { ascending: false }).limit(30)
  return NextResponse.json({ cambios: data ?? [] })
}

/** «Entendido»: marca como vistos los cambios indicados (o todos los pendientes si no se indica ninguno). */
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const a = await acceso(request, id)
  if ('error' in a) return a.error
  const body = await request.json().catch(() => ({})) as { ids?: unknown }
  let q = a.db.from('cambios_cliente').update({ visto: true }).eq('cliente_id', id).eq('visto', false)
  if (Array.isArray(body.ids) && body.ids.every(x => typeof x === 'string')) q = q.in('id', body.ids as string[])
  const { error } = await q
  if (error) return NextResponse.json({ error: 'No se pudo marcar como visto' }, { status: 500 })
  return NextResponse.json({ ok: true })
}
