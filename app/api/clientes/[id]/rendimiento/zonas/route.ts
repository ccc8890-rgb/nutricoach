import { NextRequest, NextResponse } from 'next/server'
import { createApiSupabase, createServiceSupabase } from '@/lib/supabase-server'
import { autorizarCoachCliente } from '@/lib/auth/autorizar-coach-cliente'
import { calcularZonas, aplicarVdot } from '@/lib/rendimiento/zonas'

async function autorizar(request: NextRequest, clienteId: string) {
  const { data: { user } } = await createApiSupabase(request).auth.getUser()
  if (!user) return { error: NextResponse.json({ error: 'No autorizado' }, { status: 401 }) }
  const db = createServiceSupabase()
  const a = await autorizarCoachCliente(db, { userId: user.id, clienteId })
  if (!a.ok) return { error: NextResponse.json({ error: a.mensaje }, { status: a.status }) }
  return { db }
}

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const r = await autorizar(request, id)
  if (r.error) return r.error
  return NextResponse.json(await calcularZonas(r.db, id, new Date().toISOString().slice(0, 10)))
}

/** El coach acepta un VDOT nuevo. Los envíos al reloj se reajustan solos con el cron diario (cambia la huella de los pasos). */
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const r = await autorizar(request, id)
  if (r.error) return r.error
  const body = await request.json().catch(() => null) as { vdot?: unknown; motivo?: unknown } | null
  const vdot = typeof body?.vdot === 'number' ? body.vdot : NaN
  const res = await aplicarVdot(r.db, id, vdot, typeof body?.motivo === 'string' ? body.motivo : 'Recalibración aceptada por el coach')
  if (!res.ok) return NextResponse.json({ error: res.error }, { status: res.status })
  return NextResponse.json({ ok: true, vdot: res.vdot })
}
