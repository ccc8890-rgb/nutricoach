// lib/rendimiento/fit-actividad.ts
// Lee un archivo .fit (el formato estándar de ciclocomputadores y relojes) y lo convierte en una fila de entrenos_realizados.
import { Decoder, Stream } from '@garmin/fitsdk'
import { calcularTss, tssDe, type UmbralesAtleta, type MetodoTss } from './carga'
import type { VueltaEntreno } from './garmin-entrenos'

/* eslint-disable @typescript-eslint/no-explicit-any */
type Mesg = Record<string, any>

/** Errores pensados para enseñar al usuario tal cual. */
export class ErrorFit extends Error {}

export interface ActividadFit {
  inicio: Date
  /** Mismo vocabulario que Garmin Connect (cycling, indoor_cycling, running, lap_swimming…). */
  tipo: string
  duracion_s: number
  distancia_m: number | null
  fc_media: number | null
  fc_max: number | null
  potencia_media: number | null
  potencia_max: number | null
  potencia_normalizada: number | null
  cadencia_media: number | null
  desnivel_m: number | null
  trabajo_kj: number | null
  vueltas: VueltaEntreno[]
}

const num = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) ? v : null)
const positivo = (v: unknown): number | null => { const n = num(v); return n !== null && n > 0 ? n : null }

/** Tipo de actividad en el vocabulario de Garmin Connect a partir de deporte y subdeporte del FIT. */
export function tipoDesdeFit(sport: unknown, subSport: unknown): string {
  const d = String(sport ?? '').toLowerCase()
  const sub = String(subSport ?? '').toLowerCase()
  if (d === 'cycling' || d === 'e_biking') {
    if (sub.includes('indoor') || sub.includes('virtual') || sub.includes('spin')) return 'indoor_cycling'
    if (sub.includes('mountain')) return 'mountain_biking'
    if (sub.includes('gravel')) return 'gravel_cycling'
    return 'cycling'
  }
  if (d === 'running') return sub.includes('treadmill') ? 'treadmill_running' : sub.includes('trail') ? 'trail_running' : sub.includes('track') ? 'track_running' : 'running'
  if (d === 'swimming') return sub.includes('open_water') ? 'open_water_swimming' : 'lap_swimming'
  if (d === 'training') return sub.includes('strength') ? 'strength_training' : 'hiit'
  return d || 'otros'
}

/** Potencia normalizada (Coggan): media de la 4ª potencia de la media móvil de 30 s, a 1 muestra por segundo. */
export function potenciaNormalizada(registros: { t: number; w: number }[]): number | null {
  if (registros.length < 60) return null
  const t0 = registros[0].t
  const largo = Math.floor(registros[registros.length - 1].t - t0) + 1
  if (largo < 60) return null
  // Muestra por segundo: mantiene el último valor hasta 10 s de hueco; más allá cuenta como 0 (parada).
  const serie = new Array<number>(largo).fill(0)
  let i = 0
  let ultimo = 0
  let desde = t0
  for (let s = 0; s < largo; s++) {
    while (i < registros.length && registros[i].t - t0 <= s) { ultimo = registros[i].w; desde = registros[i].t; i++ }
    serie[s] = s + t0 - desde <= 10 ? ultimo : 0
  }
  let suma = 0
  let n = 0
  let acum = 0
  for (let s = 0; s < largo; s++) {
    acum += serie[s]
    if (s >= 30) acum -= serie[s - 30]
    if (s >= 29) { const m = acum / 30; suma += m ** 4; n++ }
  }
  return n ? Math.round((suma / n) ** 0.25) : null
}

