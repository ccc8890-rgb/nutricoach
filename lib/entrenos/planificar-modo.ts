// lib/entrenos/planificar-modo.ts
// Decide qué debe hacer el botón «Planificar con IA» según el plan activo del cliente. Función pura.
import { calcularEstadoBloque } from './bloques'

export type ModoPlanificacion = 'crear' | 'siguiente_bloque' | 'ajustar'

export interface PlanActivoResumen { created_at: string; duracion_semanas: number | null }

export interface DecisionModo {
  modo: ModoPlanificacion
  /** Texto que se muestra bajo el botón. */
  etiqueta: string
  diasRestantes: number | null
}

/** Cuando quedan estos días o menos del bloque, se propone el siguiente. */
export const DIAS_AVISO_SIGUIENTE_BLOQUE = 7

const dias = (n: number) => `${n} ${n === 1 ? 'día' : 'días'}`

export function decidirModoPlanificacion(plan: PlanActivoResumen | null, hoy: Date = new Date()): DecisionModo {
  if (!plan) return { modo: 'crear', etiqueta: 'Crear el primer bloque', diasRestantes: null }
  // Sin duración no se sabe cuándo acaba: se ajusta, que no sustituye nada.
  if (!plan.duracion_semanas) return { modo: 'ajustar', etiqueta: 'Ajustar el plan actual con sus datos reales', diasRestantes: null }
  const e = calcularEstadoBloque(plan.created_at, plan.duracion_semanas, hoy)
  if (e.terminado) return { modo: 'siguiente_bloque', etiqueta: 'Siguiente bloque (el actual ya terminó)', diasRestantes: 0 }
  if (e.diasRestantes <= DIAS_AVISO_SIGUIENTE_BLOQUE) {
    return { modo: 'siguiente_bloque', etiqueta: `Siguiente bloque (el actual acaba en ${dias(e.diasRestantes)})`, diasRestantes: e.diasRestantes }
  }
  return { modo: 'ajustar', etiqueta: `Ajustar el bloque actual (semana ${e.semanaActual} de ${e.semanasTotales})`, diasRestantes: e.diasRestantes }
}
