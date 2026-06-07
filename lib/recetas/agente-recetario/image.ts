import type { RecetaCandidata } from './types'

export type ImagenPendienteAgente = {
  estado: 'pendiente_revision'
  aprobada: false
  prompt: string
  fuente?: string
}

export function prepararImagenPendiente(receta: RecetaCandidata): ImagenPendienteAgente {
  const ingredientesPrincipales = receta.ingredientes
    .filter((ingrediente) => !['especias_aromaticos', 'salsas_condimentos'].includes(ingrediente.rolIngrediente))
    .slice(0, 4)
    .map((ingrediente) => ingrediente.nombre)
    .join(', ')

  return {
    estado: 'pendiente_revision',
    aprobada: false,
    prompt: `Fotografia culinaria realista de ${receta.nombre}. Ingredientes visibles: ${ingredientesPrincipales}. Luz natural, plato reconocible, composicion limpia, sin texto, sin manos, sin elementos que contradigan la receta.`,
  }
}
