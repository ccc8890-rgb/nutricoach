/**
 * enriquecer-micronutrientes-batch.ts
 *
 * Script batch para enriquecer micronutrientes de TODOS los alimentos
 * que actualmente tienen vitamina_a_ug = NULL.
 *
 * JERARQUÍA DE FUENTES:
 *   1. OpenFoodFacts (búsqueda por nombre + código de barras)
 *   2. DeepSeek IA (fallback)
 *
 * Incluye desglose completo de carbohidratos:
 *   - azucares (azúcares totales)
 *   - azucares_anyadidos (azúcares añadidos)
 *   - almidon (almidón)
 *   - polialcoholes (polialcoholes/edulcorantes)
 *   - fibra
 *
 * USO:
 *   SUPABASE_SERVICE_ROLE_KEY=... NEXT_PUBLIC_SUPABASE_URL=... npx tsx scripts/enriquecer-micronutrientes-batch.ts
 */

import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!
const DEEPSEEK_API_KEY = process.env.DEEPSEEK_API_KEY
const DEEPSEEK_MODEL = process.env.DEEPSEEK_MODEL || 'deepseek-chat'

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
    console.error('❌ Faltan SUPABASE_SERVICE_ROLE_KEY o NEXT_PUBLIC_SUPABASE_URL')
    process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY)

// ── Campos de micronutrientes ─────────────────────────────────
const CAMPOS_MICROS = [
    'vitamina_a_ug', 'vitamina_c_mg', 'vitamina_d_ug', 'vitamina_e_mg',
    'vitamina_k_ug', 'vitamina_b6_mg', 'vitamina_b12_ug',
    'tiamina_mg', 'riboflavina_mg', 'niacina_mg', 'folato_ug',
    'calcio_mg', 'hierro_mg', 'magnesio_mg', 'fosforo_mg',
    'potasio_mg', 'sodio_mg', 'zinc_mg', 'cobre_mg', 'selenio_ug',
    'saturados_g', 'monoinsaturados_g', 'poliinsaturados_g', 'colesterol_mg',
] as const

// ── OpenFoodFacts mapping (incluye desglose CHO) ──────────────
const OFF_MAP: Record<string, string> = {
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
    // Desglose de carbohidratos
    'sugars_100g': 'azucares',
    'added-sugars_100g': 'azucares_anyadidos',
    'starch_100g': 'almidon',
    'polyols_100g': 'polialcoholes',
    'fiber_100g': 'fibra',
}

// ── Estadísticas ──────────────────────────────────────────────
const stats = {
    total: 0,
    openfoodfacts: 0,
    ia: 0,
    errores: 0,
    erroresLista: [] as string[],
}

// ── Buscar en OpenFoodFacts ───────────────────────────────────
async function buscarOpenFoodFacts(
    nombre: string,
    codigoExterno?: string | null
): Promise<Record<string, number> | null> {
    try {
        let url: string
        if (codigoExterno) {
            url = `https://world.openfoodfacts.org/api/v2/product/${codigoExterno}.json`
        } else {
            const query = encodeURIComponent(
                nombre.replace(/\(.*?\)/g, '').replace(/,/g, '').trim()
            )
            url = `https://world.openfoodfacts.org/cgi/search.pl?search_terms=${query}&search_simple=1&action=process&json=1&lc=es&cc=es&fields=product_name,nutriments&page_size=3`
        }

        const res = await fetch(url)
        if (!res.ok) return null
        const json = await res.json()

        let nutriments: any = null
        if (codigoExterno) {
            if (json.status !== 1) return null
            nutriments = json.product?.nutriments
        } else {
            const products: any[] = json.products ?? []
            if (!products.length) return null
            nutriments = products[0].nutriments
        }
        if (!nutriments) return null

        const result: Record<string, number> = {}
        for (const [offKey, nuestroKey] of Object.entries(OFF_MAP)) {
            const val = nutriments[offKey]
            if (val != null && !isNaN(val)) {
                result[nuestroKey] = Math.round(val * 100) / 100
            }
        }

        return Object.keys(result).length >= 3 ? result : null
    } catch {
        return null
    }
}

