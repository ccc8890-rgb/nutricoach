// ================================================================
// AGENTE DIRECTOR
// Orquesta la ejecución de todos los agentes para todos los clientes.
// Es el entry point del cron job.
// ================================================================

import { createServiceSupabase } from '@/lib/supabase-server'
import { actualizarPerfilAprendizaje } from './executor'
import { ejecutarRevisorSemanal } from './revisor-semanal'
import { ejecutarAgenteRiesgo } from './riesgo'
import { ejecutarAgenteMotivacion } from './motivacion'
import { ejecutarAgenteRiesgoEntreno } from './riesgo-entreno'
import { ejecutarRevisorSemanalEntreno } from './revisor-semanal-entreno'
import { ejecutarTrainingBrain } from './training-brain'
import { ejecutarAgenteReadiness } from './readiness'
import { ejecutarDirectorSupercoachCliente } from './supercoach'
import { actualizarPerfilGusto } from './perfil-gusto'
import { ejecutarAprendizajeColectivo } from './aprendizaje-colectivo'
import { ejecutarAgenteRetencion } from './agente-retencion'
import { crearPlanDirectorCliente, type ModoDirector, type PlanDirectorCliente } from './orquestador'

export interface ResultadoDirector {
  clientes_procesados: number
  tareas_generadas: number
  errores: string[]
  duracion_ms: number
  planes_director?: PlanDirectorCliente[]
  aprendizaje_colectivo?: { patrones_extraidos: number; resumen: string }
}

// ── Entry point del cron job ──────────────────────────────────
export async function ejecutarDirector(
  modo: ModoDirector = 'diario'
): Promise<ResultadoDirector> {
  const inicio = Date.now()
  const db = createServiceSupabase()
  const errores: string[] = []
  let tareasGeneradas = 0

  // Obtener clientes activos
  const { data: clientes, error } = await db
    .from('clientes')
    .select('id')
    .eq('activo', true)

  if (error || !clientes) {
    return { clientes_procesados: 0, tareas_generadas: 0, errores: ['No se pudieron cargar clientes'], duracion_ms: Date.now() - inicio }
  }

  const tareasPrevias = await contarTareasPendientes(db)
  const planesDirector: PlanDirectorCliente[] = []

  // Procesar clientes en lotes paralelos para escalar a cientos de clientes.
  // Concurrencia=5: equilibrio entre velocidad y límites de rate de la API de IA.
  const CONCURRENCIA = 5
  for (let i = 0; i < clientes.length; i += CONCURRENCIA) {
    const lote = clientes.slice(i, i + CONCURRENCIA)
    const resultados = await Promise.allSettled(
      lote.map(async ({ id }) => {
        const plan = crearPlanDirectorCliente(await cargarSenalesDirectorCliente(id), modo)
        planesDirector.push(plan)

        if (plan.ejecutar.perfil_aprendizaje) await actualizarPerfilAprendizaje(id)
        if (plan.ejecutar.perfil_gusto) await actualizarPerfilGusto(id)

        if (plan.ejecutar.riesgo_nutricion) await ejecutarAgenteRiesgo(id)
        if (plan.ejecutar.retencion) await ejecutarAgenteRetencion(id)
        if (plan.ejecutar.riesgo_entreno) await ejecutarAgenteRiesgoEntreno(id)
        if (plan.ejecutar.readiness) await ejecutarAgenteReadiness(id)
        if (plan.ejecutar.supercoach) await ejecutarDirectorSupercoachCliente(id)

        if (plan.ejecutar.revisor_semanal) await ejecutarRevisorSemanal(id)
        if (plan.ejecutar.motivacion) await ejecutarAgenteMotivacion(id)
        if (plan.ejecutar.revisor_semanal_entreno) await ejecutarRevisorSemanalEntreno(id)
        if (plan.ejecutar.training_brain) await ejecutarTrainingBrain(id)
      })
    )
    for (let j = 0; j < resultados.length; j++) {
      const r = resultados[j]
      if (r.status === 'rejected') {
        const msg = r.reason instanceof Error ? r.reason.message : String(r.reason)
        errores.push(`cliente ${lote[j].id}: ${msg}`)
      }
    }
  }

  const tareasAhora = await contarTareasPendientes(db)
  tareasGeneradas = Math.max(0, tareasAhora - tareasPrevias)

  // Aprendizaje colectivo: solo el 1er día del mes (en ejecución semanal)
  let aprendizajeColectivo: ResultadoDirector['aprendizaje_colectivo']
  if (modo === 'semanal' && new Date().getDate() <= 7) {
    try {
      const res = await ejecutarAprendizajeColectivo()
      aprendizajeColectivo = { patrones_extraidos: res.patrones_extraidos, resumen: res.resumen }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      errores.push(`aprendizaje_colectivo: ${msg}`)
    }
  }

  return {
    clientes_procesados: clientes.length,
    tareas_generadas: tareasGeneradas,
    errores,
    duracion_ms: Date.now() - inicio,
    planes_director: planesDirector,
    aprendizaje_colectivo: aprendizajeColectivo,
  }
}

