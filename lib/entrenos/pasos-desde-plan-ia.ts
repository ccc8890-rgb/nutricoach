// lib/entrenos/pasos-desde-plan-ia.ts
// Pasos estructurados (zonas, no ritmos fijos) de las sesiones de carrera de un plan de IA, SIN IA:
// la estructura sale del esqueleto del macrociclo y, en las series, de lo que la IA escribió (reps y duración).
// Sin pasos, el reloj y el portal no tendrían nada que mostrar. Lo que no se puede decidir con datos se deja sin pasos (nunca se inventa).
import { validarPasos, type Paso } from './pasos'
import { minutosDeTrabajo } from './macro-a-sesiones'
import type { SemanaMacro } from './macrociclo'
import type { SesionIA } from './guardar-plan'

const DIAS = ['lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado', 'domingo']
const norm = (t: string) => t.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim()
const E = { tipo: 'zona', zona: 'E' } as const
const seg = (n: number) => ({ unidad: 'segundos' as const, valor: Math.max(1, Math.round(n)) })

/** «8min», «2 min», «30s» → segundos; null si no se puede leer. */
export function segundosDe(txt: unknown): number | null {
  if (typeof txt === 'number') return null
  if (typeof txt !== 'string') return null
  const m = txt.match(/(\d+(?:[.,]\d+)?)\s*min/i)
  if (m) return Math.round(parseFloat(m[1].replace(',', '.')) * 60)
  const s = txt.match(/^\s*(\d+)\s*(?:s|seg)\b/i)
  return s ? Number(s[1]) : null
}

/** «500m», «1km», «1.000 m» → metros; null si no es una distancia (los «20m skipping» de técnica tampoco cuentan). */
export function metrosDe(txt: unknown): number | null {
  if (typeof txt !== 'string') return null
  const km = txt.match(/^\s*(\d+(?:[.,]\d+)?)\s*km\s*$/i)
  if (km) return Math.round(parseFloat(km[1].replace(',', '.')) * 1000)
  const m = txt.match(/^\s*(\d{1,2}(?:[.]\d{3})|\d{3,4})\s*m\s*$/i)
  return m ? Number(m[1].replace('.', '')) : null
}

const duracionBloque = (s: SesionIA, bloque: string) => {
  const t = (s.ejercicios ?? []).filter(e => e.bloque === bloque).map(e => segundosDe(e.repeticiones)).filter((x): x is number => x !== null)
  return t.length ? t.reduce((a, b) => a + b, 0) : null
}

export function pasosDeSesionCarrera(s: SesionIA, semana: SemanaMacro | undefined): Paso[] | null {
  if (!semana || typeof s.ritmo_objetivo !== 'string' || !s.ritmo_objetivo.trim() || !s.dia_semana) return null
  const dia = DIAS.indexOf(norm(s.dia_semana))
  // Si el coach o el atleta cambió el día de la sesión, se busca la del esqueleto por tipo (solo si hay una).
  const tipoNombre = /tirada|largo/.test(norm(s.nombre ?? '')) ? 'tirada' : /series|intervalo/.test(norm(s.nombre ?? '')) ? 'series' : /tempo|umbral/.test(norm(s.nombre ?? '')) ? 'tempo' : /rodaje|regenerativ|z2|suave/.test(norm(s.nombre ?? '')) ? 'rodaje' : null
  const delTipo = tipoNombre ? semana.sesiones.filter(m => m.tipo === tipoNombre) : []
  const macro = semana.sesiones.find(m => m.dia === dia) ?? (delTipo.length === 1 ? delTipo[0] : undefined)
  if (!macro) return null
  const total = macro.minutos * 60
  let pasos: Paso[] | null = null

  if (macro.tipo === 'rodaje' || macro.tipo === 'tirada' || macro.tipo === 'strides') {
    pasos = [{ tipo: 'trabajo', duracion: seg(total), objetivo: E }]
  } else if (macro.tipo === 'tempo') {
    const trabajo = minutosDeTrabajo(macro.minutos, semana.minutos) * 60
    const calentamiento = Math.ceil((total - trabajo) * 0.6)
    pasos = [
      { tipo: 'calentamiento', duracion: seg(calentamiento), objetivo: E },
      { tipo: 'trabajo', duracion: seg(trabajo), objetivo: { tipo: 'zona', zona: 'T' } },
      { tipo: 'enfriamiento', duracion: seg(total - trabajo - calentamiento), objetivo: E },
    ]
  } else if (macro.tipo === 'series') {
    const principal = (s.ejercicios ?? []).find(e => e.bloque === 'principal' && typeof e.series === 'number' && e.series >= 2)
    const reps = principal ? (principal.series as number) : 0
    const metros = principal ? metrosDe(principal.repeticiones) : null
    // Series por distancia (pista): el trabajo cuenta metros y la recuperación va por tiempo (trote). Para repartir el resto de la sesión se estima ~4:30/km.
    const trabajo = metros ? Math.round(metros * 0.27) : principal ? segundosDe(principal.repeticiones) : null
    const recuperacion = metros
      ? (typeof principal?.descanso_segundos === 'number' && principal.descanso_segundos > 0 ? principal.descanso_segundos : 120)
      : trabajo
    if (reps >= 2 && trabajo && recuperacion) {
      const resto = Math.max(0, total - reps * (trabajo + recuperacion))
      const calentamiento = duracionBloque(s, 'calentamiento') ?? Math.ceil(resto * 0.6)
      const enfriamiento = duracionBloque(s, 'vuelta_calma') ?? Math.max(resto - calentamiento, 180)
      pasos = [
        { tipo: 'calentamiento', duracion: seg(calentamiento), objetivo: E },
        { tipo: 'repetir', veces: reps, pasos: [
          { tipo: 'trabajo', duracion: metros ? { unidad: 'metros' as const, valor: metros } : seg(trabajo), objetivo: { tipo: 'zona', zona: 'I' } },
          { tipo: 'recuperacion', duracion: seg(recuperacion), objetivo: E, nota: 'Trote suave, sin parar.' },
        ] },
        { tipo: 'enfriamiento', duracion: seg(enfriamiento), objetivo: E },
      ]
    }
  }
  // «ritmo_carrera» no se deduce del VDOT: sin pasos hasta que el coach fije el ritmo.
  if (!pasos) return null
  const v = validarPasos(pasos)
  return v.ok ? v.pasos : null
}
