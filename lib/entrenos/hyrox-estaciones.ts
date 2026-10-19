// lib/entrenos/hyrox-estaciones.ts
// Las 8 estaciones de Hyrox, qué estaciones toca cubrir en cada fase del bloque y comprobación de combinados («sin parar») y pliometría.
// Criterio de entrenador de híbridos (no cifras de un estudio): en una carrera real se hacen las 8, así que a lo largo de un ciclo de bloques
// (Base → Fuerza → Resistencia) tienen que haber salido todas, no solo las cuatro de siempre.
import type { Hallazgo } from './validar-plan-carrera'

export type EstacionHyrox = 'skierg' | 'sled_push' | 'sled_pull' | 'burpee_broad_jump' | 'remo' | 'farmers_carry' | 'sandbag_lunges' | 'wall_balls'

export const ESTACIONES_HYROX: { id: EstacionHyrox; nombre: string; patron: RegExp }[] = [
  { id: 'skierg', nombre: 'SkiErg', patron: /ski ?erg/i },
  { id: 'sled_push', nombre: 'Sled Push', patron: /sled push|empuje de trineo/i },
  { id: 'sled_pull', nombre: 'Sled Pull', patron: /sled pull|arrastre de trineo/i },
  { id: 'burpee_broad_jump', nombre: 'Burpee Broad Jumps', patron: /burpee broad/i },
  { id: 'remo', nombre: 'Remo (Row)', patron: /remo erg|rowing|\brow\b|remo indoor/i },
  { id: 'farmers_carry', nombre: 'Farmers Carry', patron: /farmer|granjero/i },
  { id: 'sandbag_lunges', nombre: 'Sandbag Lunges', patron: /sandbag (walking )?lunge|zancadas? con saco/i },
  { id: 'wall_balls', nombre: 'Wall Balls', patron: /wall ?ball/i },
]

/** Estaciones que debe cubrir la semana tipo de cada fase. Entre Base, Fuerza y Resistencia salen las 8. */
export const ESTACIONES_POR_FASE: Record<string, EstacionHyrox[]> = {
  Base: ['skierg', 'sled_push', 'sled_pull', 'remo', 'farmers_carry', 'wall_balls'],
  Fuerza: ['skierg', 'sled_push', 'sled_pull', 'remo', 'farmers_carry', 'sandbag_lunges'],
  Resistencia: ['skierg', 'sled_push', 'remo', 'wall_balls', 'burpee_broad_jump', 'sandbag_lunges'],
  Deload: ['skierg', 'sled_push', 'remo'],
}

export const nombreEstacion = (id: EstacionHyrox) => ESTACIONES_HYROX.find(e => e.id === id)!.nombre

export function estacionesEnNombres(nombres: string[]): Set<EstacionHyrox> {
  const out = new Set<EstacionHyrox>()
  for (const n of nombres) for (const e of ESTACIONES_HYROX) if (e.patron.test(n)) out.add(e.id)
  return out
}

/** Saltos y trabajo reactivo (pliometría) con o sin carga. «Burpee broad jump» es una estación, no pliometría. */
export const PATRON_PLIOMETRIA = /salto|jump(?!ing jack)|hop\b|hops|pogo|bounding|slam|lanzamiento de bal|skipping/i
export const esPliometria = (e: { nombre?: unknown; bloque?: unknown }) =>
  e.bloque === 'pliometria' || (PATRON_PLIOMETRIA.test(String(e.nombre ?? '')) && !/burpee broad/i.test(String(e.nombre ?? '')))

interface EjercicioPlan { nombre?: unknown; bloque?: unknown; series?: unknown; encadenado?: unknown }
interface SesionPlan { nombre?: unknown; ejercicios?: unknown }
const lista = (s: SesionPlan) => (Array.isArray(s.ejercicios) ? s.ejercicios : []) as EjercicioPlan[]

/** Longitud máxima de un combinado: más de 3 seguidos ya no es un bloque técnico sino un circuito entero. */
export const MAX_ENCADENADOS = 3

