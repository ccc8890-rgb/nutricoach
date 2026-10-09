import { createHash } from 'node:crypto'
import { proximaFechaDia } from './proxima-fecha'

/** Huella de lo que se envía a Garmin: los pasos y el VDOT (cambian los ritmos). */
export function huellaPasos(pasos: unknown, vdot: number | null): string {
  return createHash('sha256').update(JSON.stringify({ pasos, vdot })).digest('hex').slice(0, 16)
}

export interface EstadoGarminSesion {
  dia_semana: string | null
  garmin_workout_id: string | null
  garmin_programado_fecha: string | null
  garmin_pasos_hash: string | null
}

/**
 * Decide si hay que (re)enviar la sesión a Garmin. Cada sesión es semanal, así que
 * la fecha objetivo es siempre su próxima ocurrencia (hoy incluido), dentro de 7 días.
 */
export function decidirEnvio(
  s: EstadoGarminSesion,
  huellaActual: string,
  ahora: Date = new Date(),
): { enviar: boolean; fecha: string | null } {
  const fecha = proximaFechaDia(s.dia_semana, ahora)
  if (!fecha) return { enviar: false, fecha: null }
  const alDia = !!s.garmin_workout_id && s.garmin_programado_fecha === fecha && s.garmin_pasos_hash === huellaActual
  return { enviar: !alDia, fecha }
}
