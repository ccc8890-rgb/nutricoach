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

export interface ResultadoDirector {
  clientes_procesados: number
  tareas_generadas: number
  errores: string[]
  duracion_ms: number
}

// ── Entry point del cron job ──────────────────────────────────
export async function ejecutarDirector(
  modo: 'diario' | 'semanal' = 'diario'
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

  for (const { id } of clientes) {
    try {
      // Siempre: actualizar perfil de aprendizaje
      await actualizarPerfilAprendizaje(id)

      // Siempre: agente de riesgo nutrición + entrenamiento
      await ejecutarAgenteRiesgo(id)
      await ejecutarAgenteRiesgoEntreno(id)

      // Solo lunes (semanal): revisores + motivación
      if (modo === 'semanal') {
        await ejecutarRevisorSemanal(id)
        await ejecutarAgenteMotivacion(id)
        await ejecutarRevisorSemanalEntreno(id)
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      errores.push(`cliente ${id}: ${msg}`)
    }
  }

  const tareasAhora = await contarTareasPendientes(db)
  tareasGeneradas = Math.max(0, tareasAhora - tareasPrevias)

  return {
    clientes_procesados: clientes.length,
    tareas_generadas: tareasGeneradas,
    errores,
    duracion_ms: Date.now() - inicio,
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
