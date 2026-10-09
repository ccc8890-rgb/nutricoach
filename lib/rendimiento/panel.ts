// lib/rendimiento/panel.ts
// Datos del panel de rendimiento del coach: carga, forma, semanas, bienestar y evolución.
import { serieCarga, resumenCarga, type PuntoPmc, type ResumenCarga } from './pmc'
import { esCarrera } from './carga'

export interface EntrenoPanel {
  fecha: string
  tipo: string | null
  nombre: string | null
  duracion_s: number | null
  distancia_m: number | null
  ritmo_medio_s_km: number | null
  fc_media: number | null
  tss: number | null
  tss_metodo: string | null
  carga_garmin: number | null
  vo2max: number | null
  tiempo_zona_fc: number[] | null
  mejores_parciales: { s1000: number | null; s1609: number | null; s5000: number | null } | null
  raw: { gap_ms?: number | null } | null
}

export interface DiaBienestar {
  fecha: string
  hrv: number | null
  rhr: number | null
  readiness: number | null
  body_battery_max: number | null
  sueno_h: number | null
  stress_avg: number | null
}

export interface SemanaCarga {
  /** Lunes de la semana. */
  semana: string
  tss: number
  km: number
  sesiones: number
  minutos: number
}

export interface PanelRendimiento {
  serie: PuntoPmc[]
  resumen: ResumenCarga | null
  semanas: SemanaCarga[]
  bienestar: DiaBienestar[]
  /** Media de HRV de los últimos 28 días, con su banda de ±1 desviación. */
  hrvBase: { media: number; min: number; max: number } | null
  /** Mejores parciales (1 km y 5 km) de cada carrera con ese dato, para ver la evolución. */
  parciales: { fecha: string; s1000: number | null; s5000: number | null }[]
  /** Eficiencia aeróbica: m/min por latido en carreras continuas de 25+ min. Sube = más forma. */
  eficiencia: { fecha: string; valor: number }[]
  vo2max: { fecha: string; valor: number }[]
  entrenos: EntrenoPanel[]
}

export function lunesDe(fecha: string): string {
  const d = new Date(`${fecha}T12:00:00Z`)
  const dow = (d.getUTCDay() + 6) % 7 // lunes = 0
  d.setUTCDate(d.getUTCDate() - dow)
  return d.toISOString().slice(0, 10)
}

export function agruparSemanas(entrenos: EntrenoPanel[], semanasAtras: number, hoy: string): SemanaCarga[] {
  const porSemana = new Map<string, SemanaCarga>()
  for (const e of entrenos) {
    const s = lunesDe(e.fecha)
    const acc = porSemana.get(s) ?? { semana: s, tss: 0, km: 0, sesiones: 0, minutos: 0 }
    acc.tss += e.tss ?? 0
    acc.km += esCarrera(e.tipo) ? (e.distancia_m ?? 0) / 1000 : 0
    acc.sesiones += 1
    acc.minutos += (e.duracion_s ?? 0) / 60
    porSemana.set(s, acc)
  }
  const salida: SemanaCarga[] = []
  let cursor = lunesDe(hoy)
  for (let i = 0; i < semanasAtras; i++) {
    const a = porSemana.get(cursor) ?? { semana: cursor, tss: 0, km: 0, sesiones: 0, minutos: 0 }
    salida.unshift({ ...a, tss: Math.round(a.tss), km: Math.round(a.km * 10) / 10, minutos: Math.round(a.minutos) })
    const d = new Date(`${cursor}T12:00:00Z`)
    d.setUTCDate(d.getUTCDate() - 7)
    cursor = d.toISOString().slice(0, 10)
  }
  return salida
}

export function hrvBase(dias: DiaBienestar[]): PanelRendimiento['hrvBase'] {
  const v = dias.slice(-28).map(d => d.hrv).filter((x): x is number => typeof x === 'number')
  if (v.length < 7) return null
  const media = v.reduce((a, b) => a + b, 0) / v.length
  const desv = Math.sqrt(v.reduce((a, b) => a + (b - media) ** 2, 0) / v.length)
  const r = (n: number) => Math.round(n * 10) / 10
  return { media: r(media), min: r(media - desv), max: r(media + desv) }
}

export function construirPanel(
  entrenos: EntrenoPanel[],
  bienestar: DiaBienestar[],
  hoy: string,
  diasVista = 180,
): PanelRendimiento {
  const ordenados = [...entrenos].sort((a, b) => a.fecha.localeCompare(b.fecha))
  const primera = ordenados[0]?.fecha ?? hoy
  // La curva arranca en el primer entreno para que la forma "caliente" bien; se recorta a la vista pedida.
  const completa = serieCarga(ordenados.map(e => ({ fecha: e.fecha, tss: e.tss ?? 0 })), primera, hoy)
  const serie = completa.slice(-diasVista)

  const parciales = ordenados
    .filter(e => esCarrera(e.tipo) && (e.mejores_parciales?.s1000 || e.mejores_parciales?.s5000))
    .map(e => ({ fecha: e.fecha, s1000: e.mejores_parciales?.s1000 ?? null, s5000: e.mejores_parciales?.s5000 ?? null }))

  const eficiencia = ordenados
    .filter(e => esCarrera(e.tipo) && e.tipo !== 'treadmill_running' && (e.duracion_s ?? 0) >= 25 * 60 && e.fc_media && e.distancia_m)
    .map(e => {
      const ms = e.raw?.gap_ms ?? (e.distancia_m! / e.duracion_s!)
      return { fecha: e.fecha, valor: Math.round(((ms * 60) / e.fc_media!) * 1000) / 1000 }
    })

  return {
    serie,
    resumen: resumenCarga(completa),
    semanas: agruparSemanas(ordenados, 12, hoy),
    bienestar,
    hrvBase: hrvBase(bienestar),
    parciales,
    eficiencia,
    vo2max: ordenados.filter(e => e.vo2max).map(e => ({ fecha: e.fecha, valor: e.vo2max! })),
    entrenos: ordenados.slice(-25).reverse(),
  }
}
