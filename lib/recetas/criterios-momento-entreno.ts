// Criterios de composición para marcar una receta como pre o post entreno.
// Los momentos pre/post son filtros DUROS del planificador, así que no basta el nombre.
//
// Fuentes (cargadas en knowledge_base, ver docs/10-10-2026_bases-cientificas-nutricion-segun-sesiones.md):
//  - Pre: 1-4 g/kg de hidratos 1-4 h antes (Thomas 2016, ACSM/AND/DC; Burke 2011, J Sports Sci).
//  - Post: 20-40 g de proteína por toma, 0,25-0,40 g/kg (Kerksick 2017 ISSN nutrient timing; Jäger 2017 ISSN proteína),
//    con hidratos para reponer glucógeno.
// CRITERIO DE DIETISTA (sin estudio que dé el umbral): topes de grasa ≤20 g y fibra ≤8 g por ración en el pre,
// con apoyo indirecto del RCT de FODMAP/fibra y síntomas digestivos (10.1139/apnm-2023-0508).
// Los umbrales por ración son aproximaciones: el peso del cliente no se conoce al clasificar la receta.

export type RecetaParaMomento = {
  kcal?: number | null; proteinas?: number | null; carbohidratos?: number | null
  grasas?: number | null; fibra?: number | null
  nivel_fit?: string | null; tipo_receta?: string | null
}

const n = (v: unknown) => Number(v) || 0
const excluida = (r: RecetaParaMomento) => r.tipo_receta === 'salsa_base' || r.nivel_fit === 'indulgente' || r.nivel_fit === 'no_fit'

export function cumplePreEntreno(r: RecetaParaMomento): boolean {
  return !excluida(r) && n(r.carbohidratos) >= 35 && n(r.grasas) <= 20 && n(r.fibra) <= 8 && n(r.proteinas) <= 30
}

export function cumplePostEntreno(r: RecetaParaMomento): boolean {
  // Tolerancia de redondeo: 19,5 g ≈ 20 g y 28 g ≈ 30 g
  return !excluida(r) && n(r.proteinas) >= 19.5 && n(r.carbohidratos) >= 28
}
