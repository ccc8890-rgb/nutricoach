export const BLOQUES_SESION = [
  'calentamiento',
  'movilidad',
  'pliometria',
  'principal',
  'accesorios',
  'vuelta_calma',
] as const

export type TipoBloqueSesion = typeof BLOQUES_SESION[number]

const LABELS: Record<TipoBloqueSesion, string> = {
  calentamiento: 'CALENTAMIENTO',
  movilidad: 'MOVILIDAD / ACTIVACIÓN',
  pliometria: 'PLIOMETRÍA',
  principal: 'BLOQUE PRINCIPAL',
  accesorios: 'ACCESORIOS',
  vuelta_calma: 'VUELTA A LA CALMA',
}

export function normalizarBloqueSesion(value: unknown): TipoBloqueSesion {
  return typeof value === 'string' && BLOQUES_SESION.includes(value as TipoBloqueSesion)
    ? value as TipoBloqueSesion
    : 'principal'
}

export function etiquetaBloqueSesion(tipo: TipoBloqueSesion) {
  return LABELS[tipo]
}

export function agruparEjerciciosPorBloque<T extends { orden: number; bloque?: unknown }>(items: T[]) {
  return BLOQUES_SESION.flatMap(bloque => {
    const agrupados = items
      .filter(item => normalizarBloqueSesion(item.bloque) === bloque)
      .sort((a, b) => a.orden - b.orden)
    return agrupados.length ? [{ bloque, items: agrupados }] : []
  })
}

export function crearPresentacionEjercicios<T extends { orden: number; bloque?: unknown }>(items: T[]) {
  let indiceGlobal = 0
  return agruparEjerciciosPorBloque(items).map(grupo => ({
    ...grupo,
    label: etiquetaBloqueSesion(grupo.bloque),
    items: grupo.items.map(item => ({ ...item, indiceGlobal: ++indiceGlobal })),
  }))
}

export function esInicioDeBloque(items: Array<{ bloque?: unknown }>, index: number) {
  if (index === 0) return true
  if (index < 0 || index >= items.length) return false
  return normalizarBloqueSesion(items[index].bloque) !== normalizarBloqueSesion(items[index - 1].bloque)
}

export function ordenarEjerciciosParaEjecucion<T extends { orden: number; bloque?: unknown }>(items: T[]) {
  return agruparEjerciciosPorBloque(items).flatMap(grupo => grupo.items)
}
