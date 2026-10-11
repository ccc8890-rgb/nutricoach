// lib/entrenos/reparar-plan.ts
// Bucle de corrección: si el plan que devuelve la IA incumple las reglas del motor (volumen, esqueleto, número de sesiones, citas inventadas…),
// se le devuelve su propio plan con la lista de problemas para que lo corrija, en vez de enseñárselo al coach roto.
import type { Hallazgo } from './validar-plan-carrera'
import type { EvidenciaPlan } from './evidencia-plan'

export interface EntradaProblemas {
  hallazgos: Hallazgo[]
  sesiones: number
  /** Sesiones por semana que debe tener el plan (6 en el híbrido); null si no hay un número fijo. */
  sesionesEsperadas: number | null
  evidencia: EvidenciaPlan | null
}

/** Cada problema es una frase accionable para la IA. Lista vacía = el plan está bien. */
export function problemasDelPlan(e: EntradaProblemas): string[] {
  const p: string[] = []
  for (const h of e.hallazgos) p.push(h.texto)
  if (e.sesionesEsperadas !== null && e.sesiones !== e.sesionesEsperadas) p.push(`El plan tiene ${e.sesiones} sesiones por semana y debe tener exactamente ${e.sesionesEsperadas}.`)
  if (e.evidencia) {
    if (e.evidencia.clavesInventadas > 0) p.push('Citas claves [K#] que no existen en la lista de estudios ofrecida: usa solo las claves de la lista o marca la decisión como «criterio_entrenador».')
    if (e.evidencia.autoresNoVerificables.length > 0) p.push(`Mencionas autores que no están en la lista de estudios (${e.evidencia.autoresNoVerificables.join(', ')}): quítalos o cita solo por clave K#.`)
    if (e.evidencia.decisiones.length < 5) p.push('"decisiones_clave" debe tener entre 6 y 10 decisiones.')
  }
  return p
}

export function promptDeReparacion(planJson: string, problemas: string[]): string {
  return `Este es el plan que generaste:\n\n${planJson}\n\nEl sistema de revisión automática ha encontrado estos problemas:\n${problemas.map((x, i) => `${i + 1}. ${x}`).join('\n')}\n\nDevuelve el plan COMPLETO corregido, con exactamente el mismo formato JSON, arreglando solo lo necesario para resolver esos problemas y manteniendo todo lo demás. Responde únicamente con el JSON.`
}
