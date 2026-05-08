import { NextRequest, NextResponse } from 'next/server'
import { createApiSupabase } from '@/lib/supabase-server'

const DEEPSEEK_API_URL = 'https://api.deepseek.com/v1/chat/completions'
const DEEPSEEK_MODEL = process.env.DEEPSEEK_MODEL || 'deepseek-chat'

async function fetchUrl(url: string): Promise<string> {
  const res = await fetch(url, {
    signal: AbortSignal.timeout(15000),
    headers: { 'User-Agent': 'Mozilla/5.0 (compatible; NutriCoachBot/1.0)' },
  })
  const html = await res.text()
  // Strip HTML tags, keep text
  return html
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 8000)
}

async function fetchDoi(doi: string): Promise<string> {
  const clean = doi.replace(/^https?:\/\/doi\.org\//i, '').replace(/^doi:/i, '').trim()
  const res = await fetch(`https://api.semanticscholar.org/graph/v1/paper/DOI:${clean}?fields=title,abstract,authors,year,journal`, {
    signal: AbortSignal.timeout(10000),
  })
  if (!res.ok) return ''
  const data = await res.json()
  const authors = (data.authors ?? []).map((a: { name: string }) => a.name).join(', ')
  return `Título: ${data.title ?? ''}\nAño: ${data.year ?? ''}\nRevista: ${data.journal?.name ?? ''}\nAutores: ${authors}\nAbstract: ${data.abstract ?? ''}`
}

export async function POST(request: NextRequest) {
  try {
    const supabase = createApiSupabase(request)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

    const { url, doi, texto } = await request.json()

    if (!url && !doi && !texto) {
      return NextResponse.json({ error: 'Proporciona url, doi o texto' }, { status: 400 })
    }

    let contenido = ''
    let fuente_tipo: 'scrapeado' | 'doi' | 'ia_generado' = 'ia_generado'

    if (doi) {
      contenido = await fetchDoi(doi)
      fuente_tipo = 'doi'
    } else if (url) {
      contenido = await fetchUrl(url)
      fuente_tipo = 'scrapeado'
    } else {
      contenido = texto
    }

    if (!contenido || contenido.length < 50) {
      return NextResponse.json({ error: 'No se pudo extraer contenido suficiente' }, { status: 422 })
    }

    const prompt = `Eres un asistente de nutrición deportiva y ciencias del ejercicio. Analiza el siguiente contenido (paper, artículo o texto) y extrae la información en JSON estructurado para una base de conocimiento de un coach.

CONTENIDO:
${contenido.slice(0, 6000)}

Responde SOLO con JSON válido, sin markdown, con esta estructura exacta:
{
  "titulo": "título del estudio o artículo",
  "resumen": "resumen en 3-5 frases, enfocado en las conclusiones accionables para un coach",
  "puntos_clave": ["punto 1", "punto 2", "punto 3"],
  "fuente": "Autor(es), Año. Revista/Fuente",
  "disciplina": "uno de: nutricion|hyrox|running|ciclismo|triatlon|hibrido|fuerza|recuperacion|general",
  "categoria": "uno de: periodizacion|intensidad|volumen|fuerza|resistencia|hiit|zona2|competicion|recuperacion|proteina|hidratacion|suplementacion|patologia|composicion_corporal|metabolismo|metodologia|otro",
  "tipo": "uno de: estudio|meta_analisis|revision|guia_clinica|protocolo|metodologia|referencia|nota_propia",
  "nivel_evidencia": "uno de: meta_analisis|rct|revision_sistematica|estudio_observacional|opinion_experto|practica_clinica",
  "tags": ["tag1", "tag2", "tag3"],
  "poblacion": ["atletas", "principiantes", etc. - lista de poblaciones objetivo],
  "condiciones": ["hyrox", "diabetes", "menopausia", etc. - condiciones específicas relevantes]
}`

    const apiKey = process.env.DEEPSEEK_API_KEY
    if (!apiKey) return NextResponse.json({ error: 'DEEPSEEK_API_KEY no configurada' }, { status: 500 })

    const aiRes = await fetch(DEEPSEEK_API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: DEEPSEEK_MODEL,
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.2,
        max_tokens: 1500,
      }),
      signal: AbortSignal.timeout(30000),
    })

    if (!aiRes.ok) {
      const err = await aiRes.text()
      return NextResponse.json({ error: `DeepSeek error: ${err}` }, { status: 500 })
    }

    const aiData = await aiRes.json()
    const raw = aiData.choices?.[0]?.message?.content ?? ''

    let parsed: Record<string, unknown>
    try {
      const jsonStr = raw.replace(/^```json\s*/i, '').replace(/```\s*$/i, '').trim()
      parsed = JSON.parse(jsonStr)
    } catch {
      return NextResponse.json({ error: 'La IA no devolvió JSON válido', raw }, { status: 500 })
    }

    return NextResponse.json({
      ...parsed,
      fuente_tipo,
      url_origen: url ?? null,
      doi: doi ?? null,
      contenido_completo: contenido.slice(0, 20000),
    })
  } catch (err) {
    console.error('KB scrape error:', err)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
