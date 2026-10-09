// lib/rendimiento/cumplimiento.ts
// Planificado vs realizado: compara los pasos de una sesión con las vueltas que registró el reloj.
import type { Paso, PasoSimple } from '@/lib/entrenos/pasos'
import type { Ritmos } from '@/lib/entrenos/ritmos'
import type { VueltaEntreno } from './garmin-entrenos'

/** Holgura sobre el rango objetivo antes de considerar una repetición fuera de ritmo (s/km). */
const TOLERANCIA_S_KM = 3
/** Si el objetivo es una zona (no un rango), se admite ±3 % alrededor de su ritmo. */
const BANDA_ZONA = 0.03
/** Vueltas más cortas que esto no se evalúan (ruido de GPS). */
const METROS_MINIMOS = 150

export type EstadoRep = 'en_rango' | 'rapida' | 'lenta' | 'sin_objetivo'

export interface ResultadoRep {
  n: number
  distancia_m: number
  ritmo_s_km: number
  objetivo: { min: number; max: number } | null
  estado: EstadoRep
  /** Segundos por km fuera del rango (negativo = más rápido, positivo = más lento). 0 si está dentro. */
  desvio_s_km: number
}

export type EstadoCumplimiento = 'cumplida' | 'parcial' | 'no_cumplida'

export interface Cumplimiento {
  estado: EstadoCumplimiento
  repsPlanificadas: number
  repsHechas: number
  repsEnRango: number
  reps: ResultadoRep[]
  ritmoMedioS: number | null
  /** Ritmo medio de las 2 últimas reps menos el de las 2 primeras (s/km). Positivo = se viene abajo. */
  caidaS: number | null
  /** Ritmo de cada tramo cuando el plan era un bloque único pero el reloj lo partió en vueltas. */
  tramos?: number[]
  resumen: string
}

/** Pasos de trabajo en el orden en que se ejecutan, con las repeticiones ya desplegadas. */
export function repsPlanificadas(pasos: Paso[]): PasoSimple[] {
  const reps: PasoSimple[] = []
  for (const p of pasos) {
    if (p.tipo === 'repetir') {
      for (let i = 0; i < p.veces; i++) for (const q of p.pasos) if (q.tipo === 'trabajo') reps.push(q)
    } else if (p.tipo === 'trabajo') reps.push(p)
  }
  return reps
}

function rangoObjetivo(p: PasoSimple, ritmos: Ritmos | null): { min: number; max: number } | null {
  const o = p.objetivo
  if (o?.tipo === 'ritmo') return { min: o.min_seg_km, max: o.max_seg_km }
  if (o?.tipo === 'zona' && ritmos) {
    const r = ritmos[o.zona]
    return { min: r * (1 - BANDA_ZONA), max: r * (1 + BANDA_ZONA) }
  }
  return null
}

export function evaluarRep(n: number, v: VueltaEntreno, objetivo: { min: number; max: number } | null): ResultadoRep {
  const ritmo = (v.duracion_s / v.distancia_m) * 1000
  if (!objetivo) return { n, distancia_m: v.distancia_m, ritmo_s_km: Math.round(ritmo), objetivo: null, estado: 'sin_objetivo', desvio_s_km: 0 }
  let estado: EstadoRep = 'en_rango'
  let desvio = 0
  if (ritmo < objetivo.min - TOLERANCIA_S_KM) { estado = 'rapida'; desvio = ritmo - objetivo.min }
  else if (ritmo > objetivo.max + TOLERANCIA_S_KM) { estado = 'lenta'; desvio = ritmo - objetivo.max }
  return { n, distancia_m: v.distancia_m, ritmo_s_km: Math.round(ritmo), objetivo, estado, desvio_s_km: Math.round(desvio) }
}

const mmss = (s: number) => `${Math.floor(s / 60)}:${String(Math.round(s % 60)).padStart(2, '0')}`

/**
 * Evalúa una sesión de series. Devuelve null si el reloj no marcó repeticiones (sin vueltas ACTIVE),
 * por ejemplo en un rodaje libre: ahí no hay nada que comparar repetición a repetición.
 */
export function evaluarCumplimiento(pasos: Paso[], vueltas: VueltaEntreno[] | null, ritmos: Ritmos | null): Cumplimiento | null {
  const plan = repsPlanificadas(pasos)
  if (!plan.length || !vueltas?.length) return null
  const activas = vueltas.filter(v => v.tipo === 'ACTIVE' && v.distancia_m >= METROS_MINIMOS && v.duracion_s > 0)
  if (!activas.length) return null

  // Bloque continuo previsto (p. ej. tempo de 20 min): se evalúa el conjunto del trabajo, aunque el reloj lo partiera en vueltas.
  if (plan.length === 1) return evaluarBloque(plan[0], activas, ritmos)

  const reps = activas.map((v, i) => evaluarRep(i + 1, v, rangoObjetivo(plan[Math.min(i, plan.length - 1)], ritmos)))
  const enRango = reps.filter(r => r.estado === 'en_rango' || r.estado === 'sin_objetivo').length
  const medio = Math.round(reps.reduce((a, r) => a + r.ritmo_s_km, 0) / reps.length)
  let caida: number | null = null
  if (reps.length >= 4) {
    const m = (x: ResultadoRep[]) => x.reduce((a, r) => a + r.ritmo_s_km, 0) / x.length
    caida = Math.round(m(reps.slice(-2)) - m(reps.slice(0, 2)))
  }
  const hechasPct = Math.min(activas.length / plan.length, 1)
  const rangoPct = enRango / reps.length
  const estado: EstadoCumplimiento = hechasPct >= 0.85 && rangoPct >= 0.7 ? 'cumplida' : hechasPct >= 0.5 ? 'parcial' : 'no_cumplida'
  const resumen = `${reps.length}/${plan.length} repeticiones, ${enRango} en ritmo, media ${mmss(medio)}/km` + (caida !== null && caida > 8 ? `, cae ${caida} s/km hacia el final` : '')
  return { estado, repsPlanificadas: plan.length, repsHechas: reps.length, repsEnRango: enRango, reps, ritmoMedioS: medio, caidaS: caida, resumen }
}

