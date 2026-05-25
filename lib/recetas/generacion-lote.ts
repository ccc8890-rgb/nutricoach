export type ProveedorRecetasIA = 'deepseek'

export type LoteRecetasRequest = {
  bloque: string
  tipo: 'slot' | 'objetivo' | 'deporte' | 'manual'
  cantidad?: number
  objetivo?: string
  deporte?: string
  momento?: string
  estilo?: string
  confirmar?: boolean
  proveedor?: ProveedorRecetasIA
}

export type LoteRecetasNormalizado = {
  bloque: string
  tipo: 'slot' | 'objetivo' | 'deporte' | 'manual'
  cantidad: number
  objetivo: string | null
  deporte: string | null
  momento: string | null
  estilo: string
  confirmar: boolean
  proveedor: ProveedorRecetasIA
}

export const MAX_RECETAS_LOTE = 12
export const MAX_OUTPUT_TOKENS_LOTE = 5500
export const COSTE_MAXIMO_ESTIMADO_USD = 0.08

const ESTIMACION_DEEPSEEK_USD_POR_M_INPUT = 0.15
const ESTIMACION_DEEPSEEK_USD_POR_M_OUTPUT = 0.60

export function normalizarRequestLoteRecetas(input: LoteRecetasRequest): LoteRecetasNormalizado {
  const cantidad = Math.max(1, Math.min(Number(input.cantidad ?? 8), MAX_RECETAS_LOTE))

  return {
    bloque: String(input.bloque || 'bloque manual').trim().slice(0, 120),
    tipo: input.tipo ?? 'manual',
    cantidad,
    objetivo: input.objetivo ? String(input.objetivo).trim().slice(0, 80) : null,
    deporte: input.deporte ? String(input.deporte).trim().slice(0, 80) : null,
    momento: input.momento ? String(input.momento).trim().slice(0, 80) : null,
    estilo: input.estilo ? String(input.estilo).trim().slice(0, 80) : 'chef_healthy',
    confirmar: Boolean(input.confirmar),
    proveedor: 'deepseek',
  }
}

export function construirPromptLoteRecetas(input: LoteRecetasNormalizado) {
  return `Crea ${input.cantidad} recetas para NutriCoach.

CONTEXTO DEL BLOQUE:
- Bloque: ${input.bloque}
- Tipo: ${input.tipo}
- Objetivo nutricional: ${input.objetivo ?? 'adaptable'}
- Deporte/disciplina: ${input.deporte ?? 'general'}
- Momento de comida: ${input.momento ?? 'adaptable'}
- Estilo principal: ${input.estilo}

DIRECCION CULINARIA:
- Recetas healthy atractivas, actuales y con personalidad de chef.
- No deben parecer dieta hospitalaria ni comida restrictiva.
- Reinterpretar comida normal en versión funcional: bowls, tacos, woks, burgers, crepes, tostas, pasta, wraps, curry, poke, comfort food ligero.
- Priorizar ingredientes comunes en España y preparación realista.
- Cada receta debe tener una razón de adherencia: sabor, textura, practicidad o parecido a una comida normal.

REGLAS NUTRICIONALES:
- Incluye kcal, proteinas, carbohidratos, grasas y fibra por porción.
- Usa cantidades redondeadas para cliente: 15g, 20g, 30g, 50g, 75g, 100g, 125g, 150g, 200g.
- Evita cantidades raras tipo 27g o 107g salvo suplementos, especias o salsas muy concretas.
- Añade digestibilidad, densidad_energetica, coste_estimado_nivel, nivel_elaboracion y adherencia_score.

SEGURIDAD DE PRODUCTO:
- Todas las recetas deben salir con estado "en_revision".
- No marques ninguna receta como aprobada.
- No inventes datos clínicos ni claims médicos.
- Si una receta es para rendimiento o peri-entreno, justifica brevemente el timing de carbohidratos/proteina.

SCHEMA JSON ESTRICTO:
{
  "recetas": [
    {
      "nombre": "string",
      "descripcion": "string corta",
      "categoria": "Desayuno | Comida | Cena | Snack | Postre | Bebida | Otro",
      "tipo_plato": "string",
      "porciones": 1,
      "descripcion_porcion": "string",
      "tiempo_prep_min": 15,
      "tiempo_coccion_min": 10,
      "kcal": 450,
      "proteinas": 35,
      "carbohidratos": 55,
      "grasas": 12,
      "fibra": 8,
      "ingredientes": [
        { "nombre": "string", "cantidad_gramos": 100 }
      ],
      "instrucciones": "pasos claros",
      "consejos": "sustituciones o batch cooking",
      "tags": ["healthy", "alto_proteina"],
      "objetivos": ["rendimiento"],
      "deportes": ["running", "general"],
      "momentos": ["post_entreno"],
      "estilos": ["chef_healthy", "funcional"],
      "premium_chef": true,
      "uso_personal": false,
      "batch_cooking": false,
      "tupper": false,
      "digestibilidad": "alta | media | baja",
      "densidad_energetica": "baja | media | alta",
      "nivel_elaboracion": 3,
      "adherencia_score": 85,
      "coste_estimado_nivel": "bajo | medio | alto",
      "estado": "en_revision"
    }
  ]
}

RESPONDE SOLO JSON VALIDO.`
}

export function estimarCosteLoteUSD(prompt: string, maxOutputTokens = MAX_OUTPUT_TOKENS_LOTE) {
  const inputTokensEstimados = Math.ceil(prompt.length / 4)
  const costeInput = (inputTokensEstimados / 1_000_000) * ESTIMACION_DEEPSEEK_USD_POR_M_INPUT
  const costeOutput = (maxOutputTokens / 1_000_000) * ESTIMACION_DEEPSEEK_USD_POR_M_OUTPUT
  return Number((costeInput + costeOutput).toFixed(4))
}

export function extraerJsonLoteRecetas(text: string) {
  const limpio = text.trim().replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/```$/i, '').trim()
  const inicio = limpio.indexOf('{')
  const fin = limpio.lastIndexOf('}')
  if (inicio < 0 || fin < inicio) throw new Error('La respuesta no contiene JSON válido')
  const parsed = JSON.parse(limpio.slice(inicio, fin + 1))
  if (!Array.isArray(parsed.recetas)) throw new Error('El JSON no contiene recetas[]')
  return parsed as { recetas: unknown[] }
}