// ── DeepSeek IA (con desglose CHO completo) ───────────────────
async function poblarConIA(alimento: {
    nombre: string
    categoria: string | null
    calorias: number
    proteinas: number
    carbohidratos: number
    grasas: number
}): Promise<Record<string, number> | null> {
    if (!DEEPSEEK_API_KEY) return null

    const prompt = `Eres un nutricionista experto. Proporciona los micronutrientes y el desglose de carbohidratos por 100g de "${alimento.nombre}" (categoría: ${alimento.categoria || 'desconocida'}).

Macros conocidos: ${alimento.calorias} kcal, ${alimento.proteinas}g proteínas, ${alimento.carbohidratos}g carbohidratos, ${alimento.grasas}g grasas.

IMPORTANTE — Desglose de carbohidratos: Los ${alimento.carbohidratos}g de carbohidratos totales deben desglosarse razonablemente entre azucares, almidon y polialcoholes (fibra ya se indica aparte). Por ejemplo:
- Fruta fresca: casi todos los CHO son azucares
- Pan/pasta/arroz/patata: mayoritariamente almidon
- Chicles/chucherías "sin azúcar": mayoritariamente polialcoholes
- Productos procesados dulces: mezcla de azucares + almidon

Responde ÚNICAMENTE con un JSON válido (sin markdown, sin explicaciones):

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
  "colesterol_mg": número,
  "azucares": número,
  "azucares_anyadidos": número,
  "almidon": número,
  "polialcoholes": número,
  "fibra": número
}

Basado en datos científicos de BEDCA/USDA. Valores redondeados a 2 decimales. Usa 0 si no aplica.`

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
                max_tokens: 1000,
            }),
        })

        if (!res.ok) {
            const text = await res.text()
            console.warn(`⚠️ DeepSeek API error ${res.status}: ${text.substring(0, 100)}`)
            return null
        }

        const json = await res.json()
        const content = json.choices?.[0]?.message?.content
        if (!content) return null

        const jsonMatch = content.match(/\{[\s\S]*\}/)
        if (!jsonMatch) return null

        const data = JSON.parse(jsonMatch[0])

        const result: Record<string, number> = {}
        for (const campo of [...CAMPOS_MICROS, 'azucares', 'azucares_anyadidos', 'almidon', 'polialcoholes', 'fibra']) {
            const val = data[campo]
            if (val != null && !isNaN(val)) {
                result[campo] = Math.round(val * 100) / 100
            }
        }

        return Object.keys(result).length >= 5 ? result : null
    } catch {
        return null
    }
}

// ── Procesar un alimento ──────────────────────────────────────
async function procesarAlimento(alimento: {
    id: string
    nombre: string
    categoria: string | null
    codigo_externo: string | null
    calorias: number
    proteinas: number
    carbohidratos: number
    grasas: number
}): Promise<boolean> {
    // PASO 1: OpenFoodFacts
    const offData = await buscarOpenFoodFacts(alimento.nombre, alimento.codigo_externo)
    if (offData) {
        const { error } = await supabase
            .from('alimentos')
            .update({
                ...offData,
                fuente: 'openfoodfacts',
                micros_actualizados_en: new Date().toISOString(),
            })
            .eq('id', alimento.id)

        if (!error) {
            stats.openfoodfacts++
            return true
        }
    }

    // PASO 2: DeepSeek IA
    const iaData = await poblarConIA(alimento)
    if (iaData) {
        const { error } = await supabase
            .from('alimentos')
            .update({
                ...iaData,
                fuente: 'ia',
                micros_actualizados_en: new Date().toISOString(),
            })
            .eq('id', alimento.id)

        if (!error) {
            stats.ia++
            return true
        }
    }

    stats.errores++
    stats.erroresLista.push(alimento.nombre)
    return false
}

