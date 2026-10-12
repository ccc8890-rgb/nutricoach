// lib/entrenos/progresion-semanal.ts
// Progresión real semana a semana dentro de un bloque. La semana tipo del plan es la SEMANA 1; las demás se CALCULAN al leer (no se guardan
// copias que se desfasen si el coach edita la base). Reglas fijas y auditables (criterio de entrenador de híbridos, no cifras de un estudio):
//  - Carrera: los minutos de cada sesión de cada semana salen del macrociclo calculado por el motor (incluye la descarga).
//  - Fuerza y estaciones: semanas 1-2 = base; desde la semana 3 un escalón de carga (+2,5 kg en básicos de barra, +10 kg en trineos,
//    +2 kg en farmers, +5 % en el resto de pesos libres) y +1 serie en SkiErg/remo, carrera comprometida y pliometría.
//  - Descarga (semana marcada por el macrociclo): -35 % de series (mínimo 2), cargas -10 % y pliometría a la mitad.
import { lunesDe, diferenciaDias } from './calendario-ajustes'
import { validarPasos, type Paso, type PasoRepetir, type PasoSimple } from './pasos'

export interface SesionSemanaProg { tipo: string; minutos: number }
export interface SemanaProg { n: number; descarga: boolean; sesiones: SesionSemanaProg[] }
export interface ProgresionPlan { version: 1; semanas: SemanaProg[] }

/** Pesos de la prueba Open masculina (referencia que se muestra junto al peso de entreno; confirmar con el reglamento de la temporada). */
export const PESOS_OPEN_MASCULINO: { patron: RegExp; texto: string }[] = [
  { patron: /sled push|empuje de trineo/i, texto: '152 kg' },
  { patron: /sled pull|arrastre de trineo/i, texto: '103 kg' },
  { patron: /farmer|granjero/i, texto: '2 × 24 kg' },
  { patron: /sandbag (walking )?lunge/i, texto: '20 kg' },
  { patron: /wall ?ball/i, texto: '6 kg' },
]
export const objetivoOpen = (nombre: string) => PESOS_OPEN_MASCULINO.find(p => p.patron.test(nombre))?.texto ?? null

/** Semana (1-based) del bloque a la que pertenece una fecha, contando semanas naturales desde el lunes de la creación del plan. null = fuera del bloque. */
export function semanaDelBloque(plan: { created_at: string; duracion_semanas: number | null }, fecha: string): number | null {
  if (!plan.duracion_semanas) return null
  const inicio = lunesDe(plan.created_at.slice(0, 10))
  const n = Math.floor(diferenciaDias(inicio, lunesDe(fecha)) / 7) + 1
  return n >= 1 && n <= plan.duracion_semanas ? n : null
}

export function progresionDeMacro(semanas: { n: number; descarga: boolean; sesiones: { tipo: string; minutos: number }[] }[] | undefined | null, duracion: number | null): ProgresionPlan | null {
  if (!semanas?.length || !duracion) return null
  const s = semanas.slice(0, duracion).map(x => ({ n: x.n, descarga: !!x.descarga, sesiones: x.sesiones.map(y => ({ tipo: y.tipo, minutos: y.minutos })) }))
  return s.length ? { version: 1, semanas: s } : null
}

export function tipoCarreraDeNombre(nombre: string): string | null {
  const n = nombre.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
  if (/h[ií]brid|hyrox/.test(n)) return null
  return /tirada|largo/.test(n) ? 'tirada' : /series|intervalo/.test(n) ? 'series' : /tempo|umbral/.test(n) ? 'tempo' : /rodaje|regenerativ|z2|suave/.test(n) ? 'rodaje' : null
}

// ───────────────────────── Fuerza y estaciones ─────────────────────────
export interface EjercicioBase { nombre: string; bloque?: string | null; tipo?: string | null; series: number | null; repeticiones: string | null; peso_sugerido: string | null }
export interface EjercicioSemana { series: number | null; repeticiones: string | null; peso_sugerido: string | null; objetivo_open: string | null; cambio: boolean }

