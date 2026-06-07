import type { RecetaCandidata, RecetaCoverageGap } from './types'
import { AGENTE_RECETARIO_DEFAULTS } from './types'
import { PLANTILLAS_RECETARIO_PRO } from './templates'

export function generarCandidatasDesdeHueco(
  gap: RecetaCoverageGap,
  options: { cantidad?: number } = {},
): RecetaCandidata[] {
  const cantidad = Math.min(
    options.cantidad ?? 3,
    AGENTE_RECETARIO_DEFAULTS.maxCandidatesPerRun,
  )

  const compatibles = PLANTILLAS_RECETARIO_PRO.filter((template) =>
    !gap.momento || template.momentos.includes(gap.momento)
  )

  return compatibles
    .slice(0, cantidad)
    .map((template) => template.factory({
      objetivo: gap.objetivo,
      deporte: gap.deporte,
      momento: gap.momento,
    }))
}
