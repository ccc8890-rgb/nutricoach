import { NextRequest, NextResponse } from 'next/server'
import { createApiSupabase, createServiceSupabase } from '@/lib/supabase-server'
import { autorizarCoachCliente } from '@/lib/auth/autorizar-coach-cliente'
import { planParaCliente } from '@/lib/rendimiento/plan-cliente'
import { prepararSemana, aplicarSemana, deshacerSemana } from '@/lib/rendimiento/aplicar-semana'

export const maxDuration = 60
const FECHA_RE = /^\d{4}-\d{2}-\d{2}$/

/**
 * Vista previa, aplicación y deshacer de una semana del plan-objetivo sobre el plan activo del atleta.
 * El plan se recalcula aquí con los datos del servidor: el cliente nunca envía pasos.
 */
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: clienteId } = await params
  const { data: { user } } = await createApiSupabase(request).auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  const db = createServiceSupabase()
  const a = await autorizarCoachCliente(db, { userId: user.id, clienteId })
  if (!a.ok) return NextResponse.json({ error: a.mensaje }, { status: a.status })

  const b = await request.json().catch(() => null) as Record<string, unknown> | null
  const accion = b?.accion
  const hoy = new Date().toISOString().slice(0, 10)

  if (accion === 'deshacer') {
    const logId = typeof b?.logId === 'string' ? b.logId : ''
    if (!logId) return NextResponse.json({ error: 'Falta el cambio a deshacer' }, { status: 400 })
    const r = await deshacerSemana(db, clienteId, logId)
    return r.ok ? NextResponse.json(r) : NextResponse.json({ error: r.error }, { status: r.status })
  }

  const distancia_m = typeof b?.distancia_m === 'number' ? b.distancia_m : NaN
  const tiempo_s = typeof b?.tiempo_s === 'number' ? b.tiempo_s : NaN
  const fecha = typeof b?.fecha === 'string' && FECHA_RE.test(b.fecha) ? b.fecha : ''
  const semana = typeof b?.semana === 'number' && Number.isInteger(b.semana) ? b.semana : 0
  if (!Number.isFinite(distancia_m) || !Number.isFinite(tiempo_s) || !fecha || semana < 1 || (accion !== 'previsualizar' && accion !== 'aplicar')) {
    return NextResponse.json({ error: 'Datos inválidos' }, { status: 400 })
  }

  const calculo = await planParaCliente(db, clienteId, { distancia_m, tiempo_s, fecha }, hoy)
  if (!calculo.ok) return NextResponse.json({ error: calculo.error }, { status: 422 })

  if (accion === 'previsualizar') {
    const r = await prepararSemana(db, clienteId, calculo.plan, semana, hoy)
    return r.ok ? NextResponse.json(r) : NextResponse.json({ error: r.error }, { status: r.status })
  }
  const r = await aplicarSemana(db, clienteId, calculo.plan, semana, hoy)
  return r.ok ? NextResponse.json(r) : NextResponse.json({ error: r.error }, { status: r.status })
}
