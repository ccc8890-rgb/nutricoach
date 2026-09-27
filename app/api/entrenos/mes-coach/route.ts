import { NextRequest, NextResponse } from 'next/server'
import { createApiSupabase, createServiceSupabase } from '@/lib/supabase-server'
import { fechaFinBloque } from '@/lib/entrenos/bloques'

// Variante coach de /api/entrenos/mes-completo: aquella resuelve el cliente
// por sesión autenticada (portal cliente); esta la usa el coach para ver el
// mes de UN cliente concreto desde su ficha, y a diferencia de la del
// cliente soporta varias sesiones el mismo día de la semana (doble sesión) y
// marca las competiciones activas del cliente en el día correspondiente.

function toISODate(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

const DIAS_SEMANA_POR_INDICE = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado']

export async function GET(request: NextRequest) {
  const supabase = createApiSupabase(request)
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const planId = searchParams.get('plan_id')
  const year = parseInt(searchParams.get('year') ?? '', 10)
  const month = parseInt(searchParams.get('month') ?? '', 10) // 1-12
  if (!planId || !year || !month || month < 1 || month > 12) {
    return NextResponse.json({ error: 'plan_id, year y month (1-12) son obligatorios' }, { status: 400 })
  }

  const admin = createServiceSupabase()

  const { data: plan } = await admin
    .from('planes_entrenamiento')
    .select('id, nombre, cliente_id, coach_id, created_at, duracion_semanas')
    .eq('id', planId)
    .maybeSingle()

  if (!plan) return NextResponse.json({ error: 'Plan no encontrado' }, { status: 404 })
  if (plan.coach_id !== user.id) return NextResponse.json({ error: 'Sin acceso' }, { status: 403 })

  const diasEnMes = new Date(year, month, 0).getDate()
  const diasDelMes = Array.from({ length: diasEnMes }, (_, i) => new Date(year, month - 1, i + 1))
  const primerDiaMes = toISODate(diasDelMes[0])
  const ultimoDiaMes = toISODate(diasDelMes[diasDelMes.length - 1])

  const { data: sesiones } = await admin
    .from('sesiones_entrenamiento')
    .select('id, nombre, dia_semana, fase_bloque, duracion_estimada_min')
    .eq('plan_id', plan.id)
    .order('orden')

  const { data: competiciones } = await admin
    .from('competiciones')
    .select('id, nombre, disciplina, fecha_competicion, objetivo')
    .eq('cliente_id', plan.cliente_id)
    .eq('activo', true)
    .gte('fecha_competicion', primerDiaMes)
    .lte('fecha_competicion', ultimoDiaMes)

  const sesionesPorDia = new Map<string, typeof sesiones>()
  for (const s of sesiones ?? []) {
    if (!sesionesPorDia.has(s.dia_semana)) sesionesPorDia.set(s.dia_semana, [])
    sesionesPorDia.get(s.dia_semana)!.push(s)
  }

  const competicionesPorFecha = new Map<string, typeof competiciones>()
  for (const c of competiciones ?? []) {
    if (!competicionesPorFecha.has(c.fecha_competicion)) competicionesPorFecha.set(c.fecha_competicion, [])
    competicionesPorFecha.get(c.fecha_competicion)!.push(c)
  }

  const fechaInicioPlan = plan.created_at
  const duracionSemanas = plan.duracion_semanas as number | null

  const dias = diasDelMes.map(d => {
    const fecha = toISODate(d)
    const diaSemana = DIAS_SEMANA_POR_INDICE[d.getDay()]
    const antesDeInicio = fecha < toISODate(new Date(fechaInicioPlan))
    const bloquePendiente = duracionSemanas
      ? d.getTime() >= fechaFinBloque(fechaInicioPlan, duracionSemanas).getTime()
      : false

    return {
      fecha,
      dia_semana: diaSemana,
      sesiones: (antesDeInicio || bloquePendiente) ? [] : (sesionesPorDia.get(diaSemana) ?? []),
      bloque_pendiente: bloquePendiente,
      competiciones: competicionesPorFecha.get(fecha) ?? [],
    }
  })

  return NextResponse.json({ plan_nombre: plan.nombre, dias })
}
