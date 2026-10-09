// lib/rendimiento/alertas.ts
// Reglas de seguridad deterministas sobre la carga. Se calculan SIEMPRE, antes y al margen de la IA:
// la IA las recibe como hechos, no decide si existen.
import type { ResumenCarga } from './pmc'
import type { SemanaCarga } from './panel'

export type Gravedad = 'info' | 'aviso' | 'alta'

export interface AlertaRendimiento {
  codigo: string
  gravedad: Gravedad
  texto: string
}

export interface EntradaAlertas {
  resumen: ResumenCarga | null
  /** Semanas completas más recientes al final; la última puede estar en curso. */
  semanas: SemanaCarga[]
  /** Días hasta la próxima competición, si hay una. */
  diasParaCompeticion: number | null
  /** Pulso en reposo: últimos 7 días frente a los 28 anteriores. */
  rhr?: { reciente: number | null; base: number | null }
  /** Porcentaje del tiempo de las últimas 4 semanas en zonas 4-5 de pulso (0-100). */
  pctIntenso28d?: number | null
}

export function calcularAlertas(e: EntradaAlertas): AlertaRendimiento[] {
  const a: AlertaRendimiento[] = []
  const r = e.resumen
  if (!r) return a

  if (r.rampa7 > 8) {
    a.push({ codigo: 'rampa_alta', gravedad: 'alta', texto: `La forma sube ${r.rampa7} puntos en 7 días (más de ~8 aumenta el riesgo de lesión o sobrecarga).` })
  } else if (r.rampa7 > 5) {
    a.push({ codigo: 'rampa_vigilar', gravedad: 'aviso', texto: `La forma sube ${r.rampa7} puntos en 7 días: ritmo de progresión alto, conviene vigilarlo.` })
  }

  if (r.tsb < -30) {
    a.push({ codigo: 'fatiga_alta', gravedad: 'alta', texto: `Frescura ${r.tsb}: muy por debajo de -30, zona de sobrecarga.` })
  }
  const cerca = e.diasParaCompeticion !== null && e.diasParaCompeticion <= 14 && e.diasParaCompeticion >= 0
  if (cerca && r.tsb < -10) {
    a.push({ codigo: 'llega_cansado', gravedad: 'alta', texto: `Faltan ${e.diasParaCompeticion} días para la competición y la frescura es ${r.tsb}: llegaría cargado.` })
  }
  if (r.tsb > 25 && !cerca) {
    a.push({ codigo: 'destrenando', gravedad: 'aviso', texto: `Frescura +${r.tsb} sin competición cerca: se está perdiendo forma.` })
  }

  if (r.monotonia !== null && r.monotonia > 2) {
    a.push({ codigo: 'monotonia', gravedad: 'aviso', texto: `Monotonía ${r.monotonia} (>2): poca variación entre días fáciles y duros.` })
  }

  const completas = e.semanas.length > 1 ? e.semanas.slice(0, -1) : e.semanas
  const [previa, anterior] = [completas[completas.length - 2], completas[completas.length - 1]]
  if (previa && anterior && previa.tss > 0) {
    const cambio = ((anterior.tss - previa.tss) / previa.tss) * 100
    if (cambio > 30) {
      a.push({ codigo: 'salto_semanal', gravedad: 'aviso', texto: `La carga semanal pasó de ${previa.tss} a ${anterior.tss} TSS (+${Math.round(cambio)}%).` })
    }
  }
  const ultimas4 = completas.slice(-4)
  if (ultimas4.length === 4 && ultimas4.every(s => s.sesiones === 0)) {
    a.push({ codigo: 'inactividad', gravedad: 'alta', texto: 'Sin ningún entreno registrado en las últimas 4 semanas.' })
  }

  if (e.rhr?.reciente && e.rhr.base && e.rhr.reciente - e.rhr.base >= 5) {
    a.push({ codigo: 'rhr_alto', gravedad: 'aviso', texto: `Pulso en reposo ${Math.round(e.rhr.reciente)} ppm, ${Math.round(e.rhr.reciente - e.rhr.base)} por encima de su base (${Math.round(e.rhr.base)}): posible fatiga o enfermedad.` })
  }

  if (e.pctIntenso28d != null && e.pctIntenso28d > 35) {
    a.push({ codigo: 'demasiada_intensidad', gravedad: 'aviso', texto: `${Math.round(e.pctIntenso28d)}% del tiempo en zonas 4-5 de pulso de Garmin (según % del pulso máximo; un rodaje con calor o poca base también puede caer ahí). Un reparto polarizado (~80/20) suele rendir y recuperar mejor: conviene contrastar ritmo y pulso.` })
  }
  return a
}
