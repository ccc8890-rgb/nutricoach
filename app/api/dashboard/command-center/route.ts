import { NextResponse } from 'next/server'
import { createServerSupabase } from '@/lib/supabase-server'

type Severity = 'critica' | 'alta' | 'media' | 'baja'

type ClienteProfile = {
  nombre?: string | null
  apellidos?: string | null
  email?: string | null
}

type ClienteRow = {
  id: string
  activo: boolean | null
  onboarding_completado: boolean | null
  created_at: string
  fecha_proxima_revision: string | null
  tipo_membresia?: string | null
  fecha_fin_membresia?: string | null
  profile?: ClienteProfile | ClienteProfile[] | null
}

type CheckinRow = {
  id: string
  cliente_id: string
  fecha: string
  adherencia: number | null
  energia: number | null
  sueno: number | null
  nota_coach?: string | null
  created_at?: string | null
}

type ClienteRelation = {
  id?: string
  profile?: ClienteProfile | ClienteProfile[] | null
}

type AgenteTareaRow = {
  id: string
  cliente_id: string | null
  tipo: string
  agente: string
  estado: string
  prioridad: number | null
  propuesta: string | null
  created_at: string
  clientes?: ClienteRelation | ClienteRelation[] | null
}

type CompeticionRow = {
  id: string
  nombre: string
  disciplina: string | null
  fecha_competicion: string
  cliente_id: string
  clientes?: ClienteRelation | ClienteRelation[] | null
}

const SEVERITY_ORDER: Record<Severity, number> = {
  critica: 0,
  alta: 1,
  media: 2,
  baja: 3,
}

function profileName(profile?: ClienteProfile | ClienteProfile[] | null) {
  const p = Array.isArray(profile) ? profile[0] : profile
  const nombre = [p?.nombre, p?.apellidos].filter(Boolean).join(' ').trim()
  return nombre || 'Cliente'
}

function relationProfile(relation?: ClienteRelation | ClienteRelation[] | null) {
  const rel = Array.isArray(relation) ? relation[0] : relation
  return rel?.profile ?? null
}

function toISODate(date: Date) {
  return date.toISOString().slice(0, 10)
}

function daysBetween(date: string | null | undefined, now = new Date()) {
  if (!date) return null
  const target = new Date(date)
  if (Number.isNaN(target.getTime())) return null
  target.setHours(0, 0, 0, 0)
  const base = new Date(now)
  base.setHours(0, 0, 0, 0)
  return Math.ceil((target.getTime() - base.getTime()) / 86_400_000)
}

function daysSince(date: string | null | undefined, now = new Date()) {
  const diff = daysBetween(date, now)
  return diff === null ? null : -diff
}

function relativeDueLabel(days: number | null) {
  if (days === null) return 'sin fecha'
  if (days < 0) return `hace ${Math.abs(days)}d`
  if (days === 0) return 'hoy'
  if (days === 1) return 'mañana'
  return `en ${days}d`
}

function sortBySeverity<T extends { severity: Severity; created_at?: string | null; fecha?: string | null }>(items: T[]) {
  return [...items].sort((a, b) => {
    const severity = SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity]
    if (severity !== 0) return severity
    const ad = new Date(a.fecha ?? a.created_at ?? 0).getTime()
    const bd = new Date(b.fecha ?? b.created_at ?? 0).getTime()
    return bd - ad
  })
}

