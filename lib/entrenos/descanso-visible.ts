/** El descanso solo importa en cardio (series de correr) y funcional (Hyrox, circuitos).
 * En fuerza da igual y estorba, así que no se enseña ni se programa el temporizador. */
export function descansoRelevante(tipo?: string | null): boolean {
  return tipo === 'cardio' || tipo === 'funcional'
}

/** Segundos de descanso a mostrar, o 0 si no procede. */
export function descansoVisible(tipo: string | null | undefined, segundos: number | null | undefined): number {
  return descansoRelevante(tipo) ? (segundos ?? 0) : 0
}
