// lib/entrenos/validar-plan-carrera.ts
// Revisión determinista de la parte de carrera de un plan generado por IA. No arregla el plan: lo contrasta con las pautas en las que
// coinciden los entrenadores de referencia (Daniels, Pfitzinger, Fitzgerald/80-20, Hudson) y con el volumen real del atleta, y dice qué no cuadra.
//
// Pautas usadas y su fuente:
//  - Tirada larga ≤ 2 h 30 min (Daniels) y como máximo ~30 % del volumen semanal con 5+ salidas (Daniels: 25 % del kilometraje);
//    con 3-4 salidas por semana es inevitable que pese más, y se tolera hasta el 50 % (criterio de entrenador).
//  - Sesiones de calidad: hasta 2 por semana si se corre 4 días o menos; hasta 3 con 5+ (Daniels), nunca en días consecutivos (alternar duro-fácil).
//  - Un salto de volumen semanal superior al 30 % se asocia a más lesiones (Nielsen 2014): aviso desde el 20 %, error desde el 30 %.
//  - Los ritmos objetivo deben caber en la zona de cada tipo de sesión según el VDOT (Daniels).
import type { Ritmos } from './ritmos'

export interface SesionPlan {
  nombre: string
  dia_semana?: string | null
  tipo_sesion?: string | null
  ritmo_objetivo?: string | null
  duracion_min?: number | null
}

export type TipoCarrera = 'tirada' | 'rodaje' | 'tempo' | 'series' | 'otra'

export interface ContextoValidacion {
  ritmos: Ritmos | null
  /** Media de minutos de carrera por semana en las últimas 4 semanas completas (reloj). */
  minutosRealesSemana: number | null
  /** Semana 1 del macrociclo calculado con reglas: lo que el plan generado debería respetar. */
  esqueleto?: { minutos: number; salidas: number; tiradaMin: number; sesionesCalidad: number } | null
}

export interface Hallazgo { nivel: 'error' | 'aviso'; codigo: string; texto: string }

export interface ResultadoValidacion {
  hallazgos: Hallazgo[]
  resumen: { carrerasSemana: number; minutosCarrera: number; sesionesCalidad: number; tiradaLargaMin: number | null; tiradaLargaPct: number | null }
}

/** Lunes=0 … Domingo=6. */
function diaNumero(d?: string | null): number {
  const t = (d ?? '').trim().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
  return ['lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado', 'domingo'].indexOf(t)
}

export function tipoDeSesionCarrera(s: SesionPlan): TipoCarrera {
  const n = s.nombre.toLowerCase()
  if (/tirada|largo|long run/.test(n)) return 'tirada'
  if (/series|intervalo|fartlek|cuestas|r[ií]tmo de carrera|vo2/.test(n)) return 'series'
  if (/tempo|umbral|threshold|progresiv/.test(n)) return 'tempo'
  if (/rodaje|f[aá]cil|suave|regenerativ|z2|aer[oó]bic|recuperaci/.test(n)) return 'rodaje'
  return 'otra'
}

const esDeCarrera = (s: SesionPlan) => s.tipo_sesion === 'carrera' || (s.tipo_sesion == null && /carrera|tirada|rodaje|running|tempo|series/i.test(s.nombre) && !/h[ií]brid|hyrox/i.test(s.nombre))

/** Primer ritmo m:ss del texto (s/km), o null. */
export function ritmoDeTexto(t?: string | null): number | null {
  const m = (t ?? '').match(/\b(\d{1,2}):([0-5]\d)\b/)
  return m ? Number(m[1]) * 60 + Number(m[2]) : null
}

const fmt = (s: number) => `${Math.floor(s / 60)}:${String(Math.round(s % 60)).padStart(2, '0')}`

