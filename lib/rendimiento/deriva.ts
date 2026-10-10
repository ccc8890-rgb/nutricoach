// lib/rendimiento/deriva.ts
// Deriva cardiaca (desacoplamiento Pa:Hr): cuánto sube el pulso para el mismo ritmo entre la 1ª y la 2ª mitad.
import type { VueltaEntreno } from './garmin-entrenos'

/** Tipos de vuelta que no cuentan: calentar, enfriar y recuperaciones entre series. */
const TIPOS_EXCLUIDOS = new Set(['WARMUP', 'COOLDOWN', 'RECOVERY', 'REST', 'REPEAT'])
/** Menos tiempo de trabajo continuo que esto y la deriva no es fiable. */
const SEGUNDOS_MINIMOS = 30 * 60
/** Vueltas más cortas que esto se ignoran (ruido de GPS/pulso). */
const METROS_MINIMOS = 300
/** Si el ritmo varía más que esto entre vueltas, no es una carrera continua y la deriva no significa nada. */
const VARIACION_MAXIMA = 0.1

export type ValoracionDeriva = 'estable' | 'moderada' | 'alta'

export interface Deriva {
  /** % de pérdida de eficiencia (velocidad/pulso) de la 2ª mitad respecto a la 1ª. Positivo = el pulso se disparó. */
  derivaPct: number
  fc1: number
  fc2: number
  ritmo1_s_km: number
  ritmo2_s_km: number
  minutos: number
  valoracion: ValoracionDeriva
}

export function valorarDeriva(pct: number): ValoracionDeriva {
  if (pct < 5) return 'estable'
  if (pct <= 10) return 'moderada'
  return 'alta'
}

interface Tramo { dur: number; v: number; fc: number }

function media(tramos: Tramo[]) {
  const t = tramos.reduce((a, x) => a + x.dur, 0)
  return { v: tramos.reduce((a, x) => a + x.v * x.dur, 0) / t, fc: tramos.reduce((a, x) => a + x.fc * x.dur, 0) / t }
}

/** Devuelve null si la carrera no es continua, es corta o faltan datos de pulso/velocidad. */
export function calcularDeriva(vueltas: VueltaEntreno[] | null | undefined): Deriva | null {
  if (!Array.isArray(vueltas)) return null
  // Con recuperaciones entre varias repeticiones es una sesión de series, no una rodada continua.
  const activas = vueltas.filter(l => l.tipo === 'ACTIVE' || l.tipo === 'INTERVAL').length
  if (activas >= 3 && vueltas.some(l => l.tipo === 'RECOVERY')) return null

  const tramos: Tramo[] = vueltas
    .filter(l => !(l.tipo && TIPOS_EXCLUIDOS.has(l.tipo)) && l.distancia_m >= METROS_MINIMOS)
    .filter(l => l.fc_media && l.velocidad_ms && l.duracion_s > 0)
    .map(l => ({ dur: l.duracion_s, v: l.velocidad_ms!, fc: l.fc_media! }))

  const total = tramos.reduce((a, t) => a + t.dur, 0)
  if (tramos.length < 4 || total < SEGUNDOS_MINIMOS) return null

  const vMedia = tramos.reduce((a, t) => a + t.v * t.dur, 0) / total
  const varianza = tramos.reduce((a, t) => a + t.dur * (t.v - vMedia) ** 2, 0) / total
  if (Math.sqrt(varianza) / vMedia > VARIACION_MAXIMA) return null

  // Cada vuelta va a la mitad en la que cae su punto medio.
  const mitad1: Tramo[] = []
  const mitad2: Tramo[] = []
  let acumulado = 0
  for (const t of tramos) {
    ;(acumulado + t.dur / 2 < total / 2 ? mitad1 : mitad2).push(t)
    acumulado += t.dur
  }
  if (!mitad1.length || !mitad2.length) return null

  const a = media(mitad1)
  const b = media(mitad2)
  const derivaPct = Math.round(((a.v / a.fc) / (b.v / b.fc) - 1) * 1000) / 10
  return {
    derivaPct,
    fc1: Math.round(a.fc),
    fc2: Math.round(b.fc),
    ritmo1_s_km: Math.round(1000 / a.v),
    ritmo2_s_km: Math.round(1000 / b.v),
    minutos: Math.round(total / 60),
    valoracion: valorarDeriva(derivaPct),
  }
}
