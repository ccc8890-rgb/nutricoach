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

/** Ingredient names that are section headers, not real ingredients */
const CABECERAS = new Set([
    'para las verduras al horno', 'aceite de oliva en spray',
    'para la salsa chipotle casera', 'zumo de 1 lima',
    'para las alubias especiadas', 'para el montaje',
    'sal y pimienta al gusto', 'sal',
])

/** Ingredients whose names contain measurement prefixes (cdta, cda) — split by those */
function esSubseccion(nombre: string): boolean {
    return /^cdta?\s+(de\s+)?/i.test(nombre.trim())
}

/** Macros por 100g for all known orphan ingredients */
const MACROS: Record<string, { kcal: number; p: number; c: number; g: number; fibra: number }> = {
    'canela molida': { kcal: 247, p: 4, c: 80, g: 1.2, fibra: 53 },
    'canela': { kcal: 247, p: 4, c: 80, g: 1.2, fibra: 53 },
    'levadura química': { kcal: 0, p: 0, c: 0, g: 0, fibra: 0 },
    'levadura quimica': { kcal: 0, p: 0, c: 0, g: 0, fibra: 0 },
    'levadura': { kcal: 0, p: 0, c: 0, g: 0, fibra: 0 },
    'comino molido': { kcal: 375, p: 18, c: 44, g: 22, fibra: 11 },
    'comino': { kcal: 375, p: 18, c: 44, g: 22, fibra: 11 },
    'cilantro molido': { kcal: 23, p: 2, c: 4, g: 0.5, fibra: 3 },
    'cilantro': { kcal: 23, p: 2, c: 4, g: 0.5, fibra: 3 },
    'perejil': { kcal: 36, p: 3, c: 6, g: 0.8, fibra: 3 },
    'eneldo': { kcal: 43, p: 3.5, c: 7, g: 1.1, fibra: 2 },
    'bicarbonato de sodio': { kcal: 0, p: 0, c: 0, g: 0, fibra: 0 },
    'bicarbonato sódico': { kcal: 0, p: 0, c: 0, g: 0, fibra: 0 },
    'nuez moscada molida': { kcal: 525, p: 6, c: 49, g: 36, fibra: 21 },
    'pimentón dulce': { kcal: 282, p: 14, c: 54, g: 13, fibra: 37 },
    'pimentón': { kcal: 282, p: 14, c: 54, g: 13, fibra: 37 },
    'pimienta negra': { kcal: 251, p: 10, c: 64, g: 3.3, fibra: 26 },
    'gelatina en láminas': { kcal: 355, p: 86, c: 0, g: 0, fibra: 0 },
    'gelatina neutra en polvo': { kcal: 355, p: 86, c: 0, g: 0, fibra: 0 },
    'azucar': { kcal: 387, p: 0, c: 100, g: 0, fibra: 0 },
    'azucar glas': { kcal: 387, p: 0, c: 100, g: 0, fibra: 0 },
    'edulcorante': { kcal: 0, p: 0, c: 0, g: 0, fibra: 0 },
    'edulcorante líquido': { kcal: 0, p: 0, c: 0, g: 0, fibra: 0 },
    'eritritol': { kcal: 0, p: 0, c: 0, g: 0, fibra: 0 },
    'tahini': { kcal: 595, p: 17, c: 21, g: 53, fibra: 5 },
    'limón': { kcal: 29, p: 1.1, c: 9, g: 0.3, fibra: 2.8 },
    'limon': { kcal: 29, p: 1.1, c: 9, g: 0.3, fibra: 2.8 },
    'sirope de arce': { kcal: 260, p: 0, c: 67, g: 0, fibra: 0 },
    'sirope de agave': { kcal: 310, p: 0, c: 76, g: 0, fibra: 0 },
    'maicena': { kcal: 357, p: 0.3, c: 87, g: 0.1, fibra: 0.9 },
    'nutella': { kcal: 544, p: 6, c: 57, g: 32, fibra: 3 },
    'cafe espresso': { kcal: 0, p: 0, c: 0, g: 0, fibra: 0 },
    'licor amaretto': { kcal: 280, p: 0, c: 32, g: 0, fibra: 0 },
    'galleta maría': { kcal: 420, p: 7, c: 75, g: 10, fibra: 2 },
    'galletas maría': { kcal: 420, p: 7, c: 75, g: 10, fibra: 2 },
    'ketchup': { kcal: 101, p: 1, c: 27, g: 0.1, fibra: 0.3 },
    'pepinillo encurtido': { kcal: 11, p: 0.3, c: 2.3, g: 0.1, fibra: 1 },
    'puré de açaí congelado': { kcal: 70, p: 1, c: 4, g: 5, fibra: 3 },
    'chipotles en adobo': { kcal: 15, p: 0.5, c: 3, g: 0.2, fibra: 1 },
    'weetabix': { kcal: 380, p: 8, c: 82, g: 2, fibra: 5 },
    'condimento everything bagel': { kcal: 0, p: 0, c: 0, g: 0, fibra: 0 },
    'chili crisp': { kcal: 884, p: 0, c: 0, g: 100, fibra: 0 },
    'levadura nutricional': { kcal: 380, p: 50, c: 35, g: 5, fibra: 20 },
    'batata hervida': { kcal: 86, p: 1.6, c: 20, g: 0.1, fibra: 3 },
    'burrata': { kcal: 260, p: 14, c: 2, g: 22, fibra: 0 },
    'pimenton': { kcal: 282, p: 14, c: 54, g: 13, fibra: 37 },
}

