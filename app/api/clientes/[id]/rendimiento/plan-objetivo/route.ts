import { NextRequest, NextResponse } from 'next/server'
import { createApiSupabase, createServiceSupabase } from '@/lib/supabase-server'
import { autorizarCoachCliente } from '@/lib/auth/autorizar-coach-cliente'
import { generarPlan, type PlanObjetivo } from '@/lib/rendimiento/plan-objetivo'
import { construirPanel, type EntrenoPanel } from '@/lib/rendimiento/panel'
import { esCarrera } from '@/lib/rendimiento/carga'
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
  const desde = new Date(Date.now() - 42 * 86_400_000).toISOString().slice(0, 10)
  const [{ data: perfil }, { data: entrenos }] = await Promise.all([
    db.from('perfil_entreno_cliente').select('vdot').eq('cliente_id', clienteId).maybeSingle(),
    db.from('entrenos_realizados').select('fecha,tipo,nombre,duracion_s,distancia_m,ritmo_medio_s_km,fc_media,tss,tss_metodo,carga_garmin,vo2max,tiempo_zona_fc,mejores_parciales,raw').eq('cliente_id', clienteId).gte('fecha', desde).order('fecha'),
  ])
  const vdot = perfil?.vdot ? Number(perfil.vdot) : null
  if (!vdot) return NextResponse.json({ error: 'El atleta no tiene VDOT: hace falta para calcular ritmos' }, { status: 422 })

  const lista = (entrenos ?? []) as EntrenoPanel[]
  const panel = construirPanel(lista, [], hoy, 60)
  const completas = panel.semanas.slice(-5, -1) // las 4 últimas semanas cerradas
  const media = (v: number[]) => (v.length ? v.reduce((x, y) => x + y, 0) / v.length : 0)
  const tiradaMaxKm = Math.max(0, ...lista.filter(e => esCarrera(e.tipo) && e.tipo !== 'treadmill_running').map(e => (e.distancia_m ?? 0) / 1000))

  const plan = generarPlan({
    hoy, objetivo: { distancia_m, tiempo_s, fecha }, vdot,
    cargaSemanalActual: Math.round(media(completas.map(s => s.tss))),
    kmSemanaActual: Math.round(media(completas.map(s => s.km)) * 10) / 10,
    tiradaMaxKm: Math.round(tiradaMaxKm * 10) / 10,
  })
  if ('error' in plan) return NextResponse.json({ error: plan.error }, { status: 422 })

  // Cada sesión clave con sus pasos explicados en texto (ritmos del VDOT actual).
  const ritmos = ritmosDesdeVdot(vdot)
  const semanas = (plan as PlanObjetivo).semanas.map(s => ({
    ...s,
    claves: s.claves.map(c => {
      const r = resumenSesion(c.pasos, ritmos)
      return { tipo: c.tipo, titulo: c.titulo, descripcion: c.descripcion, lineas: r.lineas, distanciaKm: Math.round(r.distancia_m / 100) / 10 }
    }),
  }))
  return NextResponse.json({
    plan: { ...plan, semanas },
    base: { vdot, cargaSemanalActual: Math.round(media(completas.map(s => s.tss))), kmSemanaActual: Math.round(media(completas.map(s => s.km)) * 10) / 10, tiradaMaxKm: Math.round(tiradaMaxKm * 10) / 10 },
  })
}
