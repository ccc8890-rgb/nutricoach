// lib/rendimiento/presentacion.ts
// Contenido de lo que ve el coach: titulares, una etiqueta por decisión, «qué cambia» y «por qué», en castellano llano.
// Funciones puras y probadas: los componentes solo las pintan, y el acabado visual no cambia lo que se dice.
import type { PayloadPlanEntrenoIA } from '@/lib/entrenos/planificar-con-ia'

export type EstadoPresentacion = 'ok' | 'mirar' | 'revisar'
export type EtiquetaDecision = 'seguro' | 'mirar' | 'revisar'

export const TEXTO_ESTADO: Record<EstadoPresentacion, string> = {
  ok: 'Todo en orden', mirar: 'Hay algo que mirar', revisar: 'Revisa antes de aprobar',
}
export const TEXTO_ETIQUETA: Record<EtiquetaDecision, string> = { seguro: 'Seguro', mirar: 'Mirar', revisar: 'Revisar' }

interface DecisionBase {
  segura?: boolean
  riesgo?: 'bajo' | 'medio' | 'alto'
  fiabilidad?: { nivel: 'alta' | 'media' | 'baja' }
}

/**
 * Una sola etiqueta en lugar de cuatro (origen, segura, riesgo, fiabilidad):
 * revisar = riesgo alto o fiabilidad baja · seguro = la marca el motor (regla, riesgo bajo, fiabilidad suficiente) · mirar = el resto.
 */
export function etiquetaDecision(d: DecisionBase): EtiquetaDecision {
  if (d.riesgo === 'alto' || d.fiabilidad?.nivel === 'baja') return 'revisar'
  if (d.segura) return 'seguro'
  return 'mirar'
}

export function estadoAnalisis(p: { alerta_prioritaria?: string | null; decisiones?: DecisionBase[]; preguntas_al_coach?: string[] }): EstadoPresentacion {
  const etiquetas = (p.decisiones ?? []).map(etiquetaDecision)
  if (p.alerta_prioritaria || etiquetas.includes('revisar')) return 'revisar'
  if (etiquetas.includes('mirar') || (p.preguntas_al_coach?.length ?? 0) > 0) return 'mirar'
  return 'ok'
}

/** Primera frase del texto (sin cortar decimales como «-1.3»), con un tope de caracteres. */
export function titularDe(texto: string | null | undefined, max = 170): string {
  const t = (texto ?? '').trim()
  if (!t) return ''
  const m = t.match(/^(.+?[.!?])(\s|$)/)
  const frase = (m ? m[1] : t).trim()
  if (frase.length <= max) return frase
  const corte = frase.slice(0, max - 1)
  const ultimoEspacio = corte.lastIndexOf(' ')
  return `${(ultimoEspacio > max * 0.5 ? corte.slice(0, ultimoEspacio) : corte).trimEnd()}…`
}

/** Explica las siglas la primera vez que aparecen sueltas (no si ya van entre paréntesis). */
export function glosarSiglas(texto: string): string {
  return texto
    .replace(/(?<!\()\bCTL\b(?!\))/g, 'forma (CTL)')
    .replace(/(?<!\()\bATL\b(?!\))/g, 'fatiga (ATL)')
    .replace(/(?<!\()\bTSB\b(?!\))/g, 'frescura (TSB)')
}

/** Línea resumen del «Por qué» plegado de una decisión. */
export function porQueResumen(d: { estudios?: unknown[]; fiabilidad?: { nivel: string }; confianza?: number }): string {
  if (!d.fiabilidad) return typeof d.confianza === 'number' ? `confianza ${Math.round(d.confianza * 100)} %` : ''
  const n = d.estudios?.length ?? 0
  const base = n > 0 ? `${n} ${n === 1 ? 'estudio' : 'estudios'}` : 'criterio de entrenador'
  return `${base} · fiabilidad ${d.fiabilidad.nivel}`
}

