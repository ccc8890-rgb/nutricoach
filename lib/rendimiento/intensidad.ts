// lib/rendimiento/intensidad.ts
// Distribución de intensidad (modelo de 3 zonas de Seiler) a partir del tiempo en cada zona de pulso de Garmin.
import { esCarrera } from './carga'
import { lunesDe } from './fechas'

/** Tiempo en segundos por intensidad: suave = zonas 1-2, media = zona 3, dura = zonas 4-5 de Garmin. */
export interface TiempoIntensidad { suave: number; media: number; dura: number }

export interface SemanaIntensidad extends TiempoIntensidad {
  /** Lunes de la semana. */
  semana: string
}

export type ValoracionIntensidad = 'sin_datos' | 'bien' | 'zona_gris' | 'muy_duro' | 'mejorable'

export interface ResumenIntensidad {
  /** Minutos con datos de pulso en la ventana. */
  minutos: number
  pctSuave: number
  pctMedia: number
  pctDura: number
  valoracion: ValoracionIntensidad
}

export interface DistribucionIntensidad {
  /** Últimas 12 semanas, de la más antigua a la actual. */
  semanas: SemanaIntensidad[]
  /** Últimos 28 días. */
  reciente: ResumenIntensidad
  /** Los 56 días anteriores a esos 28. */
  previo: ResumenIntensidad
}

export interface EntrenoIntensidad {
  fecha: string
  tipo: string | null
  tiempo_zona_fc: number[] | null
}

/** Con menos tiempo que esto con pulso, la distribución no es representativa. */
const MINUTOS_MINIMOS = 60
const SEMANAS = 12

function sumaZonas(z: number[] | null): TiempoIntensidad | null {
  if (!Array.isArray(z) || z.length < 5) return null
  const [z1, z2, z3, z4, z5] = z.map(v => (typeof v === 'number' && v > 0 ? v : 0))
  if (z1 + z2 + z3 + z4 + z5 <= 0) return null
  return { suave: z1 + z2, media: z3, dura: z4 + z5 }
}

export function valorarIntensidad(pctSuave: number, pctMedia: number, pctDura: number): ValoracionIntensidad {
  if (pctSuave >= 75) return 'bien'
  if (pctMedia >= 30) return 'zona_gris'
  if (pctDura > 25) return 'muy_duro'
  return 'mejorable'
}

function resumir(t: TiempoIntensidad): ResumenIntensidad {
  const total = t.suave + t.media + t.dura
  if (total < MINUTOS_MINIMOS * 60) return { minutos: Math.round(total / 60), pctSuave: 0, pctMedia: 0, pctDura: 0, valoracion: 'sin_datos' }
  const pct = (s: number) => Math.round((s / total) * 100)
  const pctSuave = pct(t.suave)
  const pctMedia = pct(t.media)
  // La dura se calcula por diferencia para que los tres sumen siempre 100.
  const pctDura = 100 - pctSuave - pctMedia
  return { minutos: Math.round(total / 60), pctSuave, pctMedia, pctDura, valoracion: valorarIntensidad(pctSuave, pctMedia, pctDura) }
}

function diasEntre(a: string, b: string): number {
  return Math.round((new Date(`${b}T12:00:00Z`).getTime() - new Date(`${a}T12:00:00Z`).getTime()) / 86_400_000)
}

export function distribucionIntensidad(entrenos: EntrenoIntensidad[], hoy: string): DistribucionIntensidad {
  const vacio = (): TiempoIntensidad => ({ suave: 0, media: 0, dura: 0 })
  const reciente = vacio()
  const previo = vacio()
  const porSemana = new Map<string, TiempoIntensidad>()

  for (const e of entrenos) {
    if (!esCarrera(e.tipo)) continue
    const t = sumaZonas(e.tiempo_zona_fc)
    const d = diasEntre(e.fecha, hoy)
    if (!t || d < 0) continue
    const destino = d < 28 ? reciente : d < 84 ? previo : null
    if (destino) { destino.suave += t.suave; destino.media += t.media; destino.dura += t.dura }
    const s = lunesDe(e.fecha)
    const acc = porSemana.get(s) ?? vacio()
    acc.suave += t.suave; acc.media += t.media; acc.dura += t.dura
    porSemana.set(s, acc)
  }

  const semanas: SemanaIntensidad[] = []
  let cursor = lunesDe(hoy)
  for (let i = 0; i < SEMANAS; i++) {
    const a = porSemana.get(cursor) ?? vacio()
    semanas.unshift({ semana: cursor, suave: Math.round(a.suave), media: Math.round(a.media), dura: Math.round(a.dura) })
    const f = new Date(`${cursor}T12:00:00Z`)
    f.setUTCDate(f.getUTCDate() - 7)
    cursor = f.toISOString().slice(0, 10)
  }

  return { semanas, reciente: resumir(reciente), previo: resumir(previo) }
}
