import { NextResponse } from 'next/server'
import { createServerSupabase } from '@/lib/supabase-server'

const DEEPSEEK_API_KEY = process.env.DEEPSEEK_API_KEY
const DEEPSEEK_MODEL = process.env.DEEPSEEK_MODEL || 'deepseek-chat'

/**
 * Endpoint to populate micronutrients for all foods (or a single food)
 * using DeepSeek API to generate scientifically accurate values per 100g.
 *
 * POST /api/alimentos/poblar-micronutrientes
 * Body: { alimento_id?: string } — if omitted, processes all foods
 */
export async function POST(request: Request) {
    try {
        const supabase = await createServerSupabase()
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

        const body = await request.json().catch(() => ({}))
        const alimentoId = body.alimento_id as string | undefined

        // Get foods to process
        let query = supabase
            .from('alimentos')
            .select('id, nombre, categoria, calorias, proteinas, carbohidratos, grasas')
            .is('vitamina_a_ug', null)

        if (alimentoId) {
            query = query.eq('id', alimentoId)
        }

        const { data: alimentos, error } = await query.limit(50)
        if (error) return NextResponse.json({ error: error.message }, { status: 400 })
        if (!alimentos?.length) {
            return NextResponse.json({ message: 'No foods need micronutrient data', processed: 0 })
        }

        if (!DEEPSEEK_API_KEY) {
            return NextResponse.json({ error: 'DEEPSEEK_API_KEY not configured' }, { status: 500 })
        }

        let processed = 0
        let errors: string[] = []

        // Process in batches to avoid rate limits
        const batchSize = 5
        for (let i = 0; i < alimentos.length; i += batchSize) {
            const batch = alimentos.slice(i, i + batchSize)

            const results = await Promise.allSettled(
                batch.map(alimento => poblarUnAlimento(alimento, supabase))
            )

            results.forEach((r, idx) => {
                if (r.status === 'fulfilled' && r.value) {
                    processed++
                } else if (r.status === 'rejected') {
                    errors.push(`${batch[idx]?.nombre}: ${r.reason?.message || 'Error'}`)
                }
            })
        }

        return NextResponse.json({
            processed,
            total: alimentos.length,
            errors: errors.length > 0 ? errors.slice(0, 5) : [],
            remaining: alimentos.length - processed,
        })
    } catch (err: any) {
        return NextResponse.json({ error: err.message }, { status: 500 })
    }
}

async function poblarUnAlimento(
    alimento: { id: string; nombre: string; categoria: string; calorias: number; proteinas: number; carbohidratos: number; grasas: number },
    supabase: any
): Promise<boolean> {
    const prompt = `
Eres un nutricionista experto. Proporciona los micronutrientes por 100g de "${alimento.nombre}" (categoría: ${alimento.categoria}).
Basate en bases de datos científicas (BEDCA, USDA, FEN). Responde SOLO con JSON, sin explicaciones.

MACROS CONOCIDOS (por 100g):
- Calorías: ${alimento.calorias} kcal
- Proteínas: ${alimento.proteinas}g
- Carbohidratos: ${alimento.carbohidratos}g
- Grasas: ${alimento.grasas}g

Devuelve este JSON EXACTO (usa 0 si no aplica, valores por 100g):
{
  "vitamina_a_ug": number,
  "vitamina_c_mg": number,
  "vitamina_d_ug": number,
  "vitamina_e_mg": number,
  "vitamina_k_ug": number,
  "vitamina_b6_mg": number,
  "vitamina_b12_ug": number,
  "tiamina_mg": number,
  "riboflavina_mg": number,
  "niacina_mg": number,
  "folato_ug": number,
  "calcio_mg": number,
  "hierro_mg": number,
  "magnesio_mg": number,
  "fosforo_mg": number,
  "potasio_mg": number,
  "sodio_mg": number,
  "zinc_mg": number,
  "cobre_mg": number,
  "selenio_ug": number,
  "saturados_g": number,
  "monoinsaturados_g": number,
  "poliinsaturados_g": number,
  "colesterol_mg": number
}`

    const response = await fetch('https://api.deepseek.com/v1/chat/completions', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${DEEPSEEK_API_KEY}`,
        },
        body: JSON.stringify({
            model: DEEPSEEK_MODEL,
            messages: [{ role: 'user', content: prompt }],
            temperature: 0.1,
            max_tokens: 1000,
        }),
    })

    if (!response.ok) {
        const text = await response.text()
        throw new Error(`DeepSeek API error ${response.status}: ${text.substring(0, 200)}`)
    }

    const json = await response.json()
    const content = json.choices?.[0]?.message?.content
    if (!content) throw new Error('No content in DeepSeek response')

    // Parse JSON from response (handle potential markdown wrapping)
    const jsonMatch = content.match(/\{[\s\S]*\}/)
    if (!jsonMatch) throw new Error('No JSON found in response')

    const micros = JSON.parse(jsonMatch[0])

    // Validate and sanitize values
    const campos = [
        'vitamina_a_ug', 'vitamina_c_mg', 'vitamina_d_ug', 'vitamina_e_mg',
        'vitamina_k_ug', 'vitamina_b6_mg', 'vitamina_b12_ug',
        'tiamina_mg', 'riboflavina_mg', 'niacina_mg', 'folato_ug',
        'calcio_mg', 'hierro_mg', 'magnesio_mg', 'fosforo_mg',
        'potasio_mg', 'sodio_mg', 'zinc_mg', 'cobre_mg', 'selenio_ug',
        'saturados_g', 'monoinsaturados_g', 'poliinsaturados_g', 'colesterol_mg',
    ]

    const updateData: Record<string, number> = {}
    for (const campo of campos) {
        const val = micros[campo]
        if (typeof val === 'number' && !isNaN(val) && isFinite(val)) {
            updateData[campo] = Math.max(0, Math.round(val * 100) / 100) // round to 2 decimals
        } else {
            updateData[campo] = 0
        }
    }

    const { error: updateError } = await supabase
        .from('alimentos')
        .update(updateData)
        .eq('id', alimento.id)

    if (updateError) throw new Error(updateError.message)

    return true
}
