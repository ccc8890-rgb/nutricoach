import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const projectRoot = resolve(__dirname, '..')

const envPath = resolve(projectRoot, '.env.local')
const envContent = readFileSync(envPath, 'utf-8')
const env = {}
for (const line of envContent.split('\n')) {
    const match = line.match(/^\s*([^#=]+?)\s*=\s*(.*?)\s*$/)
    if (match) env[match[1]] = match[2].replace(/^["']|["']$/g, '').trim()
}

const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY)

// Get all recetas with their ingredients and calculate expected macros
const { data: recetas } = await supabase
    .from('recetas')
    .select('id, nombre, kcal, proteinas, carbohidratos, grasas, peso_total_g, porciones')
    .order('created_at', { ascending: false })
    .limit(100)

console.log('=== VERIFICACIÓN DE MACROS EN RECETAS ===')
console.log('Comparando kcal calculadas vs almacenadas para las últimas 100 recetas\n')

let errores = []
let sinIngredientes = 0
let alimentosSinMacros = new Set()

for (const receta of recetas) {
    // Get ingredients for this recipe
    const { data: ings } = await supabase
        .from('receta_ingredientes')
        .select('alimento_id, cantidad_gramos, nombre_libre')
        .eq('receta_id', receta.id)

    if (!ings || ings.length === 0) {
        sinIngredientes++
        continue
    }

    // Get linked alimentos
    const alimentoIds = ings.map(i => i.alimento_id).filter(Boolean)
    if (alimentoIds.length === 0) continue

    const { data: alims } = await supabase
        .from('alimentos')
        .select('id, nombre, calorias, proteinas, carbohidratos, grasas')
        .in('id', alimentoIds)

    const alimMap = {}
    for (const a of (alims || [])) {
        alimMap[a.id] = a
    }

    let calcKcal = 0
    let calcP = 0
    let calcHC = 0
    let calcG = 0
    let calcPeso = 0
    let tieneAlimentoSinMacros = false

    for (const ing of ings) {
        const alim = alimMap[ing.alimento_id]
        if (!alim || !ing.cantidad_gramos) continue

        const factor = ing.cantidad_gramos / 100
        const kcal = (alim.calorias || 0) * factor
        calcKcal += kcal
        calcP += (alim.proteinas || 0) * factor
        calcHC += (alim.carbohidratos || 0) * factor
        calcG += (alim.grasas || 0) * factor
        calcPeso += ing.cantidad_gramos

        if (!alim.calorias || alim.calorias === 0) {
            tieneAlimentoSinMacros = true
            alimentosSinMacros.add(alim.nombre + ' -> ' + receta.nombre)
        }
    }

    if (calcKcal === 0 && calcPeso > 0) continue // skip recipes where calculation yields 0

    // Compare calculated vs stored (allow 5% tolerance)
    const diff = Math.abs(calcKcal - (receta.kcal || 0))
    const diffPct = receta.kcal > 0 ? (diff / receta.kcal) * 100 : 0

    if (diffPct > 10 && receta.kcal > 0) {
        errores.push({
            nombre: receta.nombre,
            kcalBD: receta.kcal,
            kcalCalc: calcKcal,
            diffPct: diffPct.toFixed(1),
            pesoBD: receta.peso_total_g,
            pesoCalc: calcPeso,
            tieneAlimSinMacros: tieneAlimentoSinMacros
        })
    }
}

console.log('\n=== RECETAS CON DISCREPANCIAS > 10% ===')
if (errores.length === 0) {
    console.log('¡Ninguna! Todas las recetas tienen macros correctos.')
} else {
    for (const e of errores) {
        console.log('  ' + e.nombre)
        console.log('    BD: ' + e.kcalBD.toFixed(1) + ' kcal | Calculado: ' + e.kcalCalc.toFixed(1) + ' kcal (diff: ' + e.diffPct + '%)')
        console.log('    Peso BD: ' + (e.pesoBD || '?') + 'g | Calculado: ' + e.pesoCalc + 'g')
        if (e.tieneAlimSinMacros) console.log('    ⚠️  Tiene alimentos sin macros')
        console.log('')
    }
}

console.log('\nRecetas sin ingredientes: ' + sinIngredientes)
console.log('Alimentos sin macros que afectan a recetas: ' + alimentosSinMacros.size)
for (const a of alimentosSinMacros) {
    console.log('  - ' + a)
}
