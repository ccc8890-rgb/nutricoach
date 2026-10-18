import { NextRequest, NextResponse } from 'next/server'
import { createApiSupabase, createServiceSupabase } from '@/lib/supabase-server'
import { calcularBloqueInfo, clasificarTipoSesion } from '@/lib/entrenos/bloques'
import { construirTuBloque } from '@/lib/entrenos/tu-bloque'
import { kmDeSesion, ritmosDeVdot } from '@/lib/entrenos/km-sesion'
import { pasosParaFecha } from '@/lib/entrenos/sesion-semana'
import { ocurrenciasDelDia, type Ajuste } from '@/lib/entrenos/calendario-ajustes'
import { plantillaActivaEn } from '@/lib/entrenos/ventana-plan'

function startOfWeek(offsetSemanas = 0) {
  const now = new Date()
  const day = now.getDay()
  // Monday-first week
  const diff = (day === 0 ? -6 : 1 - day)
  const monday = new Date(now)
  monday.setDate(now.getDate() + diff + offsetSemanas * 7)
  monday.setHours(0, 0, 0, 0)
  return monday
}

function toISODate(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

export async function GET(request: NextRequest) {
  const supabase = createApiSupabase(request)
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  const admin = createServiceSupabase()

  // Plan activo y cliente en una sola consulta (join interno por profile_id).
  const { data: planEntreno } = await admin
    .from('planes_entrenamiento')
    .select('id, nombre, created_at, duracion_semanas, progresion, cliente_id, cliente:clientes!inner(profile_id)')
    .eq('cliente.profile_id', user.id)
    .eq('activo', true)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (!planEntreno) {
    // Sin plan: se distingue "no hay cliente" de "cliente sin plan" como antes.
    const { data: clienteData } = await admin.from('clientes').select('id').eq('profile_id', user.id).maybeSingle()
    if (!clienteData) return NextResponse.json({ error: 'Cliente no encontrado' }, { status: 404 })
    return NextResponse.json({ sesiones: [], plan_nombre: '' })
  }

  // ?offset=N (0-8): semana en curso o las siguientes, solo para verlas y organizarse
  const offsetPedido = parseInt(new URL(request.url).searchParams.get('offset') ?? '0', 10)
  const weekStart = startOfWeek(Number.isFinite(offsetPedido) ? Math.min(Math.max(offsetPedido, 0), 8) : 0)
  const weekEnd = new Date(weekStart)
  weekEnd.setDate(weekStart.getDate() + 6)

  // Sesiones con sus ejercicios y registros de la semana en paralelo (no dependen entre sí).
  const [{ data: sesRaw }, { data: registros }] = await Promise.all([
    admin
      .from('sesiones_entrenamiento')
      .select('id, nombre, dia_semana, duracion_estimada_min, contexto_ia, fase_bloque, pasos, sesion_ejercicios(id, ejercicio:ejercicios(tipo))')
      .eq('plan_id', planEntreno.id)
      .order('orden')
      .order('id'),
    admin
      .from('registros_sets')
      .select('sesion_ejercicio_id, fecha')
      .eq('cliente_id', planEntreno.cliente_id)
      .gte('fecha', toISODate(weekStart))
      .lte('fecha', toISODate(weekEnd)),
  ])

  const sesData = sesRaw ?? []
  if (sesData.length === 0) {
    return NextResponse.json({ sesiones: [], plan_nombre: planEntreno.nombre })
  }

  // Aplanado equivalente al antiguo select sobre sesion_ejercicios (id, sesion_id, ejercicio)
  const ejData = sesData.flatMap(s =>
    ((s as unknown as { sesion_ejercicios: { id: string; ejercicio: { tipo: string | null } | { tipo: string | null }[] | null }[] }).sesion_ejercicios ?? [])
      .map(e => ({ id: e.id, sesion_id: s.id, ejercicio: Array.isArray(e.ejercicio) ? e.ejercicio[0] ?? null : e.ejercicio }))
  )

  const ejCountBySesion: Record<string, number> = {}
  for (const ej of ejData) ejCountBySesion[ej.sesion_id] = (ejCountBySesion[ej.sesion_id] ?? 0) + 1

  // Count registros per sesion_id
  const registrosPorSesion: Record<string, number> = {}
  for (const r of registros ?? []) {
    const ejSesId = ejData.find(e => e.id === r.sesion_ejercicio_id)?.sesion_id
    if (ejSesId) registrosPorSesion[ejSesId] = (registrosPorSesion[ejSesId] ?? 0) + 1
  }

  const today = toISODate(new Date())

  const tiposPorSesion: Record<string, string[]> = {}
  for (const ej of ejData) {
    const tipo = ej.ejercicio?.tipo
    if (!tipo) continue
    if (!tiposPorSesion[ej.sesion_id]) tiposPorSesion[ej.sesion_id] = []
    tiposPorSesion[ej.sesion_id].push(tipo)
  }

  const faseBloqueDelPlan = sesData.find(s => s.fase_bloque)?.fase_bloque as string | undefined
  const bloque = calcularBloqueInfo(planEntreno.created_at, planEntreno.duracion_semanas, faseBloqueDelPlan)

  const { data: perfilVdot } = await admin.from('perfil_entreno_cliente').select('vdot').eq('cliente_id', planEntreno.cliente_id).maybeSingle()
  const ritmosAtleta = ritmosDeVdot(perfilVdot?.vdot)

  // Lo que toca cada día de esta semana: la plantilla semanal más lo que el coach movió, copió o quitó en una fecha concreta.
  const { data: ajustesBD } = await admin.from('calendario_entreno_ajustes').select('id, sesion_id, tipo, fecha_origen, fecha').eq('plan_id', planEntreno.id)
  const ajustes = (ajustesBD ?? []) as Ajuste[]
  const activa = plantillaActivaEn(planEntreno.created_at, planEntreno.duracion_semanas as number | null)
  const NOMBRE_DIA = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo']
  const sesiones = Array.from({ length: 7 }, (_, i) => i).flatMap(i => {
    const fecha = toISODate(new Date(weekStart.getTime() + i * 86400000))
    return ocurrenciasDelDia(fecha, sesData, ajustes, activa(fecha)).map(({ sesion: s, ajuste }) => ({
      id: s.id,
      nombre: s.nombre,
      dia_semana: NOMBRE_DIA[i],
      duracion_estimada_min: s.duracion_estimada_min ?? null,
      contexto_ia: s.contexto_ia ?? null,
      ejercicios_count: ejCountBySesion[s.id] ?? 0,
      tipo_sesion: clasificarTipoSesion(tiposPorSesion[s.id] ?? []),
      fecha,
      registros_count: registrosPorSesion[s.id] ?? 0,
      completada: (registrosPorSesion[s.id] ?? 0) > 0,
      esHoy: fecha === today,
      km: kmDeSesion(pasosParaFecha(planEntreno, { nombre: s.nombre, pasos: (s as { pasos?: unknown }).pasos }, fecha), ritmosAtleta),
      // Colocada por el coach en esta fecha (movida o copiada): la plantilla no se toca.
      ajuste: ajuste ? ajuste.tipo : null,
    }))
  })

  // «Tu bloque»: mensaje, próximas semanas y mejoras del último plan de IA aprobado de este cliente.
  const { data: tareaPlan } = await admin.from('agente_tareas').select('payload, aplicado_at')
    .eq('cliente_id', planEntreno.cliente_id).eq('tipo', 'plan_entreno_ia')
    .in('estado', ['aplicado', 'aprobada', 'aprobado', 'modificado']).order('created_at', { ascending: false }).limit(1).maybeSingle()
  // Solo si el plan activo es el que salió de esa tarea (si el coach lo cambió a mano después, no se enseña un mensaje ajeno).
  const salioDeLaTarea = !!tareaPlan?.aplicado_at && Math.abs(new Date(planEntreno.created_at).getTime() - new Date(tareaPlan.aplicado_at).getTime()) < 5 * 60_000
  let ritmoRodaje: number | null = null
  if (tareaPlan && salioDeLaTarea) {
    ritmoRodaje = ritmosAtleta?.E ?? null
  }
  const tu_bloque = tareaPlan && salioDeLaTarea ? construirTuBloque(tareaPlan.payload, today, ritmoRodaje) : null

  return NextResponse.json({ sesiones, plan_nombre: planEntreno.nombre, bloque, tu_bloque })
}
