// lib/entrenos/pasos.ts
import { formatearRitmo, type Ritmos, type ZonaRitmo } from './ritmos'

export type Duracion =
  | { unidad: 'metros' | 'segundos'; valor: number }
  | { unidad: 'lap' }

export type Objetivo =
  | { tipo: 'zona'; zona: ZonaRitmo }
  | { tipo: 'ritmo'; min_seg_km: number; max_seg_km: number }
  | { tipo: 'fc'; min: number; max: number }
  | { tipo: 'rpe'; valor: number }

export type TipoPasoSimple = 'calentamiento' | 'trabajo' | 'recuperacion' | 'enfriamiento'

export interface PasoSimple {
  tipo: TipoPasoSimple
  duracion: Duracion
  objetivo?: Objetivo
  nota?: string
}
export interface PasoRepetir {
  tipo: 'repetir'
  veces: number
  pasos: PasoSimple[]
}
export type Paso = PasoSimple | PasoRepetir

const TIPOS_SIMPLES: TipoPasoSimple[] = ['calentamiento', 'trabajo', 'recuperacion', 'enfriamiento']
const ZONAS: ZonaRitmo[] = ['E', 'M', 'T', 'I', 'R']
const MAX_PASOS = 30

const esNumero = (n: unknown): n is number => typeof n === 'number' && Number.isFinite(n)
const esObjeto = (x: unknown): x is Record<string, unknown> => typeof x === 'object' && x !== null && !Array.isArray(x)

function errorDuracion(d: unknown): string | null {
  if (!esObjeto(d)) return 'duración ausente'
  if (d.unidad === 'lap') return null
  if ((d.unidad === 'metros' || d.unidad === 'segundos') && esNumero(d.valor) && d.valor > 0) return null
  return 'duración inválida'
}

function errorObjetivo(o: unknown): string | null {
  if (o === undefined) return null
  if (!esObjeto(o)) return 'objetivo inválido'
  if (o.tipo === 'zona') return ZONAS.includes(o.zona as ZonaRitmo) ? null : 'zona de ritmo inválida'
  if (o.tipo === 'ritmo') {
    return esNumero(o.min_seg_km) && esNumero(o.max_seg_km) && o.min_seg_km > 0 && o.min_seg_km < o.max_seg_km
      ? null : 'rango de ritmo inválido (mínimo debe ser menor que máximo)'
  }
  if (o.tipo === 'fc') {
    return esNumero(o.min) && esNumero(o.max) && o.min > 0 && o.min < o.max ? null : 'rango de FC inválido'
  }
  if (o.tipo === 'rpe') return esNumero(o.valor) && o.valor >= 1 && o.valor <= 10 ? null : 'RPE inválido'
  return 'tipo de objetivo desconocido'
}

function errorSimple(p: unknown): string | null {
  if (!esObjeto(p)) return 'paso inválido'
  if (!TIPOS_SIMPLES.includes(p.tipo as TipoPasoSimple)) return `tipo de paso desconocido: ${String(p.tipo)}`
  return errorDuracion(p.duracion) ?? errorObjetivo(p.objetivo)
}

export function validarPasos(x: unknown): { ok: true; pasos: Paso[] } | { ok: false; error: string } {
  if (!Array.isArray(x) || x.length === 0) return { ok: false, error: 'La sesión no tiene pasos' }
  if (x.length > MAX_PASOS) return { ok: false, error: `Demasiados pasos (máx. ${MAX_PASOS})` }
  for (const p of x) {
    if (esObjeto(p) && p.tipo === 'repetir') {
      if (!esNumero(p.veces) || !Number.isInteger(p.veces) || p.veces < 1 || p.veces > 50) {
        return { ok: false, error: 'Las repeticiones deben ser un entero entre 1 y 50' }
      }
      if (!Array.isArray(p.pasos) || p.pasos.length === 0) return { ok: false, error: 'Un bloque repetido necesita pasos' }
      for (const q of p.pasos) {
        const e = errorSimple(q)
        if (e) return { ok: false, error: e }
      }
    } else {
      const e = errorSimple(p)
      if (e) return { ok: false, error: e }
    }
  }
  return { ok: true, pasos: x as Paso[] }
}

