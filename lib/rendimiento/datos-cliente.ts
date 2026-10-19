// lib/rendimiento/datos-cliente.ts
// Lo que ve el cliente en su pestaña «Datos»: recuperación, sueño, carga y base aeróbica, sin jerga y sin inventar lo que el reloj no mide.
import type { PanelRendimiento } from './panel'
import type { BaseAerobica } from './base-aerobica'
import type { ResumenCarga } from './pmc'
import type { ResumenIntensidad } from './intensidad'
import { deporteDe } from './deportes'
import { lunesDe } from './fechas'

export interface FilaReloj {
  fecha: string
  rhr: number | null
  hrv: number | null
  training_readiness: number | null
  body_battery_max: number | null
  stress_avg: number | null
  sueno_h: number | null
  sueno_calidad: number | null
  raw_data: Record<string, unknown> | null
}

export interface PuntoTendencia { fecha: string; valor: number }
export interface Tendencia {
  puntos: PuntoTendencia[]
  actual: number
  /** Rango habitual del propio atleta (media ± 1 desviación de los últimos 30 días). Null con pocos datos. */
  normal: { min: number; max: number } | null
  posicion: 'dentro' | 'sobre' | 'bajo' | null
}

export interface Recuperacion {
  fecha: string
  puntuacion: number
  nivel: 'baja' | 'moderada' | 'alta'
  /** Frase de Garmin traducida; null si el código no se conoce (no se inventa). */
  motivo: string | null
  hrvSemanal: number | null
  pulsoReposo: number | null
  bateriaMax: number | null
  estres: number | null
}

export interface DatosCliente {
  hoy: string
  tieneReloj: boolean
  recuperacion: Recuperacion | null
  tendencias: { preparacion: Tendencia | null; pulsoReposo: Tendencia | null }
  /** Solo si hay al menos 3 noches con datos en los últimos 14 días. */
  sueno: { noches: { fecha: string; horas: number; calidad: number | null }[]; mediaHoras: number } | null
  carga: { estado: string; semanas: { semana: string; tss: number; km: number }[]; semanaActual: { tss: number; km: number; sesiones: number } | null } | null
  baseAerobica: BaseAerobica
  /** Forma, fatiga y frescura (últimos 60 días) para la gráfica de carga. */
  forma: { serie: { fecha: string; ctl: number; atl: number; tsb: number }[]; resumen: ResumenCarga } | null
  /** Reparto suave/medio/duro de carrera en los últimos 28 días. */
  intensidad: ResumenIntensidad | null
  /** Batería corporal y estrés diarios (últimos 30 días con dato). */
  bienestar: { bateria: PuntoTendencia[]; estres: PuntoTendencia[] }
  vo2max: { actual: number; puntos: PuntoTendencia[] } | null
  /** Lunes a domingo de esta semana: minutos y sesiones por día. */
  semanaDias: { fecha: string; minutos: number; sesiones: number }[]
  /** Últimas sesiones, de la más reciente a la más antigua. */
  ultimosEntrenos: { fecha: string; nombre: string; deporte: string; minutos: number; km: number | null; fcMedia: number | null; carga: number | null }[]
}

const NIVEL: Record<string, Recuperacion['nivel']> = { LOW: 'baja', MODERATE: 'moderada', HIGH: 'alta' }

/** Frases de Garmin (training_readiness_feedback) que hemos visto; cualquier otra no se muestra. */
const MOTIVO: Record<string, string> = {
  RECOVERY_IN_PROGRESS: 'Tu cuerpo aún se está recuperando del último entreno.',
  WELL_RECOVERED: 'Estás bien recuperado.',
  BOOSTED_BY_GOOD_SLEEP: 'Dormir bien te ha dado un empujón.',
  GOOD_SLEEP_HISTORY: 'Tus últimas noches de sueño ayudan.',
}

const MIN_DIAS_NORMAL = 14

function tendencia(filas: FilaReloj[], campo: 'training_readiness' | 'rhr', dias = 30): Tendencia | null {
  const puntos = filas.flatMap(f => (f[campo] != null ? [{ fecha: f.fecha, valor: f[campo] as number }] : [])).slice(-dias)
  if (puntos.length < 3) return null
  const actual = puntos[puntos.length - 1].valor
  let normal: Tendencia['normal'] = null
  if (puntos.length >= MIN_DIAS_NORMAL) {
    const v = puntos.map(p => p.valor)
    const m = v.reduce((a, b) => a + b, 0) / v.length
    const sd = Math.sqrt(v.reduce((a, b) => a + (b - m) ** 2, 0) / v.length)
    normal = { min: Math.round(m - sd), max: Math.round(m + sd) }
  }
  const posicion = normal ? (actual > normal.max ? 'sobre' : actual < normal.min ? 'bajo' : 'dentro') : null
  return { puntos, actual, normal, posicion }
}