export function validarSemanaCarrera(sesiones: SesionPlan[], ctx: ContextoValidacion): ResultadoValidacion {
  const hallazgos: Hallazgo[] = []
  const carrera = sesiones.filter(esDeCarrera)
  const tipos = carrera.map(s => ({ s, tipo: tipoDeSesionCarrera(s), min: typeof s.duracion_min === 'number' && s.duracion_min > 0 ? s.duracion_min : null }))
  const minutosCarrera = tipos.reduce((a, t) => a + (t.min ?? 0), 0)
  const calidad = tipos.filter(t => t.tipo === 'tempo' || t.tipo === 'series')
  const tirada = tipos.filter(t => t.tipo === 'tirada' && t.min !== null).sort((a, b) => (b.min ?? 0) - (a.min ?? 0))[0]
  const tiradaPct = tirada && minutosCarrera > 0 ? Math.round((tirada.min! / minutosCarrera) * 100) : null

  // Calidad: cuántas y nunca seguidas.
  const maxCalidad = carrera.length >= 5 ? 3 : 2
  if (calidad.length > maxCalidad) hallazgos.push({ nivel: 'aviso', codigo: 'demasiada_calidad', texto: `Hay ${calidad.length} sesiones de calidad con ${carrera.length} salidas de carrera por semana (máximo recomendado ${maxCalidad}).` })
  const diasCalidad = calidad.map(t => diaNumero(t.s.dia_semana)).filter(d => d >= 0).sort((a, b) => a - b)
  for (let i = 1; i < diasCalidad.length; i++) {
    if (diasCalidad[i] - diasCalidad[i - 1] === 1) hallazgos.push({ nivel: 'aviso', codigo: 'calidad_seguida', texto: 'Hay dos sesiones de calidad en días consecutivos: conviene alternar días duros y fáciles.' })
  }
  const tiradaDia = tirada ? diaNumero(tirada.s.dia_semana) : -1
  if (tiradaDia > 0 && diasCalidad.includes(tiradaDia - 1)) hallazgos.push({ nivel: 'aviso', codigo: 'calidad_antes_tirada', texto: 'La tirada larga cae el día siguiente a una sesión de calidad: llegaría con las piernas cargadas.' })

  // Tirada larga: tope absoluto y proporción.
  if (tirada && tirada.min! > 150) hallazgos.push({ nivel: 'error', codigo: 'tirada_excesiva', texto: `La tirada larga dura ${tirada.min} min: más de 2 h 30 min no aporta beneficio proporcional y aumenta el riesgo.` })
  const limitePct = carrera.length >= 5 ? 30 : 50
  if (tiradaPct !== null && tiradaPct > limitePct && carrera.length >= 3) hallazgos.push({ nivel: 'aviso', codigo: 'tirada_pesada', texto: `La tirada larga es el ${tiradaPct} % del tiempo semanal de carrera (referencia: hasta ~${limitePct} % con ${carrera.length} salidas por semana).` })

  // Progresión respecto al volumen real.
  if (ctx.minutosRealesSemana && ctx.minutosRealesSemana > 0 && minutosCarrera > 0) {
    const salto = (minutosCarrera - ctx.minutosRealesSemana) / ctx.minutosRealesSemana
    if (salto > 0.3) hallazgos.push({ nivel: 'error', codigo: 'salto_volumen', texto: `El plan sube el volumen de carrera un ${Math.round(salto * 100)} % sobre lo que corre de media (${Math.round(ctx.minutosRealesSemana)} → ${minutosCarrera} min/semana): los saltos de más del 30 % se asocian a más lesiones.` })
    else if (salto > 0.2) hallazgos.push({ nivel: 'aviso', codigo: 'subida_volumen', texto: `El plan sube el volumen de carrera un ${Math.round(salto * 100)} % sobre su media real (${Math.round(ctx.minutosRealesSemana)} → ${minutosCarrera} min/semana).` })
  }

  // Ritmos objetivo coherentes con el VDOT.
  const r = ctx.ritmos
  if (r) {
    for (const t of tipos) {
      const p = ritmoDeTexto(t.s.ritmo_objetivo)
      if (p === null) continue
      if (t.tipo === 'tirada' || t.tipo === 'rodaje') {
        if (p < r.M) hallazgos.push({ nivel: 'aviso', codigo: 'rodaje_rapido', texto: `«${t.s.nombre}»: ${fmt(p)}/km es más rápido que su ritmo de maratón (${fmt(r.M)}/km); un rodaje o una tirada suave debería ir más lento (fácil: ${fmt(r.E)}/km).` })
        else if (p > r.E * 1.25) hallazgos.push({ nivel: 'aviso', codigo: 'rodaje_lento', texto: `«${t.s.nombre}»: ${fmt(p)}/km es demasiado lento incluso para un rodaje fácil de su VDOT (${fmt(r.E)}/km).` })
      } else if (t.tipo === 'tempo') {
        if (p < r.T * 0.97 || p > r.T * 1.08) hallazgos.push({ nivel: 'aviso', codigo: 'tempo_fuera_de_zona', texto: `«${t.s.nombre}»: ${fmt(p)}/km queda fuera de la zona de umbral de su VDOT (${fmt(r.T)}/km, de ${fmt(r.T * 0.97)} a ${fmt(r.T * 1.08)}).` })
      } else if (t.tipo === 'series') {
        if (p < r.R * 0.95 || p > r.T) hallazgos.push({ nivel: 'aviso', codigo: 'series_fuera_de_zona', texto: `«${t.s.nombre}»: ${fmt(p)}/km queda fuera del rango de series de su VDOT (de ${fmt(r.R * 0.95)} a ${fmt(r.T)}/km).` })
      }
    }
  }

  // Contraste con el esqueleto calculado (macrociclo): la IA redacta y detalla, pero no debe cambiar la estructura.
  const esq = ctx.esqueleto
  if (esq && carrera.length > 0) {
    if (carrera.length !== esq.salidas) hallazgos.push({ nivel: 'aviso', codigo: 'fuera_de_esqueleto_salidas', texto: `El plan tiene ${carrera.length} sesiones de carrera por semana y el esqueleto calculado para este atleta prevé ${esq.salidas}.` })
    if (minutosCarrera > 0 && (minutosCarrera > esq.minutos * 1.2 || minutosCarrera < esq.minutos * 0.8)) hallazgos.push({ nivel: 'aviso', codigo: 'fuera_de_esqueleto_volumen', texto: `El plan suma ${minutosCarrera} min de carrera por semana y el esqueleto calculado prevé ~${esq.minutos} min (±20 %).` })
    if (tirada?.min && tirada.min > esq.tiradaMin * 1.25) hallazgos.push({ nivel: 'aviso', codigo: 'fuera_de_esqueleto_tirada', texto: `La tirada larga dura ${tirada.min} min y el esqueleto calculado la limita a ~${esq.tiradaMin} min.` })
    if (calidad.length > esq.sesionesCalidad) hallazgos.push({ nivel: 'aviso', codigo: 'fuera_de_esqueleto_calidad', texto: `El plan tiene ${calidad.length} sesiones de calidad y el esqueleto calculado prevé ${esq.sesionesCalidad}.` })
  }

  return { hallazgos, resumen: { carrerasSemana: carrera.length, minutosCarrera, sesionesCalidad: calidad.length, tiradaLargaMin: tirada?.min ?? null, tiradaLargaPct: tiradaPct } }
}