/** Ritmo objetivo del paso en seg/km, o null si no hay ritmo aplicable. */
export function ritmoDelPaso(p: PasoSimple, ritmos: Ritmos | null): number | null {
  const o = p.objetivo
  if (o?.tipo === 'ritmo') return (o.min_seg_km + o.max_seg_km) / 2
  if (o?.tipo === 'zona') return ritmos ? ritmos[o.zona] : null
  return null
}

const NOMBRE_TIPO: Record<TipoPasoSimple, string> = {
  calentamiento: 'Calentamiento',
  trabajo: 'Trabajo',
  recuperacion: 'Recuperación',
  enfriamiento: 'Vuelta a la calma',
}

function textoDuracion(d: Duracion): string {
  if (d.unidad === 'lap') return 'hasta pulsar lap'
  if (d.unidad === 'metros') return `${d.valor} m`
  const m = Math.floor(d.valor / 60)
  const s = Math.round(d.valor % 60)
  return `${m}:${String(s).padStart(2, '0')}`
}

function textoObjetivo(p: PasoSimple, ritmos: Ritmos | null): string {
  const o = p.objetivo
  if (!o) return ''
  if (o.tipo === 'zona') return ritmos ? ` @ ${formatearRitmo(ritmos[o.zona])}/km` : ` @ zona ${o.zona}`
  if (o.tipo === 'ritmo') return ` @ ${formatearRitmo(o.min_seg_km)}–${formatearRitmo(o.max_seg_km)}/km`
  if (o.tipo === 'fc') return ` @ ${o.min}–${o.max} ppm`
  return ` @ RPE ${o.valor}`
}

export function lineaPaso(p: PasoSimple, ritmos: Ritmos | null): string {
  return `${NOMBRE_TIPO[p.tipo]} ${textoDuracion(p.duracion)}${textoObjetivo(p, ritmos)}`
}

/** Metros y segundos de un paso simple (cada uno, si se pueden conocer). */
function medidas(p: PasoSimple, ritmos: Ritmos | null): { m: number; s: number | null } {
  const d = p.duracion
  if (d.unidad === 'lap') return { m: 0, s: null }
  // Sin objetivo de ritmo se asume ritmo fácil (E) para estimar.
  const ritmo = ritmoDelPaso(p, ritmos) ?? ritmos?.E ?? null
  if (d.unidad === 'metros') return { m: d.valor, s: ritmo ? (d.valor / 1000) * ritmo : null }
  return { m: ritmo ? (d.valor / ritmo) * 1000 : 0, s: d.valor }
}

export function resumenSesion(
  pasos: Paso[],
  ritmos: Ritmos | null,
): { distancia_m: number; duracion_s: number | null; lineas: string[] } {
  let distancia = 0
  let duracion: number | null = 0
  const lineas: string[] = []

  const acumular = (p: PasoSimple, veces: number) => {
    const { m, s } = medidas(p, ritmos)
    distancia += m * veces
    duracion = duracion === null || s === null ? null : duracion + s * veces
  }

  for (const p of pasos) {
    if (p.tipo === 'repetir') {
      lineas.push(`${p.veces} × (${p.pasos.map(q => lineaPaso(q, ritmos).replace(/^(\w+)\s/, (_, w) => `${w.toLowerCase()} `)).join(' + ')})`)
      p.pasos.forEach(q => acumular(q, p.veces))
    } else {
      lineas.push(lineaPaso(p, ritmos))
      acumular(p, 1)
    }
  }
  return { distancia_m: Math.round(distancia), duracion_s: duracion === null ? null : Math.round(duracion), lineas }
}
