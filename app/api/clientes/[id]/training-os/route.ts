import { NextRequest, NextResponse } from 'next/server'
import { createApiSupabase, createServiceSupabase } from '@/lib/supabase-server'
import { cargarActividadCoach } from '@/lib/actividad/coach-insights'
import { evaluarPerfilEntreno } from '@/lib/motor-entreno'
import { crearDecisionTrainingOS } from '@/lib/training/training-os'
import type { PerfilEntrenoCliente } from '@/types'

function pct(real: number, objetivo: number): number | null {
  if (!objetivo) return null
  return Math.round((real / objetivo) * 100)
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = createApiSupabase(request)
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  const { id: clienteId } = await params
  const admin = createServiceSupabase()

  const { data: cliente } = await admin
    .from('clientes')
    .select('id, coach_id')
    .eq('id', clienteId)
    .single()

  if (!cliente || cliente.coach_id !== user.id) {
    return NextResponse.json({ error: 'Sin acceso' }, { status: 403 })
  }

  const desde7 = new Date(Date.now() - 7 * 86_400_000).toISOString().split('T')[0]
  const desde28 = new Date(Date.now() - 28 * 86_400_000).toISOString().split('T')[0]

  const [
    perfilRes,
    planRes,
    registros7Res,
    registros28Res,
    tareasRes,
  ] = await Promise.all([
    admin
      .from('perfil_entreno_cliente')
      .select('*')
      .eq('cliente_id', clienteId)
      .maybeSingle(),
    admin
      .from('planes_entrenamiento')
      .select('id, nombre, duracion_semanas, activo')
      .eq('cliente_id', clienteId)
      .eq('activo', true)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
    admin
      .from('registros_sets')
      .select('fecha, duracion_sesion_s, esfuerzo_percibido')
      .eq('cliente_id', clienteId)
      .gte('fecha', desde7),
    admin
      .from('registros_sets')
      .select('fecha, duracion_sesion_s, esfuerzo_percibido')
      .eq('cliente_id', clienteId)
      .gte('fecha', desde28),
    admin
      .from('agente_tareas')
      .select('id, tipo, prioridad, propuesta, created_at')
      .eq('cliente_id', clienteId)
      .in('estado', ['pendiente', 'modificado'])
      .in('tipo', ['alerta_readiness', 'ajuste_nutricion_carga', 'alerta_riesgo_entreno', 'revision_semanal_entreno'])
      .order('prioridad', { ascending: true })
      .limit(6),
  ])

  if (perfilRes.error && perfilRes.error.code !== 'PGRST116') {
    return NextResponse.json({ error: perfilRes.error.message }, { status: 500 })
  }
  if (planRes.error && planRes.error.code !== 'PGRST116') {
    return NextResponse.json({ error: planRes.error.message }, { status: 500 })
  }

  const actividad = await cargarActividadCoach(admin, clienteId, 14).catch(() => null)
  const perfil = perfilRes.data as PerfilEntrenoCliente | null
  const recomendacion = perfil ? evaluarPerfilEntreno(perfil) : null

  const sesiones7 = new Set((registros7Res.data ?? []).map(r => r.fecha)).size
  const sesiones28 = new Set((registros28Res.data ?? []).map(r => r.fecha)).size
  const rpeValues = (registros7Res.data ?? [])
    .map(r => r.esfuerzo_percibido)
    .filter((v): v is number => typeof v === 'number')
  const rpeMedia7 = rpeValues.length
    ? Math.round((rpeValues.reduce((a, b) => a + b, 0) / rpeValues.length) * 10) / 10
    : null

  const planRaw = planRes.data as { id: string; nombre: string; duracion_semanas?: number | null } | null
  const { count: sesionesPlan } = planRaw?.id
    ? await admin.from('sesiones_entrenamiento').select('id', { count: 'exact', head: true }).eq('plan_id', planRaw.id)
    : { count: null }
  const plan = planRaw ? { ...planRaw, sesiones_por_semana: sesionesPlan ?? null } : null
  const sesionesObjetivo = plan?.sesiones_por_semana ?? perfil?.dias_disponibles ?? null
  const adherencia7 = sesionesObjetivo ? pct(sesiones7, sesionesObjetivo) : null
  const rendimiento = {
    sesiones_7d: sesiones7,
    sesiones_28d: sesiones28,
    sesiones_objetivo_semana: sesionesObjetivo,
    adherencia_7d_pct: adherencia7,
    rpe_media_7d: rpeMedia7,
  }
  const decisionTraining = crearDecisionTrainingOS({
    actividad,
    rendimiento,
  })

  const decisiones: Array<{ titulo: string; detalle: string; tono: 'critico' | 'atencion' | 'ok' | 'neutro' }> = []

  if (!perfil) {
    decisiones.push({
      titulo: 'Completar perfil atleta',
      detalle: 'Sin modalidad, métricas y recuperación el motor no puede seleccionar bien la progresión.',
      tono: 'atencion',
    })
  }
  if (!plan) {
    decisiones.push({
      titulo: 'Asignar planificación activa',
      detalle: 'El cliente no tiene un plan de entrenamiento activo para comparar ejecución contra objetivo.',
      tono: 'critico',
    })
  }
  if (actividad?.flags.some(f => f.severidad === 'alta')) {
    decisiones.push({
      titulo: 'Revisar carga antes de progresar',
      detalle: actividad.flags.find(f => f.severidad === 'alta')?.accion ?? 'Hay señales altas en recuperación o carga externa.',
      tono: 'critico',
    })
  }
  if (adherencia7 !== null && adherencia7 < 70) {
    decisiones.push({
      titulo: 'Adherencia semanal baja',
      detalle: `${sesiones7} sesiones de ${sesionesObjetivo} previstas esta semana. Ajustar fricción antes de subir volumen.`,
      tono: 'atencion',
    })
  }
  if (decisionTraining.estado === 'descarga') {
    decisiones.push({
      titulo: 'Microciclo de descarga',
      detalle: decisionTraining.microciclo.foco,
      tono: 'critico',
    })
  } else if (decisionTraining.estado === 'progresar') {
    decisiones.push({
      titulo: 'Progresión disponible',
      detalle: decisionTraining.microciclo.foco,
      tono: 'ok',
    })
  }
  if (decisiones.length === 0) {
    decisiones.push({
      titulo: 'Sistema estable',
      detalle: 'No hay bloqueos fuertes. Revisar progresión, rendimiento y preferencias antes de la siguiente semana.',
      tono: 'ok',
    })
  }

  return NextResponse.json({
    perfil,
    plan,
    recomendacion,
    actividad,
    rendimiento,
    decision_training: decisionTraining,
    decisiones,
    tareas_pendientes: tareasRes.data ?? [],
  })
}
