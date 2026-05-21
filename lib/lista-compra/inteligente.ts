import type { IngredienteSemanal } from '@/types'

export type IngredienteCompraInteligente = IngredienteSemanal

export interface SustitutoEconomico {
  alimento_id: string
  alimento_nombre: string
  categoria: string
  cantidad_gramos: number
  supermercado_recomendado: string
  precio_recomendado_kg: number
  precio_caro_kg: number
  coste_recomendado: number
  coste_caro: number
  ahorro_euros: number
  ahorro_pct: number
}

function redondear2(valor: number): number {
  return Math.round(valor * 100) / 100
}

function formatKg(kg: number): string {
  return Number.isInteger(kg) ? `${kg} kg` : `${kg.toFixed(1)} kg`
}

export function convertirGramosACompra(gramos: number, nombre: string): string {
  const cantidad = Math.max(0, gramos)
  const nombreNormalizado = nombre.toLowerCase()

  if (/\b(huevo|huevos)\b/.test(nombreNormalizado)) {
    const unidades = Math.max(1, Math.ceil(cantidad / 60))
    return `${unidades} ${unidades === 1 ? 'unidad' : 'unidades'} aprox.`
  }

  if (cantidad >= 1000) {
    return formatKg(redondear2(cantidad / 1000))
  }

  return `${Math.round(cantidad)} g`
}

export function sugerirSustitutosEconomicos(
  ingredientes: IngredienteCompraInteligente[]
): SustitutoEconomico[] {
  return ingredientes
    .filter(ing => ing.precios.length >= 2)
    .map(ing => {
      const precios = [...ing.precios].sort((a, b) => a.precio_por_kg - b.precio_por_kg)
      const barato = precios[0]
      const caro = precios[precios.length - 1]
      const costeRecomendado = (ing.cantidad_gramos_total / 1000) * barato.precio_por_kg
      const costeCaro = (ing.cantidad_gramos_total / 1000) * caro.precio_por_kg
      const ahorro = costeCaro - costeRecomendado

      return {
        alimento_id: ing.alimento_id,
        alimento_nombre: ing.alimento_nombre,
        categoria: ing.categoria,
        cantidad_gramos: ing.cantidad_gramos_total,
        supermercado_recomendado: barato.supermercado_nombre,
        precio_recomendado_kg: barato.precio_por_kg,
        precio_caro_kg: caro.precio_por_kg,
        coste_recomendado: redondear2(costeRecomendado),
        coste_caro: redondear2(costeCaro),
        ahorro_euros: redondear2(ahorro),
        ahorro_pct: caro.precio_por_kg > 0
          ? redondear2((ahorro / costeCaro) * 100)
          : 0,
      }
    })
    .filter(s => s.ahorro_euros >= 0.5)
    .sort((a, b) => b.ahorro_euros - a.ahorro_euros)
}
