/**
 * fix-orphan-ingredients-v2.ts
 *
 * Script mejorado para linkear ingredientes huérfanos (sin alimento_id)
 * usando ILIKE y matching semántico contra la tabla alimentos real.
 * 
 * USO: npx tsx scripts/fix-orphan-ingredients-v2.ts
 */
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
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
)

// Ingredientes que son cabeceras de sección (no alimentos reales)
const CABECERAS = new Set([
    'sal', 'sal y pimienta al gusto', 'pimienta',
    'para las verduras al horno',
    'para la salsa chipotle casera',
    'para las alubias especiadas', 'para el montaje',
])

// Mapas manuales para casos que ILIKE no puede resolver bien
// TODOS los targets han sido verificados contra la DB (05-05-2026)
const MANUAL_MAP: Record<string, string> = {
    // === Carnes ===
    'pechuga de pollo': 'Pechuga de pollo (cruda)',
    'pechuga de pollo en filetes': 'Pechuga de pollo (cruda)',
    'pollo': 'Pechuga de pollo (cruda)',
    'pollo entero': 'Pollo entero con piel',
    'pollo entero con piel': 'Pollo entero con piel',
    'pollo entero sin piel': 'Pollo entero con piel',
    'pollo cocido desmenuzado': 'Pollo entero con piel',
    'carne picada de pollo': 'Carne picada de ternera (5% grasa)',
    'carne molida de res': 'Carne picada de ternera (5% grasa)',
    'hamburguesa de carne sazonada': 'Carne picada de ternera (5% grasa)',
    'bonito asado': 'Atún en lata al natural',

    // === Lácteos y huevos ===
    'leche': 'Leche entera',
    'leche (cualquier tipo)': 'Leche entera',
    'leche para glaseado': 'Leche entera',
    'lácteos: un chorrito de leche': 'Leche entera',
    'leche condensada light': 'Leche semidesnatada',
    'leche evaporada light': 'Leche semidesnatada',
    'huevos': 'Huevo M',
    'huevo': 'Huevo M',
    'queso': 'Queso cottage',
    'queso feta': 'Queso burgos',
    'queso cheddar': 'Queso burgos',
    'queso cheddar rallado': 'Queso burgos',
    'queso parmesano rallado': 'Queso parmesano',
    'queso rallado': 'Queso rallado (mezcla)',
    'mozzarella': 'Queso mozzarella',
    'yogur natural': 'Yogur natural desnatado',
    'yogur griego': 'Yogur griego natural (0%)',
    'yogur griego natural': 'Yogur griego natural (0%)',
    'crema de leche': 'Nata para cocinar (18%)',
    'crema': 'Nata para cocinar (18%)',
    'mantequilla ligera': 'Mantequilla',
    'mantequilla de maní': 'Mantequilla de cacahuete',
    'mantequilla de almendras': 'Mantequilla de cacahuete',
    'mantequilla de almendra': 'Mantequilla de cacahuete',

    // === Harinas y panes ===
    'harina de trigo': 'Harina de avena',
    'harina': 'Harina de avena',
    'harina de almendra': 'Almendras',
    'harina de almendras': 'Almendras',
    'harina de avena': 'Harina de avena',
    'pan rallado': 'Pan de molde blanco',
    'pan rallado integral': 'Pan integral',
    'tortillas de maíz': 'Tortita de arroz',
    'tortillas de harina grandes': 'Pan de pita',
    'levadura': 'levadura química',
    'levadura royal': 'levadura química',
    'maicena': 'maicena',
    'láminas de lasaña sin gluten': 'Pan de pita',

    // === Verduras y hortalizas ===
    'ajo': 'Ajo crudo',
    'ajo en polvo': 'Ajo crudo',
    'ajo rallado': 'Ajo crudo',
    'dientes de ajo': 'Ajo crudo',
    'cebolla': 'Cebolla',
    'cebolla roja': 'Cebolla',
    'patatas': 'Patata (cruda)',
    'puré de patatas': 'Patata cocida',
    'puré de boniato': 'Boniato (crudo)',
    'calabaza butternut': 'Boniato (crudo)',
    'zanahoria': 'Zanahoria (cruda)',
    'espinaca': 'Espinacas (crudas)',
    'lechuga': 'Lechuga romana',
    'tomates secos': 'Tomate cherry',
    'tomate frito': 'Tomate frito (bote)',
    'pasta de tomate': 'Tomate frito (bote)',
    'setas': 'Champiñones',
    'pico de gallo': 'Tomate',
    'chispas de chocolate': 'Chocolate negro 85%',
    'toppings variados': 'Chocolate negro 85%',

    // === Frutas ===
    'plátano': 'Plátano',
    'plátano maduro': 'Plátano',
    'zumo de lima': 'limón',

    // === Aceites y grasas ===
    'aceite': 'Aceite de oliva virgen extra',
    'aceite de oliva': 'Aceite de oliva virgen extra',
    'aceite para freír': 'Aceite de oliva virgen extra',

    // === Salsas y aderezos ===
    'salsa bechamel sin gluten': 'Leche entera',
    'salsa de pescado': 'Salsa de soja (baja en sal)',
    'salsa de hamburguesa (big mac style)': 'Ketchup',
    'salsa ragú': 'Tomate frito (bote)',
    'mayonesa': 'Mayonesa light',
    'aderezo césar': 'Mayonesa light',
    'vinagre': 'Vinagre de manzana',
    'ciracha (sriracha)': 'Salsa de soja (baja en sal)',

    // === Endulzantes ===
    'azúcar': 'azucar glas',
    'azúcar glas para glaseado': 'azucar glas',
    'miel picante': 'Miel',

    // === Frutos secos y semillas ===
    'cacahuetes': 'Cacahuetes (sin sal)',
    'dátiles': 'Dátiles secos',
    'pistacho': 'Pistachos (sin sal)',
    'aceitunas': 'Aceite de oliva virgen extra',
    'crema de cacahuete': 'Crema de cacahuete (sin azúcar)',
    'pasta de maní': 'Crema de cacahuete (natural)',
    'almendras': 'Almendra cruda',
    'almendra': 'Almendra cruda',

    // === Especias y hierbas ===
    'pimienta': 'pimienta',
    'canela': 'canela molida',
    'canela en polvo': 'canela molida',
    'comino': 'comino molido',
    'perejil': 'perejil',
    'especias': 'pimienta',
    'especias (sal, pimienta, etc.)': 'pimienta',
    'jengibre': 'Jengibre fresco',
    'cayena molida': 'pimienta',
    'hojuelas de chile': 'pimienta',
    'chile': 'pimienta',
    'chili flakes': 'pimienta',
    'curry': 'pimienta',
    'curry rojo': 'pimienta',
    'pimentón dulce': 'pimentón dulce',
    'orégano': 'orégano',
    'romero': 'romero',

    // === Líquidos ===
    'vodka': 'Agua con gas',
    'leche de coco': 'Leche de coco (para cocinar)',
    'sirope de arce': 'sirope de arce',

    // === Chocolate y proteínas ===
    'chocolate para fundir': 'Chocolate negro 85%',
    'chocolate puro': 'Chocolate negro 85%',
    'chocolate negro': 'Chocolate negro 85%',
    'proteína whey de vainilla': 'Avena con proteína (polvo)',
    'proteína en polvo': 'Avena con proteína (polvo)',
    'proteína en polvo sabor galleta': 'Avena con proteína (polvo)',

    // === Cereales ===
    'avena': 'Avena (copos)',
    'arroz de sushi': 'Arroz blanco (crudo)',
    'cereal cocoa krispies (seven sundays)': 'Arroz blanco (crudo)',
    'cornflakes triturados': 'Arroz blanco (crudo)',

    // === Otros (aproximaciones) ===
    'malvaviscos (marshmallows)': 'Arroz blanco (crudo)',
    'esencia de vainilla': 'Avena (copos)',
    'joblea de arroz': 'Tortita de arroz',
    'yotecésamo': 'Sésamo',
    'chalotas': 'Cebolla',
    'ajetes': 'Ajo crudo',
    'albahaca': 'perejil',
    'jalea de arroz': 'Miel',
    'mingles bbq seasoning': 'pimienta',
    'aceite de coco': 'Aceite de coco',

    // === Añadidos en 2ª pasada (05-05-2026) ===
    'concentrado de vacuno': 'Caldo de pollo (brick)',
    'fideosudón': 'Pasta (seca)',
    'coco rallado': 'Aceite de coco',
    'sal marina en escamas': 'pimienta',
    'manzanas': 'Manzana (con piel)',
    'especias (bakarat)': 'pimienta',
    'yufka': 'Pan de pita',
    'swina (edulcorante)': 'edulcorante',
    'polvo de hornear': 'levadura química',
    'stevia morena': 'edulcorante',
    'glaseado de queso crema': 'Queso crema light',
    'agua': 'Agua con gas',
    'endulzante al gusto': 'edulcorante',

    // === Añadidos en 3ª pasada (07-05-2026) - ingredientes aún huérfanos ===
    'lechuga iceberg': 'Lechuga',
    'tomate': 'Tomate natural',
    'fresas': 'Fresa',
    'naranja': 'Naranja',
    'garbanzos (cocidos)': 'Garbanzos cocidos',
    'copos de maíz (sin azúcar)': 'Copos de maíz (sin azúcar)',
    'guisantes congelados (cocidos)': 'Guisantes congelados (cocidos)',
    'aceite de oliva en spray': 'Aceite de oliva virgen extra',
    'zumo de 1 lima': 'lima',
}