export function validarHibridoHyrox(sesiones: SesionPlan[], fase: string): Hallazgo[] {
  const h: Hallazgo[] = []
  const ejercicios = sesiones.flatMap(lista)

  const objetivo = ESTACIONES_POR_FASE[fase]
  if (objetivo) {
    const cubiertas = estacionesEnNombres(ejercicios.map(e => String(e.nombre ?? '')))
    const faltan = objetivo.filter(id => !cubiertas.has(id))
    if (faltan.length > (fase === 'Deload' ? 1 : 0)) h.push({ nivel: 'aviso', codigo: 'estaciones_incompletas', texto: `La semana de fase ${fase} debería cubrir estas estaciones de Hyrox y no aparecen: ${faltan.map(nombreEstacion).join(', ')}. Repártelas entre las sesiones híbridas (2-3 estaciones por sesión; las de pierna van en la sesión de Pierna).` })
  }

  if (fase !== 'Deload' && !ejercicios.some(esPliometria)) h.push({ nivel: 'aviso', codigo: 'sin_pliometria', texto: 'El plan no incluye pliometría: añade un bloque corto «pliometria» (20-60 contactos) en la sesión de Pierna y en una sesión de carrera de calidad, nunca en rodajes ni en la tirada larga.' })

  for (const s of sesiones) {
    const ej = lista(s)
    let cadena = 0
    ej.forEach((e, i) => {
      if (e.encadenado === true) {
        cadena += 1
        const sig = ej[i + 1]
        if (!sig) h.push({ nivel: 'aviso', codigo: 'encadenado_sin_siguiente', texto: `«${String(s.nombre ?? 'Sesión')}»: «${String(e.nombre ?? '')}» está marcado «encadenado» pero no hay ejercicio siguiente.` })
        else if (typeof e.series === 'number' && typeof sig.series === 'number' && e.series !== sig.series) h.push({ nivel: 'aviso', codigo: 'encadenado_series_distintas', texto: `«${String(s.nombre ?? 'Sesión')}»: «${String(e.nombre ?? '')}» y «${String(sig.nombre ?? '')}» se hacen sin parar pero tienen series distintas (${e.series} y ${sig.series}): las rondas deben coincidir.` })
        if (cadena >= MAX_ENCADENADOS) h.push({ nivel: 'aviso', codigo: 'combinado_demasiado_largo', texto: `«${String(s.nombre ?? 'Sesión')}»: hay más de ${MAX_ENCADENADOS} ejercicios encadenados seguidos; parte el combinado.` })
      } else cadena = 0
    })
  }
  return h
}

/** Pliometría del catálogo por nivel de dificultad (1 = muy bajo impacto … 4 = solo avanzados). Es criterio de entrenador: la evidencia no distingue por nivel. */
export const PLIOMETRIA_POR_DIFICULTAD: Record<1 | 2 | 3 | 4, string[]> = {
  1: ['Pogo jumps', 'Saltos en punta de pies', 'Técnica de carrera'],
  2: ['Salto vertical (CMJ)', 'Box jumps', 'Saltos laterales', 'Slam ball'],
  3: ['Sentadilla con salto lastrada', 'Saltos a una pierna', 'Zancadas con salto', 'Saltos de vallas', 'Bounding', 'Box jumps con peso', 'Broad jumps'],
  4: ['Drop jump', 'Salto con trap bar'],
}

export interface PautaPliometria { dificultadMax: 1 | 2 | 3 | 4; contactos: string; conCarga: boolean }
export function pautaPliometria(nivel: string | null | undefined): PautaPliometria {
  const n = (nivel ?? '').toLowerCase()
  if (/avanzad|elite|élite|experto/.test(n)) return { dificultadMax: 4, contactos: '30-60', conCarga: true }
  if (/intermedi/.test(n)) return { dificultadMax: 3, contactos: '20-40', conCarga: true }
  return { dificultadMax: 2, contactos: '10-20', conCarga: false }
}

export function textoPliometriaParaNivel(nivel: string | null | undefined): string {
  const p = pautaPliometria(nivel)
  const permitidos = ([1, 2, 3, 4] as const).filter(d => d <= p.dificultadMax).flatMap(d => PLIOMETRIA_POR_DIFICULTAD[d])
  return `NIVEL DEL ATLETA «${nivel ?? 'sin dato'}»: usa solo estos ejercicios de saltos (están en el catálogo): ${permitidos.join('; ')}. Contactos por sesión: ${p.contactos}. ${p.conCarga ? 'Admite carga ligera en la fase de Fuerza.' : 'Sin carga externa.'}`
}