// ── Resumen para el dashboard del coach ──────────────────────
export async function obtenerResumenAgentes(): Promise<{
  pendientes: number
  aprobados_hoy: number
  rechazados_hoy: number
  clientes_en_riesgo: number
}> {
  const db = createServiceSupabase()
  const hoy = new Date().toISOString().split('T')[0]

  const [pendientes, aprobadosHoy, rechazadosHoy, enRiesgo] = await Promise.all([
    db.from('agente_tareas').select('*', { count: 'exact', head: true }).eq('estado', 'pendiente'),
    db.from('agente_tareas').select('*', { count: 'exact', head: true }).eq('estado', 'aprobado').gte('revisado_at', hoy),
    db.from('agente_tareas').select('*', { count: 'exact', head: true }).eq('estado', 'rechazado').gte('revisado_at', hoy),
    db.from('cliente_perfil_aprendizaje').select('*', { count: 'exact', head: true }).gte('riesgo_abandono', 0.35),
  ])

  return {
    pendientes: pendientes.count ?? 0,
    aprobados_hoy: aprobadosHoy.count ?? 0,
    rechazados_hoy: rechazadosHoy.count ?? 0,
    clientes_en_riesgo: enRiesgo.count ?? 0,
  }
}

async function contarTareasPendientes(db: ReturnType<typeof createServiceSupabase>): Promise<number> {
  const { count } = await db
    .from('agente_tareas')
    .select('*', { count: 'exact', head: true })
    .eq('estado', 'pendiente')
  return count ?? 0
}

function diasDesde(fecha?: string | null): number | null {
  if (!fecha) return null
  return Math.floor((Date.now() - new Date(fecha).getTime()) / 86_400_000)
}

function desdeDias(days: number): string {
  return new Date(Date.now() - days * 86_400_000).toISOString().split('T')[0]
}

async function cargarSenalesDirectorCliente(clienteId: string) {
  const db = createServiceSupabase()
  const desde7 = desdeDias(7)

  const [
    planNutricion,
    planEntreno,
    ultimoCheckin,
    ultimaSesion,
    sesiones7d,
    pendientes,
  ] = await Promise.all([
    db
      .from('planes_nutricion')
      .select('id')
      .eq('cliente_id', clienteId)
      .eq('activo', true)
      .limit(1)
      .maybeSingle(),
    db
      .from('planes_entrenamiento')
      .select('id')
      .eq('cliente_id', clienteId)
      .eq('activo', true)
      .limit(1)
      .maybeSingle(),
    db
      .from('checkins')
      .select('fecha')
      .eq('cliente_id', clienteId)
      .order('fecha', { ascending: false })
      .limit(1)
      .maybeSingle(),
    db
      .from('registros_sets')
      .select('fecha')
      .eq('cliente_id', clienteId)
      .order('fecha', { ascending: false })
      .limit(1)
      .maybeSingle(),
    db
      .from('registros_sets')
      .select('fecha', { count: 'exact', head: true })
      .eq('cliente_id', clienteId)
      .gte('fecha', desde7),
    db
      .from('agente_tareas')
      .select('tipo, agente')
      .eq('cliente_id', clienteId)
      .eq('estado', 'pendiente'),
  ])

  return {
    clienteId,
    tienePlanNutricion: Boolean(planNutricion.data),
    tienePlanEntreno: Boolean(planEntreno.data),
    diasSinCheckin: diasDesde(ultimoCheckin.data?.fecha),
    diasSinSesion: diasDesde(ultimaSesion.data?.fecha),
    sesiones7d: sesiones7d.count ?? 0,
    pendientes: (pendientes.data ?? []) as Array<{ tipo: string; agente: string }>,
  }
}
