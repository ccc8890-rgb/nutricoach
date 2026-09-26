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

/**
 * Calcula en qué semana de un bloque de N semanas cae `fechaRef`, contando
 * desde `fechaInicioISO`. Clampa siempre semanaActual a [1, duracionSemanas]
 * y diasRestantes a >= 0, incluso si fechaInicioISO cae en el futuro
 * respecto a fechaRef (reloj desincronizado o dato corrupto).
 */
export function calcularEstadoBloque(
  fechaInicioISO: string,
  duracionSemanas: number,
  fechaRef: Date = new Date()
): EstadoBloque {
  const inicio = new Date(fechaInicioISO)
  const diasTranscurridos = Math.max(
    0,
    Math.floor((fechaRef.getTime() - inicio.getTime()) / MS_POR_DIA)
  )
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

/** Orden lunes-primero, consistente en toda la app (semana-completa, mes-completo). */
export const DIAS_SEMANA_ORDEN: Record<string, number> = {
  Lunes: 0, Martes: 1, Miércoles: 2, Jueves: 3, Viernes: 4, Sábado: 5, Domingo: 6,
}

/** Abreviaturas indexadas por DIAS_SEMANA_ORDEN — mismo orden lunes-primero. */
export const DIAS_SEMANA_ABREVIATURA = ['L', 'M', 'X', 'J', 'V', 'S', 'D']

export type TipoSesion = 'hibrido' | 'carrera' | 'mixto'

/**
 * Clasifica una sesión como híbrida o de carrera según qué proporción de
 * sus ejercicios vinculados son de tipo 'cardio' (ejercicios.tipo).
 * Sin ejercicios vinculados (match fallido para todos), devuelve 'mixto'
 * en vez de dividir por cero.
 */
export function clasificarTipoSesion(tiposEjercicios: string[]): TipoSesion {
  if (tiposEjercicios.length === 0) return 'mixto'
  const cardio = tiposEjercicios.filter(t => t === 'cardio').length
  const ratio = cardio / tiposEjercicios.length
  if (ratio >= 0.6) return 'carrera'
  if (ratio <= 0.2) return 'hibrido'
  return 'mixto'
}
