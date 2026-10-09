import { NextRequest, NextResponse } from 'next/server'
import { createApiSupabase, createServiceSupabase } from '@/lib/supabase-server'
import { autorizarCoachCliente } from '@/lib/auth/autorizar-coach-cliente'
import { aplicarDecision } from '@/lib/rendimiento/aplicar-decision'

export const maxDuration = 60

/** Aplica (o deshace) al plan del atleta un cambio de pasos propuesto por el entrenador IA. Solo el coach dueño. */
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: clienteId } = await params
  const { data: { user } } = await createApiSupabase(request).auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const db = createServiceSupabase()
  const a = await autorizarCoachCliente(db, { userId: user.id, clienteId })
  if (!a.ok) return NextResponse.json({ error: a.mensaje }, { status: a.status })

  const body = await request.json().catch(() => null) as { tareaId?: unknown; indice?: unknown; deshacer?: unknown } | null
  const tareaId = typeof body?.tareaId === 'string' ? body.tareaId : ''
  const indice = typeof body?.indice === 'number' && Number.isInteger(body.indice) ? body.indice : -1
  if (!tareaId || indice < 0 || indice > 20) return NextResponse.json({ error: 'Datos inválidos' }, { status: 400 })

  const r = await aplicarDecision(db, { clienteId, tareaId, indice, deshacer: body?.deshacer === true })
  if (!r.ok) return NextResponse.json({ error: r.error }, { status: r.status })
  return NextResponse.json(r)
}
