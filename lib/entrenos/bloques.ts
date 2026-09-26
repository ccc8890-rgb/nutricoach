export type FaseBloque = 'Base' | 'Fuerza' | 'Resistencia' | 'Deload'

const ROTACION_BLOQUES: FaseBloque[] = ['Base', 'Fuerza', 'Resistencia', 'Deload']

/** Rotación fija de foco de bloque. Sin fase previa, siempre empieza en Base. */
export function siguienteFaseBloque(faseActual: FaseBloque | null | undefined): FaseBloque {
  if (!faseActual) return 'Base'
  const idx = ROTACION_BLOQUES.indexOf(faseActual)
  if (idx === -1) return 'Base'
  return ROTACION_BLOQUES[(idx + 1) % ROTACION_BLOQUES.length]
}

export interface EstadoBloque {
  semanaActual: number
  semanasTotales: number
  diasRestantes: number
  terminado: boolean
}

const MS_POR_DIA = 24 * 60 * 60 * 1000

/** Trunca una fecha a medianoche local, para comparar por día de calendario. */
function truncarAMedianoche(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate())
}

/**
 * Calcula en qué semana de un bloque de N semanas cae `fechaRef`, contando
 * desde `fechaInicioISO`. Clampa siempre semanaActual a [1, duracionSemanas]
 * y diasRestantes a >= 0, incluso si fechaInicioISO cae en el futuro
 * respecto a fechaRef (reloj desincronizado o dato corrupto).
 *
 * Ambas fechas se truncan a medianoche antes de restar, para contar por día
 * de calendario y no por diferencia exacta de horas — un plan creado a las
 * 20:00 no debe seguir "en semana 1" hasta las 20:00 exactas del día 7.
 */
export function calcularEstadoBloque(
  fechaInicioISO: string,
  duracionSemanas: number,
  fechaRef: Date = new Date()
): EstadoBloque {
  const inicio = truncarAMedianoche(new Date(fechaInicioISO))
  const ref = truncarAMedianoche(fechaRef)
  const diasTranscurridos = Math.max(0, Math.round((ref.getTime() - inicio.getTime()) / MS_POR_DIA))
  const totalDias = duracionSemanas * 7
  const diasRestantes = Math.max(0, totalDias - diasTranscurridos)
  const semanaActual = Math.min(duracionSemanas, Math.max(1, Math.floor(diasTranscurridos / 7) + 1))

  return {
    semanaActual,
    semanasTotales: duracionSemanas,
    diasRestantes,
    terminado: diasTranscurridos >= totalDias,
  }
}

/**
 * Fecha (medianoche local) en la que termina un bloque — usado para saber
 * si un día del calendario cae ya fuera del bloque activo.
 */
export function fechaFinBloque(fechaInicioISO: string, duracionSemanas: number): Date {
  const inicio = truncarAMedianoche(new Date(fechaInicioISO))
  const fin = new Date(inicio)
  fin.setDate(fin.getDate() + duracionSemanas * 7)
  return fin
}

export interface BloqueInfo {
  fase: string
  semana_actual: number
  semanas_totales: number
}

/**
 * Helper compartido por las APIs de lectura (sesiones-plan, semana-completa)
 * para no duplicar el mismo cálculo de bloque en cada una. Devuelve null si
 * el plan no tiene fase de bloque (planes antiguos o no-híbridos) o no tiene
 * duración definida.
 */
export function calcularBloqueInfo(
  fechaInicioISO: string,
  duracionSemanas: number | null | undefined,
  faseBloque: string | null | undefined,
  fechaRef: Date = new Date()
): BloqueInfo | null {
  if (!faseBloque || !duracionSemanas) return null
  const estado = calcularEstadoBloque(fechaInicioISO, duracionSemanas, fechaRef)
  return { fase: faseBloque, semana_actual: estado.semanaActual, semanas_totales: estado.semanasTotales }
}

/** Orden lunes-primero, consistente en toda la app (semana-completa, mes-completo). */
export const DIAS_SEMANA_ORDEN: Record<string, number> = {
  Lunes: 0, Martes: 1, Miércoles: 2, Jueves: 3, Viernes: 4, Sábado: 5, Domingo: 6,
}

/** Abreviaturas indexadas por DIAS_SEMANA_ORDEN — mismo orden lunes-primero. */
export const DIAS_SEMANA_ABREVIATURA = ['L', 'M', 'X', 'J', 'V', 'S', 'D']

export type TipoSesion = 'hibrido' | 'carrera' | 'mixto'

/**
 * Clasifica una sesión como híbrida o de carrera según qué proporción de
 * sus ejercicios vinculados son de tipo 'cardio' (ejercicios.tipo): la
 * mayoría decide (>50% cardio → carrera, <50% → hibrido, empate → mixto).
 * Sin ejercicios vinculados (match fallido para todos), devuelve 'mixto'
 * en vez de dividir por cero.
 */
export function clasificarTipoSesion(tiposEjercicios: string[]): TipoSesion {
  if (tiposEjercicios.length === 0) return 'mixto'
  const cardio = tiposEjercicios.filter(t => t === 'cardio').length
  const ratio = cardio / tiposEjercicios.length
  if (ratio > 0.5) return 'carrera'
  if (ratio < 0.5) return 'hibrido'
  return 'mixto'
}