/** `filas`: días de Garmin Connect de más antiguo a más reciente. */
export function construirDatosCliente(panel: PanelRendimiento, filas: FilaReloj[], hoy: string): DatosCliente {
  const ultima = [...filas].reverse().find(f => f.training_readiness != null) ?? null
  const raw = ultima?.raw_data ?? {}
  const nivelRaw = typeof raw.training_readiness_level === 'string' ? raw.training_readiness_level : ''
  const motivoRaw = typeof raw.training_readiness_feedback === 'string' ? raw.training_readiness_feedback : ''
  const recuperacion: Recuperacion | null = ultima && NIVEL[nivelRaw]
    ? {
        fecha: ultima.fecha,
        puntuacion: ultima.training_readiness!,
        nivel: NIVEL[nivelRaw],
        motivo: MOTIVO[motivoRaw] ?? null,
        hrvSemanal: ultima.hrv,
        pulsoReposo: ultima.rhr,
        bateriaMax: ultima.body_battery_max,
        estres: ultima.stress_avg,
      }
    : null

  const desde14 = new Date(`${hoy}T12:00:00Z`).getTime() - 13 * 86_400_000
  const noches = filas
    .filter(f => f.sueno_h != null && f.sueno_h > 0 && new Date(`${f.fecha}T12:00:00Z`).getTime() >= desde14)
    .map(f => ({ fecha: f.fecha, horas: f.sueno_h as number, calidad: f.sueno_calidad }))
  const sueno = noches.length >= 3 ? { noches, mediaHoras: Math.round((noches.reduce((a, n) => a + n.horas, 0) / noches.length) * 10) / 10 } : null

  const semanas = panel.semanas.map(s => ({ semana: s.semana, tss: s.tss, km: s.km }))
  const actual = panel.semanas[panel.semanas.length - 1]
  const carga = panel.resumen
    ? { estado: panel.resumen.textoEstado, semanas, semanaActual: actual ? { tss: actual.tss, km: actual.km, sesiones: actual.sesiones } : null }
    : null

  const serieVar = (campo: 'body_battery_max' | 'stress_avg'): PuntoTendencia[] =>
    filas.flatMap(f => (f[campo] != null ? [{ fecha: f.fecha, valor: f[campo] as number }] : [])).slice(-30)

  const lunes = lunesDe(hoy)
  const semanaDias = Array.from({ length: 7 }, (_, i) => {
    const fecha = new Date(new Date(`${lunes}T12:00:00Z`).getTime() + i * 86_400_000).toISOString().slice(0, 10)
    const delDia = panel.entrenos.filter(e => e.fecha === fecha)
    return { fecha, minutos: Math.round(delDia.reduce((a, e) => a + (e.duracion_s ?? 0), 0) / 60), sesiones: delDia.length }
  })

  const vo2 = panel.vo2max.slice(-12)

  return {
    hoy,
    tieneReloj: filas.length > 0,
    recuperacion,
    tendencias: { preparacion: tendencia(filas, 'training_readiness'), pulsoReposo: tendencia(filas, 'rhr') },
    sueno,
    carga,
    baseAerobica: panel.baseAerobica,
    forma: panel.resumen && panel.serie.length >= 7
      ? { serie: panel.serie.slice(-60).map(p => ({ fecha: p.fecha, ctl: p.ctl, atl: p.atl, tsb: p.tsb })), resumen: panel.resumen }
      : null,
    intensidad: panel.intensidad.reciente.valoracion === 'sin_datos' ? null : panel.intensidad.reciente,
    bienestar: { bateria: serieVar('body_battery_max'), estres: serieVar('stress_avg') },
    vo2max: vo2.length ? { actual: vo2[vo2.length - 1].valor, puntos: vo2.map(v => ({ fecha: v.fecha, valor: v.valor })) } : null,
    semanaDias,
    ultimosEntrenos: panel.entrenos.slice(0, 6).map(e => ({
      fecha: e.fecha,
      nombre: e.nombre ?? 'Sesión',
      deporte: deporteDe(e.tipo),
      minutos: Math.round((e.duracion_s ?? 0) / 60),
      km: e.distancia_m ? Math.round(e.distancia_m / 100) / 10 : null,
      fcMedia: e.fc_media ? Math.round(e.fc_media) : null,
      carga: e.tss ? Math.round(e.tss) : null,
    })),
  }
}
