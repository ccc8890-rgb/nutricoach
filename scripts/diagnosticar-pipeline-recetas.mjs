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

// 1. Recetas sin calorías
const { data: sinCalorias, count: countSC } = await supabase
    .from('recetas')
    .select('id, nombre, proteinas, carbohidratos, grasas', { count: 'exact', head: false })
    .is('calorias', null)
    .order('created_at', { ascending: false })
    .limit(20)

console.log('=== RECETAS SIN CALORÍAS (' + (countSC ?? '?') + ' total) ===')
for (const r of (sinCalorias || [])) {
    console.log('  - ' + r.nombre)
    console.log('    P: ' + r.proteinas + ' | HC: ' + r.carbohidratos + ' | G: ' + r.grasas)
}

// 2. Recetas sin ingredientes
const { data: recetas } = await supabase
    .from('recetas')
    .select('id, nombre')
    .order('created_at', { ascending: false })

let sinIngs = []
for (const r of (recetas || []).slice(0, 200)) {
    const { count } = await supabase
        .from('receta_ingredientes')
        .select('*', { count: 'exact', head: true })
        .eq('receta_id', r.id)
    if (count === 0) sinIngs.push(r.nombre)
}

console.log('\n=== RECETAS SIN INGREDIENTES (primeras 200 revisadas) ===')
console.log('Total sin ingredientes: ' + sinIngs.length)
sinIngs.slice(0, 30).forEach(n => console.log('  - ' + n))
if (sinIngs.length > 30) console.log('  ... y ' + (sinIngs.length - 30) + ' más')

// 3. Recetas con calorías pero ingredientes con alimentos no linkeados
const { data: recetasConIngs } = await supabase
    .from('recetas')
    .select('id, nombre, calorias')
    .not('calorias', 'is', null)
    .limit(100)

let conIngsSinLink = 0
let conIngsTodoCorrecto = 0
let malasMacros = 0

for (const r of (recetasConIngs || [])) {
    const { data: ings } = await supabase
        .from('receta_ingredientes')
        .select('alimento_id, gramos')
        .eq('receta_id', r.id)

    if (!ings || ings.length === 0) {
        conIngsSinLink++
        continue
    }

    const todosLinkeados = ings.every(i => i.alimento_id !== null)
    const todosConGramos = ings.every(i => i.gramos !== null && i.gramos > 0)

    if (!todosLinkeados || !todosConGramos) {
        conIngsSinLink++
    } else {
        conIngsTodoCorrecto++
    }
}

console.log('\n=== DIAGNÓSTICO DE 100 RECETAS CON CALORÍAS ===')
console.log('  Sin ingredientes o con ingredientes rotos: ' + conIngsSinLink)
console.log('  Con ingredientes completos (linkeados + gramos): ' + conIngsTodoCorrecto)

// 4. Buscar recetas recientes (últimas 30)
const { data: recientes } = await supabase
    .from('recetas')
    .select('id, nombre, calorias, proteinas, carbohidratos, grasas, created_at')
    .order('created_at', { ascending: false })
    .limit(30)

console.log('\n=== ÚLTIMAS 30 RECETAS ===')
for (const r of (recientes || [])) {
    const { count } = await supabase
        .from('receta_ingredientes')
        .select('*', { count: 'exact', head: true })
        .eq('receta_id', r.id)

    const calStr = r.calorias ?? 'undefined'
    console.log('  ' + r.nombre.slice(0, 50).padEnd(50) + ' | Cal: ' + String(calStr).padEnd(9) + ' | Ing: ' + count)
}
