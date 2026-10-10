// lib/rendimiento/tecnica.ts
// Técnica de carrera (cadencia, zancada, contacto con el suelo, oscilación vertical) y su evolución a igual ritmo.
import { esCarrera } from './carga'
import type { VueltaEntreno } from './garmin-entrenos'

/** Carreras de menos de esto no entran: el calentamiento pesa demasiado en la media. */
const SEGUNDOS_MINIMOS = 20 * 60
const METROS_MINIMOS = 3000
/** Fuera de este rango de ritmo (s/km) el dato casi seguro es erróneo (GPS, cinta, andar). */
const RITMO_MIN = 200
const RITMO_MAX = 480
/** Puntos mínimos en cada ventana para dar una comparación. */
const PUNTOS_MINIMOS = 4
const VENTANA_RECIENTE_DIAS = 42
const VENTANA_PREVIA_DIAS = 120

export interface EntrenoTecnica {
  fecha: string
  tipo: string | null
  duracion_s: number | null
  distancia_m: number | null
  ritmo_medio_s_km: number | null
  raw: {
    cadencia?: number | null
    zancada_m?: number | null
    contacto_suelo_ms?: number | null
    oscilacion_vertical_cm?: number | null
  } | null
  vueltas?: VueltaEntreno[] | null
}

export interface PuntoTecnica {
  fecha: string
  ritmo_s_km: number
  cadencia: number
  /** Garmin lo guarda como `zancada_m` pero el valor está en centímetros (p. ej. 110). */
  zancada_cm: number
  contacto_ms: number
  oscilacion_cm: number
  /** Oscilación / zancada en %: cuánto de cada paso se «gasta» subiendo. Menos es mejor. */
  ratio_vertical: number
}

export type MetricaTecnica = 'cadencia' | 'zancada_cm' | 'contacto_ms' | 'ratio_vertical'

export interface ComparacionMetrica {
  /** Valor esperado al ritmo de referencia en la ventana reciente. */
  reciente: number
  /** Idem en la ventana previa. */
  previo: number
  /** reciente − previo, a igual ritmo. */
  delta: number
}

export interface ResumenTecnica {
  /** Ritmo (s/km) al que se comparan las dos ventanas: la mediana de las carreras analizadas. */
  ritmoReferencia: number
  carrerasRecientes: number
  carrerasPrevias: number
  metricas: Record<MetricaTecnica, ComparacionMetrica>
}

const num = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v) && v > 0

/** True si el entreno tiene recuperaciones entre varias repeticiones (series): su media no refleja una técnica continua. */
function esSeries(vueltas: VueltaEntreno[] | null | undefined): boolean {
  if (!Array.isArray(vueltas)) return false
  const trabajo = vueltas.filter(l => l.tipo === 'ACTIVE' || l.tipo === 'INTERVAL').length
  return trabajo >= 3 && vueltas.some(l => l.tipo === 'RECOVERY')
}

export function puntosTecnica(entrenos: EntrenoTecnica[]): PuntoTecnica[] {
  const puntos: PuntoTecnica[] = []
  for (const e of entrenos) {
    if (!esCarrera(e.tipo) || e.tipo === 'treadmill_running') continue
    if ((e.duracion_s ?? 0) < SEGUNDOS_MINIMOS || (e.distancia_m ?? 0) < METROS_MINIMOS) continue
    const ritmo = e.ritmo_medio_s_km
    if (!num(ritmo) || ritmo < RITMO_MIN || ritmo > RITMO_MAX) continue
    if (esSeries(e.vueltas)) continue
    const r = e.raw
    if (!r || !num(r.cadencia) || !num(r.zancada_m) || !num(r.contacto_suelo_ms) || !num(r.oscilacion_vertical_cm)) continue
    puntos.push({
      fecha: e.fecha,
      ritmo_s_km: ritmo,
      cadencia: r.cadencia,
      zancada_cm: r.zancada_m,
      contacto_ms: r.contacto_suelo_ms,
      oscilacion_cm: r.oscilacion_vertical_cm,
      ratio_vertical: (r.oscilacion_vertical_cm / r.zancada_m) * 100,
    })
  }
  return puntos.sort((a, b) => a.fecha.localeCompare(b.fecha))
}

/** Regresión lineal simple y = a + b·x. Si no hay variación en x, devuelve la media con pendiente 0. */
function ajusteLineal(xs: number[], ys: number[]): { a: number; b: number } {
  const n = xs.length
  const mx = xs.reduce((s, v) => s + v, 0) / n
  const my = ys.reduce((s, v) => s + v, 0) / n
  const sxx = xs.reduce((s, v) => s + (v - mx) ** 2, 0)
  if (sxx === 0) return { a: my, b: 0 }
  const b = xs.reduce((s, v, i) => s + (v - mx) * (ys[i] - my), 0) / sxx
  return { a: my - b * mx, b }
}

const mediana = (v: number[]) => {
  const s = [...v].sort((x, y) => x - y)
  const m = Math.floor(s.length / 2)
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2
}

function diasEntre(a: string, b: string): number {
  return Math.round((new Date(`${b}T12:00:00Z`).getTime() - new Date(`${a}T12:00:00Z`).getTime()) / 86_400_000)
}

/**
 * Compara la técnica de las últimas 6 semanas con la de los 4 meses anteriores **al mismo ritmo**:
 * se ajusta cada métrica contra el ritmo con todas las carreras y se mira cuánto se desvían de esa recta las de cada ventana.
 * Devuelve null si alguna ventana tiene menos de 4 carreras.
 */
export function resumenTecnica(puntos: PuntoTecnica[], hoy: string): ResumenTecnica | null {
  const recientes = puntos.filter(p => diasEntre(p.fecha, hoy) >= 0 && diasEntre(p.fecha, hoy) <= VENTANA_RECIENTE_DIAS)
  const previas = puntos.filter(p => {
    const d = diasEntre(p.fecha, hoy)
    return d > VENTANA_RECIENTE_DIAS && d <= VENTANA_RECIENTE_DIAS + VENTANA_PREVIA_DIAS
  })
  if (recientes.length < PUNTOS_MINIMOS || previas.length < PUNTOS_MINIMOS) return null

  const usadas = [...recientes, ...previas]
  const ritmoReferencia = Math.round(mediana(usadas.map(p => p.ritmo_s_km)))
  const xs = usadas.map(p => p.ritmo_s_km)

  const comparar = (valor: (p: PuntoTecnica) => number): ComparacionMetrica => {
    const { a, b } = ajusteLineal(xs, usadas.map(valor))
    const residuoMedio = (ps: PuntoTecnica[]) => ps.reduce((s, p) => s + (valor(p) - (a + b * p.ritmo_s_km)), 0) / ps.length
    const base = a + b * ritmoReferencia
    const reciente = base + residuoMedio(recientes)
    const previo = base + residuoMedio(previas)
    return { reciente: redondear(reciente), previo: redondear(previo), delta: redondear(reciente - previo) }
  }

  return {
    ritmoReferencia,
    carrerasRecientes: recientes.length,
    carrerasPrevias: previas.length,
    metricas: {
      cadencia: comparar(p => p.cadencia),
      zancada_cm: comparar(p => p.zancada_cm),
      contacto_ms: comparar(p => p.contacto_ms),
      ratio_vertical: comparar(p => p.ratio_vertical),
    },
  }
}

const redondear = (n: number) => Math.round(n * 10) / 10
