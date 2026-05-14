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

// 1. Problema 1: Alimentos en recetas que tienen 0 kcal (no enriquecidos)
console.log('=== PROBLEMA 1: Ingredientes linkeados a alimentos con 0 kcal ===')
const { data: recIngs } = await supabase
    .from('receta_ingredientes')
    .select('receta_id, alimento_id, nombre_libre, cantidad_gramos')

const alimIds = [...new Set((recIngs || []).map(i => i.alimento_id).filter(Boolean))]
const { data: alims } = await supabase
    .from('alimentos')
    .select('id, nombre, calorias')
    .in('id', alimIds)

const alimMap = {}
for (const a of (alims || [])) alimMap[a.id] = a

// Find all ingredients linked to alimentos with 0 kcal
const ceroKcal = {}
for (const ing of (recIngs || [])) {
    const alim = alimMap[ing.alimento_id]
    if (alim && (!alim.calorias || alim.calorias === 0)) {
        if (!ceroKcal[ing.alimento_id]) {
            ceroKcal[ing.alimento_id] = { nombre: alim.nombre, recetas: [] }
        }
        ceroKcal[ing.alimento_id].recetas.push(ing.nombre_libre || '?')
    }
}

console.log('Alimentos con 0 kcal que están en recetas:')
for (const [id, info] of Object.entries(ceroKcal)) {
    console.log('  - ' + info.nombre + ' (usado en ' + info.recetas.length + ' ingredientes)')
    // Show unique recipe names
    const uniqueRecipes = [...new Set(info.recetas)]
    uniqueRecipes.slice(0, 5).forEach(r => console.log('      → ' + r))
    if (uniqueRecipes.length > 5) console.log('      → ... y ' + (uniqueRecipes.length - 5) + ' más')
}
console.log('Total alimentos con 0 kcal en recetas: ' + Object.keys(ceroKcal).length)

// 2. Problema 2: Matches incorrectos (nombre_libre muy diferente al nombre del alimento)
console.log('\n=== PROBLEMA 2: Posibles matches incorrectos ===')
let sospechosos = []
for (const ing of (recIngs || [])) {
    const alim = alimMap[ing.alimento_id]
    if (alim && ing.nombre_libre) {
        const libre = ing.nombre_libre.toLowerCase()
        const alimNombre = alim.nombre.toLowerCase()
        // Check if nombre_libre doesn't contain any significant word from alimento name
        const palabrasLibre = libre.split(/\s+/)
        const palabrasAlim = alimNombre.split(/\s+/)
        const coinciden = palabrasLibre.some(p => p.length > 3 && alimNombre.includes(p))
        if (!coinciden && libre.length > 3) {
            sospechosos.push({ nombre_libre: ing.nombre_libre, alimento: alim.nombre, kcal: alim.calorias })
        }
    }
}

console.log('Matches dudosos (nombre_libre no coincide con alimento):')
sospechosos.slice(0, 30).forEach(s => {
    console.log('  "' + s.nombre_libre + '" → "' + s.alimento + '" (' + (s.kcal || 0) + ' kcal)')
})
if (sospechosos.length > 30) console.log('  ... y ' + (sospechosos.length - 30) + ' más')
console.log('Total sospechosos: ' + sospechosos.length)

// 3. Verificar que peso_total_g coincida con suma de ingredientes
console.log('\n=== PROBLEMA 3: peso_total_g vs suma de ingredientes ===')
const { data: recetas } = await supabase
    .from('recetas')
    .select('id, nombre, peso_total_g, porciones')
    .limit(218)

let discrepancias = 0
for (const r of (recetas || [])) {
    const { data: ings } = await supabase
        .from('receta_ingredientes')
        .select('cantidad_gramos')
        .eq('receta_id', r.id)

    const sumaIngs = (ings || []).reduce((sum, i) => sum + (i.cantidad_gramos || 0), 0)
    if (sumaIngs > 0 && r.peso_total_g && Math.abs(sumaIngs - r.peso_total_g) > 10) {
        discrepancias++
        if (discrepancias <= 10) {
            console.log('  ' + r.nombre + ': suma_ing=' + sumaIngs + 'g vs peso_total=' + r.peso_total_g + 'g (diff: ' + (sumaIngs - r.peso_total_g) + 'g)')
        }
    }
}
console.log('Recetas con discrepancia de peso: ' + discrepancias)
