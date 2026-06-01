import { NextRequest, NextResponse } from 'next/server'
import { createApiSupabase, createServiceSupabase } from '@/lib/supabase-server'
import {
  calcularCommandCenterRow,
  ordenarCommandCenterRows,
  type CommandCenterInput,
  type CommandCenterTask,
} from '@/lib/training/command-center'

const TASK_TYPES = [
  'training_brain',
  'alerta_readiness',
  'ajuste_nutricion_carga',
  'alerta_riesgo_entreno',
  'revision_semanal_entreno',
]

function toISODate(date: Date) {
  return date.toISOString().split('T')[0]
}

function getWeekStart(date = new Date()) {
  const result = new Date(date)
  const day = result.getDay()
  const diff = day === 0 ? 6 : day - 1
  result.setDate(result.getDate() - diff)
  result.setHours(0, 0, 0, 0)
  return result
}

function weekDots(fechas: Set<string>) {
  const lunes = getWeekStart()
  return Array.from({ length: 7 }, (_, i) => {
    const dia = new Date(lunes)
    dia.setDate(lunes.getDate() + i)
    return fechas.has(toISODate(dia))
  })
}

export async function GET(request: NextRequest) {
  const supabase = createApiSupabase(request)
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  const admin = createServiceSupabase()
  const hoy = new Date()
  const desde7 = new Date(hoy)
  desde7.setDate(hoy.getDate() - 6)
  const desde28 = new Date(hoy)
  desde28.setDate(hoy.getDate() - 27)
  const lunesISO = toISODate(getWeekStart(hoy))

  const { data: planes, error: planesError } = await admin
    .from('planes_entrenamiento')
    .select('id, nombre, cliente_id, cliente:clientes(id, profile:profiles!profile_id(nombre, apellidos), perfil_entreno:perfil_entreno_cliente(dias_disponibles))')
    .eq('coach_id', user.id)
    .eq('activo', true)
    .order('created_at', { ascending: false })

  if (planesError) {
    return NextResponse.json({ error: planesError.message }, { status: 500 })
  }

  const clienteIds = (planes ?? []).map(p => p.cliente_id).filter(Boolean) as string[]
  if (!clienteIds.length) {
    return NextResponse.json({
      clientes: [],
      stats: { total: 0, requiere_accion: 0, fatiga: 0, revision_ia: 0, progreso: 0, sin_actividad: 0 },
    })
  }

  const [
    registros7Res,
    registros28Res,
    prsRes,
    tareasRes,
  ] = await Promise.all([
    admin
      .from('registros_sets')
      .select('cliente_id, fecha, esfuerzo_percibido')
      .in('cliente_id', clienteIds)
      .gte('fecha', toISODate(desde7)),
    admin
      .from('registros_sets')
      .select('cliente_id, fecha')
      .in('cliente_id', clienteIds)
      .gte('fecha', toISODate(desde28)),
    admin
      .from('prs_por_ejercicio')
      .select('cliente_id, fecha_pr')
      .in('cliente_id', clienteIds)
      .gte('fecha_pr', lunesISO),
    admin
      .from('agente_tareas')
      .select('id, cliente_id, tipo, prioridad, propuesta')
      .in('cliente_id', clienteIds)
      .in('estado', ['pendiente', 'modificado'])
      .in('tipo', TASK_TYPES)
      .order('prioridad', { ascending: true }),
  ])

  const registros7 = registros7Res.data ?? []
  const registros28 = registros28Res.data ?? []
  const prs = prsRes.data ?? []
  const tareas = tareasRes.data ?? []

  const inputs: CommandCenterInput[] = (planes ?? []).map(plan => {
    const cliente = plan.cliente as unknown as {
      profile?: { nombre?: string | null; apellidos?: string | null } | null
      perfil_entreno?: Array<{ dias_disponibles?: number | null }> | { dias_disponibles?: number | null } | null
    } | null
    const perfilEntreno = Array.isArray(cliente?.perfil_entreno)
      ? cliente?.perfil_entreno[0]
      : cliente?.perfil_entreno
    const regs7Cliente = registros7.filter(r => r.cliente_id === plan.cliente_id)
    const regs28Cliente = registros28.filter(r => r.cliente_id === plan.cliente_id)
    const fechas7 = new Set(regs7Cliente.map(r => r.fecha).filter(Boolean))
    const fechas28 = new Set(regs28Cliente.map(r => r.fecha).filter(Boolean))
    const rpeValues = regs7Cliente
      .map(r => r.esfuerzo_percibido)
      .filter((v): v is number => typeof v === 'number')
    const rpeMedia = rpeValues.length
      ? Math.round((rpeValues.reduce((a, b) => a + b, 0) / rpeValues.length) * 10) / 10
      : null
    const tareasCliente: CommandCenterTask[] = tareas
      .filter(t => t.cliente_id === plan.cliente_id)
      .map(t => ({
        id: t.id,
        tipo: t.tipo,
        prioridad: t.prioridad,
        propuesta: t.propuesta,
      }))
    const prCount = prs.filter(pr => pr.cliente_id === plan.cliente_id).length
    const ultimaFecha = [...fechas28].sort().reverse()[0] ?? null

    return {
      cliente_id: plan.cliente_id,
      plan_id: plan.id,
      nombre: cliente?.profile?.nombre || 'Sin nombre',
      apellidos: cliente?.profile?.apellidos || '',
      plan_nombre: plan.nombre,
      sesiones_objetivo: perfilEntreno?.dias_disponibles ?? null,
      sesiones_7d: fechas7.size,
      sesiones_28d: fechas28.size,
      rpe_media_7d: rpeMedia,
      pr_count_7d: prCount,
      ultima_fecha: ultimaFecha,
      dots: weekDots(fechas7),
      tareas_pendientes: tareasCliente,
      flags_altas: 0,
    }
  })

  const clientes = ordenarCommandCenterRows(inputs.map(calcularCommandCenterRow))
  const stats = {
    total: clientes.length,
    requiere_accion: clientes.filter(c => c.requiere_accion).length,
    fatiga: clientes.filter(c => c.estado === 'fatiga').length,
    revision_ia: clientes.filter(c => c.estado === 'revision_ia').length,
    progreso: clientes.filter(c => c.estado === 'progreso').length,
    sin_actividad: clientes.filter(c => c.estado === 'sin_actividad').length,
  }

  return NextResponse.json({ clientes, stats })
}
