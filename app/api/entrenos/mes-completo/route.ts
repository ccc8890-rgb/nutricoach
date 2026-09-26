import { NextRequest, NextResponse } from 'next/server'
import { createApiSupabase, createServiceSupabase } from '@/lib/supabase-server'
import { clasificarTipoSesion, fechaFinBloque } from '@/lib/entrenos/bloques'

function toISODate(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

const DIAS_SEMANA_POR_INDICE = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado']

export async function GET(request: NextRequest) {
  const supabase = createApiSupabase(request)
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const year = parseInt(searchParams.get('year') ?? '', 10)
  const month = parseInt(searchParams.get('month') ?? '', 10) // 1-12
  if (!year || !month || month < 1 || month > 12) {
    return NextResponse.json({ error: 'year y month (1-12) son obligatorios' }, { status: 400 })
  }

  const admin = createServiceSupabase()

  const { data: clienteData } = await admin
    .from('clientes')
    .select('id')
    .eq('profile_id', user.id)
    .single()

  if (!clienteData) return NextResponse.json({ error: 'Cliente no encontrado' }, { status: 404 })

  const { data: planEntreno } = await admin
    .from('planes_entrenamiento')
    .select('id, nombre, created_at, duracion_semanas')
    .eq('cliente_id', clienteData.id)
    .eq('activo', true)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  const diasEnMes = new Date(year, month, 0).getDate()
  const diasDelMes = Array.from({ length: diasEnMes }, (_, i) => new Date(year, month - 1, i + 1))

  if (!planEntreno) {
    return NextResponse.json({
      plan_nombre: '',
      dias: diasDelMes.map(d => ({
        fecha: toISODate(d),
        dia_semana: DIAS_SEMANA_POR_INDICE[d.getDay()],
        sesion: null,
        fase_bloque: null,
        bloque_pendiente: false,
      })),
    })
  }

  const { data: sesData } = await admin
    .from('sesiones_entrenamiento')
    .select('id, nombre, dia_semana, fase_bloque')
    .eq('plan_id', planEntreno.id)
    .order('orden')

  const sesiones = sesData ?? []
  const sesIds = sesiones.map(s => s.id)

  let ejData: { id: string; sesion_id: string; ejercicio: { tipo: string | null } | null }[] = []
  if (sesIds.length > 0) {
    const { data } = await admin
      .from('sesion_ejercicios')
      .select('id, sesion_id, ejercicio:ejercicios(tipo)')
      .in('sesion_id', sesIds)
    ejData = (data ?? []) as unknown as typeof ejData
  }

  const ejCountBySesion: Record<string, number> = {}
  const tiposPorSesion: Record<string, string[]> = {}
  for (const ej of ejData) {
    ejCountBySesion[ej.sesion_id] = (ejCountBySesion[ej.sesion_id] ?? 0) + 1
    const tipo = ej.ejercicio?.tipo
    if (tipo) {
      if (!tiposPorSesion[ej.sesion_id]) tiposPorSesion[ej.sesion_id] = []
      tiposPorSesion[ej.sesion_id].push(tipo)
    }
  }

  const sesionPorDia = new Map(sesiones.map(s => [s.dia_semana, s]))

  const allEjIds = ejData.map(e => e.id)
  const primerDiaMes = toISODate(diasDelMes[0])
  const ultimoDiaMes = toISODate(diasDelMes[diasDelMes.length - 1])

  const { data: registros } = allEjIds.length > 0
    ? await admin
        .from('registros_sets')
        .select('sesion_ejercicio_id, fecha')
        .eq('cliente_id', clienteData.id)
        .gte('fecha', primerDiaMes)
        .lte('fecha', ultimoDiaMes)
        .in('sesion_ejercicio_id', allEjIds)
    : { data: [] }

  const ejToSesion = new Map(ejData.map(e => [e.id, e.sesion_id]))
  const sesionesCompletadasPorFecha = new Map<string, Set<string>>()
  for (const r of registros ?? []) {
    const sesId = ejToSesion.get(r.sesion_ejercicio_id)
    if (!sesId) continue
    if (!sesionesCompletadasPorFecha.has(r.fecha)) sesionesCompletadasPorFecha.set(r.fecha, new Set())
    sesionesCompletadasPorFecha.get(r.fecha)!.add(sesId)
  }

  const fechaInicioPlan = planEntreno.created_at
  const duracionSemanas = planEntreno.duracion_semanas as number | null

  const dias = diasDelMes.map(d => {
    const fecha = toISODate(d)
    const diaSemana = DIAS_SEMANA_POR_INDICE[d.getDay()]
    const sesion = sesionPorDia.get(diaSemana)

    // Antes del inicio del plan actual: no tenemos datos de qué se hizo ese día.
    const antesDeInicio = fecha < toISODate(new Date(fechaInicioPlan))
    // Después de que termine el bloque activo y aún no se generó el siguiente.
    // Comparado por día de calendario (fechaFinBloque ya trunca a medianoche),
    // no por diferencia exacta de horas desde la creación del plan.
    const bloquePendiente = duracionSemanas
      ? d.getTime() >= fechaFinBloque(fechaInicioPlan, duracionSemanas).getTime()
      : false

    if (antesDeInicio || bloquePendiente || !sesion) {
      return {
        fecha,
        dia_semana: diaSemana,
        sesion: null,
        fase_bloque: null,
        bloque_pendiente: bloquePendiente,
      }
    }

    return {
      fecha,
      dia_semana: diaSemana,
      sesion: {
        id: sesion.id,
        nombre: sesion.nombre,
        tipo_sesion: clasificarTipoSesion(tiposPorSesion[sesion.id] ?? []),
        ejercicios_count: ejCountBySesion[sesion.id] ?? 0,
        completada: sesionesCompletadasPorFecha.get(fecha)?.has(sesion.id) ?? false,
      },
      fase_bloque: sesion.fase_bloque,
      bloque_pendiente: false,
    }
  })

  return NextResponse.json({ plan_nombre: planEntreno.nombre, dias })
}
