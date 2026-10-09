// lib/rendimiento/vdot.ts
// VDOT estimado a partir de los esfuerzos reales (Daniels/Gilbert). Solo propone SUBIR el VDOT con evidencia:
// bajar el nivel por falta de carreras recientes no es una conclusión que los datos permitan.
import { esCarrera, type UmbralesAtleta } from './carga'
import type { VueltaEntreno } from './garmin-entrenos'

export interface EntrenoParaVdot {
  fecha: string
  tipo: string | null
  duracion_s: number | null
  distancia_m: number | null
  fc_media: number | null
  mejores_parciales: { s1000: number | null; s1609: number | null; s5000: number | null } | null
  vueltas: VueltaEntreno[] | null
}

/** VDOT para una marca de `distancia_m` en `tiempo_s` (fórmulas de Daniels y Gilbert, 1979). */
export function vdotDeMarca(distancia_m: number, tiempo_s: number): number | null {
  if (!(distancia_m > 0) || !(tiempo_s > 0)) return null
  const t = tiempo_s / 60
  const v = distancia_m / t // m/min
  const vo2 = -4.6 + 0.182258 * v + 0.000104 * v * v
  const fraccion = 0.8 + 0.1894393 * Math.exp(-0.012778 * t) + 0.2989558 * Math.exp(-0.1932605 * t)
  const vdot = vo2 / fraccion
  return Number.isFinite(vdot) ? Math.round(vdot * 10) / 10 : null
}

/** VDOT implícito en una velocidad de umbral (el ritmo de tempo corresponde al ~88 % del VO2max). */
export function vdotDeUmbral(velocidadMs: number | null): number | null {
  if (!velocidadMs || velocidadMs <= 0) return null
  const v = velocidadMs * 60
  const vo2 = -4.6 + 0.182258 * v + 0.000104 * v * v
  return Math.round((vo2 / 0.88) * 10) / 10
}

export interface EsfuerzoVdot {
  fecha: string
  descripcion: string
  distancia_m: number
  tiempo_s: number
  vdot: number
  /** Pulso medio de la salida respecto al pulso de umbral (1,00 = umbral). */
  intensidad: number
  diasAtras: number
}

const DIA = 86_400_000
const dias = (desde: string, hoy: string) => Math.round((new Date(`${hoy}T12:00:00Z`).getTime() - new Date(`${desde}T12:00:00Z`).getTime()) / DIA)
/** Una salida solo cuenta como esfuerzo si el pulso medio llegó al 93 % del pulso de umbral. */
const INTENSIDAD_MINIMA = 0.93
const MAX_DIAS = 180

/** Variación de velocidad entre vueltas por encima de la cual la salida no es continua (series con pausas). */
const CV_INTERVALOS = 0.15

function esDeIntervalos(e: EntrenoParaVdot): boolean {
  const vueltas = e.vueltas ?? []
  if (vueltas.filter(v => v.tipo === 'ACTIVE' || v.tipo === 'RECOVERY').length >= 3) return true
  // Series hechas con vueltas manuales: no llevan tipo de paso, pero el ritmo entre vueltas sube y baja mucho.
  const v = vueltas.filter(l => l.distancia_m >= 100 && l.duracion_s > 0).map(l => l.distancia_m / l.duracion_s)
  if (v.length < 5) return false
  const media = v.reduce((a, b) => a + b, 0) / v.length
  const desv = Math.sqrt(v.reduce((a, b) => a + (b - media) ** 2, 0) / v.length)
  return desv / media > CV_INTERVALOS
}

