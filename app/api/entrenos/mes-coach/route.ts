import { NextRequest, NextResponse } from 'next/server'
import { createApiSupabase, createServiceSupabase } from '@/lib/supabase-server'
import { diferenciaDias, lunesDe, ocurrenciasDelDia, sumarDias, type Ajuste } from '@/lib/entrenos/calendario-ajustes'
import { estadoVentanaPlan } from '@/lib/entrenos/ventana-plan'
import { ritmosDesdeVdot } from '@/lib/entrenos/ritmos'
import { resumenSesion, validarPasos } from '@/lib/entrenos/pasos'
import { ejerciciosParaFecha, pasosParaFecha, semanaDeFecha } from '@/lib/entrenos/sesion-semana'
import { cargarSemanasMacro, sesionesPrevision, type CarreraPlantilla, type SesionPlantilla } from '@/lib/entrenos/prevision'
import { clasificarTipoSesion } from '@/lib/entrenos/bloques'

// Variante coach de /api/entrenos/mes-completo: aquella resuelve el cliente
// por sesión autenticada (portal cliente); esta la usa el coach para ver el
// mes de UN cliente concreto desde su ficha, y a diferencia de la del
// cliente soporta varias sesiones el mismo día de la semana (doble sesión) y
// marca las competiciones activas del cliente en el día correspondiente.
// Además aplica los ajustes por fecha (mover/copiar/quitar una sesión en un día concreto),
// añade lo realmente hecho (Garmin/Strava) y el estado de envío al reloj de cada sesión.

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
    .select('id, nombre, cliente_id, coach_id, created_at, duracion_semanas, progresion')
    .eq('id', planId)
    .maybeSingle()

  if (!plan) return NextResponse.json({ error: 'Plan no encontrado' }, { status: 404 })
  if (plan.coach_id !== user.id) return NextResponse.json({ error: 'Sin acceso' }, { status: 403 })

  // Semanas completas (de lunes a domingo) que tocan el mes: así se pueden copiar semanas que cruzan de mes.
  const primerDiaMes = lunesDe(toISODate(new Date(year, month - 1, 1)))
  const ultimoDiaMes = sumarDias(lunesDe(toISODate(new Date(year, month, 0))), 6)
  const diasDelMes = Array.from({ length: diferenciaDias(primerDiaMes, ultimoDiaMes) + 1 }, (_, i) => {
    const [y, m, d] = sumarDias(primerDiaMes, i).split('-').map(Number)
    return new Date(y, m - 1, d)
  })

  const { data: sesiones } = await admin
    .from('sesiones_entrenamiento')
    .select('id, nombre, dia_semana, fase_bloque, hora_inicio, duracion_estimada_min, contexto_ia, pasos, garmin_workout_id, garmin_programado_fecha, garmin_fechas, ejercicios:sesion_ejercicios(id, bloque, series, repeticiones, descanso_segundos, encadenado, peso_sugerido, rpe, notas, orden, ejercicio:ejercicios(nombre, tipo))')
    .eq('plan_id', plan.id)
    .order('orden')
    .order('id')

  const { data: ajustesBD } = await admin
    .from('calendario_entreno_ajustes')
    .select('id, sesion_id, tipo, fecha_origen, fecha')
    .eq('plan_id', plan.id)
  const ajustes = (ajustesBD ?? []) as Ajuste[]

  const { data: competiciones } = await admin
    .from('competiciones')
    .select('id, nombre, disciplina, fecha_competicion, objetivo')
    .eq('cliente_id', plan.cliente_id)
    .eq('activo', true)
    .gte('fecha_competicion', primerDiaMes)
    .lte('fecha_competicion', ultimoDiaMes)

  const { data: hechos } = await admin
    .from('entrenos_realizados')
    .select('id, fecha, tipo, nombre, distancia_m, duracion_s')
    .eq('cliente_id', plan.cliente_id)
    .gte('fecha', primerDiaMes)
    .lte('fecha', ultimoDiaMes)
    .order('fecha')

  const { data: perfil } = await admin.from('perfil_entreno_cliente').select('vdot').eq('cliente_id', plan.cliente_id).maybeSingle()
  const ritmos = perfil?.vdot ? ritmosDesdeVdot(Number(perfil.vdot)) : null

  const hechosPorFecha = new Map<string, NonNullable<typeof hechos>>()
  for (const h of hechos ?? []) {
    if (!hechosPorFecha.has(h.fecha)) hechosPorFecha.set(h.fecha, [])
    hechosPorFecha.get(h.fecha)!.push(h)
  }

  const competicionesPorFecha = new Map<string, typeof competiciones>()
  for (const c of competiciones ?? []) {
    if (!competicionesPorFecha.has(c.fecha_competicion)) competicionesPorFecha.set(c.fecha_competicion, [])
    competicionesPorFecha.get(c.fecha_competicion)!.push(c)
  }

  // Detalle de cada sesión (ejercicios y pasos de Garmin con sus ritmos) para abrirla sin salir del calendario.
  const catalogo: Record<string, unknown> = {}
  for (const s of sesiones ?? []) {
    const v = s.pasos ? validarPasos(s.pasos) : null
    const resumen = v?.ok ? resumenSesion(v.pasos, ritmos) : null
    catalogo[s.id] = {
      nombre: s.nombre,
      hora_inicio: s.hora_inicio,
      duracion_estimada_min: s.duracion_estimada_min,
      contexto_ia: s.contexto_ia,
      ejercicios: [...(s.ejercicios ?? [])]
        .sort((a, b) => (a.orden ?? 0) - (b.orden ?? 0))
        .map(e => ({ id: e.id, nombre: (e.ejercicio as { nombre?: string } | null)?.nombre ?? 'Ejercicio', series: e.series, repeticiones: e.repeticiones, descanso_segundos: e.descanso_segundos, encadenado: e.encadenado ?? false, peso_sugerido: e.peso_sugerido, rpe: e.rpe, notas: e.notas })),
      pasos: resumen ? resumen.lineas : null,
      distancia_m: resumen?.distancia_m ?? null,
      duracion_s: resumen?.duracion_s ?? null,
    }
  }

  const estado = estadoVentanaPlan(plan.created_at, plan.duracion_semanas as number | null)

  // Previsión tras el bloque en curso (la misma que ve el atleta): carrera del macrociclo + fuerza/híbridas de la semana tipo.
  const semanasMacro = await cargarSemanasMacro(admin, { cliente_id: plan.cliente_id, created_at: plan.created_at })
  const noCarreraPorDia = new Map<string, SesionPlantilla[]>()
  const carreraPlantilla: CarreraPlantilla[] = []
  for (const x of sesiones ?? []) {
    if (!x.dia_semana) continue
    const tipo_sesion = clasificarTipoSesion((x.ejercicios ?? []).map(e => (e.ejercicio as { tipo?: string | null } | null)?.tipo ?? '').filter(Boolean))
    if (tipo_sesion === 'carrera') { carreraPlantilla.push({ dia_semana: x.dia_semana, nombre: x.nombre }); continue }
    noCarreraPorDia.set(x.dia_semana, [...(noCarreraPorDia.get(x.dia_semana) ?? []), { nombre: x.nombre, tipo_sesion }])
  }

  // Lo que de verdad toca cada fecha (semana del bloque con su progresión): el catálogo de arriba es la semana tipo (semana 1) y es lo que se edita.
  const catalogoSemana: Record<string, unknown> = {}
  const registrarSemana = (s: NonNullable<typeof sesiones>[number], fecha: string) => {
    const clave = `${s.id}|${fecha}`
    if (clave in catalogoSemana) return
    const sem = semanaDeFecha(plan, fecha)
    if (!sem.prog || !sem.n) return
    const pasos = pasosParaFecha(plan, { nombre: s.nombre, pasos: s.pasos }, fecha)
    const v = pasos ? validarPasos(pasos) : null
    const resumen = v?.ok ? resumenSesion(v.pasos, ritmos) : null
    const lista = ejerciciosParaFecha(plan, [...(s.ejercicios ?? [])].sort((a, b) => (a.orden ?? 0) - (b.orden ?? 0)) as never, fecha, s.nombre) as unknown as { id: string; ejercicio?: { nombre?: string } | null; series: number | null; repeticiones: string | null; descanso_segundos: number | null; encadenado?: boolean | null; peso_sugerido: string | null; rpe: string | null; notas: string | null }[]
    catalogoSemana[clave] = {
      semana: { n: sem.n, total: plan.duracion_semanas, descarga: sem.descarga },
      ejercicios: lista.map(e => ({ id: e.id, nombre: e.ejercicio?.nombre ?? 'Ejercicio', series: e.series, repeticiones: e.repeticiones, descanso_segundos: e.descanso_segundos, encadenado: e.encadenado ?? false, peso_sugerido: e.peso_sugerido, rpe: e.rpe, notas: e.notas })),
      pasos: resumen ? resumen.lineas : null,
      distancia_m: resumen?.distancia_m ?? null,
      duracion_s: resumen?.duracion_s ?? null,
    }
  }

  const dias = diasDelMes.map(d => {
    const fecha = toISODate(d)
    const { antesDeInicio, bloquePendiente } = estado(fecha)
    const ocurrencias = ocurrenciasDelDia(fecha, sesiones ?? [], ajustes, !antesDeInicio && !bloquePendiente)
    for (const { sesion } of ocurrencias) registrarSemana(sesion as never, fecha)
    const prev = bloquePendiente && ocurrencias.length === 0 && semanasMacro.length > 0
      ? sesionesPrevision(fecha, DIAS_SEMANA_POR_INDICE[d.getDay()], semanasMacro, noCarreraPorDia, ritmos?.E ?? null, carreraPlantilla)
      : null

    return {
      fecha,
      fuera_de_mes: d.getMonth() !== month - 1,
      dia_semana: DIAS_SEMANA_POR_INDICE[d.getDay()],
      sesiones: ocurrencias.map(({ sesion, ajuste }) => ({
        id: sesion.id,
        nombre: sesion.nombre,
        fase_bloque: sesion.fase_bloque,
        ajuste: ajuste ? { id: ajuste.id, tipo: ajuste.tipo, fecha_origen: ajuste.fecha_origen } : null,
        // Se repite en otras fechas (plantilla semanal o varias colocaciones): editarla cambia todas.
        compartida: !!sesion.dia_semana || ajustes.filter(x => x.sesion_id === sesion.id && x.fecha !== null && x.tipo !== 'omitir').length > 1,
        // Solo las sesiones con pasos viajan al reloj: enviada (a esta fecha) o pendiente del próximo envío.
        garmin: !sesion.pasos ? null : (sesion.garmin_workout_id && (sesion.garmin_programado_fecha === fecha || (Array.isArray(sesion.garmin_fechas) && sesion.garmin_fechas.includes(fecha))) ? 'enviada' : 'pendiente'),
      })),
      bloque_pendiente: bloquePendiente && ocurrencias.length === 0 && !(prev && prev.sesiones.length > 0),
      prevision: prev ? { fase: prev.fase, sesiones: prev.sesiones.map(x => ({ id: x.id, nombre: x.nombre, tipo_sesion: x.tipo_sesion, km: x.km })) } : null,
      competiciones: competicionesPorFecha.get(fecha) ?? [],
      realizados: (hechosPorFecha.get(fecha) ?? []).map(h => ({ id: h.id, tipo: h.tipo, nombre: h.nombre, distancia_m: h.distancia_m, duracion_s: h.duracion_s })),
    }
  })

  return NextResponse.json({ plan_nombre: plan.nombre, dias, catalogo, catalogo_semana: catalogoSemana })
}
