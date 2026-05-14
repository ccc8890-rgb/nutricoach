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

const RECETA_NOMBRE = 'Tostadas de Arroz con Aguacate y Salmón Ahumado'

// 1. Receta
const { data: recs } = await supabase.from('recetas').select('*').eq('nombre', RECETA_NOMBRE)
const r = recs?.[0]
console.log('=== RECETA ===')
console.log('ID:', r?.id)
console.log('Kcal:', r?.kcal)
console.log('Kcal_100g:', r?.kcal_100g)
console.log('Proteinas:', r?.proteinas)
console.log('Carbohidratos:', r?.carbohidratos)
console.log('Grasas:', r?.grasas)
console.log('Peso total:', r?.peso_total_g)
console.log('Porciones:', r?.porciones)
console.log('')

// 2. Ingredientes
const { data: ings } = await supabase.from('receta_ingredientes').select('*').eq('receta_id', r?.id)
console.log('=== INGREDIENTES (' + (ings?.length || 0) + ') ===')
for (const i of (ings || [])) {
    console.log('  nombre_libre:', i.nombre_libre)
    console.log('  cantidad_gramos:', i.cantidad_gramos)
    console.log('  alimento_id:', i.alimento_id)
    console.log('')
}

// 3. Alimentos linkeados
const alimentoIds = (ings || []).map(i => i.alimento_id).filter(Boolean)
if (alimentoIds.length > 0) {
    const { data: alims } = await supabase.from('alimentos').select('id, nombre, calorias, proteinas, carbohidratos, grasas').in('id', alimentoIds)
    console.log('=== ALIMENTOS LINKADOS ===')
    let totalKcal = 0
    let totalP = 0
    let totalHC = 0
    let totalG = 0
    let pesoTotal = 0
    for (const ing of (ings || [])) {
        const alim = (alims || []).find(a => a.id === ing.alimento_id)
        if (alim && ing.cantidad_gramos) {
            const factor = ing.cantidad_gramos / 100
            const kcal = (alim.calorias || 0) * factor
            const p = (alim.proteinas || 0) * factor
            const hc = (alim.carbohidratos || 0) * factor
            const g = (alim.grasas || 0) * factor
            totalKcal += kcal
            totalP += p
            totalHC += hc
            totalG += g
            pesoTotal += ing.cantidad_gramos
            console.log('  ' + ing.nombre_libre + ' (' + ing.cantidad_gramos + 'g) -> ' + alim.nombre + ': ' + kcal.toFixed(1) + ' kcal')
        } else {
            console.log('  ' + ing.nombre_libre + ' (' + (ing.cantidad_gramos || '?') + 'g) -> SIN ALIMENTO O SIN GRAMOS')
        }
    }
    console.log('')
    console.log('=== COMPARACIÓN ===')
    console.log('Calculado manualmente:')
    console.log('  Kcal: ' + totalKcal.toFixed(1) + ' (vs BD: ' + r?.kcal + ')')
    console.log('  Proteinas: ' + totalP.toFixed(1) + 'g (vs BD: ' + r?.proteinas + ')')
    console.log('  Carbohidratos: ' + totalHC.toFixed(1) + 'g (vs BD: ' + r?.carbohidratos + ')')
    console.log('  Grasas: ' + totalG.toFixed(1) + 'g (vs BD: ' + r?.grasas + ')')
    console.log('  Peso total: ' + pesoTotal + 'g (vs BD: ' + r?.peso_total_g + ')')
    console.log('')
    if (pesoTotal > 0) {
        console.log('Kcal/100g calculado: ' + (totalKcal / pesoTotal * 100).toFixed(1) + ' (vs BD: ' + r?.kcal_100g + ')')
    }
}
