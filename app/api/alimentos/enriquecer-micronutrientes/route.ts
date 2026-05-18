import { NextResponse } from 'next/server'
import { createServerSupabase } from '@/lib/supabase-server'

const DEEPSEEK_API_KEY = process.env.DEEPSEEK_API_KEY
const DEEPSEEK_MODEL = process.env.DEEPSEEK_MODEL || 'deepseek-chat'

/**
 * Endpoint de enriquecimiento de micronutrientes con jerarquía de fuentes:
 *   1. OpenFoodFacts (búsqueda por nombre/código externo)
 *   2. IA (DeepSeek) como fallback
 *
 * POST /api/alimentos/enriquecer-micronutrientes
 * Body: { alimento_id?: string }
 *   - Si se omite alimento_id, procesa todos los alimentos sin micronutrientes
 *   - Si se incluye, procesa solo ese alimento
 */
export async function POST(request: Request) {
    try {
        const supabase = await createServerSupabase()
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

        const body = await request.json().catch(() => ({}))
        const alimentoId = body.alimento_id as string | undefined

        // Buscar alimentos que necesitan micronutrientes (vitamina_a_ug = 0 o null)
        let query = supabase
            .from('alimentos')
            .select('id, nombre, categoria, codigo_externo, calorias, proteinas, carbohidratos, grasas, fuente')
            .or('vitamina_a_ug.is.null, vitamina_a_ug.eq.0')
            .neq('fuente', 'bedca')  // Los BEDCA ya tienen micros

        if (alimentoId) {
            query = query.eq('id', alimentoId)
        }

        const { data: alimentos, error } = await query.limit(50)
        if (error) return NextResponse.json({ error: error.message }, { status: 400 })
        if (!alimentos?.length) {
            return NextResponse.json({
                message: 'Todos los alimentos ya tienen micronutrientes o son fuente BEDCA',
                processed: 0
            })
        }

        let processed = 0
        let errors: string[] = []
        let porFuente = { openfoodfacts: 0, ia: 0 }

        for (const alimento of alimentos) {
            try {
                // PASO 1: Intentar OpenFoodFacts
                const offData = await buscarEnOpenFoodFacts(alimento.nombre, alimento.codigo_externo)

                if (offData) {
                    // OFF tiene micronutrientes → actualizar
                    const { error: updErr } = await supabase
                        .from('alimentos')
                        .update({
                            ...offData,
                            fuente: 'openfoodfacts',
                            micros_actualizados_en: new Date().toISOString(),
                        })
                        .eq('id', alimento.id)

                    if (!updErr) {
                        porFuente.openfoodfacts++
                        processed++
                        continue
                    }
                }

                // PASO 2: Fallback a DeepSeek IA
                if (!DEEPSEEK_API_KEY) {
                    errors.push(`${alimento.nombre}: Sin DEEPSEEK_API_KEY`)
                    continue
                }

                const iaData = await poblarConIA(alimento)
                if (iaData) {
                    const { error: updErr } = await supabase
                        .from('alimentos')
                        .update({
                            ...iaData,
                            fuente: 'ia',
                            micros_actualizados_en: new Date().toISOString(),
                        })
                        .eq('id', alimento.id)

                    if (!updErr) {
                        porFuente.ia++
                        processed++
                    } else {
                        errors.push(`${alimento.nombre}: ${updErr.message}`)
                    }
                } else {
                    errors.push(`${alimento.nombre}: IA no devolvió datos`)
                }
            } catch (err: any) {
                errors.push(`${alimento.nombre}: ${err.message}`)
            }
        }

        return NextResponse.json({
            processed,
            total: alimentos.length,
            porFuente,
            errors: errors.length > 0 ? errors.slice(0, 10) : [],
        })
    } catch (err: any) {
        return NextResponse.json({ error: err.message }, { status: 500 })
    }
}

