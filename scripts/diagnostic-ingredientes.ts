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

async function main() {
    // 1. Ingredients without alimento_id, grouped by recipe
    const { data: sins, error: e1 } = await supabase
        .from('receta_ingredientes')
        .select('receta_id, nombre_libre, cantidad_gramos, alimento_id')
        .is('alimento_id', null)

    if (e1) { console.error('Error:', e1); return }

    const porReceta: Record<string, any[]> = {}
    sins!.forEach(i => {
        if (!porReceta[i.receta_id]) porReceta[i.receta_id] = []
        porReceta[i.receta_id].push(i)
    })

    console.log('=== INGREDIENTES SIN alimento_id ===')
    for (const rid of Object.keys(porReceta)) {
        const { data: r } = await supabase.from('recetas').select('nombre, kcal').eq('id', rid).single()
        console.log(`\n${r?.nombre || rid} | kcal: ${r?.kcal} | ${porReceta[rid].length} ingredientes sin DB:`)
        porReceta[rid].forEach(ing => {
            console.log(`   - ${ing.nombre_libre} (${ing.cantidad_gramos}g)`)
        })
    }

    // 2. Recipes with kcal=0 or null
    const { data: recetas } = await supabase.from('recetas').select('id, nombre, kcal')
    const cero = recetas!.filter(r => (r.kcal === 0 || r.kcal === null))
    console.log(`\n=== RECETAS CON kcal=0 O null: ${cero.length} ===`)
    cero.forEach(r => console.log(`   ${r.nombre} -> kcal: ${r.kcal}`))

    // 3. Summary stats
    const { data: allIng } = await supabase.from('receta_ingredientes').select('id, receta_id, alimento_id')
    const totalIng = allIng!.length
    const sinDB = allIng!.filter(i => !i.alimento_id).length
    const conDB = totalIng - sinDB
    console.log(`\n=== ESTADÍSTICAS ===`)
    console.log(`Total ingredientes: ${totalIng}`)
    console.log(`Con alimento_id: ${conDB} (${Math.round(conDB / totalIng * 100)}%)`)
    console.log(`Sin alimento_id: ${sinDB} (${Math.round(sinDB / totalIng * 100)}%)`)
    console.log(`Recetas afectadas: ${Object.keys(porReceta).length}`)
    console.log(`Recetas totales: ${recetas!.length}`)

    // 4. Top ingredient names that appear most frequently without DB match
    const freq: Record<string, number> = {}
    sins!.forEach(i => {
        const key = (i.nombre_libre || '').toLowerCase().trim()
        if (key) freq[key] = (freq[key] || 0) + 1
    })
    const top = Object.entries(freq).sort((a, b) => b[1] - a[1]).slice(0, 20)
    console.log(`\n=== TOP 20 ingredientes sin DB (más frecuentes) ===`)
    top.forEach(([name, count]) => console.log(`   ${name}: ${count} veces`))
}

main().catch(console.error)
