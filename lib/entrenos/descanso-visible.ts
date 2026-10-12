/** El descanso solo importa en cardio (series de correr) y funcional (Hyrox, circuitos).
 * En fuerza da igual y estorba, así que no se enseña ni se programa el temporizador. */
export function descansoRelevante(tipo?: string | null): boolean {
  return tipo === 'cardio' || tipo === 'funcional'
}

/**
 * Segundos de descanso a mostrar, o 0 si no procede.
 * Con una sola serie (calentamiento de 1 × 5 min) no hay nada que descansar: si se pasa `series` y es ≤ 1, no se muestra.
 * Usar SIEMPRE esta función para enseñar una pausa; no leer `descanso_segundos` directamente.
 */
export function descansoVisible(tipo: string | null | undefined, segundos: number | null | undefined, series?: number | null): number {
  if (series != null && series <= 1) return 0
  return descansoRelevante(tipo) ? (segundos ?? 0) : 0
}
