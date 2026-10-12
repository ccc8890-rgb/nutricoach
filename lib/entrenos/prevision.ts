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
/** Sesión de carrera de la semana tipo del plan (el día que tiene realmente, aunque el atleta la haya movido). */
export interface CarreraPlantilla { dia_semana: string; nombre: string }
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

const sinAcentos = (t: string) => t.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim()
const DIAS = ['lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado', 'domingo']
type Clase = 'calidad' | 'tirada' | 'rodaje'
const claseMacro = (tipo: string): Clase => tipo === 'tirada' ? 'tirada' : ['series', 'tempo', 'ritmo_carrera'].includes(tipo) ? 'calidad' : 'rodaje'
const clasePlantilla = (nombre: string): Clase | null => /tirada|larga/i.test(nombre) ? 'tirada' : /series|tempo|ritmo|intervalos|fartlek/i.test(nombre) ? 'calidad' : /rodaje|trote|carrera/i.test(nombre) ? 'rodaje' : null

/** Día (0 = lunes) de cada sesión de carrera del macrociclo: el que tiene su equivalente en la semana tipo; si no hay equivalente, el del macrociclo. */
export function diasDeCarrera(semana: SemanaMacroPrevision, plantilla: CarreraPlantilla[]): { dia: number; tipo: string; minutos: number }[] {
  const libres = plantilla.map(p => ({ clase: clasePlantilla(p.nombre), dia: DIAS.indexOf(sinAcentos(p.dia_semana)), usada: false }))
  return semana.sesiones.map(s => {
    const hueco = libres.find(l => !l.usada && l.dia >= 0 && l.clase === claseMacro(s.tipo))
    if (hueco) hueco.usada = true
    return { ...s, dia: hueco ? hueco.dia : s.dia }
  })
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
  carreraPlantilla: CarreraPlantilla[] = [],
): { fase: string; sesiones: SesionPrevision[] } | null {
  const semana = semanaMacroDe(fecha, semanas)
  if (!semana) return null
  const indice = (new Date(`${fecha}T12:00:00`).getDay() + 6) % 7 // 0 = lunes
  const carrera: SesionPrevision[] = diasDeCarrera(semana, carreraPlantilla).filter(s => s.dia === indice).map((s, i) => ({
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
