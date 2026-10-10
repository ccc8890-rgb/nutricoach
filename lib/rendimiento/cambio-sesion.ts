// lib/rendimiento/cambio-sesion.ts
// Barandillas para cambios de pasos propuestos por la IA: nada llega al plan si no pasa estas comprobaciones.
import { validarPasos, resumenSesion, type Paso } from '@/lib/entrenos/pasos'
import type { Ritmos } from '@/lib/entrenos/ritmos'

/** Rango admisible de un ritmo objetivo (s/km): de 2:30 a 8:00. */
const RITMO_MIN = 150
const RITMO_MAX = 480
/** Anchura máxima de un rango de ritmo (s/km). */
const ANCHO_MAX = 40
/** La sesión nueva puede medir entre el 40 % y el 125 % de la actual: bajar mucho es seguro, subir de golpe no. */
const FACTOR_MIN = 0.4
const FACTOR_MAX = 1.25
/** Ningún objetivo de ritmo puede ser más rápido que el más rápido de la sesión actual en más de esto (s/km): no se aprieta de golpe. */
const ACELERACION_MAX = 10
/** Con VDOT conocido, el ritmo de trabajo no puede ser más rápido que el de repeticiones (R) ni más de un 25 % más lento que el fácil (E). */
const MARGEN_R = 0.95
const MARGEN_E = 1.25

export type ValidacionCambio = { ok: true; pasos: Paso[] } | { ok: false; error: string }

function ritmosDe(pasos: Paso[]): { min: number; max: number }[] {
  const salida: { min: number; max: number }[] = []
  const ver = (p: { objetivo?: { tipo: string; min_seg_km?: number; max_seg_km?: number } }) => {
    const o = p.objetivo
    if (o?.tipo === 'ritmo' && typeof o.min_seg_km === 'number' && typeof o.max_seg_km === 'number') salida.push({ min: o.min_seg_km, max: o.max_seg_km })
  }
  for (const p of pasos) {
    if (p.tipo === 'repetir') p.pasos.forEach(ver)
    else ver(p)
  }
  return salida
}

/** Ritmo objetivo (s/km) más rápido de la lista de pasos, o null si ninguno lo trae. */
function ritmoMasRapido(pasos: Paso[]): number | null {
  const r = ritmosDe(pasos)
  return r.length ? Math.min(...r.map(x => x.min)) : null
}

export function validarCambioPasos(actuales: unknown, nuevos: unknown, ritmos: Ritmos | null): ValidacionCambio {
  const v = validarPasos(nuevos)
  if (!v.ok) return { ok: false, error: v.error }

  for (const r of ritmosDe(v.pasos)) {
    if (r.min < RITMO_MIN || r.max > RITMO_MAX) return { ok: false, error: 'Un ritmo objetivo queda fuera de lo razonable (entre 2:30 y 8:00 /km)' }
    if (r.max - r.min > ANCHO_MAX) return { ok: false, error: `Un rango de ritmo es demasiado ancho (máx. ${ANCHO_MAX} s/km)` }
  }

  // Con el VDOT del atleta, los ritmos de trabajo tienen que caber entre el ritmo de repeticiones y el fácil.
  if (ritmos) {
    for (const r of ritmosDe(v.pasos)) {
      if (r.min < ritmos.R * MARGEN_R) return { ok: false, error: `Un ritmo objetivo es más rápido que el ritmo de repeticiones de su VDOT (${Math.round(ritmos.R)} s/km)` }
      if (r.max > ritmos.E * MARGEN_E) return { ok: false, error: 'Un ritmo objetivo es demasiado lento incluso para un rodaje fácil de su VDOT' }
    }
  }

  const a = validarPasos(actuales)
  if (a.ok) {
    const antesRapido = ritmoMasRapido(a.pasos)
    const despuesRapido = ritmoMasRapido(v.pasos)
    if (antesRapido !== null && despuesRapido !== null && despuesRapido < antesRapido - ACELERACION_MAX) {
      return { ok: false, error: `El cambio aprieta el ritmo más de ${ACELERACION_MAX} s/km de golpe (${Math.round(antesRapido)} → ${Math.round(despuesRapido)} s/km)` }
    }
    const antes = resumenSesion(a.pasos, ritmos).distancia_m
    const despues = resumenSesion(v.pasos, ritmos).distancia_m
    if (antes > 0 && despues > 0) {
      const f = despues / antes
      if (f < FACTOR_MIN || f > FACTOR_MAX) {
        return { ok: false, error: `El cambio modifica demasiado el volumen de la sesión (${Math.round(antes / 100) / 10} km → ${Math.round(despues / 100) / 10} km)` }
      }
    }
  }
  return { ok: true, pasos: v.pasos }
}
