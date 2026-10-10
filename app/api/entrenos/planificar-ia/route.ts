import { NextRequest, NextResponse } from 'next/server'
import { createApiSupabase, createServiceSupabase } from '@/lib/supabase-server'
import { autorizarCoachCliente } from '@/lib/auth/autorizar-coach-cliente'
import { rateLimit } from '@/lib/rate-limit'
import { estadoHttpDe, leerModoPlanificacion, planificarConIA, validarCuerpoPlanificar } from '@/lib/entrenos/planificar-con-ia'

export const maxDuration = 120

async function autorizar(req: NextRequest, clienteId: string) {
  const { data: { user } } = await createApiSupabase(req).auth.getUser()
  if (!user) return { error: NextResponse.json({ error: 'No autorizado' }, { status: 401 }) }
  const db = createServiceSupabase()
  const a = await autorizarCoachCliente(db, { userId: user.id, clienteId })
  if (!a.ok) return { error: NextResponse.json({ error: a.mensaje }, { status: a.status }) }
  return { db, userId: user.id }
}

/** Qué hará el botón para este cliente (texto bajo el botón). */
export async function GET(req: NextRequest) {
  const v = validarCuerpoPlanificar({ cliente_id: new URL(req.url).searchParams.get('cliente_id') })
  if (!v.ok) return NextResponse.json({ error: v.motivo }, { status: 400 })
  const r = await autorizar(req, v.clienteId)
  if (r.error) return r.error
  const m = await leerModoPlanificacion(r.db, v.clienteId)
  return NextResponse.json({ modo: m.modo, etiqueta: m.etiqueta, diasRestantes: m.diasRestantes, hayPropuestaPendiente: m.hayPropuestaPendiente })
}

/** Genera la propuesta (nunca cambia el plan activo). */
export async function POST(req: NextRequest) {
  try {
    const cuerpo = await req.json().catch(() => null)
    const v = validarCuerpoPlanificar(cuerpo)
    if (!v.ok) return NextResponse.json({ error: v.motivo }, { status: 400 })
    const r = await autorizar(req, v.clienteId)
    if (r.error) return r.error
    if (!rateLimit(`planificar-ia:${r.userId}`, 5, 60_000)) return NextResponse.json({ error: 'Demasiadas peticiones. Espera un momento.' }, { status: 429 })

    const res = await planificarConIA(r.db, { clienteId: v.clienteId })
    if (!res.ok) return NextResponse.json({ error: res.motivo, codigo: res.codigo, modo: res.modo }, { status: estadoHttpDe(res) })
    return NextResponse.json({ ok: true, modo: res.modo, tarea_id: res.tareaId, resumen: res.resumen })
  } catch (err) {
    console.error('planificar-ia error:', err instanceof Error ? err.message : err)
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
  }
}