function evaluarBloque(paso: PasoSimple, activas: VueltaEntreno[], ritmos: Ritmos | null): Cumplimiento {
  const dist = activas.reduce((a, v) => a + v.distancia_m, 0)
  const dur = activas.reduce((a, v) => a + v.duracion_s, 0)
  const rep = evaluarRep(1, { tipo: 'ACTIVE', paso: null, distancia_m: dist, duracion_s: dur, fc_media: null, velocidad_ms: dist / dur }, rangoObjetivo(paso, ritmos))
  const d = paso.duracion
  const proporcion = d.unidad === 'segundos' ? dur / d.valor : d.unidad === 'metros' ? dist / d.valor : 1
  const enRango = rep.estado === 'en_rango' || rep.estado === 'sin_objetivo'
  const estado: EstadoCumplimiento = proporcion >= 0.85 && enRango ? 'cumplida' : proporcion >= 0.5 ? 'parcial' : 'no_cumplida'
  const previsto = d.unidad === 'segundos' ? `${Math.round(d.valor / 60)} min` : d.unidad === 'metros' ? `${(d.valor / 1000).toFixed(1)} km` : 'bloque'
  const hecho = d.unidad === 'metros' ? `${(dist / 1000).toFixed(1)} km` : `${Math.round(dur / 60)} min`
  const fuera = rep.estado === 'rapida' ? ' (más rápido de lo previsto)' : rep.estado === 'lenta' ? ' (más lento de lo previsto)' : ''
  return {
    estado, repsPlanificadas: 1, repsHechas: 1, repsEnRango: enRango ? 1 : 0, reps: [rep], ritmoMedioS: rep.ritmo_s_km, caidaS: null,
    tramos: activas.length > 1 ? activas.map(v => Math.round((v.duracion_s / v.distancia_m) * 1000)) : undefined,
    resumen: `Trabajo: ${hecho} a ${mmss(rep.ritmo_s_km)}/km${fuera}; previsto ${previsto}` + (activas.length > 1 ? ` (el reloj lo marcó en ${activas.length} tramos)` : ''),
  }
}

// ── Emparejar la sesión planificada con el entreno que la ejecutó ──
const DIAS = ['lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado', 'domingo']
const normalizar = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').trim().toLowerCase()

export function fechaDeLaSemana(lunes: string, diaSemana: string): string | null {
  const i = DIAS.indexOf(normalizar(diaSemana))
  if (i < 0) return null
  const d = new Date(`${lunes}T12:00:00Z`)
  d.setUTCDate(d.getUTCDate() + i)
  return d.toISOString().slice(0, 10)
}

export interface EntrenoEmparejable {
  fecha: string
  tipo: string | null
  duracion_s: number | null
  vueltas: VueltaEntreno[] | null
  raw: { workout_id?: number | string | null } | null
}

export type EstadoSesion = 'hecha' | 'otro_dia' | 'saltada' | 'pendiente'

function sumarDias(f: string, n: number) {
  const d = new Date(`${f}T12:00:00Z`)
  d.setUTCDate(d.getUTCDate() + n)
  return d.toISOString().slice(0, 10)
}

/**
 * Busca el entreno de carrera de una sesión prevista: primero el del mismo día, luego el de un día antes o después.
 * Entre varios candidatos gana el que tiene repeticiones marcadas y, si no, el más largo.
 */
export function emparejarEntreno(
  fechaPrevista: string,
  hoy: string,
  entrenos: EntrenoEmparejable[],
  esDeCarrera: (tipo: string | null) => boolean,
): { estado: EstadoSesion; entreno: EntrenoEmparejable | null } {
  const mejor = (lista: EntrenoEmparejable[]) =>
    [...lista].sort((a, b) => {
      const ra = a.vueltas?.some(v => v.tipo === 'ACTIVE') ? 1 : 0
      const rb = b.vueltas?.some(v => v.tipo === 'ACTIVE') ? 1 : 0
      return rb - ra || (b.duracion_s ?? 0) - (a.duracion_s ?? 0)
    })[0] ?? null
  const carreras = entrenos.filter(e => esDeCarrera(e.tipo))
  const mismoDia = mejor(carreras.filter(e => e.fecha === fechaPrevista))
  if (mismoDia) return { estado: 'hecha', entreno: mismoDia }
  const cercano = mejor(carreras.filter(e => e.fecha === sumarDias(fechaPrevista, -1) || e.fecha === sumarDias(fechaPrevista, 1)))
  if (cercano) return { estado: 'otro_dia', entreno: cercano }
  return { estado: fechaPrevista >= hoy ? 'pendiente' : 'saltada', entreno: null }
}
