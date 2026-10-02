/**
 * Código público de planes/cuestionarios. Actúa como secreto compartido en enlaces, así que debe ser
 * impredecible: crypto (no Math.random) y 16 caracteres base62 (~95 bits). Antes: Math.random de 8 chars
 * o randomUUID().slice(0, 10) (~36 bits).
 */
const CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'

export function generarCodigoPublico(longitud = 16): string {
  const bytes = new Uint8Array(longitud)
  crypto.getRandomValues(bytes)
  // 256 % 62 = 8: se descartan los bytes >= 248 para que no haya sesgo hacia los primeros caracteres
  let out = ''
  for (const b of bytes) if (b < 248) out += CHARS[b % 62]
  return out.length >= longitud ? out.slice(0, longitud) : out + generarCodigoPublico(longitud - out.length)
}
