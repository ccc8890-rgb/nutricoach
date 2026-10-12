/**
 * Ejercicios encadenados: uno que sale directo al siguiente sin pausa
 * (p. ej. Sled push → 400 m corriendo, para trabajar en fatiga).
 * `encadenado` en un ejercicio significa «enlaza con el siguiente».
 */
export interface ItemEncadenable {
  series?: number | null
  descanso_segundos?: number | null
  encadenado?: boolean | null
}

export type UnidadEjercicios<T> =
  | { tipo: 'solo'; item: T }
  | { tipo: 'cadena'; items: T[]; rondas: number | null; pausaRonda: number | null }

export function agruparEncadenados<T extends ItemEncadenable>(items: T[]): UnidadEjercicios<T>[] {
  const unidades: UnidadEjercicios<T>[] = []
  let i = 0
  while (i < items.length) {
    const cadena: T[] = [items[i]]
    while (items[i + cadena.length - 1]?.encadenado && i + cadena.length < items.length) cadena.push(items[i + cadena.length])
    if (cadena.length < 2) {
      unidades.push({ tipo: 'solo', item: items[i] })
      i += 1
      continue
    }
    const series = cadena.map(c => c.series ?? 0)
    const rondas = series[0] > 0 && series.every(s => s === series[0]) ? series[0] : null
    const ultimo = cadena[cadena.length - 1].descanso_segundos
    unidades.push({ tipo: 'cadena', items: cadena, rondas, pausaRonda: ultimo && ultimo > 0 ? ultimo : null })
    i += cadena.length
  }
  return unidades
}
