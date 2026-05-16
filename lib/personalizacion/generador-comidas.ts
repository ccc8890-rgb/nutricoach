const DEEPSEEK_API_URL = 'https://api.deepseek.com/v1/chat/completions'
const DEEPSEEK_MODEL = process.env.DEEPSEEK_MODEL || 'deepseek-v4-pro'

const TIPOS_COCCION_POR_NIVEL: Record<string, string> = {
  no_cocina:   'no bake, microondas, ensamblar sin calor, sin cocción',
  basico:      'sartén, microondas, horno (platos simples, máx. 3 pasos)',
  intermedio:  'sartén, horno, olla, wok, freidora de aire',
  avanzado:    'todos los métodos, técnicas culinarias avanzadas',
}

export interface PerfilAlimentario {
  comidas_habituales: string[]
  cocinas_preferidas: string[]
  nivel_cocina: string
  tiempo_disponible_min: number
  electrodomesticos: string[]
  ingredientes_preferidos: string[]
  ingredientes_rechazados: string[]
  patrones_aprendidos: Record<string, string[]>
}

export interface MacrosObjetivo {
  kcal: number
  proteinas: number
  carbohidratos: number
  grasas: number
}

export interface ComidaGenerada {
  nombre: string
  ingredientes: { nombre: string; gramos: number }[]
  instrucciones: string
  tiempo_min: number
  macros_estimados: MacrosObjetivo
  tip: string | null
}

export function buildPromptGenerador(params: {
  tipoComida: string
  macrosObjetivo: MacrosObjetivo
  perfil: PerfilAlimentario
  restricciones?: string[]
}): string {
  const { tipoComida, macrosObjetivo, perfil, restricciones } = params
  const tiposCoccion = TIPOS_COCCION_POR_NIVEL[perfil.nivel_cocina] ?? 'sartén, horno'
  const patronesHoy = perfil.patrones_aprendidos[tipoComida] ?? []

  const rechazados = [
    ...perfil.ingredientes_rechazados,
    ...(restricciones ?? []),
  ]

  return `Eres un dietista especializado en comidas prácticas, apetecibles y culturalmente apropiadas para España.
Genera UNA comida para ${tipoComida} con estos macros exactos (±10% tolerancia):
Kcal: ${macrosObjetivo.kcal} | Proteínas: ${macrosObjetivo.proteinas}g | Carbos: ${macrosObjetivo.carbohidratos}g | Grasas: ${macrosObjetivo.grasas}g

PERFIL DEL CLIENTE:
- Come habitualmente: ${perfil.comidas_habituales.join(', ') || 'comida mediterránea estándar'}
- Cocinas preferidas: ${perfil.cocinas_preferidas.join(', ') || 'mediterránea'}
- Nivel cocina: ${perfil.nivel_cocina} | Tiempo máximo: ${perfil.tiempo_disponible_min} minutos
- Electrodomésticos disponibles: ${perfil.electrodomesticos.join(', ') || 'básicos (horno, sartén, microondas)'}
- Ingredientes que le gustan: ${perfil.ingredientes_preferidos.join(', ') || 'sin preferencias marcadas'}
- Patrones aprendidos (${tipoComida}): ${patronesHoy.join(', ') || 'sin datos aún — propón algo mediterráneo estándar'}
- NUNCA incluir: ${rechazados.join(', ') || 'ningún alimento vetado'}
- Métodos de cocción disponibles: ${tiposCoccion}

REGLAS:
1. Los ingredientes deben ser ingredientes reales comprados en supermercado español
2. Cantidad total de la comida: 300-600g para comidas principales, 150-300g para snacks
3. Los macros estimados deben coincidir con los macros objetivo ±10%
4. La preparación debe caber en ${perfil.tiempo_disponible_min} minutos

Responde SOLO con este JSON sin markdown:
{
  "nombre": "nombre atractivo de la comida",
  "ingredientes": [{"nombre": "nombre del ingrediente", "gramos": 0}],
  "instrucciones": "pasos en ${perfil.tiempo_disponible_min} minutos máximo, numerados",
  "tiempo_min": 0,
  "macros_estimados": {"kcal": 0, "proteinas": 0, "carbohidratos": 0, "grasas": 0},
  "tip": "consejo breve o null"
}`
}

export async function generarComidaConIA(params: {
  tipoComida: string
  macrosObjetivo: MacrosObjetivo
  perfil: PerfilAlimentario
  restricciones?: string[]
}): Promise<ComidaGenerada | null> {
  const apiKey = process.env.DEEPSEEK_API_KEY
  if (!apiKey) return null

  const prompt = buildPromptGenerador(params)

  try {
    const res = await fetch(DEEPSEEK_API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: DEEPSEEK_MODEL,
        messages: [
          { role: 'system', content: 'Eres un dietista experto. Respondes solo con JSON válido en español.' },
          { role: 'user', content: prompt },
        ],
        temperature: 0.6,
        max_tokens: 1000,
      }),
    })

    if (!res.ok) return null

    const data = await res.json()
    const content = data.choices?.[0]?.message?.content ?? ''
    const match = content.match(/\{[\s\S]*\}/)
    if (!match) return null

    const parsed = JSON.parse(match[0]) as ComidaGenerada
    return parsed
  } catch {
    return null
  }
}

export function perfilVacio(): PerfilAlimentario {
  return {
    comidas_habituales: [],
    cocinas_preferidas: ['mediterránea'],
    nivel_cocina: 'basico',
    tiempo_disponible_min: 30,
    electrodomesticos: [],
    ingredientes_preferidos: [],
    ingredientes_rechazados: [],
    patrones_aprendidos: {},
  }
}
