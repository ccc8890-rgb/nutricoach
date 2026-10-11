// lib/entrenos/capacidad.ts
// Capacidad semanal de carrera que el atleta ya ha demostrado. La media de 4 semanas se hunde con viajes, vacaciones o una semana floja,
// y un plan que parte de esa media se queda corto; la mejor semana reciente (con margen) dice lo que de verdad tolera.
// Criterio de entrenador, no de un estudio: el plan no debe quedar por debajo de la carga que ya soporta (el desentrenamiento empieza en pocas semanas, Mujika 2000).

/** Fracción de la mejor semana reciente que se toma como volumen sostenible. */
export const FRACCION_MEJOR_SEMANA = 0.8

export interface CapacidadSemanal {
  /** Media de las 4 últimas semanas completas (0 incluidos). */
  media4: number
  /** Mejor de esas 4 semanas. */
  mejor4: number
  /** Volumen de partida recomendado: el mayor entre la media y el 80 % de la mejor semana. */
  capacidad: number
  /** La capacidad es mayor que la media por culpa de semanas bajas. */
  hayDiferencia: boolean
}

/** `semanas[0]` = la más reciente; minutos de carrera por semana completa. */
export function capacidadSemanal(semanas: number[]): CapacidadSemanal | null {
  const ult4 = semanas.slice(0, 4)
  if (ult4.length === 0 || !ult4.some(x => x > 0)) return null
  const media4 = Math.round(ult4.reduce((a, b) => a + b, 0) / ult4.length)
  const mejor4 = Math.max(...ult4)
  const capacidad = Math.max(media4, Math.round(mejor4 * FRACCION_MEJOR_SEMANA))
  return { media4, mejor4, capacidad, hayDiferencia: capacidad > media4 }
}
