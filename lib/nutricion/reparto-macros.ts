// lib/nutricion/reparto-macros.ts
// Reparto de calorías entre proteína, carbos y grasa (4/4/9 kcal/g). Es la posición del punto en el diagrama ternario de las recetas
// (pantalla y tarjeta de Instagram), así que las dos salen siempre de aquí.

export interface RepartoKcal {
  /** Fracciones 0-1 de kcal: [proteína, carbos, grasa]; suman 1 (o 0 si no hay macros). */
  f: [number, number, number]
  /** Porcentajes redondeados. */
  pct: [number, number, number]
  /** Índice del macro predominante: 0 proteína, 1 carbos, 2 grasa. */
  dom: 0 | 1 | 2
}

export function repartoKcal(p: number, c: number, g: number): RepartoKcal {
  const kp = Math.max(p, 0) * 4, kc = Math.max(c, 0) * 4, kg = Math.max(g, 0) * 9
  const total = kp + kc + kg
  const f: [number, number, number] = total > 0 ? [kp / total, kc / total, kg / total] : [0, 0, 0]
  const dom = f.indexOf(Math.max(...f)) as 0 | 1 | 2
  return { f, pct: [Math.round(f[0] * 100), Math.round(f[1] * 100), Math.round(f[2] * 100)], dom }
}
