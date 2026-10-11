// lib/entrenos/zonas-fc.ts
// Zonas de pulso por tipo de trabajo, ancladas al umbral de lactato (el que mide Garmin) y al pulso máximo.
import type { ZonaRitmo } from './ritmos'

export interface RangoFc { min: number; max: number }
export type ZonasFc = Partial<Record<ZonaRitmo, RangoFc>>

/** Techo del esfuerzo suave: por debajo del 90 % del umbral (igual que el panel de intensidad) y de Daniels (≤79 % del máximo). */
const SUAVE_SOBRE_UMBRAL = 0.9
const SUAVE_SOBRE_MAXIMO = 0.79
/** Suelo del rango suave: solo evita que el reloj pite en el calentamiento; el control real es el techo. */
const SUELO_SOBRE_UMBRAL = 0.65

/**
 * Rangos de pulso orientativos por zona. Solo E, M, T e I tienen rango; en R (repeticiones cortas) el pulso
 * llega tarde y no guía. Devuelve null si no se conoce ni el umbral ni el pulso máximo.
 */
export function zonasFcDesde(u: { fcUmbral: number | null; fcMax: number | null }): ZonasFc | null {
  const max = u.fcMax && u.fcMax > 0 ? u.fcMax : null
  const umbral = u.fcUmbral && u.fcUmbral > 0 ? u.fcUmbral : max ? max * 0.9 : null
  if (!umbral) return null
  const techos = [umbral * SUAVE_SOBRE_UMBRAL, ...(max ? [max * SUAVE_SOBRE_MAXIMO] : [])]
  const r = (n: number) => Math.round(n)
  const techoE = r(Math.min(...techos))
  return {
    E: { min: r(umbral * SUELO_SOBRE_UMBRAL), max: techoE },
    M: { min: r(umbral * 0.93), max: r(umbral * 0.97) },
    T: { min: r(umbral * 0.97), max: r(umbral * 1.02) },
    I: { min: r(umbral * 1.0), max: max ?? r(umbral * 1.08) },
  }
}