// ── MAIN ──────────────────────────────────────────────────────
async function main() {
    console.log('🔬 Enriquecimiento de micronutrientes + desglose CHO — Batch')
    console.log(`   Modelo DeepSeek: ${DEEPSEEK_MODEL}`)
    console.log(`   DeepSeek API Key: ${DEEPSEEK_API_KEY ? '✅ configurada' : '❌ NO CONFIGURADA'}`)
    console.log('')

    // Obtener total de alimentos pendientes
    const { count: totalPendientes } = await supabase
        .from('alimentos')
        .select('*', { count: 'exact', head: true })
        .eq('es_comestible', true)
        .is('vitamina_a_ug', null)
        .neq('fuente', 'bedca')

    stats.total = totalPendientes ?? 0
    console.log(`📊 Alimentos pendientes: ${stats.total}`)
    console.log('')

    if (stats.total === 0) {
        console.log('✅ No hay alimentos pendientes de enriquecer.')
        return
    }

    // Procesar en lotes de 50 para no saturar APIs
    const LOTE = 50
    let procesados = 0
    let exitosos = 0

    for (let offset = 0; offset < stats.total; offset += LOTE) {
        const { data: alimentos, error } = await supabase
            .from('alimentos')
            .select('id, nombre, categoria, codigo_externo, calorias, proteinas, carbohidratos, grasas')
            .eq('es_comestible', true)
            .is('vitamina_a_ug', null)
            .neq('fuente', 'bedca')
            .range(offset, offset + LOTE - 1)
            .order('id')

        if (error) {
            console.error(`❌ Error fetching batch at offset ${offset}: ${error.message}`)
            continue
        }
        if (!alimentos?.length) break

        console.log(`\n📦 Lote ${Math.floor(offset / LOTE) + 1}/${Math.ceil(stats.total / LOTE)} (${alimentos.length} alimentos)`)

        for (const alimento of alimentos) {
            const ok = await procesarAlimento(alimento)
            procesados++
            if (ok) exitosos++

            // Progreso cada 10
            if (procesados % 10 === 0) {
                const pct = Math.round((procesados / stats.total) * 100)
                process.stdout.write(`\r   ${procesados}/${stats.total} (${pct}%) — OFF:${stats.openfoodfacts} IA:${stats.ia} Err:${stats.errores}`)
            }
        }

        // Pausa entre lotes para no saturar
        if (offset + LOTE < stats.total) {
            await new Promise(r => setTimeout(r, 1500))
        }
    }

    // Resultados finales
    console.log('\n')
    console.log('═══════════════════════════════════════')
    console.log('✅ ENRIQUECIMIENTO COMPLETADO')
    console.log('═══════════════════════════════════════')
    console.log(`   Total procesados:    ${procesados}`)
    console.log(`   Exitosos:            ${exitosos}`)
    console.log(`   OpenFoodFacts:       ${stats.openfoodfacts}`)
    console.log(`   DeepSeek IA:         ${stats.ia}`)
    console.log(`   Errores:             ${stats.errores}`)
    if (stats.erroresLista.length > 0) {
        console.log(`   Primeros errores:    ${stats.erroresLista.slice(0, 10).join(', ')}`)
    }
    console.log('')

    // Verificar estado final
    const { count: restantes } = await supabase
        .from('alimentos')
        .select('*', { count: 'exact', head: true })
        .is('vitamina_a_ug', null)
        .neq('fuente', 'bedca')

    console.log(`📊 Restantes con micros NULL: ${restantes ?? 0}`)

    // Resumen de desglose CHO
    console.log('')
    console.log('📊 ESTADÍSTICAS DE DESGLOSE CHO:')
    const { data: muestraCHO } = await supabase
        .from('alimentos')
        .select('id, nombre, carbohidratos, azucares, azucares_anyadidos, almidon, polialcoholes, fibra')
        .not('azucares', 'is', null)
        .limit(10)
    if (muestraCHO?.length) {
        console.log('   Muestra de alimentos con desglose CHO:')
        muestraCHO.forEach(a => console.log(`   - ${a.nombre}: CHO=${a.carbohidratos}g azuc=${a.azucares}g anyad=${a.azucares_anyadidos}g almid=${a.almidon}g poli=${a.polialcoholes}g fibra=${a.fibra}g`))
    }
}

main().catch(console.error)
