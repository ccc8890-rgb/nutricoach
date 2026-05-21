// ── Extractor de abstracts vía DeepSeek ──────────────────────────
// Toma un paper raw (título + abstract) y extrae campos estructurados
// usando DeepSeek como "reader" científico.

import type { PaperRaw, PaperExtraido, DisenoEstudio } from './tipos'

const DEEPSEEK_MODEL = 'deepseek-chat'
const DEEPSEEK_API_URL = 'https://api.deepseek.com/v1/chat/completions'

interface DeepSeekMessage {
  role: 'system' | 'user' | 'assistant'
}

interface DeepSeekResponse {
  choices: { message: { content: string } }[]
  usage: { total_tokens: number }
}

/**
 * Prompt para que DeepSeek extraiga campos estructurados de un abstract.
 */
function buildExtractPrompt(paper: PaperRaw): string {
  return `Eres un revisor científico experto en nutrición y ciencias del deporte. Tu tarea es extraer información estructurada de abstracts de papers científicos.

## Paper a analizar

Título: ${paper.titulo}
Abstract: ${paper.abstract}
${paper.revista ? `Revista: ${paper.revista}` : ''}
${paper.autores ? `Autores: ${paper.autores}` : ''}

## Instrucciones

Extrae los siguientes campos del abstract. Responde SOLO con JSON válido, sin markdown ni explicaciones adicionales.

### Campos requeridos:

1. \`hallazgo_principal\`: En 1-2 frases, ¿cuál es el hallazgo principal del estudio?
2. \`poblacion\`: Describe la población estudiada (ej: "adultos sanos 18-35 años", "mujeres posmenopáusicas con obesidad", "atletas de resistencia")
3. \`intervencion\`: ¿Qué intervención se realizó? (ej: "suplementación con 20g proteína post-ejercicio", "dieta hipocalórica 500kcal déficit")
4. \`resultado_principal\`: ¿Cuál fue el resultado cuantitativo principal? (ej: "aumento del 15% en síntesis proteica muscular", "pérdida de 2.3kg grasa en 8 semanas")
5. \`diseno_estudio\`: Tipo de diseño. Usa UNO de estos valores exactos: "rct", "meta_analisis", "revision_sistematica", "cohorte", "caso_control", "transversal", "opinion_experto", "no_especificado"
6. \`tamano_muestral\`: Número total de participantes. Si no se especifica, pon 0.
7. \`keywords\`: Array de 3-6 keywords relevantes en inglés (ej: ["protein synthesis", "resistance training", "leucine"])
8. \`disciplina_sugerida\`: Una de: "nutricion", "hyrox", "running", "ciclismo", "triatlon", "hibrido", "fuerza", "recuperacion", "general"
9. \`categoria_sugerida\`: Una de: "periodizacion", "intensidad", "volumen", "fuerza", "resistencia", "hiit", "zona2", "competicion", "recuperacion", "proteina", "hidratacion", "suplementacion", "patologia", "composicion_corporal", "metabolismo", "metodologia", "otro"
10. \`tags_sugeridos\`: Array de 2-4 tags relevantes en español para nuestro sistema (ej: ["proteina", "sarcopenia", "adultos_mayores"])
11. \`condiciones_relacionadas\`: Array de condiciones de salud relacionadas (ej: ["diabetes", "hta", "dislipemia", "higado_graso", "obesidad"]). Vacío si no aplica.

Devuelve SOLO el JSON.`
}

/**
 * Llama a DeepSeek para extraer campos estructurados de un abstract.
 */
async function extractWithDeepSeek(paper: PaperRaw): Promise<PaperExtraido | null> {
  const apiKey = process.env.DEEPSEEK_API_KEY
  if (!apiKey) {
    throw new Error('DEEPSEEK_API_KEY no configurada')
  }

  const prompt = buildExtractPrompt(paper)

  const response = await fetch(DEEPSEEK_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: DEEPSEEK_MODEL,
      messages: [
        {
          role: 'system',
          content: 'Eres un revisor científico experto. Respondes siempre en español, solo con JSON válido.',
        },
        { role: 'user', content: prompt },
      ],
      temperature: 0.1, // Baja temperatura para consistencia en extracción
      max_tokens: 1000,
    }),
    signal: AbortSignal.timeout(30_000),
  })

  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(`DeepSeek API error ${response.status}: ${errorText}`)
  }

  const data: DeepSeekResponse = await response.json()
  const content = data.choices?.[0]?.message?.content

  if (!content) {
    throw new Error('DeepSeek: respuesta vacía')
  }

  // Extraer JSON del contenido
  const jsonMatch = content.match(/\{[\s\S]*\}/)
  if (!jsonMatch) {
    console.warn(`[extractor] DeepSeek no devolvió JSON válido para: ${paper.titulo.slice(0, 60)}...`)
    console.warn(`[extractor] Contenido: ${content.slice(0, 300)}`)
    return null
  }

  try {
    const parsed = JSON.parse(jsonMatch[0])

    return {
      titulo: paper.titulo,
      abstract: paper.abstract,
      doi: paper.doi,
      enlace: paper.enlace,
      fecha_publicacion: paper.fecha_publicacion,
      fuente_tipo: paper.fuente_tipo,
      revista: paper.revista,
      autores: paper.autores,
      hallazgo_principal: parsed.hallazgo_principal ?? '',
      poblacion: parsed.poblacion ?? '',
      intervencion: parsed.intervencion ?? '',
      resultado_principal: parsed.resultado_principal ?? '',
      diseno_estudio: (parsed.diseno_estudio as DisenoEstudio) ?? 'no_especificado',
      tamano_muestral: typeof parsed.tamano_muestral === 'number' ? parsed.tamano_muestral : 0,
      keywords: Array.isArray(parsed.keywords) ? parsed.keywords : [],
      disciplina_sugerida: parsed.disciplina_sugerida ?? 'general',
      categoria_sugerida: parsed.categoria_sugerida ?? 'otro',
      tags_sugeridos: Array.isArray(parsed.tags_sugeridos) ? parsed.tags_sugeridos : [],
      condiciones_relacionadas: Array.isArray(parsed.condiciones_relacionadas) ? parsed.condiciones_relacionadas : [],
    }
  } catch (parseError) {
    console.warn(`[extractor] Error parseando JSON de DeepSeek: ${parseError}`)
    return null
  }
}

/**
 * Extrae campos de una lista de papers raw usando DeepSeek.
 * Concurrency control para no saturar la API.
 */
export async function extractPapers(
  papers: PaperRaw[],
  options?: { concurrency?: number }
): Promise<PaperExtraido[]> {
  const concurrency = options?.concurrency ?? 3
  const extraidos: PaperExtraido[] = []

  // Procesar en lotes para control de concurrencia
  for (let i = 0; i < papers.length; i += concurrency) {
    const batch = papers.slice(i, i + concurrency)
    const results = await Promise.allSettled(
      batch.map(p => extractWithDeepSeek(p))
    )

    for (const result of results) {
      if (result.status === 'fulfilled' && result.value) {
        extraidos.push(result.value)
      } else if (result.status === 'rejected') {
        console.warn(`[extractor] Error extrayendo paper: ${result.reason}`)
      }
    }

    // Pequeña pausa entre lotes para evitar rate limiting
    if (i + concurrency < papers.length) {
      await new Promise(resolve => setTimeout(resolve, 500))
    }
  }

  return extraidos
}
