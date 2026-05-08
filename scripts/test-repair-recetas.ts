/**
 * 🧪 TEST: Reparación de 5 recetas con DeepSeek
 * 
 * Prueba la calidad de refinarRecetaConIA() para recetas que:
 * - No tienen instrucciones (solo 1 palabra o null)
 * - Tienen solo 1 ingrediente en la BD
 * - No tienen URL scrapeable
 * 
 * Uso: npx tsx scripts/test-repair-recetas.ts
 */

import { createClient } from '@supabase/supabase-js'
import * as fs from 'fs'
import * as path from 'path'

// ── Cargar .env.local ─────────────────────────────────
function loadEnvLocal() {
    const envPath = path.resolve(process.cwd(), '.env.local')
    if (!fs.existsSync(envPath)) {
        console.warn('⚠️  No se encontró .env.local')
        return
    }
    const content = fs.readFileSync(envPath, 'utf-8')
    for (const line of content.split('\n')) {
        const trimmed = line.trim()
        if (!trimmed || trimmed.startsWith('#')) continue
        const eqIdx = trimmed.indexOf('=')
        if (eqIdx === -1) continue
        const key = trimmed.slice(0, eqIdx).trim()
        const value = trimmed.slice(eqIdx + 1).trim().replace(/^["']|["']$/g, '')
        if (!process.env[key]) process.env[key] = value
    }
}
loadEnvLocal()

interface DeepSeekMessage {
    role: 'system' | 'user' | 'assistant'
    content: string
}

interface DeepSeekResponse {
    choices: { message: { content: string } }[]
    usage: { total_tokens: number }
}

const DEEPSEEK_API_URL = 'https://api.deepseek.com/chat/completions'
const DEEPSEEK_MODEL = 'deepseek-chat'

interface RecetaTest {
    id: string
    nombre: string
    instrucciones_actual: string | null
    url_origen: string | null
    ingrediente_actual: { nombre: string; gramos: number } | null
    tipo: string
}

// ── Seleccionar 5 recetas de prueba ───────────────────
async function seleccionarRecetas(supabase: any): Promise<RecetaTest[]> {
    const casos = [
        { id: '403f3ac1-6418-4c4b-a93c-52ecddd87841', tipo: 'microondas' },   // Cake Crema Arroz
        { id: 'b0221808-b711-4a02-b8ee-3e16778020de', tipo: 'microondas' },   // Donuts Choco
        { id: 'e1a87935-3ecb-45fa-a122-487910ef84f6', tipo: 'snack-frio' },   // Palitos Zanahoria con Hummus
        { id: '767c9dc7-3321-4698-b800-30faac65b0d8', tipo: 'snack-frio' },   // Mix Frutos Secos
        { id: 'b72589e5-4b34-4cba-92d4-6b5e6ecd6e02', tipo: 'url-valida' },  // Gofre Boniato
    ]

    const tests: RecetaTest[] = []

    for (const caso of casos) {
        const { data: receta } = await supabase
            .from('recetas')
            .select('id, nombre, instrucciones, url_origen')
            .eq('id', caso.id)
            .single()

        if (!receta) {
            console.warn(`⚠️  No se encontró receta ${caso.id}`)
            continue
        }

        const { data: ingredientes } = await supabase
            .from('receta_ingredientes')
            .select('nombre_libre, cantidad_gramos')
            .eq('receta_id', caso.id)
            .limit(1)

        tests.push({
            id: receta.id,
            nombre: receta.nombre,
            instrucciones_actual: receta.instrucciones,
            url_origen: receta.url_origen,
            ingrediente_actual: ingredientes?.[0]?.nombre_libre
                ? { nombre: ingredientes[0].nombre_libre, gramos: ingredientes[0].cantidad_gramos }
                : null,
            tipo: caso.tipo,
        })
    }

    return tests
}

// ── Construir prompt sintético para recetas sin raw text ──
function construirPromptParaReceta(receta: RecetaTest): string {
    const metodoCoccion = receta.url_origen && !receta.url_origen.startsWith('http')
        ? receta.url_origen
        : receta.tipo === 'url-valida' ? '(pendiente de scrape)' : 'No especificado'

    const tiempo = !receta.url_origen?.startsWith('http') && /^\d+$/.test(receta.url_origen || '')
        ? `${receta.url_origen} minutos`
        : 'No especificado'

    const ingredientesStr = receta.ingrediente_actual
        ? `- ${receta.ingrediente_actual.nombre}: ${receta.ingrediente_actual.gramos}g (este es el ÚNICO ingrediente actualmente registrado. Infiere los demás por el nombre)`
        : '(sin ingredientes registrados)'

    return `INSTRUCCIÓN: Completa esta receta con tus conocimientos culinarios.

NOMBRE: "${receta.nombre}"
COCCIÓN: ${metodoCoccion}
TIEMPO: ${tiempo}

INGREDIENTE CONOCIDO:
${ingredientesStr}

INSTRUCCIONES ACTUALES: "${receta.instrucciones_actual || '(vacío)'}"`

    // Nota: el prompt JSON template se pasa dentro de refinarRecetaConIA como systemPrompt
}

// ── Llamar a DeepSeek ─────────────────────────────────
async function refinarRecetaConIA(
    textoCrudo: string,
    urlOrigen: string
): Promise<{ data: any; total_tokens: number }> {
    const apiKey = process.env.DEEPSEEK_API_KEY
    if (!apiKey) throw new Error('DEEPSEEK_API_KEY no configurada')

    const systemPrompt = `Eres un nutricionista y chef experto. Transformas recetas incompletas en recetas profesionales completas.

INSTRUCCIONES:
1. Basándote en el nombre de la receta y los ingredientes conocidos, INFIERE los ingredientes faltantes y las instrucciones completas.
2. IDIOMA: Todo en español.
3. MEDIDAS: Sistema métrico (gramos/ml).
4. INSTRUCCIONES: Pasos numerados detallados en lenguaje culinario profesional.
5. MACROS/100g: Para cada ingrediente, estima valores basados en BEDCA/USDA.
6. MACROS TOTALES: Calcula por porción sumando ingredientes y dividiendo entre porciones.
7. Si el nombre indica repostería (cake, bizcocho, donuts, brownie), incluye ingredientes típicos: huevo, harina, edulcorante, levadura, esencia, etc.
8. Si es snack frío (hummus, tostas, mix), incluye ingredientes de preparación en frío.
9. El ingrediente actual en BD es solo UN indicio. Infiere los demás por el nombre del plato.

RESPONDE ÚNICAMENTE CON UN JSON VÁLIDO. SIN markdown, SIN texto adicional.

{
  "nombre": "Nombre de la receta",
  "descripcion": "Descripción profesional y apetitosa",
  "instrucciones": "1. Paso uno...\\n2. Paso dos...\\n",
  "imagen_url": null,
  "porciones": 1,
  "tiempo_prep_min": 5,
  "tiempo_coccion_min": 3,
  "ingredientes": [
    {
      "nombre_original": "nombre original del ingrediente",
      "nombre_limpio": "nombre normalizado",
      "cantidad_gramos": 100,
      "macros_100g": { "kcal": 0, "proteinas": 0, "carbohidratos": 0, "grasas": 0, "fibra": 0 }
    }
  ],
  "macros_por_porcion": {
    "kcal": 0,
    "proteinas": 0,
    "carbohidratos": 0,
    "grasas": 0,
    "fibra": 0
  }
}`

    const messages: DeepSeekMessage[] = [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: `TEXTO CRUDO DE LA RECETA:\n\n${textoCrudo}\n\nURL: ${urlOrigen}` },
    ]

    const response = await fetch(DEEPSEEK_API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
        body: JSON.stringify({
            model: DEEPSEEK_MODEL,
            messages,
            temperature: 0.2,
            max_tokens: 4096,
        }),
    })

    if (!response.ok) {
        const errorText = await response.text()
        throw new Error(`DeepSeek API error ${response.status}: ${errorText}`)
    }

    const data: DeepSeekResponse = await response.json()
    const content = data.choices?.[0]?.message?.content
    if (!content) throw new Error('DeepSeek: respuesta vacía')

    const jsonMatch = content.match(/\{[\s\S]*\}/)
    if (!jsonMatch) throw new Error(`DeepSeek: respuesta no contiene JSON. Content: ${content.slice(0, 200)}`)

    const parsed = JSON.parse(jsonMatch[0])
    if (!parsed.nombre || !parsed.ingredientes || !parsed.macros_por_porcion) {
        throw new Error('DeepSeek: JSON incompleto')
    }

    return { data: parsed, total_tokens: data.usage.total_tokens }
}

