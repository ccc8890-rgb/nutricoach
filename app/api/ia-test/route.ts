/**
 * API route: POST /api/ia-test
 *
 * Probador de IA — envía un prompt a DeepSeek y devuelve la respuesta.
 * No guarda en registros_ia, solo testea prompts libremente.
 * Protegida: solo usuarios autenticados pueden usarla.
 */
import { NextRequest } from 'next/server'
import { createApiSupabase } from '@/lib/supabase-server'

const DEEPSEEK_API_URL = 'https://api.deepseek.com/v1/chat/completions'

const MODELO_POR_DEFECTO = process.env.DEEPSEEK_MODEL || 'deepseek-v4-pro'

const SYSTEM_PROMPTS: Record<string, string> = {
    neutral: 'Eres un asistente útil.',
    coach_nutricional: `Eres un coach nutricional experto. Responde preguntas sobre nutrición, dietas, y alimentación saludable basándote en ciencia actual.`,
    generador_recetas: `Eres un chef nutricional. Ayudas a crear recetas saludables adaptadas a objetivos fitness. Responde en español.`,
    traductor_macros: `Convierte descripciones de comidas en macros estimados (kcal, proteinas, carbohidratos, grasas). Responde SOLO con JSON.`,
}

export async function POST(request: NextRequest) {
    try {
        // 🔐 Autenticación obligatoria
        const supabase = createApiSupabase(request)
        const { data: { user }, error: authError } = await supabase.auth.getUser()
        if (authError || !user) {
            return Response.json({ error: 'No autorizado' }, { status: 401 })
        }

        const body = await request.json()
        const { prompt, systemPromptKey = 'neutral', temperatura = 0.7, maxTokens = 2000 } = body

        if (!prompt || typeof prompt !== 'string') {
            return Response.json({ error: 'Falta el prompt' }, { status: 400 })
        }

        const systemContent = SYSTEM_PROMPTS[systemPromptKey] || SYSTEM_PROMPTS.neutral

        const response = await fetch(DEEPSEEK_API_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${process.env.DEEPSEEK_API_KEY}`,
            },
            body: JSON.stringify({
                model: MODELO_POR_DEFECTO,
                messages: [
                    { role: 'system', content: systemContent },
                    { role: 'user', content: prompt },
                ],
                temperature: temperatura,
                max_tokens: maxTokens,
            }),
        })

        if (!response.ok) {
            const errorText = await response.text()
            return Response.json({
                error: `DeepSeek API error: ${response.status}`,
                detalle: errorText,
            }, { status: response.status })
        }

        const data = await response.json()

        return Response.json({
            respuesta: data.choices?.[0]?.message?.content ?? '',
            modelo: data.model || MODELO_POR_DEFECTO,
            tokens: {
                prompt: data.usage?.prompt_tokens ?? 0,
                completion: data.usage?.completion_tokens ?? 0,
                total: data.usage?.total_tokens ?? 0,
            },
        })
    } catch (err) {
        const message = err instanceof Error ? err.message : 'Error desconocido'
        return Response.json({ error: message }, { status: 500 })
    }
}
