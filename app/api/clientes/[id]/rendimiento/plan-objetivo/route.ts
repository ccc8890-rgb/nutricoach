import { NextRequest, NextResponse } from 'next/server'
import { createApiSupabase, createServiceSupabase } from '@/lib/supabase-server'
import { autorizarCoachCliente } from '@/lib/auth/autorizar-coach-cliente'
import { planParaCliente } from '@/lib/rendimiento/plan-cliente'
import { resumenSesion } from '@/lib/entrenos/pasos'
import { ritmosDesdeVdot } from '@/lib/entrenos/ritmos'

const FECHA_RE = /^\d{4}-\d{2}-\d{2}$/

/**
 * Simulador: calcula un plan hacia una carrera objetivo con los datos reales del atleta.
 * No guarda nada ni toca ningún plan; es una propuesta para que el coach la valore.
 */
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: clienteId } = await params
  const { data: { user } } = await createApiSupabase(request).auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  const db = createServiceSupabase()
  const a = await autorizarCoachCliente(db, { userId: user.id, clienteId })
  if (!a.ok) return NextResponse.json({ error: a.mensaje }, { status: a.status })

  const body = await request.json().catch(() => null) as { distancia_m?: unknown; tiempo_s?: unknown; fecha?: unknown } | null
  const distancia_m = typeof body?.distancia_m === 'number' ? body.distancia_m : NaN
  const tiempo_s = typeof body?.tiempo_s === 'number' ? body.tiempo_s : NaN
  const fecha = typeof body?.fecha === 'string' && FECHA_RE.test(body.fecha) ? body.fecha : ''
  if (!Number.isFinite(distancia_m) || !Number.isFinite(tiempo_s) || !fecha) return NextResponse.json({ error: 'Datos inválidos' }, { status: 400 })

  const hoy = new Date().toISOString().slice(0, 10)
  const calculo = await planParaCliente(db, clienteId, { distancia_m, tiempo_s, fecha }, hoy)
  if (!calculo.ok) return NextResponse.json({ error: calculo.error }, { status: 422 })
  const { plan, base } = calculo
  const vdot = base.vdot

  // Cada sesión clave con sus pasos explicados en texto (ritmos del VDOT actual).
  const ritmos = ritmosDesdeVdot(vdot)
  const semanas = plan.semanas.map(s => ({
    ...s,
    claves: s.claves.map(c => {
      const r = resumenSesion(c.pasos, ritmos)
      return { tipo: c.tipo, titulo: c.titulo, descripcion: c.descripcion, lineas: r.lineas, distanciaKm: Math.round(r.distancia_m / 100) / 10 }
    }),
  }))
  return NextResponse.json({
    plan: { ...plan, semanas },
    base,
  })
}
