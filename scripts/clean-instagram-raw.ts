import { createClient } from '@supabase/supabase-js'
import * as fs from 'fs'
import * as path from 'path'

function loadEnvLocal() {
    const envPath = path.resolve(process.cwd(), '.env.local')
    if (!fs.existsSync(envPath)) return
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

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const DEEPSEEK_API_KEY = process.env.DEEPSEEK_API_KEY

interface DeepSeekMessage {
    role: 'system' | 'user' | 'assistant'
    content: string
}

interface DeepSeekResponse {
    choices: { message: { content: string } }[]
    usage: { total_tokens: number }
}

async function llamarDeepSeek(messages: DeepSeekMessage[], temp = 0.3): Promise<string> {
    const res = await fetch('https://api.deepseek.com/v1/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${DEEPSEEK_API_KEY}` },
        body: JSON.stringify({
            model: process.env.DEEPSEEK_MODEL || 'deepseek-v4-pro',
            messages,
            temperature: temp,
            max_tokens: 2000,
        }),
    })
    if (!res.ok) {
        const text = await res.text()
        throw new Error(`DeepSeek error ${res.status}: ${text}`)
    }
    const json: DeepSeekResponse = await res.json()
    return json.choices[0].message.content
}

async function main() {
    // Get recipes with kcal=0 (Instagram raw)
    const { data: todas } = await supabase
        .from('recetas')
        .select('id, nombre, instrucciones, porciones, coach_id, kcal')

    const recetas = (todas || []).filter((r: any) => r.kcal === 0 || r.kcal === null)

    console.log(`Total recetas: ${todas?.length || 0}, con kcal=0: ${recetas.length}`)

    if (recetas.length === 0) {
        console.log('No hay recetas con kcal=0')
        return
    }

    console.log(`Procesando ${recetas.length} recetas Instagram raw...\n`)

    for (const receta of recetas) {
        console.log(`=== ${receta.nombre} ===`)

        const prompt = `Eres un nutricionista experto. Te voy a dar una receta en inglés/Spanglish con formato Instagram (hashtags, emojis, likes, etc.). Debes:

1. TRADUCIR las instrucciones a español profesional pero natural (como lo escribiría un coach nutricional)
2. LIMPIAR: quita hashtags, menciones, números de likes, emojis, URLs, y cualquier texto social
3. INFERIR la lista de ingredientes con cantidades en gramos
4. Si la receta no tiene ingredientes claros (ej: "Ideas Tostas Snack" o "Adobos Pollo" que son ideas generales), crea una preparación base razonable

Devuelve SOLO este JSON (sin markdown, sin \`\`\`):
{
  "nombre_limpio": "nombre en español",
  "instrucciones": "instrucciones limpias en español",
  "porciones": número,
  "ingredientes": [
    { "nombre": "nombre del ingrediente", "cantidad_gramos": número }
  ]
}

Receta original:
Nombre: ${receta.nombre}
Instrucciones: ${receta.instrucciones || '(sin instrucciones)'}
Porciones: ${receta.porciones || 1}`

        try {
            const result = await llamarDeepSeek([
                { role: 'system', content: 'Eres un nutricionista que procesa recetas de Instagram. Respondes SOLO con JSON válido.' },
                { role: 'user', content: prompt },
            ])

            // Parse JSON
            const json = JSON.parse(result.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim())

            console.log(`  → ${json.nombre_limpio}`)
            console.log(`  → ${json.ingredientes?.length || 0} ingredientes inferidos`)
            console.log(`  → Instrucciones: ${json.instrucciones?.substring(0, 80)}...`)

            // Now match ingredients via autoMatchIngredientesIA logic
            const ingredientesDB: { alimento_id: string | null; nombre_libre: string; cantidad_gramos: number; orden: number }[] = []
            let matched = 0, autoCreados = 0

            for (let idx = 0; idx < (json.ingredientes || []).length; idx++) {
                const ing = json.ingredientes[idx]
                const busqueda = ing.nombre.toLowerCase().trim()

                // Try exact match
                let encontrado: any = null
                const { data: exacto } = await supabase.from('alimentos')
                    .select('id, nombre').ilike('nombre', busqueda).limit(1).maybeSingle()
                if (exacto) encontrado = exacto

                // Word by word
                if (!encontrado) {
                    const words = busqueda.split(/\s+/).filter((w: string) => w.length > 2)
                    for (const word of words) {
                        const { data: fb } = await supabase.from('alimentos').select('id, nombre').ilike('nombre', `%${word}%`).limit(1).maybeSingle()
                        if (fb) { encontrado = fb; break }
                    }
                }

                if (encontrado) {
                    ingredientesDB.push({ alimento_id: encontrado.id, nombre_libre: encontrado.nombre, cantidad_gramos: ing.cantidad_gramos, orden: idx })
                    matched++
                } else {
                    // Create with default macros (we'll ask DeepSeek for macros in a second pass)
                    ingredientesDB.push({ alimento_id: null, nombre_libre: ing.nombre, cantidad_gramos: ing.cantidad_gramos, orden: idx })
                }
            }

            console.log(`  → Matched: ${matched}/${json.ingredientes?.length || 0}`)

            // If there are unmatched ingredients, try to get macros from DeepSeek
            const unmatched = json.ingredientes?.filter((_: any, i: number) => !ingredientesDB[i].alimento_id) || []
            if (unmatched.length > 0) {
                const macroPrompt = `Dame los macros por 100g para estos ingredientes de cocina. Responde SOLO JSON array:
[${unmatched.map((u: any) => `{"nombre": "${u.nombre}", "kcal": número, "proteinas": número, "carbohidratos": número, "grasas": número, "fibra": número}`).join(',\n')}]`

                try {
                    const macroResult = await llamarDeepSeek([
                        { role: 'system', content: 'Eres un nutricionista. Respondes SOLO con JSON array válido.' },
                        { role: 'user', content: macroPrompt },
                    ], 0.1)

                    const macros: any[] = JSON.parse(macroResult.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim())

                    for (const m of macros) {
                        const idx = json.ingredientes.findIndex((i: any) => i.nombre.toLowerCase().trim() === m.nombre.toLowerCase().trim())
                        if (idx === -1 || ingredientesDB[idx]?.alimento_id) continue

                        const { data: nuevo } = await supabase.from('alimentos').insert({
                            coach_id: receta.coach_id,
                            nombre: m.nombre,
                            calorias: m.kcal || 0,
                            proteinas: m.proteinas || 0,
                            carbohidratos: m.carbohidratos || 0,
                            grasas: m.grasas || 0,
                            fibra: m.fibra || 0,
                            categoria: 'inferido-ia',
                            fuente: 'curada',
                        }).select().single()

                        if (nuevo) {
                            ingredientesDB[idx] = { alimento_id: nuevo.id, nombre_libre: m.nombre, cantidad_gramos: json.ingredientes[idx].cantidad_gramos, orden: idx }
                            autoCreados++
                            matched++
                        }
                    }
                } catch (e) {
                    console.log(`  ⚠️ Error getting macros: ${e}`)
                }
            }

            // Update receta
            const porciones = json.porciones || receta.porciones || 1
            const { data: updated } = await supabase.from('recetas').update({
                nombre: json.nombre_limpio,
                instrucciones: json.instrucciones,
                porciones,
            }).eq('id', receta.id).select().single()

            // Delete existing ingredients and re-insert
            await supabase.from('receta_ingredientes').delete().eq('receta_id', receta.id)

            if (ingredientesDB.length > 0) {
                const { error: insErr } = await supabase.from('receta_ingredientes').insert(
                    ingredientesDB.map(ing => ({
                        receta_id: receta.id,
                        alimento_id: ing.alimento_id,
                        nombre_libre: ing.nombre_libre,
                        cantidad_gramos: ing.cantidad_gramos,
                        orden: ing.orden,
                    }))
                )
                if (insErr) console.log(`  ❌ Error insert ingredientes: ${insErr.message}`)
            }

            // Recalculate kcal
            const { data: ings } = await supabase
                .from('receta_ingredientes')
                .select('alimento_id, cantidad_gramos, alimento:alimentos(calorias, proteinas, carbohidratos, grasas, fibra)')
                .eq('receta_id', receta.id)

            let totalKcal = 0, totalP = 0, totalC = 0, totalG = 0, totalFibra = 0
            for (const ing of ings || []) {
                const alimento = ing.alimento as unknown as { calorias: number; proteinas: number; carbohidratos: number; grasas: number; fibra: number } | null
                if (alimento && ing.cantidad_gramos > 0) {
                    const factor = ing.cantidad_gramos / 100
                    totalKcal += (alimento.calorias || 0) * factor
                    totalP += (alimento.proteinas || 0) * factor
                    totalC += (alimento.carbohidratos || 0) * factor
                    totalG += (alimento.grasas || 0) * factor
                    totalFibra += (alimento.fibra || 0) * factor
                }
            }

            await supabase.from('recetas').update({
                kcal: Math.round((totalKcal / porciones) * 100) / 100,
                proteinas: Math.round((totalP / porciones) * 100) / 100,
                carbohidratos: Math.round((totalC / porciones) * 100) / 100,
                grasas: Math.round((totalG / porciones) * 100) / 100,
                fibra: Math.round((totalFibra / porciones) * 100) / 100,
            }).eq('id', receta.id)

            console.log(`  ✅ ${Math.round(totalKcal)} kcal total, ${Math.round(totalKcal / porciones)} kcal/porción (${matched}/${json.ingredientes?.length || 0} matched, ${autoCreados} auto-creados)`)
            console.log('')
        } catch (e) {
            console.log(`  ❌ Error: ${e}\n`)
        }
    }

    console.log('=== LIMPIEZA COMPLETADA ===')
    const { data: final } = await supabase.from('recetas').select('nombre, kcal')
    const cero = final!.filter(r => r.kcal === 0 || r.kcal === null)
    console.log(`Recetas restantes con kcal=0: ${cero.length}`)
    cero.forEach(r => console.log(`  ${r.nombre}: ${r.kcal}`))
}

main().catch(console.error)
