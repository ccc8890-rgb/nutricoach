import { createHmac, timingSafeEqual } from 'node:crypto'

/**
 * `state` de OAuth firmado (HMAC-SHA256) con caducidad. Antes era un JSON en base64 sin firmar:
 * cualquiera podía fabricar un callback con el clienteId de otra persona.
 * Secreto: INTEGRACIONES_STATE_SECRET, o la service role key como respaldo (solo servidor).
 */
const TTL_MS = 15 * 60 * 1000

function secreto(): string {
  const s = process.env.INTEGRACIONES_STATE_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!s) throw new Error('Falta INTEGRACIONES_STATE_SECRET')
  return s
}

const firma = (cuerpo: string) => createHmac('sha256', secreto()).update(cuerpo).digest('base64url')

export function firmarState(payload: Record<string, string | null | undefined>): string {
  const cuerpo = Buffer.from(JSON.stringify({ ...payload, exp: Date.now() + TTL_MS })).toString('base64url')
  return `${cuerpo}.${firma(cuerpo)}`
}

/** Devuelve el payload si la firma es válida y no ha caducado; lanza error en caso contrario. */
export function leerState<T extends Record<string, string>>(state: string): T {
  const [cuerpo, sig] = state.split('.')
  if (!cuerpo || !sig) throw new Error('state inválido')
  const esperada = Buffer.from(firma(cuerpo)), recibida = Buffer.from(sig)
  if (esperada.length !== recibida.length || !timingSafeEqual(esperada, recibida)) throw new Error('firma inválida')
  const { exp, ...resto } = JSON.parse(Buffer.from(cuerpo, 'base64url').toString())
  if (typeof exp !== 'number' || exp < Date.now()) throw new Error('state caducado')
  return resto as T
}
