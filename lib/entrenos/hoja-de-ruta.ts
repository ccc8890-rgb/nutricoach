// lib/entrenos/hoja-de-ruta.ts
// Hoja de ruta de ~2 meses para el coach: lo que el motor prevé semana a semana frente a lo que el atleta ha hecho de verdad.
import type { SemanaMacro } from './macrociclo'
import { esCarrera } from '@/lib/rendimiento/carga'
import { lunesDe } from '@/lib/rendimiento/fechas'

export interface FilaHojaDeRuta {
  n: number
  lunes: string
  fase: string
  descarga: boolean
  prevMin: number
  tiradaMin: number
  salidas: number
  tipos: string[]
  /** Minutos de carrera realmente hechos esa semana; null si la semana aún no ha empezado. */
  realMin: number | null
  /** La semana en curso (puede estar incompleta). */
  enCurso: boolean
  notas: string[]
}

/** Une las semanas previstas con los minutos de carrera reales por semana (lunes → minutos). */
export function construirHojaDeRuta(semanas: SemanaMacro[], entrenos: { fecha: string; tipo: string | null; duracion_s: number | null }[], hoy: string): FilaHojaDeRuta[] {
  const real = new Map<string, number>()
  for (const e of entrenos) if (esCarrera(e.tipo) && e.duracion_s) real.set(lunesDe(e.fecha), (real.get(lunesDe(e.fecha)) ?? 0) + e.duracion_s / 60)
  const lunesHoy = lunesDe(hoy)
  return semanas.map(w => ({
    n: w.n, lunes: w.lunes, fase: w.fase, descarga: w.descarga, prevMin: w.minutos, tiradaMin: w.tiradaMin, salidas: w.salidas,
    tipos: w.sesiones.map(s => s.tipo),
    realMin: w.lunes <= lunesHoy ? Math.round(real.get(w.lunes) ?? 0) : null,
    enCurso: w.lunes === lunesHoy,
    notas: w.notas,
  }))
}
