import type { RolIngrediente } from '@/types'

export type Macros = { kcal: number; p: number; c: number; g: number }

export interface IngredienteOptimizable {
  rol: RolIngrediente | null
  gramos: number
  fija: boolean
  por100: Macros
}

export interface ObjetivoComida {
  kcal: number
  p?: number | null
  c?: number | null
  g?: number | null
}

type Grupo = 'P' | 'C' | 'G' | 'O'
const CLAVES: (keyof Macros)[] = ['kcal', 'p', 'c', 'g']
// Peso relativo de cada macro en el ajuste: kcal y proteína mandan.
const PESOS: Macros = { kcal: 3, p: 3, c: 1, g: 0.7 }
const LIMITES: Record<Grupo, [number, number]> = { P: [0.25, 3], C: [0.25, 3], G: [0.25, 3], O: [0.5, 2] }
// Penaliza alejarse del factor uniforme para no deformar el plato sin necesidad.
const REGULARIZACION = 0.02

function grupoDe(rol: RolIngrediente | null): Grupo {
  if (rol === 'proteina_principal') return 'P'
  if (rol === 'carbohidrato_base') return 'C'
  if (rol === 'grasa_saludable') return 'G'
  return 'O'
}

const clamp = (v: number, [min, max]: [number, number]) => Math.min(max, Math.max(min, v))

/**
 * Calcula un factor de escala por grupo de ingredientes (proteína, hidrato,
 * grasa, resto) minimizando a la vez el error relativo en kcal y en cada macro
 * objetivo, teniendo en cuenta lo que aporta cada ingrediente a los 4 macros.
 * Devuelve un factor por ingrediente (1 para los de cantidad fija).
 */
export function optimizarFactoresReceta(ingredientes: IngredienteOptimizable[], objetivo: ObjetivoComida) {
  const fijo: Macros = { kcal: 0, p: 0, c: 0, g: 0 }
  const columnas = new Map<Grupo, Macros>()

  for (const ing of ingredientes) {
    const aporte = Object.fromEntries(CLAVES.map(k => [k, (ing.por100[k] ?? 0) * ing.gramos / 100])) as Macros
    if (ing.fija) {
      for (const k of CLAVES) fijo[k] += aporte[k]
      continue
    }
    const grupo = grupoDe(ing.rol)
    const col = columnas.get(grupo) ?? { kcal: 0, p: 0, c: 0, g: 0 }
    for (const k of CLAVES) col[k] += aporte[k]
    columnas.set(grupo, col)
  }

  const grupos = [...columnas.keys()].filter(g => (columnas.get(g)!.kcal ?? 0) > 0)
  const kcalVariable = grupos.reduce((s, g) => s + columnas.get(g)!.kcal, 0)
  const factorPorGrupo = new Map<Grupo, number>()

  if (objetivo.kcal > 0 && kcalVariable > 0) {
    const f0 = Math.max(0.2, (objetivo.kcal - fijo.kcal) / kcalVariable)
    const objetivos = CLAVES
      .map(k => ({ k, t: k === 'kcal' ? objetivo.kcal : objetivo[k] }))
      .filter((x): x is { k: keyof Macros; t: number } => typeof x.t === 'number' && x.t > 0)

    const f = new Map(grupos.map(g => [g, clamp(f0, LIMITES[g])]))
    const resultado = (k: keyof Macros) => fijo[k] + grupos.reduce((s, g) => s + f.get(g)! * columnas.get(g)![k], 0)

    for (let iter = 0; iter < 400; iter++) {
      let cambio = 0
      for (const g of grupos) {
        const col = columnas.get(g)!
        let grad = 2 * REGULARIZACION * (f.get(g)! - f0)
        let hess = 2 * REGULARIZACION
        for (const { k, t } of objetivos) {
          const peso = PESOS[k] / (t * t)
          grad += 2 * peso * (resultado(k) - t) * col[k]
          hess += 2 * peso * col[k] * col[k]
        }
        const nuevo = clamp(f.get(g)! - grad / hess, LIMITES[g])
        cambio = Math.max(cambio, Math.abs(nuevo - f.get(g)!))
        f.set(g, nuevo)
      }
      if (cambio < 1e-6) break
    }
    for (const g of grupos) factorPorGrupo.set(g, f.get(g)!)
  }

  return {
    factores: ingredientes.map(ing => (ing.fija ? 1 : factorPorGrupo.get(grupoDe(ing.rol)) ?? 1)),
    factorPorGrupo: Object.fromEntries(factorPorGrupo) as Partial<Record<Grupo, number>>,
  }
}
