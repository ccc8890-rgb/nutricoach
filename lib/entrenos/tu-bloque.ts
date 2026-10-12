// lib/entrenos/tu-bloque.ts
// «Tu bloque» para el cliente: solo lo que él debe ver del plan aprobado (sin estudios, jerga ni notas del coach).
import { lunesDe } from '@/lib/rendimiento/fechas'

export interface SemanaTuBloque {
  n: number
  lunes: string
  fase: string
  descarga: boolean
  /** Minutos de carrera previstos esa semana. */
  minutos: number
  actual: boolean
}

export interface TuBloque {
  mensaje: string | null
  mejoras: string[]
  semanas: SemanaTuBloque[]
}

const SEMANAS_VISIBLES = 4

/** Texto corto y limpio; descarta lo que no sea cadena o venga vacío. */
function texto(v: unknown, max: number): string | null {
  if (typeof v !== 'string') return null
  const t = v.trim()
  return t ? t.slice(0, max) : null
}

/** Devuelve null si la tarea no trae nada que enseñar al cliente. */
export function construirTuBloque(payload: unknown, hoy: string): TuBloque | null {
  const p = (payload ?? {}) as { plan?: Record<string, unknown>; macrociclo?: { semanas?: { n: number; lunes: string; fase: string; descarga: boolean; minutos: number }[] } }
  const mensaje = texto(p.plan?.notas_cliente_entreno, 900)
  const mejoras = (Array.isArray(p.plan?.mejoras_cliente) ? p.plan.mejoras_cliente : [])
    .map(m => texto(m, 200)).filter((m): m is string => !!m).slice(0, 3)

  const lunesHoy = lunesDe(hoy)
  const todas = p.macrociclo?.semanas ?? []
  // Desde la semana en curso: lo pasado ya no le sirve al cliente.
  const futuras = todas.filter(w => w.lunes >= lunesHoy).slice(0, SEMANAS_VISIBLES)
  const semanas = futuras.map(w => ({ n: w.n, lunes: w.lunes, fase: w.fase, descarga: w.descarga, minutos: Math.round(w.minutos), actual: w.lunes === lunesHoy }))

  if (!mensaje && !mejoras.length && !semanas.length) return null
  return { mensaje, mejoras, semanas }
}