const BARRA = /sentadilla (con barra|trasera)|press banca|peso muerto|press militar con barra|remo con barra|hip thrust/i
const TRINEO = /sled (push|pull)|trineo/i
const FARMER = /farmer|granjero/i
const ESTACION_CARDIO = /ski ?erg|remo erg|rowing/i
const COMPROMETIDA = /^(intervalos \d|series run \d|carrera continua)/i

function leerPeso(t: string | null): { valor: number; unidad: string } | null {
  const m = (t ?? '').match(/^\s*(\d+(?:[.,]\d+)?)\s*(kg|kilos?)\s*$/i)
  return m ? { valor: parseFloat(m[1].replace(',', '.')), unidad: 'kg' } : null
}
const fmtKg = (v: number) => `${Number.isInteger(v) ? v : v.toFixed(1)}kg`
const redondea05 = (v: number) => Math.round(v * 2) / 2

/** Escalones de carga acumulados al llegar a la semana n (sin contar semanas de descarga): semana 3 = 1 escalón, semana 5 = 2… */
export const escalones = (n: number) => Math.max(0, Math.floor((n - 1) / 2))

export function ejercicioDeLaSemana(e: EjercicioBase, n: number, descarga: boolean): EjercicioSemana {
  const base: EjercicioSemana = { series: e.series, repeticiones: e.repeticiones, peso_sugerido: e.peso_sugerido, objetivo_open: objetivoOpen(e.nombre), cambio: false }
  const calentamiento = e.bloque === 'calentamiento' || e.bloque === 'movilidad' || e.bloque === 'vuelta_calma'
  if (calentamiento || e.series == null || e.series <= 1) return base
  const peso = leerPeso(e.peso_sugerido)
  const esPlio = e.bloque === 'pliometria'
  const esEstacion = TRINEO.test(e.nombre) || FARMER.test(e.nombre) || /wall ?ball|burpee broad|sandbag/i.test(e.nombre) || ESTACION_CARDIO.test(e.nombre)
  const progresa = BARRA.test(e.nombre) || TRINEO.test(e.nombre) || FARMER.test(e.nombre)

  if (descarga) {
    const series = esPlio ? Math.max(1, Math.round(e.series * 0.5)) : Math.max(2, Math.round(e.series * 0.65))
    const out: EjercicioSemana = { ...base, series: Math.min(series, e.series) }
    if (peso && progresa) out.peso_sugerido = fmtKg(redondea05(cargaTrasEscalones(e.nombre, peso.valor, escalones(n - 1)) * 0.9))
    out.cambio = out.series !== e.series || out.peso_sugerido !== e.peso_sugerido
    return out
  }
  const k = escalones(n)
  if (k === 0) return base
  const out = { ...base }
  if (peso && progresa) out.peso_sugerido = fmtKg(cargaTrasEscalones(e.nombre, peso.valor, k))
  const sumaSerie = esPlio || ESTACION_CARDIO.test(e.nombre) || (e.bloque === 'principal' && COMPROMETIDA.test(e.nombre) && !esEstacion)
  if (sumaSerie) out.series = e.series + k
  out.cambio = out.series !== e.series || out.peso_sugerido !== e.peso_sugerido
  return out
}

function cargaTrasEscalones(nombre: string, kg: number, k: number): number {
  if (k <= 0) return kg
  if (BARRA.test(nombre)) return kg + 2.5 * k
  if (TRINEO.test(nombre)) return kg + 10 * k
  if (FARMER.test(nombre)) return kg + 2 * k
  return kg
}

// ───────────────────────── Carrera (pasos) ─────────────────────────
function minutosDe(prog: ProgresionPlan, n: number, tipo: string): number | null {
  const sem = prog.semanas.find(s => s.n === n)
  const m = sem?.sesiones.filter(s => s.tipo === tipo)
  return m && m.length === 1 ? m[0].minutos : null
}