function normalizar(nombre: string): string {
    return nombre.toLowerCase().trim().replace(/\s+/g, ' ')
}

async function main() {
    console.log('🔍 Buscando ingredientes huérfanos con matching ILIKE...\n')

    // 1. Get all orphans
    const { data: orphans, error: e1 } = await supabase
        .from('receta_ingredientes')
        .select('id, receta_id, nombre_libre, cantidad_gramos')
        .is('alimento_id', null)

    if (e1) { console.error('Error:', e1); return }
    console.log(`Total orphans: ${orphans!.length}`)

    // 2. Get all alimentos for ILIKE matching (cache local)
    const { data: allAlimentos } = await supabase.from('alimentos').select('id, nombre, calorias')
    const alimentosCache = allAlimentos ?? []

    // 3. Build index: normalized name → alimento
    const alimentoByName: Record<string, { id: string; nombre: string }> = {}
    for (const a of alimentosCache) {
        const key = normalizar(a.nombre)
        alimentoByName[key] = { id: a.id, nombre: a.nombre }
    }

    // Also index by first word for partial matching
    const alimentoByFirstWord: Record<string, { id: string; nombre: string }[]> = {}
    for (const a of alimentosCache) {
        const firstWord = normalizar(a.nombre).split(' ')[0]
        if (!alimentoByFirstWord[firstWord]) alimentoByFirstWord[firstWord] = []
        alimentoByFirstWord[firstWord].push({ id: a.id, nombre: a.nombre })
    }

    // 4. For each unique orphan name, find best match
    const nameGroups: Record<string, typeof orphans> = {}
    for (const o of orphans!) {
        const key = normalizar(o.nombre_libre)
        if (!nameGroups[key]) nameGroups[key] = []
        nameGroups[key].push(o)
    }

    let linked = 0
    let skipped = 0
    let unmatched: string[] = []
    const detalle: string[] = []

    for (const [nombreRaw, records] of Object.entries(nameGroups)) {
        const nombre = nombreRaw.trim()
        const cantidad = records[0].cantidad_gramos

        // Skip section headers and 0g items
        if (CABECERAS.has(nombre) || cantidad === 0) {
            skipped++
            detalle.push(`⏭️ CABECERA: "${nombre}" (${cantidad}g) — ${records.length} record(s)`)
            continue
        }

        // Check manual map first
        if (MANUAL_MAP[nombre]) {
            const targetName = MANUAL_MAP[nombre]
            const targetKey = normalizar(targetName)
            const match = alimentoByName[targetKey]

            if (match) {
                for (const rec of records) {
                    await supabase.from('receta_ingredientes').update({
                        alimento_id: match.id,
                        nombre_libre: targetName,
                    }).eq('id', rec.id)
                }
                linked++
                detalle.push(`✅ MANUAL: "${nombre}" → "${targetName}" (${records.length} records)`)
                continue
            }
        }

        // Try exact match in alimentos cache
        if (alimentoByName[nombre]) {
            const match = alimentoByName[nombre]
            for (const rec of records) {
                await supabase.from('receta_ingredientes').update({
                    alimento_id: match.id,
                    nombre_libre: match.nombre,
                }).eq('id', rec.id)
            }
            linked++
            detalle.push(`✅ EXACT: "${nombre}" → "${match.nombre}" (${records.length} records)`)
            continue
        }

        // Try singular/plural normalization
        // Si termina en 's' → probar sin la 's' (plural→singular)
        // Si NO termina en 's' → probar con 's' (singular→plural)
        let pluralMatch = false
        if (nombre.endsWith('s')) {
            const singular = nombre.slice(0, -1) // quita 's'
            if (singular.length > 2 && alimentoByName[singular]) {
                const match = alimentoByName[singular]
                for (const rec of records) {
                    await supabase.from('receta_ingredientes').update({
                        alimento_id: match.id,
                        nombre_libre: match.nombre,
                    }).eq('id', rec.id)
                }
                linked++
                detalle.push(`✅ PLURAL→SINGULAR: "${nombre}" → "${match.nombre}" (${records.length} records)`)
                pluralMatch = true
                continue
            }
            // También probar quitando 'es' (ej: cebollas→cebolla, naranjas→naranja)
            if (nombre.endsWith('es')) {
                const singular2 = nombre.slice(0, -2)
                if (singular2.length > 2 && alimentoByName[singular2]) {
                    const match = alimentoByName[singular2]
                    for (const rec of records) {
                        await supabase.from('receta_ingredientes').update({
                            alimento_id: match.id,
                            nombre_libre: match.nombre,
                        }).eq('id', rec.id)
                    }
                    linked++
                    detalle.push(`✅ PLURAL→SINGULAR: "${nombre}" → "${match.nombre}" (${records.length} records)`)
                    pluralMatch = true
                    continue
                }
            }
        } else {
            // probar añadiendo 's'
            const plural = nombre + 's'
            if (alimentoByName[plural]) {
                const match = alimentoByName[plural]
                for (const rec of records) {
                    await supabase.from('receta_ingredientes').update({
                        alimento_id: match.id,
                        nombre_libre: match.nombre,
                    }).eq('id', rec.id)
                }
                linked++
                detalle.push(`✅ SINGULAR→PLURAL: "${nombre}" → "${match.nombre}" (${records.length} records)`)
                pluralMatch = true
                continue
            }
        }
        if (pluralMatch) continue

        // Try ILIKE search against Supabase
        const searchTerm = nombre.replace(/\s*\([^)]*\)\s*/g, '').trim()
        const { data: ilikeMatches } = await supabase
            .from('alimentos')
            .select('id, nombre')
            .ilike('nombre', `%${searchTerm}%`)
            .limit(5)

        if (ilikeMatches && ilikeMatches.length > 0) {
            // Pick best match (shortest name that contains the search term)
            // Prefer matches where the search term appears at the start
            let bestMatch = ilikeMatches[0]
            for (const m of ilikeMatches) {
                const mNorm = normalizar(m.nombre)
                if (mNorm.startsWith(nombre) || mNorm.startsWith(searchTerm)) {
                    bestMatch = m
                    break
                }
                // Prefer shorter names (more specific)
                if (m.nombre.length < bestMatch.nombre.length) {
                    bestMatch = m
                }
            }

            // Verify match is reasonable
            const mNorm = normalizar(bestMatch.nombre)
            const isReasonable = mNorm.includes(nombre) || nombre.includes(mNorm.split('(')[0].trim())

            if (isReasonable) {
                for (const rec of records) {
                    await supabase.from('receta_ingredientes').update({
                        alimento_id: bestMatch.id,
                        nombre_libre: bestMatch.nombre,
                    }).eq('id', rec.id)
                }
                linked++
                detalle.push(`✅ ILIKE: "${nombre}" → "${bestMatch.nombre}" (${records.length} records)`)
                continue
            }
        }

        // Try first-word matching
        const firstWord = searchTerm.split(' ')[0]
        if (firstWord && firstWord.length > 2 && alimentoByFirstWord[firstWord]) {
            const candidates = alimentoByFirstWord[firstWord]
            // Pick the shortest match (most basic form)
            candidates.sort((a, b) => a.nombre.length - b.nombre.length)
            const best = candidates[0]

            for (const rec of records) {
                await supabase.from('receta_ingredientes').update({
                    alimento_id: best.id,
                    nombre_libre: best.nombre,
                }).eq('id', rec.id)
            }
            linked++
            detalle.push(`✅ PARTIAL: "${nombre}" → "${best.nombre}" (${records.length} records)`)
            continue
        }

        unmatched.push(nombre)
        detalle.push(`❌ SIN MATCH: "${nombre}" (${records.length} records)`)
    }

    console.log('\n=== RESULTADOS ===')
    console.log(`✅ Linkeados: ${linked}`)
    console.log(`⏭️ Cabeceras: ${skipped}`)
    console.log(`❌ Sin match: ${unmatched.length}`)
    console.log(`\n--- Detalle ---`)
    detalle.forEach(d => console.log(d))

    if (unmatched.length > 0) {
        console.log('\n--- Sin match (para añadir al MANUAL_MAP) ---')
        unmatched.forEach(u => console.log(`  '${u}': '',`))
    }

    // Recalcular kcal de recetas afectadas
    const recipeIds = [...new Set(orphans!.map(o => o.receta_id))]
    console.log(`\n=== Recalculando kcal de ${recipeIds.length} recetas... ===`)

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
            kcal: Math.round((totalKcal / porciones) * 100) / 100,
            proteinas: Math.round((totalP / porciones) * 100) / 100,
            carbohidratos: Math.round((totalC / porciones) * 100) / 100,
            grasas: Math.round((totalG / porciones) * 100) / 100,
            fibra: Math.round((totalFibra / porciones) * 100) / 100,
            kcal_por_porcion: Math.round((totalKcal / porciones) * 100) / 100,
            proteinas_por_porcion: Math.round((totalP / porciones) * 100) / 100,
            carbohidratos_por_porcion: Math.round((totalC / porciones) * 100) / 100,
            grasas_por_porcion: Math.round((totalG / porciones) * 100) / 100,
        }).eq('id', rid)

        console.log(`📊 ${receta.nombre || rid}: ${Math.round(totalKcal)} kcal total (${Math.round(totalKcal / porciones)}/porción)`)
    }

    console.log('\n✅ Proceso completado')
}

main().catch(console.error)