// ── Propuesta de plan de entreno ──

export interface ResumenPropuesta {
  estado: EstadoPresentacion
  titular: string
  queCambia: string[]
  semana: { dia: string; nombre: string; detalle: string }[]
  /** Errores y avisos del validador, los errores primero. */
  revisar: { grave: boolean; texto: string }[]
  fundamentos: { tipo: string; regla: string; fuente: string }[]
  faltan: string[]
}

const TIPO_FUNDAMENTO: Record<string, string> = { estudio: 'Estudio', libro: 'Libro', criterio: 'Criterio' }
const ORDEN_FUNDAMENTO = ['estudio', 'libro', 'criterio']
const TIPOS_CALIDAD = new Set(['tempo', 'series', 'ritmo_carrera'])

export function resumirPropuesta(p: PayloadPlanEntrenoIA): ResumenPropuesta {
  const sesiones = ((p.plan?.sesiones as { nombre?: string; dia_semana?: string | null; duracion_min?: unknown; ritmo_objetivo?: unknown }[] | undefined) ?? [])
  const sem1 = p.macrociclo?.semanas?.[0]

  const partes = [p.modo === 'crear' ? 'Primer bloque' : 'Siguiente bloque']
  if (p.fase_bloque) partes.push(p.fase_bloque)
  if (p.duracion_semanas) partes.push(`${p.duracion_semanas} semanas`)

  const queCambia: string[] = []
  if (sem1) {
    const real = p.contexto?.minutos_reales_semana
    if (real && real > 0) {
      const pct = Math.round((sem1.minutos / real - 1) * 100)
      queCambia.push(`Carrera: de ${real} a ${sem1.minutos} min por semana (${pct >= 0 ? '+' : ''}${pct} %)`)
    } else {
      queCambia.push(`Carrera: ${sem1.minutos} min por semana (sin datos del reloj para comparar)`)
    }
    queCambia.push(`${sem1.salidas} ${sem1.salidas === 1 ? 'salida' : 'salidas'} de carrera, la tirada larga de ${sem1.tiradaMin} min`)
    const calidad = sem1.sesiones.filter(s => TIPOS_CALIDAD.has(s.tipo)).length
    queCambia.push(calidad === 0 ? 'Sin sesiones de calidad esta semana' : `${calidad} ${calidad === 1 ? 'sesión' : 'sesiones'} de calidad`)
    if (sem1.fuerza > 0) queCambia.push(`${sem1.fuerza} de fuerza o híbridas`)
  } else {
    queCambia.push(`${sesiones.length} ${sesiones.length === 1 ? 'sesión' : 'sesiones'} en la semana`)
  }

  const revisar = (p.validacion?.hallazgos ?? [])
    .map(h => ({ grave: h.nivel === 'error', texto: h.texto }))
    .sort((a, b) => Number(b.grave) - Number(a.grave))

  const fundamentos = [...(p.macrociclo?.fundamentos ?? [])]
    .sort((a, b) => ORDEN_FUNDAMENTO.indexOf(a.tipo) - ORDEN_FUNDAMENTO.indexOf(b.tipo))
    .map(f => ({ tipo: TIPO_FUNDAMENTO[f.tipo] ?? f.tipo, regla: f.regla, fuente: f.fuente }))

  return {
    estado: revisar.some(r => r.grave) ? 'revisar' : revisar.length ? 'mirar' : 'ok',
    titular: partes.join(' · '),
    queCambia,
    semana: sesiones.map(s => ({
      dia: s.dia_semana ?? '',
      nombre: s.nombre ?? '',
      detalle: [typeof s.duracion_min === 'number' ? `${s.duracion_min} min` : null, typeof s.ritmo_objetivo === 'string' ? s.ritmo_objetivo : null].filter(Boolean).join(' · '),
    })),
    revisar,
    fundamentos,
    faltan: p.macrociclo?.datosFaltantes ?? [],
  }
}