export async function GET() {
  try {
    const supabase = await createServerSupabase()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    const now = new Date()
    const todayISO = toISODate(now)
    const sevenDaysAgo = new Date(now)
    sevenDaysAgo.setDate(now.getDate() - 7)
    const fourteenDaysAgo = new Date(now)
    fourteenDaysAgo.setDate(now.getDate() - 14)

    const [
      clientesRes,
      nutricionRes,
      entrenoRes,
      respuestasRes,
      tareasRes,
      competicionesRes,
    ] = await Promise.all([
      supabase
        .from('clientes')
        .select('id, activo, onboarding_completado, created_at, fecha_proxima_revision, tipo_membresia, fecha_fin_membresia, profile:profiles!profile_id(nombre, apellidos, email)')
        .eq('coach_id', user.id),
      supabase
        .from('planes_nutricion')
        .select('id, cliente_id, activo')
        .eq('coach_id', user.id),
      supabase
        .from('planes_entrenamiento')
        .select('id, cliente_id, activo')
        .eq('coach_id', user.id),
      supabase
        .from('respuestas_clientes')
        .select('id, estado, nombre_cliente, email_cliente, created_at')
        .eq('coach_id', user.id)
        .order('created_at', { ascending: false })
        .limit(20),
      supabase
        .from('agente_tareas')
        .select('id, cliente_id, tipo, agente, estado, prioridad, propuesta, created_at, clientes!cliente_id(id, profile:profiles!profile_id(nombre, apellidos))')
        .in('estado', ['pendiente', 'en_revision', 'modificado'])
        .order('prioridad', { ascending: true })
        .order('created_at', { ascending: false })
        .limit(40),
      supabase
        .from('competiciones')
        .select('id, nombre, disciplina, fecha_competicion, cliente_id, clientes!inner(profile:profiles!profile_id(nombre, apellidos))')
        .eq('activo', true)
        .gte('fecha_competicion', todayISO)
        .order('fecha_competicion', { ascending: true })
        .limit(12),
    ])

    if (clientesRes.error) throw clientesRes.error
    if (nutricionRes.error) throw nutricionRes.error
    if (entrenoRes.error) throw entrenoRes.error
    if (respuestasRes.error) throw respuestasRes.error
    if (tareasRes.error) throw tareasRes.error
    if (competicionesRes.error) throw competicionesRes.error

    const clientes = (clientesRes.data ?? []) as ClienteRow[]
    const clienteIds = clientes.map(c => c.id)
    const activeClientes = clientes.filter(c => c.activo !== false)
    const activeClienteIds = new Set(activeClientes.map(c => c.id))

    const [checkinsRes, registrosRes] = clienteIds.length
      ? await Promise.all([
        supabase
          .from('checkins')
          .select('id, cliente_id, fecha, adherencia, energia, sueno, nota_coach, created_at')
          .in('cliente_id', clienteIds)
          .gte('fecha', toISODate(sevenDaysAgo))
          .order('fecha', { ascending: false }),
        supabase
          .from('registros_sets')
          .select('id, cliente_id, fecha')
          .in('cliente_id', clienteIds)
          .gte('fecha', toISODate(fourteenDaysAgo))
          .order('fecha', { ascending: false }),
      ])
      : [{ data: [], error: null }, { data: [], error: null }]

    if (checkinsRes.error) throw checkinsRes.error
    if (registrosRes.error) throw registrosRes.error

    const checkins = (checkinsRes.data ?? []) as CheckinRow[]
    const registros = registrosRes.data ?? []
    const planesNutricion = nutricionRes.data ?? []
    const planesEntreno = entrenoRes.data ?? []
    const respuestas = respuestasRes.data ?? []
    const tareas = ((tareasRes.data ?? []) as unknown as AgenteTareaRow[])
      .filter(t => !t.cliente_id || activeClienteIds.has(t.cliente_id))
    const competiciones = (competicionesRes.data ?? []) as unknown as CompeticionRow[]

    const nutricionActiva = new Set(
      planesNutricion.filter(p => p.activo && p.cliente_id).map(p => p.cliente_id as string)
    )
    const entrenoActivo = new Set(
      planesEntreno.filter(p => p.activo && p.cliente_id).map(p => p.cliente_id as string)
    )

    const checkinsByCliente = new Map<string, CheckinRow[]>()
    for (const checkin of checkins) {
      const list = checkinsByCliente.get(checkin.cliente_id) ?? []
      list.push(checkin)
      checkinsByCliente.set(checkin.cliente_id, list)
    }

    const registrosByCliente = new Map<string, string[]>()
    for (const row of registros as Array<{ cliente_id: string; fecha: string }>) {
      const list = registrosByCliente.get(row.cliente_id) ?? []
      list.push(row.fecha)
      registrosByCliente.set(row.cliente_id, list)
    }

    const hoy = []

    for (const checkin of checkins.filter(c => !c.nota_coach).slice(0, 12)) {
      const cliente = clientes.find(c => c.id === checkin.cliente_id)
      const age = daysSince(checkin.fecha, now)
      hoy.push({
        id: `checkin-${checkin.id}`,
        tipo: 'checkin',
        title: 'Check-in sin responder',
        cliente_id: checkin.cliente_id,
        cliente_nombre: profileName(cliente?.profile),
        detail: [
          checkin.adherencia ? `Adherencia ${checkin.adherencia}/5` : null,
          checkin.energia ? `Energía ${checkin.energia}/5` : null,
        ].filter(Boolean).join(' · ') || 'Requiere nota del coach',
        meta: relativeDueLabel(age === null ? null : -age),
        severity: age !== null && age >= 3 ? 'alta' as Severity : 'media' as Severity,
        href: `/clientes/${checkin.cliente_id}`,
        cta: 'Responder',
        fecha: checkin.fecha,
      })
    }

    for (const tarea of tareas.slice(0, 12)) {
      hoy.push({
        id: `ia-${tarea.id}`,
        tipo: 'ia',
        title: `IA: ${tarea.tipo.replaceAll('_', ' ')}`,
        cliente_id: tarea.cliente_id,
        cliente_nombre: profileName(relationProfile(tarea.clientes)),
        detail: tarea.propuesta ?? 'Tarea pendiente de revisión',
        meta: `prioridad ${tarea.prioridad ?? 3}`,
        severity: (tarea.prioridad ?? 3) <= 1 ? 'alta' as Severity : 'media' as Severity,
        href: tarea.tipo.includes('entreno') || tarea.tipo === 'training_brain' ? '/entrenos/brain-ia' : '/clientes',
        cta: 'Revisar',
        created_at: tarea.created_at,
      })
    }

    for (const respuesta of respuestas.filter(r => r.estado === 'nueva' || r.estado === 'dieta_rechazada').slice(0, 8)) {
      hoy.push({
        id: `respuesta-${respuesta.id}`,
        tipo: 'respuesta',
        title: respuesta.estado === 'dieta_rechazada' ? 'Dieta rechazada' : 'Respuesta nueva',
        cliente_id: null,
        cliente_nombre: respuesta.nombre_cliente ?? respuesta.email_cliente ?? 'Consulta',
        detail: respuesta.estado === 'dieta_rechazada' ? 'Revisar feedback del cliente' : 'Cuestionario pendiente de revisión',
        meta: relativeDueLabel(daysBetween(respuesta.created_at, now)),
        severity: respuesta.estado === 'dieta_rechazada' ? 'alta' as Severity : 'media' as Severity,
        href: '/respuestas',
        cta: 'Abrir',
        created_at: respuesta.created_at,
      })
    }

    for (const cliente of activeClientes) {
      const nombre = profileName(cliente.profile)
      if (!nutricionActiva.has(cliente.id)) {
        hoy.push({
          id: `sin-nutricion-${cliente.id}`,
          tipo: 'plan',
          title: 'Sin plan nutricional activo',
          cliente_id: cliente.id,
          cliente_nombre: nombre,
          detail: 'Cliente activo sin dieta asignada',
          meta: 'plan pendiente',
          severity: 'alta' as Severity,
          href: `/clientes/${cliente.id}/revisar-plan`,
          cta: 'Crear plan',
          created_at: cliente.created_at,
        })
      }
      if (cliente.onboarding_completado === false) {
        hoy.push({
          id: `onboarding-${cliente.id}`,
          tipo: 'onboarding',
          title: 'Onboarding incompleto',
          cliente_id: cliente.id,
          cliente_nombre: nombre,
          detail: 'Falta información base para personalizar el plan',
          meta: 'perfil incompleto',
          severity: 'media' as Severity,
          href: `/clientes/${cliente.id}`,
          cta: 'Ver ficha',
          created_at: cliente.created_at,
        })
      }
    }

    const competicionesOut = competiciones.map(c => {
      const dias = daysBetween(c.fecha_competicion, now) ?? 0
      return {
        id: c.id,
        nombre: c.nombre,
        disciplina: c.disciplina,
        fecha_competicion: c.fecha_competicion,
        dias,
        estado: dias === 0 ? 'hoy' : dias <= 7 ? 'race_week' : dias <= 14 ? 'tapering' : 'normal',
        cliente_id: c.cliente_id,
        cliente_nombre: profileName(relationProfile(c.clientes)),
      }
    })

    for (const comp of competicionesOut.filter(c => c.dias <= 14).slice(0, 6)) {
      hoy.push({
        id: `competicion-${comp.id}`,
        tipo: 'competicion',
        title: comp.dias === 0 ? 'Competición hoy' : comp.dias <= 7 ? 'Race week' : 'Tapering cercano',
        cliente_id: comp.cliente_id,
        cliente_nombre: comp.cliente_nombre,
        detail: `${comp.nombre} · ${comp.disciplina ?? 'competición'}`,
        meta: relativeDueLabel(comp.dias),
        severity: comp.dias <= 7 ? 'alta' as Severity : 'media' as Severity,
        href: `/clientes/${comp.cliente_id}`,
        cta: 'Ver',
        fecha: comp.fecha_competicion,
      })
    }

    const riesgos = activeClientes.map(cliente => {
      const recientes = checkinsByCliente.get(cliente.id) ?? []
      const ultimoCheckin = recientes[0]
      const diasSinCheckin = ultimoCheckin ? daysSince(ultimoCheckin.fecha, now) : daysSince(cliente.created_at, now)
      const diasMembresia = daysBetween(cliente.fecha_fin_membresia, now)
      const registrosCliente = registrosByCliente.get(cliente.id) ?? []
      const signals: string[] = []
      let score = 0

      if (diasSinCheckin !== null && diasSinCheckin > 10) {
        signals.push(`${diasSinCheckin}d sin check-in`)
        score += 3
      } else if (diasSinCheckin !== null && diasSinCheckin > 7) {
        signals.push(`${diasSinCheckin}d sin check-in`)
        score += 2
      }
      if (diasMembresia !== null && diasMembresia < 0) {
        signals.push('membresía caducada')
        score += 3
      } else if (diasMembresia !== null && diasMembresia <= 30) {
        signals.push(`caduca ${relativeDueLabel(diasMembresia)}`)
        score += diasMembresia <= 7 ? 3 : 2
      }
      if (ultimoCheckin?.adherencia !== null && ultimoCheckin?.adherencia !== undefined && ultimoCheckin.adherencia <= 2) {
        signals.push(`adherencia ${ultimoCheckin.adherencia}/5`)
        score += 2
      }
      if (ultimoCheckin?.energia !== null && ultimoCheckin?.energia !== undefined && ultimoCheckin.energia <= 2) {
        signals.push(`energía ${ultimoCheckin.energia}/5`)
        score += 1
      }
      if (ultimoCheckin?.sueno !== null && ultimoCheckin?.sueno !== undefined && ultimoCheckin.sueno <= 2) {
        signals.push(`sueño ${ultimoCheckin.sueno}/5`)
        score += 1
      }
      if (entrenoActivo.has(cliente.id) && registrosCliente.length === 0) {
        signals.push('sin entreno 14d')
        score += 2
      }
      if (!cliente.tipo_membresia) {
        signals.push('sin membresía')
        score += 1
      }

      return {
        cliente_id: cliente.id,
        cliente_nombre: profileName(cliente.profile),
        riesgo: score >= 5 ? 'alto' : score >= 3 ? 'medio' : 'bajo',
        score,
        signals: signals.slice(0, 3),
        accion: score >= 5 ? 'Contactar hoy' : score >= 3 ? 'Revisar esta semana' : 'Mantener seguimiento',
        href: `/clientes/${cliente.id}`,
      }
    })
      .filter(r => r.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 8)

    const revisiones7 = activeClientes.filter(c => {
      const d = daysBetween(c.fecha_proxima_revision, now)
      return d !== null && d >= 0 && d <= 7
    }).length
    const revisiones30 = activeClientes.filter(c => {
      const d = daysBetween(c.fecha_proxima_revision, now)
      return d !== null && d >= 0 && d <= 30
    }).length
    const membresias30 = activeClientes.filter(c => {
      const d = daysBetween(c.fecha_fin_membresia, now)
      return d !== null && d >= 0 && d <= 30
    }).length

    return NextResponse.json({
      hoy: sortBySeverity(hoy).slice(0, 18),
      clientes_riesgo: riesgos,
      inbox_ia: tareas.slice(0, 8).map(t => ({
        id: t.id,
        tipo: t.tipo,
        agente: t.agente,
        prioridad: t.prioridad ?? 3,
        propuesta: t.propuesta,
        cliente_id: t.cliente_id,
        cliente_nombre: profileName(relationProfile(t.clientes)),
        href: t.tipo.includes('entreno') || t.tipo === 'training_brain' ? '/entrenos/brain-ia' : '/clientes',
        created_at: t.created_at,
      })),
      operacion: {
        clientes_activos: activeClientes.length,
        planes_nutricion_activos: nutricionActiva.size,
        planes_entreno_activos: entrenoActivo.size,
        checkins_pendientes: checkins.filter(c => !c.nota_coach).length,
        revisiones_7d: revisiones7,
        revisiones_30d: revisiones30,
        membresias_30d: membresias30,
        respuestas_pendientes: respuestas.filter(r => r.estado === 'nueva' || r.estado === 'dieta_rechazada').length,
      },
      competiciones: competicionesOut.slice(0, 6),
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    console.error('[dashboard/command-center] Error:', error)
    return NextResponse.json({ error: 'Error al cargar el command center' }, { status: 500 })
  }
}
