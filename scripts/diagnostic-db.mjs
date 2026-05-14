/**
 * Diagnóstico: estado actual de alimentos e ingredientes
 */
import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'fs'
import { resolve } from 'path'

const envPath = resolve(process.cwd(), '.env.local')
const envContent = readFileSync(envPath, 'utf-8')
for (const line of envContent.split('\n')) {
    const [key, ...rest] = line.split('=')
    if (key && rest.length) process.env[key.trim()] = rest.join('=').trim()
}

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { persistSession: false } }
)

async function main() {
    // 1. Total alimentos
    const { count: total } = await supabase.from('alimentos').select('*', { count: 'exact', head: true })
    console.log('📦 Total alimentos:', total)

    // 2. Por categoría
    const { data: all } = await supabase.from('alimentos').select('categoria')
    const catCount = {}
    for (const a of all || []) { catCount[a.categoria] = (catCount[a.categoria] || 0) + 1 }
    console.log('\n📊 Por categoría:')
    const sorted = Object.entries(catCount).sort((a, b) => b[1] - a[1])
    for (const [k, v] of sorted) console.log(`  ${String(k).padEnd(20)} ${v}`)

    // 3. Ingredientes sin match
    const { count: riTotal } = await supabase.from('receta_ingredientes').select('*', { count: 'exact', head: true })
    const { count: sinMatch } = await supabase.from('receta_ingredientes').select('*', { count: 'exact', head: true }).is('alimento_id', null)
    const conMatch = riTotal - sinMatch
    const pct = riTotal > 0 ? Math.round((conMatch / riTotal) * 100) : 0
    console.log(`\n🥄 Ingredientes totales: ${riTotal}`)
    console.log(`✅ Con match: ${conMatch} (${pct}%)`)
    console.log(`❌ Sin match: ${sinMatch}`)

    // 4. Alimentos básicos que deberían existir
    const basicos = [
        'Pollo', 'Pechuga de pollo', 'Ternera', 'Cerdo', 'Solomillo de cerdo',
        'Salmón', 'Salmón ahumado', 'Merluza', 'Atún', 'Pescado blanco',
        'Arroz', 'Pasta', 'Huevo', 'Leche', 'Pan integral', 'Aceite de oliva',
        'Cebolla', 'Ajo', 'Tomate', 'Zanahoria', 'Patata', 'Pimiento',
        'Manzana', 'Plátano', 'Naranja', 'Fresa', 'Calabacín',
        'Yogur natural', 'Queso fresco', 'Aguacate', 'Almendras'
    ]
    const { data: existentes } = await supabase.from('alimentos').select('nombre, categoria').in('nombre', basicos)
    const existentesSet = new Set(existentes?.map(a => a.nombre) || [])
    console.log('\n🔍 Alimentos básicos:')
    for (const b of basicos) {
        console.log(`  ${existentesSet.has(b) ? '✅' : '❌'} ${b}`)
    }

    // 5. Ejemplos de ingredientes sin match
    const { data: sinMatchEj } = await supabase
        .from('receta_ingredientes')
        .select('nombre_libre')
        .is('alimento_id', null)
        .limit(30)
    if (sinMatchEj?.length) {
        console.log(`\n🔍 ${sinMatchEj.length} ingredientes sin match (primeros 30):`)
        for (const s of sinMatchEj) console.log(`  ❌ ${s.nombre_libre}`)
    }

    // 6. Recetas que existen
    const { count: recetasCount } = await supabase.from('recetas').select('*', { count: 'exact', head: true })
    console.log(`\n📝 Recetas en BD: ${recetasCount}`)

    process.exit(0)
}

main().catch(err => { console.error(err); process.exit(1) })
