import { normalizarBloqueSesion, type TipoBloqueSesion } from './session-blocks'

export function bloqueEjercicioGenerado(value: unknown): TipoBloqueSesion {
  return normalizarBloqueSesion(value)
}