function normalizar(nombre: string): string {
    return nombre.toLowerCase().trim()
}

function buscarKey(nombre: string): string | null {
    const n = normalizar(nombre)
    // Exact match first
    if (MACROS[n]) return n
    // Check substrings
    for (const key of Object.keys(MACROS)) {
        if (n.includes(key) || key.includes(n)) return key
    }
    return null
}

interface OrphanIngredient {
    id: string
    receta_id: string
    nombre_libre: string
    cantidad_gramos: number
    categoria?: string
}

async function main() {
    console.log('🔍 Buscando ingredientes sin alimento_id...')

    // Get all orphan records
    const { data: orphans, error: e1 } = await supabase
        .from('receta_ingredientes')
        .select('id, receta_id, nombre_libre, cantidad_gramos')
        .is('alimento_id', null)

    if (e1) { console.error('Error:', e1); return }
    console.log(`Total orphans found: ${orphans!.length}`)

    // Get coach_id for each recipe
    const recipeIds = [...new Set(orphans!.map(o => o.receta_id))]
    const { data: recetas } = await supabase
        .from('recetas')
        .select('id, nombre, coach_id')
        .in('id', recipeIds)

    const coachMap: Record<string, string> = {}
    const recipeNameMap: Record<string, string> = {}
    recetas?.forEach(r => {
        coachMap[r.id] = r.coach_id
        recipeNameMap[r.id] = r.nombre || r.id
    })

    // Build cache: existing alimentos by name
    const { data: allAlimentos } = await supabase.from('alimentos').select('id, nombre, calorias')
    const existingByName: Record<string, string> = {}
    allAlimentos?.forEach(a => { existingByName[normalizar(a.nombre)] = a.id })

    // Group orphans by normalized name
    const groups: Record<string, OrphanIngredient[]> = {}
    for (const o of orphans!) {
        const key = normalizar(o.nombre_libre)
        if (!groups[key]) groups[key] = []
        groups[key].push(o)
    }

    let skipped = 0
    let linked = 0
    let created = 0
    let unmatched = 0
    let badMatchFixed = 0
    const detalle: string[] = []

    for (const [nombreRaw, records] of Object.entries(groups)) {
        const nombre = nombreRaw.trim()
        const cantidad = records[0].cantidad_gramos
        const coachId = coachMap[records[0].receta_id]

        // Skip section headers and 0g items
        if (CABECERAS.has(nombre) || cantidad === 0 || esSubseccion(nombre)) {
            skipped++
            detalle.push(`⏭️ CABECERA/SECCIÓN: "${nombre}" (${cantidad}g) — ${records.length} record(s)`)
            continue
        }

        // Try linking to existing alimento (case-insensitive exact match)
        if (existingByName[nombre]) {
            const alimentoId = existingByName[nombre]
            for (const rec of records) {
                await supabase.from('receta_ingredientes').update({
                    alimento_id: alimentoId,
                    nombre_libre: nombre,
                }).eq('id', rec.id)
            }
            linked++
            detalle.push(`✅ LINKED existente: "${nombre}" → alimento_id=${alimentoId} (${records.length} records)`)
            continue
        }

        // Check MACROS table
        const macroKey = buscarKey(nombre)
        if (macroKey) {
            const m = MACROS[macroKey]
            // Create alimento
            const { data: nuevo, error: insErr } = await supabase.from('alimentos').insert({
                coach_id: coachId,
                nombre: nombre,
                calorias: m.kcal,
                proteinas: m.p,
                carbohidratos: m.c,
                grasas: m.g,
                fibra: m.fibra,
                categoria: 'especias',
                fuente: 'curada',
            }).select().single()

            if (nuevo) {
                for (const rec of records) {
                    await supabase.from('receta_ingredientes').update({
                        alimento_id: nuevo.id,
                        nombre_libre: nombre,
                    }).eq('id', rec.id)
                }
                created++
                existingByName[nombre] = nuevo.id // cache for next occurrences
                detalle.push(`🆕 CREADO: "${nombre}" (${m.kcal} kcal/100g, ${records.length} records)`)
            } else {
                unmatched++
                detalle.push(`❌ ERROR crear "${nombre}": ${insErr?.message || 'unknown'}`)
            }
        } else {
            unmatched++
            detalle.push(`❌ SIN MACROS: "${nombre}" (${records.length} records)`)
        }
    }

    console.log('\n=== RESULTADOS ===')
    console.log(`🔗 Linked existente: ${linked}`)
    console.log(`🆕 Auto-creados: ${created}`)
    console.log(`⏭️ Cabeceras/secciones: ${skipped}`)
    console.log(`❌ Sin match: ${unmatched}`)
    console.log(`\n--- Detalle ---`)
    detalle.forEach(d => console.log(d))

    // Recalcular kcal de recetas afectadas
    console.log('\n=== Recalculando kcal de recetas afectadas... ===')
    for (const rid of recipeIds) {
        const { data: ingredientes } = await supabase
            .from('receta_ingredientes')
            .select('alimento_id, cantidad_gramos, alimento:alimentos(calorias, proteinas, carbohidratos, grasas, fibra)')
            .eq('receta_id', rid)

        const { data: receta } = await supabase.from('recetas').select('nombre, porciones').eq('id', rid).single()
        if (!receta) continue

        let totalKcal = 0, totalP = 0, totalC = 0, totalG = 0, totalFibra = 0
        for (const ing of ingredientes || []) {
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

        const porciones = receta.porciones || 1
        await supabase.from('recetas').update({
            kcal: Math.round(totalKcal * 100) / 100,
            proteinas: Math.round(totalP * 100) / 100,
            carbohidratos: Math.round(totalC * 100) / 100,
            grasas: Math.round(totalG * 100) / 100,
            fibra: Math.round(totalFibra * 100) / 100,
            kcal_por_porcion: Math.round((totalKcal / porciones) * 100) / 100,
            proteinas_por_porcion: Math.round((totalP / porciones) * 100) / 100,
            carbohidratos_por_porcion: Math.round((totalC / porciones) * 100) / 100,
            grasas_por_porcion: Math.round((totalG / porciones) * 100) / 100,
        }).eq('id', rid)

        console.log(`📊 ${receta.nombre || rid}: ${Math.round(totalKcal)} kcal total (${Math.round(totalKcal / porciones)}/porción)`)
    }
}

main().catch(console.error)