export function pasosDeLaSemana(pasosBase: unknown, nombreSesion: string, prog: ProgresionPlan | null, n: number | null): Paso[] | null {
  const v = validarPasos(pasosBase)
  if (!v.ok) return null
  const base = v.pasos
  const tipo = tipoCarreraDeNombre(nombreSesion)
  if (!prog || !n || !tipo || n === 1) return base
  const m1 = minutosDe(prog, 1, tipo); const mn = minutosDe(prog, n, tipo)
  if (!m1 || !mn || m1 === mn) return base

  let pasos: Paso[]
  const repetir = base.find((p): p is PasoRepetir => p.tipo === 'repetir')
  if (repetir) {
    // Series: las repeticiones siguen el cambio de minutos de la sesión (mín. 3, como mucho +4 sobre la base).
    const veces = Math.min(repetir.veces + 4, Math.max(3, Math.round(repetir.veces * (mn / m1))))
    pasos = base.map(p => p === repetir ? { ...repetir, veces } : p)
  } else {
    // Continuo (rodaje, tirada, tempo): se reescalan los pasos de trabajo para que la sesión dure lo que dice el macrociclo.
    const simples = base.filter((p): p is PasoSimple => p.tipo !== 'repetir')
    const seg = (p: PasoSimple) => (p.duracion.unidad === 'segundos' ? p.duracion.valor : 0)
    const total1 = simples.reduce((a, p) => a + seg(p), 0)
    const trabajoSeg = simples.filter(p => p.tipo === 'trabajo').reduce((a, p) => a + seg(p), 0)
    if (trabajoSeg <= 0) return base
    const nuevoTrabajo = Math.max(60, trabajoSeg + (mn * 60 - total1))
    pasos = base.map(p => p.tipo === 'trabajo' && p.duracion.unidad === 'segundos' ? { ...p, duracion: { unidad: 'segundos' as const, valor: Math.max(30, Math.round((p.duracion.valor / trabajoSeg) * nuevoTrabajo)) } } : p)
  }
  const ok = validarPasos(pasos)
  return ok.ok ? ok.pasos : base
}

/** Nombre sin cifras de duración o repeticiones (que cambian de una semana a otra): «Tirada larga Z2 · 60 min» → «Tirada larga Z2». */
export function nombreSinCifras(nombre: string): string {
  return nombre.replace(/\s*[·\-–]\s*\d+\s*min\b/gi, '').replace(/\s*[·\-–]\s*\d+\s*[×x]\s*\d+\s*m\b/gi, '').replace(/\s+\d+\s*[×x]\s*\d+\s*m\s+a\s+/gi, ' a ').replace(/\s{2,}/g, ' ').trim()
}

/**
 * Ejercicios de una sesión de carrera en la semana n: la carrera continua suma o resta los minutos que cambia la sesión según el macrociclo
 * (así la lista coincide con los pasos del reloj) y las series de pista siguen el mismo reparto que los pasos.
 */
export function ejercicioDeCarreraDeLaSemana(e: { nombre: string; bloque?: string | null; series: number | null; repeticiones: string | null }, nombreSesion: string, prog: ProgresionPlan | null, n: number | null): { series: number | null; repeticiones: string | null } {
  const base = { series: e.series, repeticiones: e.repeticiones }
  const tipo = tipoCarreraDeNombre(nombreSesion)
  if (!prog || !n || n === 1 || !tipo || e.bloque !== 'principal') return base
  const m1 = minutosDe(prog, 1, tipo); const mn = minutosDe(prog, n, tipo)
  if (!m1 || !mn || m1 === mn) return base
  const min = (e.repeticiones ?? '').match(/^\s*(\d+)\s*min\s*$/i)
  if (min && (e.series ?? 1) <= 1) return { series: e.series, repeticiones: `${Math.max(10, Number(min[1]) + (mn - m1))}min` }
  if (/^\s*\d{3,4}\s*m\s*$/i.test(e.repeticiones ?? '') && (e.series ?? 0) >= 2) return { series: Math.min(e.series! + 4, Math.max(3, Math.round(e.series! * (mn / m1)))), repeticiones: e.repeticiones }
  return base
}
