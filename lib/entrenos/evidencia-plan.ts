// lib/entrenos/evidencia-plan.ts
// Evidencia de un plan generado por IA: resolver las claves K# a estudios reales, detectar citas inventadas y extraer el JSON de la respuesta.
import type { EstudioCitable, EstudioRef } from '@/lib/rendimiento/evidencia'

/** Extrae el objeto JSON de la respuesta aunque venga con ```json o texto alrededor. Lanza si no hay un objeto válido. */
export function extraerJsonPlan(texto: string): Record<string, unknown> {
  const limpio = texto.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '')
  try {
    const v = JSON.parse(limpio)
    if (v && typeof v === 'object' && !Array.isArray(v)) return v as Record<string, unknown>
  } catch { /* se intenta recortar al primer y último corchete */ }
  const i = limpio.indexOf('{')
  const j = limpio.lastIndexOf('}')
  if (i >= 0 && j > i) {
    const v = JSON.parse(limpio.slice(i, j + 1))
    if (v && typeof v === 'object' && !Array.isArray(v)) return v as Record<string, unknown>
  }
  throw new Error('sin JSON')
}

export interface DecisionPlan {
  decision: string
  motivo: string
  tipo: 'estudio' | 'criterio_entrenador'
  /** Estudios reales a los que apuntan las claves válidas. */
  estudios: EstudioRef[]
  /** Claves citadas que no existían en la lista ofrecida. */
  clavesInventadas: string[]
}

export interface EvidenciaPlan {
  ofrecidos: number
  decisiones: DecisionPlan[]
  /** Estudios distintos citados. */
  estudiosCitados: EstudioRef[]
  /** Claves K# que el modelo citó sin que existieran. */
  clavesInventadas: number
  /** Autores y año («Wilson 2012») que aparecen en el texto libre y no corresponden a ningún estudio ofrecido. */
  autoresNoVerificables: string[]
}

const RE_AUTOR_ANIO = /\b([A-ZÁÉÍÓÚ][\p{L}-]{2,})(?: et al\.?| y [A-ZÁÉÍÓÚ][\p{L}-]+| & [A-ZÁÉÍÓÚ][\p{L}-]+)?,? \(?((?:19|20)\d{2})\)?/gu
const PALABRAS_NO_AUTOR = new Set(['Semana', 'Semanas', 'Bloque', 'Fase', 'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre', 'Hasta', 'Desde', 'Año', 'Año:'])

const texto = (x: unknown) => (typeof x === 'string' ? x : '')

/** Convierte las claves K# de `decisiones_clave` en estudios reales y busca citas «Autor 2018» que no estén en la lista ofrecida. */
export function resolverEvidenciaPlan(plan: Record<string, unknown>, ofrecidos: EstudioCitable[]): EvidenciaPlan {
  const porClave = new Map(ofrecidos.map(e => [e.clave.toUpperCase(), e]))
  const crudas = Array.isArray(plan.decisiones_clave) ? (plan.decisiones_clave as Record<string, unknown>[]) : []
  const citados = new Map<string, EstudioRef>()
  let inventadas = 0
  const decisiones: DecisionPlan[] = crudas.map(d => {
    const claves = (Array.isArray(d.evidencia) ? d.evidencia : []).map(x => String(x).toUpperCase().replace(/[^K0-9]/g, '')).filter(Boolean)
    const estudios: EstudioRef[] = []
    const malas: string[] = []
    for (const c of claves) {
      const e = porClave.get(c)
      if (!e) { malas.push(c); continue }
      const ref: EstudioRef = { titulo: e.titulo, anio: e.anio, doi: e.doi, nivel: e.nivelCrudo ?? 'opinion_experto' }
      estudios.push(ref)
      citados.set(e.doi ?? e.titulo, ref)
    }
    inventadas += malas.length
    return {
      decision: texto(d.decision), motivo: texto(d.motivo),
      tipo: d.tipo === 'estudio' && estudios.length > 0 ? 'estudio' : 'criterio_entrenador',
      estudios, clavesInventadas: malas,
    }
  })

  // Autores citados en texto libre: solo valen si su apellido y año coinciden con un estudio ofrecido.
  const conocidos = ofrecidos.map(e => `${e.titulo} ${e.fuente}`.toLowerCase())
  const libre = [texto(plan.fundamentacion), texto(plan.progresion_semanal), texto(plan.semana_deload),
    ...(Array.isArray(plan.sesiones) ? (plan.sesiones as Record<string, unknown>[]).flatMap(s => (Array.isArray(s.ejercicios) ? (s.ejercicios as Record<string, unknown>[]) : []).map(e => texto(e.notas))) : [])].join(' ')
  const noVerificables = new Set<string>()
  for (const m of libre.matchAll(RE_AUTOR_ANIO)) {
    if (PALABRAS_NO_AUTOR.has(m[1])) continue
    const coincide = conocidos.some(c => c.includes(m[1].toLowerCase()) && c.includes(m[2]))
    if (!coincide) noVerificables.add(`${m[1]} ${m[2]}`)
  }
  return { ofrecidos: ofrecidos.length, decisiones, estudiosCitados: [...citados.values()], clavesInventadas: inventadas, autoresNoVerificables: [...noVerificables] }
}
