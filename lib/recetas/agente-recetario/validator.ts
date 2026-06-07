import type { RecetaCandidata, ResultadoValidacionAgente } from './types'
import { AGENTE_RECETARIO_DEFAULTS } from './types'

const MATCHES_SOSPECHOSOS: Array<{
  ingrediente: RegExp
  alimento: RegExp
  motivo: string
}> = [
  { ingrediente: /arroz|sticky|glutinoso/i, alimento: /chip|patata frita|cereal chocolate/i, motivo: 'arroz vinculado a snack/cereal' },
  { ingrediente: /nata|crema/i, alimento: /chip|aperitivo|patata frita/i, motivo: 'nata vinculada a aperitivo' },
  { ingrediente: /cebolla roja|cebolla morada/i, alimento: /cebolla frita|crujiente/i, motivo: 'cebolla fresca vinculada a cebolla frita' },
  { ingrediente: /tortilla|wrap|pita/i, alimento: /^huevo$|huevo/i, motivo: 'wrap/tortilla vinculado a huevo' },
]

const LIMITES_POR_ROL: Record<string, { min: number; max: number }> = {
  especias_aromaticos: { min: 0.2, max: 15 },
  salsa_condimento: { min: 2, max: 120 },
  grasa_saludable: { min: 1, max: 35 },
  proteina_principal: { min: 40, max: 260 },
  carbohidrato_base: { min: 25, max: 300 },
  verdura_volumen: { min: 20, max: 300 },
  fruta_complemento: { min: 30, max: 250 },
}

export function validarCandidataConservadora(receta: RecetaCandidata): ResultadoValidacionAgente {
  const errores: string[] = []
  const warnings: string[] = []

  if (!receta.nombre.trim()) errores.push('nombre vacio')
  if (receta.instrucciones.length < 2) errores.push('instrucciones insuficientes')
  if (receta.ingredientes.length < 3) errores.push('menos de 3 ingredientes')

  for (const ingrediente of receta.ingredientes) {
    if (!ingrediente.alimentoId || !ingrediente.alimentoNombre) {
      errores.push(`ingrediente sin alimento vinculado: ${ingrediente.nombre}`)
    }

    if (ingrediente.cantidadGramos <= 0) {
      errores.push(`cantidad invalida: ${ingrediente.nombre}`)
    }

    const limite = LIMITES_POR_ROL[ingrediente.rolIngrediente]
    if (limite && (ingrediente.cantidadGramos < limite.min || ingrediente.cantidadGramos > limite.max)) {
      errores.push(`cantidad fuera de rango para ${ingrediente.rolIngrediente}: ${ingrediente.nombre} ${ingrediente.cantidadGramos}g`)
    }

    for (const regla of MATCHES_SOSPECHOSOS) {
      if (regla.ingrediente.test(ingrediente.nombre) && regla.alimento.test(ingrediente.alimentoNombre ?? '')) {
        errores.push(`match sospechoso: ${ingrediente.nombre} -> ${ingrediente.alimentoNombre} (${regla.motivo})`)
      }
    }
  }

  return {
    valida: errores.length === 0,
    estado: errores.length === 0 ? AGENTE_RECETARIO_DEFAULTS.forceReviewState : 'descartada',
    score: errores.length === 0 ? AGENTE_RECETARIO_DEFAULTS.minQualityScore : 0,
    errores,
    warnings,
  }
}
