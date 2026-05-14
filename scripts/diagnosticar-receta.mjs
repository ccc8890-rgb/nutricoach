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

// 1. Buscar la receta por nombre
const { data: receta } = await supabase
    .from('recetas')
    .select('*')
    .ilike('nombre', '%Tostadas%Arroz%Aguacate%Salmón%')

if (!receta || receta.length === 0) {
    console.log('No se encontró la receta exacta. Buscando tostadas...')
    const { data: tostadas } = await supabase
        .from('recetas')
        .select('id, nombre, calorias, proteinas, carbohidratos, grasas, url_origen, created_at')
        .ilike('nombre', '%tostada%')
        .order('created_at', { ascending: false })
        .limit(20)

    if (tostadas) {
        for (const r of tostadas) {
            console.log('ID: ' + r.id)
            console.log('  Nombre: ' + r.nombre)
            console.log('  Cal: ' + r.calorias + ' | P: ' + r.proteinas + ' | HC: ' + r.carbohidratos + ' | G: ' + r.grasas)
            console.log('  URL: ' + (r.url_origen || 'sin url'))
            console.log('  Creada: ' + (r.created_at || '?'))
            console.log('')
        }
    }
    process.exit(0)
}

const r = receta[0]
console.log('== RECETA: ' + r.nombre + ' ==')
console.log('ID: ' + r.id)
console.log('URL: ' + (r.url_origen || 'sin url'))
console.log('Calorias: ' + r.calorias)
console.log('Proteinas: ' + r.proteinas)
console.log('Carbohidratos: ' + r.carbohidratos)
console.log('Grasas: ' + r.grasas)
console.log('Creada: ' + (r.created_at || '?'))
console.log('')

// 2. Ingredientes
const { data: ingredientes } = await supabase
    .from('receta_ingredientes')
    .select('id, nombre, cantidad, unidad, gramos, alimento_id')
    .eq('receta_id', r.id)

console.log('== INGREDIENTES (' + (ingredientes?.length || 0) + ') ==')
for (const ing of (ingredientes || [])) {
    console.log('  - ' + ing.nombre + ': ' + (ing.cantidad || '?') + ' ' + (ing.unidad || '') + ' (' + (ing.gramos || '?') + 'g) -> alimento_id: ' + (ing.alimento_id || 'SIN LINK'))
}

// 3. Instrucciones
console.log('\n== INSTRUCCIONES ==')
if (r.instrucciones) {
    const insts = typeof r.instrucciones === 'string' ? r.instrucciones : JSON.stringify(r.instrucciones)
    console.log(insts.slice(0, 500))
} else {
    console.log('(vacío)')
}
