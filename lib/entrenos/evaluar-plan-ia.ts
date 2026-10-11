// lib/entrenos/evaluar-plan-ia.ts
// Puntuación objetiva de un plan generado por IA: validadores deterministas del motor + completitud + estructura. No juzga estilo ni acierto
// científico fino (eso lo revisa una persona); sirve para comparar modelos con las mismas reglas y detectar los que fallan en lo básico.
import type { ResultadoGeneracionPlan } from './generar-plan-ia'
import type { EvidenciaPlan } from './evidencia-plan'

export interface MetricasPlanIA {
  sesiones: number
  sesionesEsperadas: number | null
  erroresValidador: number
  avisosValidador: number
  codigosHallazgo: string[]
  /** % de ejercicios de fuerza con series, repeticiones, descanso, RPE y nota explicativa. */
  completitudEjercicios: number
  /** % de sesiones de carrera con ritmo objetivo y duración. */
  completitudCarrera: number
  tieneProgresion: boolean
  tieneDeload: boolean
  /** Decisiones clave del plan, cuántas se apoyan en un estudio real de la base y cuántos estudios distintos se citan. */
  decisiones: number
  decisionesConEstudio: number
  estudiosDistintos: number
  /** Claves K# citadas que no existen en la lista ofrecida (invención). */
  clavesInventadas: number
  /** «Autor año» en el texto libre que no corresponde a ningún estudio ofrecido. */
  autoresNoVerificables: number
  longitudNotaMedia: number
}

export interface EvaluacionPlanIA { puntuacion: number; metricas: MetricasPlanIA }

const texto = (x: unknown) => (typeof x === 'string' ? x : '')
const pct = (a: number, b: number) => (b === 0 ? 100 : Math.round((a / b) * 100))

export function evaluarPlanIA(res: ResultadoGeneracionPlan, sesionesEsperadas: number | null): EvaluacionPlanIA {
  const plan = res.planIA as Record<string, unknown>
  const sesiones = (Array.isArray(plan.sesiones) ? plan.sesiones : []) as Record<string, unknown>[]
  const hallazgos = res.validacion?.hallazgos ?? []
  const erroresValidador = hallazgos.filter(h => h.nivel === 'error').length
  const avisosValidador = hallazgos.filter(h => h.nivel === 'aviso').length

  const esCarrera = (s: Record<string, unknown>) => s.tipo_sesion === 'carrera'
  const ejercicios = sesiones.filter(s => !esCarrera(s)).flatMap(s => (Array.isArray(s.ejercicios) ? s.ejercicios : []) as Record<string, unknown>[])
  const completos = ejercicios.filter(e => texto(e.nombre) && e.series != null && texto(String(e.repeticiones ?? '')) && e.descanso_segundos != null && e.rpe_objetivo != null && texto(e.notas).length >= 20)
  const carreras = sesiones.filter(esCarrera)
  const carrerasOk = carreras.filter(s => texto(s.ritmo_objetivo) && typeof s.duracion_min === 'number')

  const notas = ejercicios.map(e => texto(e.notas).length)
  const ev = (plan._evidencia ?? null) as EvidenciaPlan | null
  const decisiones = ev?.decisiones ?? []

  const m: MetricasPlanIA = {
    sesiones: sesiones.length,
    sesionesEsperadas,
    erroresValidador,
    avisosValidador,
    codigosHallazgo: [...new Set(hallazgos.map(h => h.codigo))],
    completitudEjercicios: pct(completos.length, ejercicios.length),
    completitudCarrera: pct(carrerasOk.length, carreras.length),
    tieneProgresion: texto(plan.progresion_semanal).length >= 30,
    tieneDeload: texto(plan.semana_deload).length >= 20,
    decisiones: decisiones.length,
    decisionesConEstudio: decisiones.filter(d => d.tipo === 'estudio').length,
    estudiosDistintos: ev?.estudiosCitados.length ?? 0,
    clavesInventadas: ev?.clavesInventadas ?? 0,
    autoresNoVerificables: ev?.autoresNoVerificables.length ?? 0,
    longitudNotaMedia: notas.length ? Math.round(notas.reduce((a, b) => a + b, 0) / notas.length) : 0,
  }

  let p = 100
  p -= Math.min(60, erroresValidador * 15)
  p -= Math.min(30, avisosValidador * 3)
  if (sesionesEsperadas !== null && sesiones.length !== sesionesEsperadas) p -= 10
  if (sesiones.length === 0) p = 0
  p -= Math.round((100 - m.completitudEjercicios) * 0.3)
  p -= Math.round((100 - m.completitudCarrera) * 0.15)
  if (!m.tieneProgresion) p -= 5
  if (!m.tieneDeload) p -= 3
  // Uso real de los estudios: el sentido de tener la base es que el plan se apoye en ella, no en conocimiento genérico.
  if (m.decisiones < 5) p -= 10
  if (m.decisionesConEstudio < 3) p -= 10
  p -= Math.min(20, m.clavesInventadas * 5)
  p -= Math.min(15, m.autoresNoVerificables * 3)
  return { puntuacion: Math.max(0, p), metricas: m }
}