export function leerActividadFit(datos: Uint8Array | Buffer): ActividadFit {
  let messages: Mesg
  try {
    const decoder = new Decoder(Stream.fromBuffer(Buffer.from(datos)))
    if (!decoder.isFIT()) throw new ErrorFit('El archivo no es un .fit válido.')
    if (!decoder.checkIntegrity()) throw new ErrorFit('El archivo .fit está dañado o incompleto.')
    const r = decoder.read()
    messages = r.messages
  } catch (e) {
    if (e instanceof ErrorFit) throw e
    throw new ErrorFit('No se pudo leer el archivo .fit.')
  }

  const sesion: Mesg | undefined = (messages.sessionMesgs ?? [])[0]
  const registros: Mesg[] = messages.recordMesgs ?? []
  if (!sesion) throw new ErrorFit('El .fit no contiene ninguna sesión de entreno.')

  const inicio: Date | null = sesion.startTime instanceof Date ? sesion.startTime : registros[0]?.timestamp instanceof Date ? registros[0].timestamp : null
  if (!inicio) throw new ErrorFit('El .fit no indica cuándo empezó el entreno.')
  const duracion = positivo(sesion.totalTimerTime) ?? positivo(sesion.totalElapsedTime)
  if (!duracion) throw new ErrorFit('El .fit no tiene duración.')

  const potencias = registros.filter(r => r.timestamp instanceof Date && num(r.power) !== null).map(r => ({ t: r.timestamp.getTime() / 1000, w: r.power as number }))
  const mediaPotencia = positivo(sesion.avgPower) ?? (potencias.length ? Math.round(potencias.reduce((a, p) => a + p.w, 0) / potencias.length) : null)
  const np = positivo(sesion.normalizedPower) ?? potenciaNormalizada(potencias)
  const fcRegistros = registros.map(r => num(r.heartRate)).filter((v): v is number => v !== null && v > 0)

  const vueltas: VueltaEntreno[] = (messages.lapMesgs ?? [])
    .map((l: Mesg): VueltaEntreno | null => {
      const dur = positivo(l.totalTimerTime) ?? positivo(l.totalElapsedTime)
      if (!dur) return null
      const dist = num(l.totalDistance) ?? 0
      return {
        tipo: null,
        paso: null,
        distancia_m: Math.round(dist),
        duracion_s: Math.round(dur * 10) / 10,
        fc_media: positivo(l.avgHeartRate),
        velocidad_ms: positivo(l.enhancedAvgSpeed) ?? positivo(l.avgSpeed) ?? (dist > 0 ? Math.round((dist / dur) * 1000) / 1000 : null),
        potencia_media: positivo(l.avgPower),
      }
    })
    .filter((v: VueltaEntreno | null): v is VueltaEntreno => v !== null)

  return {
    inicio,
    tipo: tipoDesdeFit(sesion.sport, sesion.subSport),
    duracion_s: Math.round(duracion),
    distancia_m: positivo(sesion.totalDistance),
    fc_media: positivo(sesion.avgHeartRate) ?? (fcRegistros.length ? Math.round(fcRegistros.reduce((a, b) => a + b, 0) / fcRegistros.length) : null),
    fc_max: positivo(sesion.maxHeartRate) ?? (fcRegistros.length ? Math.max(...fcRegistros) : null),
    potencia_media: mediaPotencia,
    potencia_max: positivo(sesion.maxPower),
    potencia_normalizada: np,
    cadencia_media: positivo(sesion.avgCadence),
    desnivel_m: positivo(sesion.totalAscent),
    trabajo_kj: positivo(sesion.totalWork) !== null ? Math.round((sesion.totalWork as number) / 1000) : null,
    vueltas,
  }
}

/** Fecha y hora locales (Madrid) de un instante, en el formato de entrenos_realizados. */
export function fechaLocalMadrid(d: Date): { fecha: string; inicio_local: string } {
  const partes = Object.fromEntries(
    new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Madrid', hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' })
      .formatToParts(d).map(p => [p.type, p.value]),
  )
  const fecha = `${partes.year}-${partes.month}-${partes.day}`
  return { fecha, inicio_local: `${fecha}T${partes.hour}:${partes.minute}:${partes.second}` }
}

/** Fila lista para entrenos_realizados. Con potencia y FTP la carga sale de la potencia; si no, del pulso. */
export function mapearActividadFit(a: ActividadFit, clienteId: string, u: UmbralesAtleta, ftp: number | null, nombre?: string) {
  const { fecha, inicio_local } = fechaLocalMadrid(a.inicio)
  const velocidad = a.distancia_m && a.duracion_s > 0 ? a.distancia_m / a.duracion_s : null
  let tss: { tss: number; metodo: MetodoTss } | null = null
  if (a.potencia_normalizada && ftp && ftp > 0) {
    tss = { tss: Math.round(tssDe(a.duracion_s / 3600, a.potencia_normalizada / ftp) * 10) / 10, metodo: 'potencia' }
  } else {
    tss = calcularTss({ tipo: a.tipo, duracion_s: a.duracion_s, velocidadMs: velocidad, fc_media: a.fc_media, tiempo_zona_fc: null }, u)
  }
  return {
    cliente_id: clienteId,
    fuente: 'fit_manual',
    actividad_id: `${Math.round(a.inicio.getTime() / 1000)}-${a.duracion_s}`,
    fecha,
    inicio_local,
    tipo: a.tipo,
    nombre: nombre ?? null,
    duracion_s: a.duracion_s,
    distancia_m: a.distancia_m !== null ? Math.round(a.distancia_m * 10) / 10 : null,
    ritmo_medio_s_km: velocidad && velocidad > 0 && /running/.test(a.tipo) ? Math.round((1000 / velocidad) * 10) / 10 : null,
    fc_media: a.fc_media ? Math.round(a.fc_media) : null,
    fc_max: a.fc_max ? Math.round(a.fc_max) : null,
    desnivel_m: a.desnivel_m,
    tss: tss?.tss ?? null,
    tss_metodo: tss?.metodo ?? null,
    vueltas: a.vueltas,
    raw: {
      origen: 'fit',
      potencia_media: a.potencia_media,
      potencia_normalizada: a.potencia_normalizada,
      potencia_max: a.potencia_max,
      cadencia_ciclismo: /cycling|biking/.test(a.tipo) ? a.cadencia_media : null,
      trabajo_kj: a.trabajo_kj,
      ftp_usado: ftp,
      vueltas: a.vueltas.length,
    },
  }
}
