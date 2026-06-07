import type { RecetaCandidata } from './types'

export type AlimentoLigero = {
  id: string
  nombre: string
}

export type ResultadoMatcher = {
  ok: boolean
  receta: RecetaCandidata
  errores: string[]
}

function normalizar(texto: string) {
  return texto
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .replace(/\s+/g, ' ')
    .trim()
}

export function resolverIngredientesCandidata(
  receta: RecetaCandidata,
  alimentos: AlimentoLigero[],
): ResultadoMatcher {
  const errores: string[] = []
  const index = new Map(alimentos.map((alimento) => [normalizar(alimento.nombre), alimento]))

  const ingredientes = receta.ingredientes.map((ingrediente) => {
    const alimento = index.get(normalizar(ingrediente.nombre))
    if (!alimento) {
      errores.push(`sin match exacto: ${ingrediente.nombre}`)
      return ingrediente
    }

    return {
      ...ingrediente,
      alimentoId: alimento.id,
      alimentoNombre: alimento.nombre,
    }
  })

  return {
    ok: errores.length === 0,
    receta: { ...receta, ingredientes },
    errores,
  }
}
