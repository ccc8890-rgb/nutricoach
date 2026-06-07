// lib/recetas/esqueletos/index.ts
export type { Esqueleto, IngredienteEsqueleto, MetadatosEsqueleto, SustitucionesPorRol, RolIngrediente } from './types'
import { ESQUELETOS_PERDIDA_GRASA } from './perdida-grasa'
import { ESQUELETOS_RENDIMIENTO } from './rendimiento'
import { ESQUELETOS_PATOLOGIA } from './patologia'
import type { Esqueleto } from './types'

export const TODOS_LOS_ESQUELETOS: Esqueleto[] = [
  ...ESQUELETOS_PERDIDA_GRASA,
  ...ESQUELETOS_RENDIMIENTO,
  ...ESQUELETOS_PATOLOGIA,
]

export type FiltroEsqueleto = {
  objetivo?: string
  momento?: string
  tipoPlato?: string
  deporte?: string
  patologias?: string[]   // las del cliente — filtra incompatibles
  fodmapsMaximo?: 'bajos' | 'medios' | 'altos'
}

const FODMAP_ORDEN = { bajos: 0, medios: 1, altos: 2 }

export function filtrarEsqueletos(filtro: FiltroEsqueleto): Esqueleto[] {
  return TODOS_LOS_ESQUELETOS.filter((e) => {
    const m = e.metadatos

    if (filtro.objetivo && !m.objetivos.includes(filtro.objetivo)) return false
    if (filtro.momento && !m.momentos.includes(filtro.momento)) return false
    if (filtro.tipoPlato && e.tipoPlato !== filtro.tipoPlato) return false
    if (filtro.deporte && !m.deportes.includes(filtro.deporte) && !m.deportes.includes('todos')) return false

    // Rechazar si el cliente tiene patología incompatible
    if (filtro.patologias?.length) {
      const tieneIncompatible = m.patologias_incompatibles.some((p) =>
        filtro.patologias!.includes(p)
      )
      if (tieneIncompatible) return false
    }

    // Filtrar por nivel FODMAP máximo tolerado
    if (filtro.fodmapsMaximo) {
      if (FODMAP_ORDEN[m.fodmaps] > FODMAP_ORDEN[filtro.fodmapsMaximo]) return false
    }

    return true
  })
}
