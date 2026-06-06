// lib/ingredient-roles.ts
import type { RolIngrediente } from '@/types'

export type { RolIngrediente }

export const SCALING_RULES: Record<RolIngrediente, (factor: number) => number> = {
  proteina_principal:  (f) => f,
  carbohidrato_base:   (f) => f,
  verdura_volumen:     (f) => f,
  grasa_saludable:     (f) => 1 + (f - 1) * 0.5,
  salsa_condimento:    (f) => Math.min(f, 1.25),
  especias_aromaticos: () => 1.0,
  estructural:         (f) => Math.min(f, 1.15),
  lacteo_complemento:  (f) => Math.min(f, 1.30),
  fruta_complemento:   (f) => Math.min(f, 1.20),
}

interface AlimentoBasico {
  categoria?: string | null
  proteinas?: number | null
  carbohidratos?: number | null
  grasas?: number | null
  calorias?: number | null
}

export function inferirRolIngrediente(
  alimento: AlimentoBasico,
  nombreIngrediente: string
): RolIngrediente {
  const nombre = nombreIngrediente.toLowerCase()
  const cat = (alimento.categoria ?? '').toLowerCase()
  const prot = alimento.proteinas ?? 0
  const carbs = alimento.carbohidratos ?? 0
  const grasas = alimento.grasas ?? 0
  const kcal = alimento.calorias ?? 0

  const RE_ESPECIA = /\b(sal(?!sa)|pimienta|ajo|diente de ajo|ajo en polvo|cebolla en polvo|orégano|comino|cúrcuma|pimentón|albahaca|romero|tomillo|jengibre|canela|laurel|cilantro|perejil|cayena|nuez moscada|cardamomo|curry)\b/
  if (RE_ESPECIA.test(nombre)) return 'especias_aromaticos'

  const RE_SALSA = /\b(ketchup|mayonesa|pesto|hummus|tahini|mostaza|aliño|aderezo|ranch|sriracha|guacamole|tzatziki|chimichurri|vinagreta|salsa de soja|salsa teriyaki|salsa hoisin)\b/
  if (RE_SALSA.test(nombre)) return 'salsa_condimento'

  const RE_ESTRUCTURAL = /\b(tortilla de trigo|wrap|pan(?:ecillo)?|baguette|base de pizza|masa|galleta|cracker|tostada)\b/
  if (RE_ESTRUCTURAL.test(nombre)) return 'estructural'

  const RE_FRUTA = /\b(fresa|frambuesa|arándano|plátano|mango|piña|kiwi|naranja|fruta|berry|cereza|uva|sandía|melón|melocotón|granada)\b/
  if (RE_FRUTA.test(nombre) || cat.includes('fruta')) return 'fruta_complemento'

  const RE_LACTEO = /\b(queso fresco|requesón|ricotta|mascarpone|crema de leche|nata|yogur|kéfir|queso rallado|queso parmesano)\b/
  if (RE_LACTEO.test(nombre) && kcal < 250) return 'lacteo_complemento'

  const RE_GRASA = /\b(aguacate|aceite|nuez|almendra|cacahuete|pistacho|avellana|anacardo|semilla|linaza|chía|mantequilla de)\b/
  if (RE_GRASA.test(nombre) || (grasas > 20 && prot < 15)) return 'grasa_saludable'

  const RE_PROTEINA = /\b(pollo|pechuga|muslo|ternera|buey|cerdo|pavo|salmón|atún|merluza|lubina|dorada|bacalao|huevo|clara|tofu|seitán|tempe|garbanzos|lentejas|judías|edamame|proteína)\b/
  if (RE_PROTEINA.test(nombre) || prot >= 15) return 'proteina_principal'

  const RE_CARBO = /\b(arroz|pasta|patata|boniato|avena|quinoa|maíz|cuscús|bulgur|pan integral|tortita|porridge)\b/
  if (RE_CARBO.test(nombre) || carbs >= 20) return 'carbohidrato_base'

  if (kcal < 50 || cat.includes('verdura') || cat.includes('hortaliza')) return 'verdura_volumen'

  return 'proteina_principal'
}

export function calcularGramajeAjustado(
  cantidad_gramos: number,
  rol_ingrediente: RolIngrediente | null | undefined,
  es_cantidad_fija: boolean,
  factorBase: number
): number {
  if (es_cantidad_fija) return cantidad_gramos
  if (!rol_ingrediente) return Math.round(cantidad_gramos * factorBase)

  const ruleFn = SCALING_RULES[rol_ingrediente]
  const factorAplicado = ruleFn(factorBase)
  return Math.round(cantidad_gramos * factorAplicado)
}
