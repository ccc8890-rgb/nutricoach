// lib/entrenos/prevision.ts
// Previsión de las semanas posteriores al bloque en curso: sesiones de carrera del macrociclo (día, tipo, minutos → km)
// y sesiones de fuerza/híbridas proyectadas desde la semana tipo del plan. No son sesiones creadas: los ejercicios se generan al cerrar el bloque.
import type { SupabaseClient } from '@supabase/supabase-js'
import { lunesDe } from '@/lib/rendimiento/fechas'

export interface SemanaMacroPrevision {
  n: number
  lunes: string
  fase: string
  descarga: boolean
  minutos: number
  sesiones: { dia: number; tipo: string; minutos: number }[]
}
export interface SesionPlantilla { nombre: string; tipo_sesion: 'hibrido' | 'carrera' | 'mixto' }
export interface SesionPrevision {
  id: string
  nombre: string
  tipo_sesion: 'hibrido' | 'carrera' | 'mixto'
  ejercicios_count: number
  km: number | null
  completada: false
  prevision: true
}

const NOMBRE_TIPO: Record<string, string> = {
  rodaje: 'Rodaje fácil', tirada: 'Tirada larga', series: 'Series', tempo: 'Tempo', strides: 'Rodaje con progresiones', ritmo_carrera: 'Ritmo de carrera',
}

/** Semana del macrociclo que contiene la fecha, o null si cae fuera. */
export function semanaMacroDe(fecha: string, semanas: SemanaMacroPrevision[]): SemanaMacroPrevision | null {
  const lunes = lunesDe(fecha)
  return semanas.find(w => w.lunes === lunes) ?? null
}

/**
 * Sesiones previstas para una fecha: la carrera sale del macrociclo de esa semana (con km a ritmo de rodaje, aproximados)
 * y la fuerza/híbridas del mismo día de la semana tipo. Devuelve null si la fecha no está cubierta por el macrociclo.
 */
export function sesionesPrevision(
  fecha: string,
  diaSemana: string,
  semanas: SemanaMacroPrevision[],
  noCarreraPorDia: Map<string, SesionPlantilla[]>,
  ritmoRodajeSegKm: number | null,
): { fase: string; sesiones: SesionPrevision[] } | null {
  const semana = semanaMacroDe(fecha, semanas)
  if (!semana) return null
  const indice = (new Date(`${fecha}T12:00:00`).getDay() + 6) % 7 // 0 = lunes
  const carrera: SesionPrevision[] = semana.sesiones.filter(s => s.dia === indice).map((s, i) => ({
    id: `prev-${fecha}-c${i}`,
    nombre: NOMBRE_TIPO[s.tipo] ?? 'Carrera',
    tipo_sesion: 'carrera' as const,
    ejercicios_count: 0,
    km: ritmoRodajeSegKm ? Math.round((s.minutos * 60 / ritmoRodajeSegKm) * 10) / 10 : null,
    completada: false as const,
    prevision: true as const,
  }))
  const fuerza: SesionPrevision[] = (noCarreraPorDia.get(diaSemana) ?? []).map((s, i) => ({
    id: `prev-${fecha}-f${i}`, nombre: s.nombre, tipo_sesion: s.tipo_sesion, ejercicios_count: 0, km: null, completada: false as const, prevision: true as const,
  }))
  return { fase: semana.fase, sesiones: [...carrera, ...fuerza] }
}

/** Semanas del macrociclo del último plan de IA aprobado, solo si el plan activo salió de esa tarea (si no, no se enseña nada ajeno). */
export async function cargarSemanasMacro(sb: SupabaseClient, plan: { cliente_id: string; created_at: string }): Promise<SemanaMacroPrevision[]> {
  const { data: tarea } = await sb.from('agente_tareas').select('payload, aplicado_at')
    .eq('cliente_id', plan.cliente_id).eq('tipo', 'plan_entreno_ia')
    .in('estado', ['aplicado', 'aprobada', 'aprobado', 'modificado']).order('created_at', { ascending: false }).limit(1).maybeSingle()
  if (!tarea?.aplicado_at || Math.abs(new Date(plan.created_at).getTime() - new Date(tarea.aplicado_at).getTime()) >= 5 * 60_000) return []
  const semanas = (tarea.payload as { macrociclo?: { semanas?: SemanaMacroPrevision[] } } | null)?.macrociclo?.semanas
  return Array.isArray(semanas) ? semanas : []
}
