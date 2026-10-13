import { createHash } from 'node:crypto'
import { proximaFechaDia } from './proxima-fecha'
import { lunesDe, sumarDias } from './calendario-ajustes'

/** Huella de lo que se envía a Garmin: los pasos, el VDOT (cambian los ritmos), el techo de pulso suave y el nombre (que debe coincidir con el de la app). */
export function huellaPasos(pasos: unknown, vdot: number | null, techoFcE: number | null = null, nombre: string | null = null): string {
  const base = { pasos, vdot }
  // Sin pulso ni nombre conocidos la huella es la de siempre: no reenvía lo ya programado.
  return createHash('sha256').update(JSON.stringify({ ...base, ...(techoFcE ? { techoFcE } : {}), ...(nombre ? { nombre } : {}) })).digest('hex').slice(0, 16)
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
  /** Próxima fecha real de la sesión si el coach la movió en el calendario; por defecto, la de su día de la semana. */
  fechaReal?: string | null,
): { enviar: boolean; fecha: string | null } {
  const fecha = fechaReal !== undefined ? fechaReal : proximaFechaDia(s.dia_semana, ahora)
  if (!fecha) return { enviar: false, fecha: null }
  const alDia = !!s.garmin_workout_id && s.garmin_programado_fecha === fecha && s.garmin_pasos_hash === huellaActual
  return { enviar: !alDia, fecha }
}

export interface EstadoGarminMulti {
  garmin_workout_id: string | null
  garmin_programado_fecha: string | null
  garmin_fechas: string[] | null
  garmin_pasos_hash: string | null
}

export type PlanEnvioGarmin =
  | { accion: 'nada' }
  | { accion: 'borrar' }
  | { accion: 'recrear'; fechas: string[] }
  | { accion: 'anadir'; fechas: string[] }

/**
 * Decide qué hacer con una sesión de carrera en Garmin dadas las fechas en las que ocurre de verdad
 * (plantilla semanal + lo que el coach movió/copió/quitó) dentro del horizonte de envío.
 * - Si cambió el contenido, o hay una fecha programada que ya no toca: se recrea el entreno con todas las fechas.
 * - Si solo faltan fechas: se añaden al mismo entreno.
 */
export function planearEnvioGarmin(s: EstadoGarminMulti, huellaActual: string, deseadas: string[], hoy: string): PlanEnvioGarmin {
  const wanted = [...new Set(deseadas)].filter(f => f >= hoy).sort()
  const programadas = [...new Set([...(s.garmin_fechas ?? []), ...(s.garmin_programado_fecha ? [s.garmin_programado_fecha] : [])])].filter(f => f >= hoy)
  const existe = !!s.garmin_workout_id
  if (wanted.length === 0) return existe && programadas.length > 0 ? { accion: 'borrar' } : { accion: 'nada' }
  if (!existe || s.garmin_pasos_hash !== huellaActual) return { accion: 'recrear', fechas: wanted }
  if (programadas.some(f => !wanted.includes(f))) return { accion: 'recrear', fechas: wanted }
  const faltan = wanted.filter(f => !programadas.includes(f))
  return faltan.length ? { accion: 'anadir', fechas: faltan } : { accion: 'nada' }
}

/**
 * Hasta qué fecha se deja programado el calendario de Garmin: el domingo de dentro de dos semanas
 * (esta semana + las dos siguientes). Así el atleta y el coach ven lo próximo con margen,
 * y si un envío falla el cron lo reintenta cada día antes de que llegue la fecha.
 */
export function finHorizonteEnvio(hoy: string): string {
  return sumarDias(lunesDe(hoy), 20)
}
