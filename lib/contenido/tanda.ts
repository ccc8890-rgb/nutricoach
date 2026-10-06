import { planosPendientes } from './escaleta'

/** Más largo primero; sin tiempo al final; desempate por nombre. */
export function ordenarCocinado<T extends { nombre: string; tiempo_prep_min: number | null }>(recetas: T[]): T[] {
  return [...recetas].sort((a, b) =>
    (b.tiempo_prep_min ?? -1) - (a.tiempo_prep_min ?? -1) || a.nombre.localeCompare(b.nombre))
}

export function resumenTanda(items: { tiempo_prep_min: number | null; planos_hechos: string[] }[]) {
  return {
    recetas: items.length,
    minutos: items.reduce((t, i) => t + (i.tiempo_prep_min ?? 0), 0),
    planosPendientes: items.reduce((t, i) => t + planosPendientes(i.planos_hechos), 0),
  }
}
