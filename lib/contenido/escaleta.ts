import { ESTADOS_GRABADOS, type EstadoPieza } from './estados'

/** Escaleta estándar de grabación: la misma para todas las recetas. Cambiarla es un cambio de código. */
export const PLANOS = [
  { id: 'ingredientes', texto: 'Ingredientes sobre la mesa (plano general)' },
  { id: 'proceso', texto: 'Preparación: 3 o 4 planos del proceso' },
  { id: 'cocinado', texto: 'Cocinado o montaje (el momento que engancha)' },
  { id: 'plato', texto: 'Plato terminado, plano cenital' },
  { id: 'detalle', texto: 'Plano de detalle o primer bocado' },
  { id: 'macros', texto: 'Texto en pantalla con los macros' },
] as const

export const IDS_PLANOS: string[] = PLANOS.map(p => p.id)

/** Planos de la escaleta que aún no están marcados. Ignora ids desconocidos y repetidos. */
export function planosPendientes(hechos: string[]): number {
  const validos = new Set(hechos.filter(id => IDS_PLANOS.includes(id)))
  return IDS_PLANOS.length - validos.size
}

export function alternarPlano(hechos: string[], id: string): string[] {
  if (!IDS_PLANOS.includes(id)) return hechos
  return hechos.includes(id) ? hechos.filter(h => h !== id) : [...hechos, id]
}

/** Estado de la pieza tras cambiar sus planos: completar pasa a grabada; desmarcar una grabada la devuelve a para_grabar. */
export function estadoTrasPlanos(estado: EstadoPieza, hechos: string[]): EstadoPieza {
  const completa = planosPendientes(hechos) === 0
  if (estado === 'para_grabar' && completa) return 'grabada'
  if (estado === 'grabada' && !completa) return 'para_grabar'
  return estado
}

/** Planos tras cambiar el estado a mano: un vídeo grabado o posterior tiene la escaleta completa. */
export function planosTrasEstado(estado: EstadoPieza, hechos: string[]): string[] {
  return ESTADOS_GRABADOS.includes(estado) ? [...IDS_PLANOS] : hechos
}