/** Esfuerzos de los que se puede sacar un VDOT fiable, del más reciente al más antiguo. */
export function esfuerzosVdot(entrenos: EntrenoParaVdot[], u: UmbralesAtleta, hoy: string): EsfuerzoVdot[] {
  if (!u.fcUmbral) return []
  const salida: EsfuerzoVdot[] = []
  for (const e of entrenos) {
    const atras = dias(e.fecha, hoy)
    if (atras < 0 || atras > MAX_DIAS) continue
    if (!esCarrera(e.tipo) || e.tipo === 'treadmill_running' || e.tipo === 'virtual_run') continue // en cinta no se fía la distancia
    if (!e.fc_media || !e.distancia_m || !e.duracion_s) continue
    const intensidad = e.fc_media / u.fcUmbral
    if (intensidad < INTENSIDAD_MINIMA || esDeIntervalos(e)) continue
    // Salida continua y exigente: vale la marca de toda la salida (3-30 km, 12-120 min)...
    if (e.distancia_m >= 3000 && e.distancia_m <= 30_000 && e.duracion_s >= 720 && e.duracion_s <= 7200) {
      const vdot = vdotDeMarca(e.distancia_m, e.duracion_s)
      if (vdot) salida.push({ fecha: e.fecha, descripcion: `${(e.distancia_m / 1000).toFixed(1)} km en ${Math.floor(e.duracion_s / 60)}:${String(Math.round(e.duracion_s % 60)).padStart(2, '0')}`, distancia_m: e.distancia_m, tiempo_s: e.duracion_s, vdot, intensidad: Math.round(intensidad * 100) / 100, diasAtras: atras })
    }
    // ...y, si fue más larga que 5,5 km, también su mejor tramo de 5 km.
    const s5 = e.mejores_parciales?.s5000
    if (s5 && e.distancia_m > 5500) {
      const vdot = vdotDeMarca(5000, s5)
      if (vdot) salida.push({ fecha: e.fecha, descripcion: `mejores 5 km en ${Math.floor(s5 / 60)}:${String(Math.round(s5 % 60)).padStart(2, '0')}`, distancia_m: 5000, tiempo_s: s5, vdot, intensidad: Math.round(intensidad * 100) / 100, diasAtras: atras })
    }
  }
  return salida.sort((a, b) => a.diasAtras - b.diasAtras)
}

export type Confianza = 'alta' | 'media' | 'baja'

export interface Recalibracion {
  vdotActual: number | null
  /** Mejor VDOT de los esfuerzos de los últimos 180 días, o null si no hay ninguno fiable. */
  vdotEstimado: number | null
  esfuerzos: EsfuerzoVdot[]
  /** Contraste con lo que mide Garmin (no decide, solo orienta). */
  contraste: { vdotUmbralGarmin: number | null }
  sugerencia: 'subir' | 'mantener' | 'sin_evidencia'
  propuesta: number | null
  confianza: Confianza | null
  motivo: string
}

export function recalibrar(vdotActual: number | null, entrenos: EntrenoParaVdot[], u: UmbralesAtleta, hoy: string): Recalibracion {
  const esfuerzos = esfuerzosVdot(entrenos, u, hoy)
  const contraste = { vdotUmbralGarmin: vdotDeUmbral(u.velUmbralMs) }
  if (!esfuerzos.length) {
    return { vdotActual, vdotEstimado: null, esfuerzos, contraste, sugerencia: 'sin_evidencia', propuesta: null, confianza: null, motivo: 'No hay salidas recientes y exigentes de las que sacar un VDOT fiable (se necesita pulso medio cerca del umbral, en continuo y fuera de cinta).' }
  }
  const mejor = esfuerzos.reduce((a, b) => (b.vdot > a.vdot ? b : a))
  const confianza: Confianza = mejor.diasAtras <= 42 && mejor.intensidad >= 1 ? 'alta' : mejor.diasAtras <= 90 ? 'media' : 'baja'
  const estimado = mejor.vdot
  const dif = vdotActual === null ? Infinity : estimado - vdotActual
  if (vdotActual === null || dif >= 1) {
    const propuesta = Math.round(estimado * 2) / 2 // a medio punto, para no aparentar precisión falsa
    return { vdotActual, vdotEstimado: estimado, esfuerzos, contraste, sugerencia: 'subir', propuesta, confianza, motivo: `Su mejor esfuerzo reciente (${mejor.descripcion}, ${mejor.fecha}) equivale a VDOT ${estimado}, por encima del ${vdotActual ?? 'actual'}.` }
  }
  return { vdotActual, vdotEstimado: estimado, esfuerzos, contraste, sugerencia: 'mantener', propuesta: null, confianza, motivo: dif <= -3 ? `Sus esfuerzos recientes dan VDOT ${estimado}, algo por debajo del actual; sin una prueba reciente a tope no hay base para bajarlo.` : 'Su VDOT actual concuerda con sus mejores esfuerzos recientes.' }
}
