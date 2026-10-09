import { NextRequest, NextResponse } from 'next/server'
import { createApiSupabase, createServiceSupabase } from '@/lib/supabase-server'
import { autorizarCoachCliente } from '@/lib/auth/autorizar-coach-cliente'
import { ejecutarAnalisisRendimiento } from '@/lib/agentes/analisis-rendimiento'
import { vistaPreviaDecision, type DecisionGuardada } from '@/lib/rendimiento/aplicar-decision'

export const maxDuration = 90

async function autorizar(request: NextRequest, clienteId: string) {
  const { data: { user } } = await createApiSupabase(request).auth.getUser()
  if (!user) return { error: NextResponse.json({ error: 'No autorizado' }, { status: 401 }) }
  const db = createServiceSupabase()
  const a = await autorizarCoachCliente(db, { userId: user.id, clienteId })
  if (!a.ok) return { error: NextResponse.json({ error: a.mensaje }, { status: a.status }) }
  return { db }
}

/** Últimos análisis del atleta, el más reciente primero. */
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const r = await autorizar(request, id)
  if (r.error) return r.error
  const { data, error } = await r.db
    .from('agente_tareas')
    .select('id,estado,prioridad,payload,comentario_coach,created_at,revisado_at')
    .eq('cliente_id', id)
    .eq('tipo', 'analisis_rendimiento')
    .order('created_at', { ascending: false })
    .limit(5)
  if (error) return NextResponse.json({ error: 'No se pudieron leer los análisis' }, { status: 500 })
  // Vista previa (antes/después) de los cambios de pasos, solo del análisis más reciente.
  const analisis = await Promise.all((data ?? []).map(async (t, i) => {
    const p = (t.payload ?? {}) as { decisiones?: DecisionGuardada[] }
    if (i > 0 || !p.decisiones?.length) return t
    const decisiones = await Promise.all(p.decisiones.map(async d => ({ ...d, vistaPrevia: await vistaPreviaDecision(r.db, id, d) })))
    return { ...t, payload: { ...p, decisiones } }
  }))
  return NextResponse.json({ analisis })
}

/** Genera un análisis nuevo ahora (el coach lo pide a mano). */
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const r = await autorizar(request, id)
  if (r.error) return r.error
  const res = await ejecutarAnalisisRendimiento(id, { forzar: true })
  if (!res.ok) return NextResponse.json({ error: res.motivo ?? 'No se pudo generar el análisis' }, { status: 422 })
  return NextResponse.json({ ok: true, tareaId: res.tareaId })
}
