import { BLOQUES_SESION, type TipoBloqueSesion } from './session-blocks'

type ActualizacionBloqueInput = {
  solicitado: unknown
  coachId: string
  propietarioId: string | null
}

type ResultadoActualizacionBloque =
  | { ok: true; bloque: TipoBloqueSesion }
  | { ok: false; status: 400 | 403; error: string }

export function resolverActualizacionBloque(input: ActualizacionBloqueInput): ResultadoActualizacionBloque {
  if (typeof input.solicitado !== 'string' || !BLOQUES_SESION.includes(input.solicitado as TipoBloqueSesion)) {
    return { ok: false, status: 400, error: 'Bloque no válido' }
  }
  if (input.coachId !== input.propietarioId) {
    return { ok: false, status: 403, error: 'Sin acceso' }
  }
  return { ok: true, bloque: input.solicitado as TipoBloqueSesion }
}
