import type { RecetaAgentePrioridad, RecetaCoverageGap } from './types'

type CoverageSnapshot = {
  objetivo: string
  deporte?: string
  momento?: string
  tipoPlato?: string
  actuales: number
}

const MINIMOS: Array<
  Omit<CoverageSnapshot, 'actuales'> & {
    minimo: number
    prioridad: RecetaAgentePrioridad
  }
> = [
  { objetivo: 'rendimiento', deporte: 'running', momento: 'tapering', minimo: 12, prioridad: 'alta' },
  { objetivo: 'rendimiento', deporte: 'running', momento: 'carga_cho', minimo: 15, prioridad: 'alta' },
  { objetivo: 'rendimiento', deporte: 'triatlon', momento: 'carga_cho', minimo: 15, prioridad: 'alta' },
  { objetivo: 'rendimiento', deporte: 'ciclismo', momento: 'carga_cho', minimo: 15, prioridad: 'alta' },
  { objetivo: 'rendimiento', momento: 'pre_entreno', minimo: 30, prioridad: 'alta' },
  { objetivo: 'rendimiento', momento: 'post_entreno', minimo: 30, prioridad: 'alta' },
  { objetivo: 'perdida_grasa', tipoPlato: 'cena', minimo: 30, prioridad: 'media' },
  { objetivo: 'recomposicion', tipoPlato: 'media_manana', minimo: 20, prioridad: 'media' },
]

function coincide(regla: Omit<CoverageSnapshot, 'actuales'>, snap: CoverageSnapshot) {
  return regla.objetivo === snap.objetivo
    && (!regla.deporte || regla.deporte === snap.deporte)
    && (!regla.momento || regla.momento === snap.momento)
    && (!regla.tipoPlato || regla.tipoPlato.toLowerCase() === snap.tipoPlato?.toLowerCase())
}

export function detectarHuecosRecetario(snapshot: CoverageSnapshot[]): RecetaCoverageGap[] {
  return snapshot.flatMap((item) => {
    const regla = MINIMOS.find((minimo) => coincide(minimo, item))
    if (!regla || item.actuales >= regla.minimo) return []

    const gap: RecetaCoverageGap = {
      objetivo: regla.objetivo,
      deporte: regla.deporte,
      momento: regla.momento,
      tipoPlato: regla.tipoPlato,
      actuales: item.actuales,
      minimo: regla.minimo,
      prioridad: regla.prioridad,
      motivo: `Cobertura ${item.actuales}/${regla.minimo}`,
    }

    return [gap]
  })
}