// ── Main ───────────────────────────────────────────────
async function main() {
    console.log('══════════════════════════════════════════════')
    console.log('  🧪 TEST: Reparación de 5 recetas con DeepSeek')
    console.log('══════════════════════════════════════════════\n')

    const supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    const recetas = await seleccionarRecetas(supabase)
    console.log(`Seleccionadas ${recetas.length} recetas para test:\n`)
    recetas.forEach(r => {
        console.log(`  📌 ${r.nombre} (${r.tipo})`)
        console.log(`     URL: ${r.url_origen || '(sin URL)'}`)
        console.log(`     Instr: "${r.instrucciones_actual?.substring(0, 40) || '(null)'}"`)
        console.log(`     Ing: ${r.ingrediente_actual?.nombre || '(ninguno)'} ${r.ingrediente_actual?.gramos || 0}g\n`)
    })

    // ── Probar TODAS ──
    let totalTokens = 0
    let totalTime = 0
    let correctas = 0

    for (let i = 0; i < recetas.length; i++) {
        const recetaTest = recetas[i]
        console.log(`══════════════════════════════════════════════`)
        console.log(`▶️  [${i + 1}/${recetas.length}] ${recetaTest.nombre}`)
        console.log(`══════════════════════════════════════════════\n`)

        try {
            const prompt = construirPromptParaReceta(recetaTest)

            const startTime = Date.now()
            const { data, total_tokens } = await refinarRecetaConIA(prompt, recetaTest.url_origen || 'sin-url')
            const elapsed = ((Date.now() - startTime) / 1000).toFixed(1)
            totalTokens += total_tokens
            totalTime += parseFloat(elapsed)

            // Validar
            const errores: string[] = []
            if (!data.instrucciones || data.instrucciones.length < 50) errores.push('❌ instrucciones cortas')
            if (!data.ingredientes || data.ingredientes.length < 2) errores.push('❌ <2 ingredientes')
            if (!data.macros_por_porcion?.kcal) errores.push('❌ sin kcal')
            if (!data.porciones || data.porciones < 1) errores.push('❌ porciones inválidas')

            if (errores.length === 0) {
                correctas++
                console.log(`   ✅ OK — ${elapsed}s, ${total_tokens} tokens`)
            } else {
                console.log(`   ⚠️  ERRORES:`)
                errores.forEach(e => console.log(`      ${e}`))
            }

            console.log(`\n   📋 ${data.ingredientes.length} ingredientes:`)
            data.ingredientes.forEach((ing: any, i2: number) => {
                console.log(`      ${i2 + 1}. ${ing.nombre_limpio} — ${ing.cantidad_gramos}g`)
            })

            console.log(`\n   📊 Macros/porción: ${data.macros_por_porcion.kcal} kcal | P:${data.macros_por_porcion.proteinas}g | C:${data.macros_por_porcion.carbohidratos}g | G:${data.macros_por_porcion.grasas}g`)

            const instrStart = data.instrucciones.substring(0, 200)
            console.log(`\n   📝 "${instrStart}..."`)

        } catch (err) {
            console.error(`\n   ❌ ERROR:`, err instanceof Error ? err.message : err)
        }
        console.log('')
    }

    // ── Resumen ──
    console.log(`══════════════════════════════════════════════`)
    console.log('  📊 RESUMEN DEL TEST')
    console.log(`══════════════════════════════════════════════`)
    console.log(`  Recetas probadas: ${recetas.length}`)
    console.log(`  Correctas: ${correctas}/${recetas.length}`)
    console.log(`  Tokens totales: ${totalTokens}`)
    console.log(`  Tiempo total: ${totalTime.toFixed(1)}s`)
    console.log(`  Coste aprox: ~$${(totalTokens * 0.00000015 + totalTokens * 0.0000006 * 0.3).toFixed(4)}`)
    console.log(`══════════════════════════════════════════════`)
}

main().catch(err => {
    console.error('Error general:', err)
    process.exit(1)
})
