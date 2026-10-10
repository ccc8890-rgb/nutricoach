// lib/rendimiento/motor.ts
// Une las propuestas del motor de reglas con las decisiones validadas de la IA en una sola lista para el coach.
import { calcularFiabilidad, esSegura, type Fiabilidad, type PropuestaRegla, type Riesgo } from './reglas'
import type { DecisionRevisada } from './guardas'
import type { EstudioRef } from './evidencia'
import type { ClaveMetrica, Direccion } from './seguimiento'
import type { EstadoAtleta } from './estado'

export interface DecisionFinal {
  sesion: string
  cambio: string
  razon: string
  /** Texto legible con los estudios (o «criterio de entrenador (sin cita)»). */
  evidencia: string
  /** Compatibilidad con la pantalla anterior: es la fiabilidad calculada, no la que declara el modelo. */
  confianza: number
  metrica_objetivo?: ClaveMetrica
  direccion?: Direccion
  sesion_id?: string
  pasos?: unknown
  origen: 'regla' | 'ia'
  regla?: string
  riesgo: Riesgo
  /** Se puede aprobar de un vistazo: regla del motor, riesgo bajo y fiabilidad suficiente. */
  segura: boolean
  fiabilidad: Fiabilidad
  estudios: EstudioRef[]
  avisos: string[]
}

const SIN_CITA = 'criterio de entrenador (sin cita)'

export function textoEvidencia(estudios: EstudioRef[]): string {
  if (!estudios.length) return SIN_CITA
  return estudios.map(e => `«${e.titulo.length > 90 ? `${e.titulo.slice(0, 89).trimEnd()}…` : e.titulo}»${e.anio ? ` (${e.anio})` : ''}`).join('; ')
}

export function componerDecisiones(args: {
  reglas: PropuestaRegla[]
  estudiosPorDoi: Map<string, EstudioRef>
  ia: (DecisionRevisada & { estudios: EstudioRef[] })[]
  estado: EstadoAtleta
}): DecisionFinal[] {
  const delMotor: DecisionFinal[] = args.reglas.map(r => {
    const estudios = r.dois.map(d => args.estudiosPorDoi.get(d)).filter((e): e is EstudioRef => !!e)
    const fiabilidad = calcularFiabilidad({ datos: r.datos, persistencia: r.persistencia, nivelesEvidencia: estudios.map(e => e.nivel), origen: 'regla' })
    return {
      sesion: r.sesion, cambio: r.cambio, razon: r.razon, evidencia: textoEvidencia(estudios), confianza: fiabilidad.valor,
      metrica_objetivo: r.metrica_objetivo, direccion: r.direccion,
      origen: 'regla', regla: r.regla, riesgo: r.riesgo, segura: esSegura({ riesgo: r.riesgo, fiabilidad, origen: 'regla' }), fiabilidad, estudios, avisos: [],
    }
  })

  const datosGenerales = Math.min(1, args.estado.carreras6sem / 12)
  const delIA: DecisionFinal[] = args.ia.map(d => {
    const fiabilidad = calcularFiabilidad({ datos: datosGenerales, persistencia: 0.5, nivelesEvidencia: d.estudios.map(e => e.nivel), origen: 'ia' })
    return {
      sesion: d.sesion, cambio: d.cambio, razon: d.razon, evidencia: textoEvidencia(d.estudios), confianza: fiabilidad.valor,
      metrica_objetivo: d.metrica_objetivo, direccion: d.direccion, sesion_id: d.sesion_id, pasos: d.pasos,
      origen: 'ia', riesgo: d.riesgo, segura: false, fiabilidad, estudios: d.estudios, avisos: d.avisos,
    }
  })
  return [...delMotor, ...delIA]
}

/** Resumen escrito solo con datos del motor, para cuando la IA no responde. */
export function resumenDelMotor(e: EstadoAtleta, reglas: PropuestaRegla[]): string {
  const partes: string[] = []
  if (e.carga) partes.push(`Forma ${e.carga.ctl}, fatiga ${e.carga.atl}, frescura ${e.carga.tsb} (${e.carga.textoEstado.toLowerCase()}).`)
  if (e.intensidad.valoracion !== 'sin_datos') partes.push(`Reparto de intensidad de las últimas 4 semanas: ${e.intensidad.pctSuave} % suave, ${e.intensidad.pctMedia} % medio, ${e.intensidad.pctDura} % duro.`)
  partes.push(reglas.length ? `El motor propone ${reglas.length} ${reglas.length === 1 ? 'cambio' : 'cambios'}; el primero en prioridad: ${reglas[0].cambio.split('.')[0]}.` : 'El motor no encuentra motivos para cambiar el plan esta semana.')
  return partes.join(' ')
}
