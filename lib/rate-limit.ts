/**
 * Rate limiter en memoria. Suficiente para un SaaS de coach individual.
 * Se resetea en cold starts de Vercel, lo que es aceptable para este volumen.
 */

interface Bucket {
  count: number
  resetAt: number
}

const buckets = new Map<string, Bucket>()

/**
 * Verifica si una clave ha superado el límite en la ventana de tiempo.
 * @param key     Identificador único (ej: `userId:endpoint`)
 * @param max     Máximo de llamadas permitidas en la ventana
 * @param windowMs Ventana de tiempo en milisegundos
 * @returns true si está dentro del límite, false si lo supera
 */
export function rateLimit(key: string, max: number, windowMs: number): boolean {
  const now = Date.now()
  const bucket = buckets.get(key)

  if (!bucket || now > bucket.resetAt) {
    buckets.set(key, { count: 1, resetAt: now + windowMs })
    return true
  }

  if (bucket.count >= max) return false

  bucket.count++
  return true
}
