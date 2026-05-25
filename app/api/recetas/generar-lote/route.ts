import { NextRequest, NextResponse } from 'next/server'
import { createApiSupabase } from '@/lib/supabase-server'
import {
  construirPromptLoteRecetas,
  COSTE_MAXIMO_ESTIMADO_USD,
  estimarCosteLoteUSD,
  extraerJsonLoteRecetas,
  MAX_OUTPUT_TOKENS_LOTE,
  normalizarRequestLoteRecetas,
  type LoteRecetasRequest,
} from '@/lib/recetas/generacion-lote'

const DEEPSEEK_API_URL = 'https://api.deepseek.com/v1/chat/completions'
const DEEPSEEK_MODEL = process.env.DEEPSEEK_MODEL || 'deepseek-chat'

export async function POST(request: NextRequest) {
  const supabase = createApiSupabase(request)
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const body = await request.json() as LoteRecetasRequest
  const input = normalizarRequestLoteRecetas(body)
  const prompt = construirPromptLoteRecetas(input)
  const costeEstimadoUsd = estimarCosteLoteUSD(prompt, MAX_OUTPUT_TOKENS_LOTE)

  if (costeEstimadoUsd > COSTE_MAXIMO_ESTIMADO_USD) {
    return NextResponse.json({
      error: 'Coste estimado superior al límite por lote',
      coste_estimado_usd: costeEstimadoUsd,
      coste_maximo_usd: COSTE_MAXIMO_ESTIMADO_USD,
    }, { status: 400 })
  }

  if (!input.confirmar) {
    return NextResponse.json({
      modo: 'preview',
      proveedor: input.proveedor,
      modelo: DEEPSEEK_MODEL,
      coste_estimado_usd: costeEstimadoUsd,
      max_output_tokens: MAX_OUTPUT_TOKENS_LOTE,
      input,
      prompt,
      aviso: 'Preview sin consumo IA. Enviar confirmar=true para llamar a DeepSeek.',
    })
  }

  const apiKey = process.env.DEEPSEEK_API_KEY
  if (!apiKey) {
    return NextResponse.json({ error: 'DEEPSEEK_API_KEY no configurada' }, { status: 500 })
  }

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
          content: 'Eres un chef nutricional y dietista deportivo. Respondes solo JSON válido. No uses OpenAI ni herramientas externas.',
        },
        { role: 'user', content: prompt },
      ],
      temperature: 0.75,
      max_tokens: MAX_OUTPUT_TOKENS_LOTE,
    }),
  })

  if (!response.ok) {
    const detalle = await response.text()
    return NextResponse.json({ error: `DeepSeek error ${response.status}`, detalle }, { status: response.status })
  }

  const data = await response.json()
  const content = data.choices?.[0]?.message?.content
  if (!content) return NextResponse.json({ error: 'DeepSeek devolvió respuesta vacía' }, { status: 502 })

  try {
    const parsed = extraerJsonLoteRecetas(content)
    return NextResponse.json({
      modo: 'generado',
      proveedor: input.proveedor,
      modelo: data.model || DEEPSEEK_MODEL,
      coste_estimado_usd: costeEstimadoUsd,
      tokens: data.usage ?? null,
      recetas: parsed.recetas,
      aviso: 'Recetas generadas para revisión. No se han aprobado ni insertado automáticamente.',
    })
  } catch (error) {
    return NextResponse.json({
      error: error instanceof Error ? error.message : 'JSON inválido',
      raw: content.slice(0, 2000),
    }, { status: 502 })
  }
}
