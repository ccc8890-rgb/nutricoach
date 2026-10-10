// lib/entrenos/macro-a-sesiones.ts
// Convierte una semana del macrociclo en sesiones concretas con ritmos, SIN IA: todo sale de la estructura calculada y del VDOT (Daniels).
// Lo que no se puede decidir con datos (p. ej. el ritmo de una prueba que no es maratón) se deja como «a fijar con el coach», nunca se inventa.
import { formatearRitmo, type Ritmos } from './ritmos'
import type { SemanaMacro, SesionMacro } from './macrociclo'

const DIAS = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo']
const rango = (s: number, tol = 0.03) => `${formatearRitmo(s * (1 - tol))}-${formatearRitmo(s * (1 + tol))}/km`

export interface SesionConcreta {
  dia: string
  tipo: SesionMacro['tipo']
  minutos: number
  titulo: string
  detalle: string
}

/** Trabajo intenso de una sesión: ~12 % del volumen semanal, entre 15 y 40 min, y nunca más de lo que cabe en la sesión dejando calentamiento. */
export function minutosDeTrabajo(minutosSesion: number, minutosSemana: number): number {
  const objetivo = Math.min(40, Math.max(15, Math.round(minutosSemana * 0.12)))
  return Math.max(8, Math.min(objetivo, minutosSesion - 15))
}

export function concretarSemana(semana: SemanaMacro, ritmos: Ritmos | null, disciplina?: string): SesionConcreta[] {
  const sinRitmos = 'ritmo a fijar con un test o una carrera reciente (sin VDOT)'
  return semana.sesiones.map(s => {
    const base = { dia: DIAS[s.dia], tipo: s.tipo, minutos: s.minutos }
    const fácil = ritmos ? rango(ritmos.E, 0.04) : sinRitmos
    if (s.tipo === 'rodaje') return { ...base, titulo: 'Rodaje fácil', detalle: `${s.minutos} min continuos a ${fácil}. Debes poder hablar frases completas.` }
    if (s.tipo === 'tirada') return { ...base, titulo: semana.fase === 'carrera' ? 'Rodaje largo suave' : 'Tirada larga', detalle: `${s.minutos} min a ${fácil}, sin acelerar${semana.fase === 'carrera' ? '' : '; es la sesión más larga de la semana'}.` }
    if (s.tipo === 'strides') return { ...base, titulo: 'Rodaje con progresiones', detalle: `${s.minutos} min a ${fácil}; en los últimos 15 min, 6 progresiones de 20 s subiendo hasta ${ritmos ? rango(ritmos.R, 0.04) : 'ritmo de series'} con 60-90 s de trote suave entre ellas.` }
    const trabajo = minutosDeTrabajo(s.minutos, semana.minutos)
    const calentamiento = Math.ceil((s.minutos - trabajo) * 0.6)
    const vuelta = s.minutos - trabajo - calentamiento
    const marco = `${calentamiento}' fáciles + {TRABAJO} + ${vuelta}' fáciles`
    if (s.tipo === 'tempo') {
      const txt = ritmos ? `${trabajo}' continuos a ${rango(ritmos.T, 0.02)} (ritmo umbral, "cómodamente duro")` : `${trabajo}' continuos a ritmo umbral (sin VDOT: a sensaciones, 7-8/10)`
      return { ...base, titulo: 'Tempo', detalle: `${marco.replace('{TRABAJO}', txt)}.` }
    }
    if (s.tipo === 'series') {
      // Intervalos de 3 min a ritmo I con trote de igual duración (Daniels: intervalos de 3-5 min; ≤ 8 % del volumen semanal).
      const reps = Math.max(3, Math.min(Math.floor(trabajo / 3), Math.floor((semana.minutos * 0.08) / 3)))
      const txt = `${reps} × 3' a ${ritmos ? rango(ritmos.I, 0.02) : 'ritmo de 5 km (sin VDOT: 8-9/10)'} con 3' de trote suave entre repeticiones`
      return { ...base, titulo: 'Series', detalle: `${marco.replace('{TRABAJO}', txt)} (el tiempo exacto depende de las pausas).` }
    }
    // ritmo_carrera
    const esMaraton = /maraton/.test(disciplina ?? '')
    const txt = esMaraton && ritmos ? `${trabajo}' a ritmo de maratón ${rango(ritmos.M, 0.02)}` : `${trabajo}' al ritmo objetivo de la prueba (a fijar con el coach: no se deduce solo del VDOT)`
    return { ...base, titulo: 'Ritmo de carrera', detalle: `${marco.replace('{TRABAJO}', txt)}.` }
  })
}
