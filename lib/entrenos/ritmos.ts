// lib/entrenos/ritmos.ts
export type ZonaRitmo = 'E' | 'M' | 'T' | 'I' | 'R'
export type Ritmos = Record<ZonaRitmo, number>

/** Fracción del VO2max (VDOT) a la que corre cada zona (Daniels). */
const INTENSIDAD: Record<ZonaRitmo, number> = { E: 0.65, M: 0.84, T: 0.88, I: 0.98, R: 1.1 }

/** Velocidad (m/min) para un consumo de oxígeno dado: VO2 = 0,182258·v + 0,000104·v² − 4,60. */
function velocidadParaVo2(vo2: number): number {
  const a = 0.000104
  const b = 0.182258
  const c = -4.6 - vo2
  return (-b + Math.sqrt(b * b - 4 * a * c)) / (2 * a)
}

export function ritmosDesdeVdot(vdot: number): Ritmos | null {
  if (typeof vdot !== 'number' || !Number.isFinite(vdot) || vdot < 20 || vdot > 90) return null
  const zona = (z: ZonaRitmo) => 60000 / velocidadParaVo2(vdot * INTENSIDAD[z])
  return { E: zona('E'), M: zona('M'), T: zona('T'), I: zona('I'), R: zona('R') }
}

export function formatearRitmo(segKm: number): string {
  const total = Math.round(segKm)
  const m = Math.floor(total / 60)
  const s = total % 60
  return `${m}:${String(s).padStart(2, '0')}`
}