// ── OpenFoodFacts: buscar un producto y extraer micronutrientes ──────────
async function buscarEnOpenFoodFacts(
    nombre: string,
    codigoExterno?: string | null
): Promise<Record<string, number> | null> {
    try {
        let url: string

        if (codigoExterno) {
            // Búsqueda por código de barras
            url = `https://world.openfoodfacts.org/api/v2/product/${codigoExterno}.json`
        } else {
            // Búsqueda por nombre
            const query = encodeURIComponent(
                nombre
                    .replace(/\(.*?\)/g, '')  // quitar "(cruda)", etc.
                    .replace(/,/g, '')
                    .trim()
            )
            url = `https://world.openfoodfacts.org/cgi/search.pl?search_terms=${query}&search_simple=1&action=process&json=1&lc=es&cc=es&fields=product_name,nutriments&page_size=3`
        }

        const res = await fetch(url, { next: { revalidate: 86400 } })
        if (!res.ok) return null

        const json = await res.json()

        let nutriments: any = null

        if (codigoExterno) {
            // Producto individual
            if (json.status !== 1) return null
            nutriments = json.product?.nutriments
        } else {
            // Lista de productos
            const products: any[] = json.products ?? []
            if (!products.length) return null
            nutriments = products[0].nutriments
        }

        if (!nutriments) return null

        // Mapear campos de OFF a nuestro schema
        // OFF usa: _100g suffix, nosotros usamos _mg, _ug, _g
        const mapeo: Record<string, string> = {
            'vitamin-a_100g': 'vitamina_a_ug',
            'vitamin-c_100g': 'vitamina_c_mg',
            'vitamin-d_100g': 'vitamina_d_ug',
            'vitamin-e_100g': 'vitamina_e_mg',
            'vitamin-k_100g': 'vitamina_k_ug',
            'vitamin-b6_100g': 'vitamina_b6_mg',
            'vitamin-b12_100g': 'vitamina_b12_ug',
            'vitamin-b1_100g': 'tiamina_mg',
            'vitamin-b2_100g': 'riboflavina_mg',
            'vitamin-b3_100g': 'niacina_mg',
            'folates_100g': 'folato_ug',
            'calcium_100g': 'calcio_mg',
            'iron_100g': 'hierro_mg',
            'magnesium_100g': 'magnesio_mg',
            'phosphorus_100g': 'fosforo_mg',
            'potassium_100g': 'potasio_mg',
            'sodium_100g': 'sodio_mg',
            'zinc_100g': 'zinc_mg',
            'copper_100g': 'cobre_mg',
            'selenium_100g': 'selenio_ug',
            'saturated-fat_100g': 'saturados_g',
            'monounsaturated-fat_100g': 'monoinsaturados_g',
            'polyunsaturated-fat_100g': 'poliinsaturados_g',
            'cholesterol_100g': 'colesterol_mg',
        }

        const result: Record<string, number> = {}

        for (const [offKey, nuestroKey] of Object.entries(mapeo)) {
            const val = nutriments[offKey]
            if (val != null && !isNaN(val)) {
                // OFF devuelve en µg para vitaminas A, D, K, B12, folatos, selenio
                // y en mg para el resto. Nuestro schema usa _ug para µg y _mg para mg
                // OFF ya usa la unidad correcta según el campo, solo redondeamos
                result[nuestroKey] = Math.round(val * 100) / 100
            }
        }

        // Si al menos tenemos 3 micronutrientes, consideramos que es válido
        const numMicros = Object.keys(result).length
        if (numMicros < 3) return null

        return result
    } catch {
        return null
    }
}

// ── DeepSeek IA: generar micronutrientes ─────────────────────────────────
async function poblarConIA(alimento: {
    id: string
    nombre: string
    categoria: string
    calorias: number
    proteinas: number
    carbohidratos: number
    grasas: number
}): Promise<Record<string, number> | null> {
    const prompt = `Eres un nutricionista experto. Proporciona los micronutrientes por 100g de "${alimento.nombre}" (categoría: ${alimento.categoria}).

Macros conocidos: ${alimento.calorias} kcal, ${alimento.proteinas}g proteínas, ${alimento.carbohidratos}g carbohidratos, ${alimento.grasas}g grasas.

Responde ÚNICAMENTE con un JSON válido (sin markdown, sin explicaciones) con estos campos y sus valores numéricos. Usa 0 si no aplica:

{
  "vitamina_a_ug": número,
  "vitamina_c_mg": número,
  "vitamina_d_ug": número,
  "vitamina_e_mg": número,
  "vitamina_k_ug": número,
  "vitamina_b6_mg": número,
  "vitamina_b12_ug": número,
  "tiamina_mg": número,
  "riboflavina_mg": número,
  "niacina_mg": número,
  "folato_ug": número,
  "calcio_mg": número,
  "hierro_mg": número,
  "magnesio_mg": número,
  "fosforo_mg": número,
  "potasio_mg": número,
  "sodio_mg": número,
  "zinc_mg": número,
  "cobre_mg": número,
  "selenio_ug": número,
  "saturados_g": número,
  "monoinsaturados_g": número,
  "poliinsaturados_g": número,
  "colesterol_mg": número
}

Basado en datos científicos de BEDCA/USDA. Valores redondeados a 2 decimales.`

    try {
        const res = await fetch('https://api.deepseek.com/chat/completions', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${DEEPSEEK_API_KEY}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                model: DEEPSEEK_MODEL,
                messages: [{ role: 'user', content: prompt }],
                temperature: 0.1,
                max_tokens: 800,
            }),
        })

        if (!res.ok) return null

        const json = await res.json()
        const content = json.choices?.[0]?.message?.content
        if (!content) return null

        // Extraer JSON de la respuesta (puede venir envuelto en markdown)
        const jsonMatch = content.match(/\{[\s\S]*\}/)
        if (!jsonMatch) return null

        const data = JSON.parse(jsonMatch[0])

        // Validar que al menos tenga algunos campos
        const campos = [
            'vitamina_a_ug', 'vitamina_c_mg', 'vitamina_d_ug', 'vitamina_e_mg', 'vitamina_k_ug',
            'vitamina_b6_mg', 'vitamina_b12_ug', 'tiamina_mg', 'riboflavina_mg', 'niacina_mg', 'folato_ug',
            'calcio_mg', 'hierro_mg', 'magnesio_mg', 'fosforo_mg', 'potasio_mg', 'sodio_mg', 'zinc_mg', 'cobre_mg', 'selenio_ug',
            'saturados_g', 'monoinsaturados_g', 'poliinsaturados_g', 'colesterol_mg',
        ]

        const result: Record<string, number> = {}
        for (const campo of campos) {
            const val = data[campo]
            if (val != null && !isNaN(val)) {
                result[campo] = Math.round(val * 100) / 100
            }
        }

        const numCampos = Object.keys(result).length
        if (numCampos < 5) return null // mín 5 campos para considerar válido

        return result
    } catch {
        return null
    }
}
