// lib/rendimiento/pmc.ts
// Performance Management Chart (Banister / Coggan): forma (CTL), fatiga (ATL) y frescura (TSB).

export interface DiaCarga {
  fecha: string // YYYY-MM-DD
  tss: number
}

export interface PuntoPmc {
  fecha: string
  tss: number
  ctl: number
  atl: number
  /** Frescura del día: forma de ayer menos fatiga de ayer (como TrainingPeaks). */
  tsb: number
}

export const CONSTANTE_CTL = 42
export const CONSTANTE_ATL = 7

function sumarDias(fecha: string, n: number): string {
  const d = new Date(`${fecha}T12:00:00Z`)
  d.setUTCDate(d.getUTCDate() + n)
  return d.toISOString().slice(0, 10)
}

const redondear = (n: number) => Math.round(n * 10) / 10

/** Serie diaria continua entre `desde` y `hasta` (ambos incluidos); los días sin entreno cuentan 0. */
export function serieCarga(dias: DiaCarga[], desde: string, hasta: string): PuntoPmc[] {
  const porFecha = new Map<string, number>()
  for (const d of dias) porFecha.set(d.fecha, (porFecha.get(d.fecha) ?? 0) + d.tss)

  const serie: PuntoPmc[] = []
  let ctl = 0
  let atl = 0
  for (let f = desde; f <= hasta; f = sumarDias(f, 1)) {
    const tss = porFecha.get(f) ?? 0
    const tsb = ctl - atl
    ctl = ctl + (tss - ctl) / CONSTANTE_CTL
    atl = atl + (tss - atl) / CONSTANTE_ATL
    serie.push({ fecha: f, tss: redondear(tss), ctl: redondear(ctl), atl: redondear(atl), tsb: redondear(tsb) })
  }
  return serie
}

export type EstadoForma = 'transicion' | 'fresco' | 'neutral' | 'productivo' | 'sobrecarga'

export function estadoForma(tsb: number): { estado: EstadoForma; texto: string } {
  if (tsb > 25) return { estado: 'transicion', texto: 'Muy descansado: se está perdiendo forma' }
  if (tsb > 5) return { estado: 'fresco', texto: 'Fresco: buen momento para competir' }
  if (tsb > -10) return { estado: 'neutral', texto: 'Equilibrado' }
  if (tsb > -30) return { estado: 'productivo', texto: 'Carga productiva: se construye forma' }
  return { estado: 'sobrecarga', texto: 'Sobrecarga: riesgo de fatiga o lesión' }
}

export interface ResumenCarga {
  ctl: number
  atl: number
  tsb: number
  /** Cambio de forma en los últimos 7 días. Por encima de ~8 es subir deprisa. */
  rampa7: number
  carga7d: number
  carga28d: number
  /** Foster: media / desviación de la carga diaria en 7 días. Alta (>2) = poca variación. */
  monotonia: number | null
  /** Foster: carga semanal × monotonía. */
  tension: number | null
  estado: EstadoForma
  textoEstado: string
}

export function resumenCarga(serie: PuntoPmc[]): ResumenCarga | null {
  if (!serie.length) return null
  const hoy = serie[serie.length - 1]
  const hace7 = serie[serie.length - 8] ?? serie[0]
  const ult7 = serie.slice(-7).map(p => p.tss)
  const ult28 = serie.slice(-28).map(p => p.tss)
  const suma = (a: number[]) => a.reduce((x, y) => x + y, 0)
  const media = suma(ult7) / ult7.length
  const desv = Math.sqrt(suma(ult7.map(x => (x - media) ** 2)) / ult7.length)
  const monotonia = desv > 0 ? media / desv : null
  // El estado se juzga con la frescura de mañana (forma y fatiga tras hoy).
  const tsbActual = hoy.ctl - hoy.atl
  const { estado, texto } = estadoForma(tsbActual)
  return {
    ctl: hoy.ctl,
    atl: hoy.atl,
    tsb: redondear(tsbActual),
    rampa7: redondear(hoy.ctl - hace7.ctl),
    carga7d: redondear(suma(ult7)),
    carga28d: redondear(suma(ult28)),
    monotonia: monotonia === null ? null : redondear(monotonia),
    tension: monotonia === null ? null : Math.round(suma(ult7) * monotonia),
    estado,
    textoEstado: texto,
  }
}
