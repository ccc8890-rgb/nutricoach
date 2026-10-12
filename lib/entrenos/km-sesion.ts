// lib/entrenos/km-sesion.ts
// Km de una sesión de carrera a partir de sus pasos (los pasos por tiempo se convierten con el ritmo del atleta).
import { validarPasos, resumenSesion } from './pasos'
import { ritmosDesdeVdot, type Ritmos } from './ritmos'

/** Km con un decimal, o null si la sesión no tiene pasos válidos o no se puede calcular. */
export function kmDeSesion(pasos: unknown, ritmos: Ritmos | null): number | null {
  const v = validarPasos(pasos)
  if (!v.ok) return null
  const { distancia_m } = resumenSesion(v.pasos, ritmos)
  return distancia_m > 0 ? Math.round(distancia_m / 100) / 10 : null
}

export function ritmosDeVdot(vdot: unknown): Ritmos | null {
  const n = vdot != null && vdot !== '' ? Number(vdot) : NaN
  return Number.isFinite(n) ? ritmosDesdeVdot(n) : null
}

/** «8,5 km» (coma española). */
export function textoKm(km: number | null | undefined): string | null {
  return km ? `${km.toFixed(1).replace('.', ',')} km` : null
}
