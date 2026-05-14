/**
 * Diagnóstico COMPLETO del ecosistema: recetas, alimentos, ingredientes, macros, precios
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
    console.log('══════════════════════════════════════════')
    console.log('   DIAGNÓSTICO COMPLETO DEL ECOSISTEMA')
    console.log('══════════════════════════════════════════\n')

    // ── 1. ALIMENTOS ──────────────────────────────────
    console.log('📦 ALIMENTOS')
    const { count: totalAlimentos } = await supabase.from('alimentos').select('*', { count: 'exact', head: true })
    console.log(`  Total: ${totalAlimentos}`)

    const { count: conMacros } = await supabase.from('alimentos').select('*', { count: 'exact', head: true }).not('proteinas', 'is', null)
    const { count: sinMacros } = await supabase.from('alimentos').select('*', { count: 'exact', head: true }).is('proteinas', null)
    console.log(`  Con macros: ${conMacros}`)
    console.log(`  Sin macros: ${sinMacros}`)

    // Categorías NO alimento
    const { data: allAlimentos } = await supabase.from('alimentos').select('id, nombre, categoria, proteinas, calorias')
    const categoriasBasura = ['pañal', 'toallitas', 'limpieza', 'cápsulas', 'accesorios', 'braguita', 'lotes hombre', 'monodosis', 'chicles', 'caramelos']
    const basura = allAlimentos?.filter(a => a.categoria && categoriasBasura.some(c => a.categoria.toLowerCase().includes(c))) || []
    console.log(`\n  🗑️ Categorías basura:`)
    const basuraPorCat = {}
    for (const b of basura) {
        if (b.categoria) basuraPorCat[b.categoria] = (basuraPorCat[b.categoria] || 0) + 1
    }
    for (const [cat, count] of Object.entries(basuraPorCat).sort((a, b) => b[1] - a[1])) {
        console.log(`    ${cat}: ${count}`)
    }
    console.log(`  Total basura: ${basura.length} (${((basura.length / totalAlimentos) * 100).toFixed(1)}%) de alimentos`)

    // Origen de alimentos
    const origenCount = {}
    for (const a of allAlimentos || []) {
        const o = a.categoria || 'sin categoria'
        if (!categoriasBasura.some(c => o.toLowerCase().includes(c))) {
            origenCount[o] = (origenCount[o] || 0) + 1
        }
    }
    const sortedOrigen = Object.entries(origenCount).sort((a, b) => b[1] - a[1])
    console.log(`\n  🏪 Top 20 categorías de alimentos reales:`)
    for (const [cat, count] of sortedOrigen.slice(0, 20)) {
        console.log(`    ${cat}: ${count}`)
    }

    // ── 2. RECETA_INGREDIENTES ──────────────────────
    console.log(`\n🥄 RECETA_INGREDIENTES`)
    const { count: riTotal, error: riErr } = await supabase.from('receta_ingredientes').select('*', { count: 'exact', head: true })
    if (riErr) {
        console.log(`  ERROR: ${riErr.message}`)
        return
    }
    const { count: sinMatch } = await supabase.from('receta_ingredientes').select('*', { count: 'exact', head: true }).is('alimento_id', null)
    const conMatch = riTotal - sinMatch
    console.log(`  Total: ${riTotal}`)
    console.log(`  Con match (alimento_id != null): ${conMatch} (${((conMatch / riTotal) * 100).toFixed(1)}%)`)
    console.log(`  Sin match (alimento_id = null): ${sinMatch} (${((sinMatch / riTotal) * 100).toFixed(1)}%)`)

    // Top ingredientes sin match agrupados por nombre
    const { data: sinMatchList } = await supabase
        .from('receta_ingredientes')
        .select('nombre_libre, receta_id')
        .is('alimento_id', null)
        .limit(200)

    const sinMatchCount = {}
    for (const ing of sinMatchList || []) {
        const n = ing.nombre_libre?.toLowerCase().trim()
        if (n) sinMatchCount[n] = (sinMatchCount[n] || 0) + 1
    }
    console.log(`\n  🔍 TOP ingredientes sin match (por frecuencia):`)
    Object.entries(sinMatchCount)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 30)
        .forEach(([nombre, count]) => {
            // Check if a similar food exists in alimentos
            console.log(`    ❌ "${nombre}" (${count} vez/veces)`)
        })

    // ── 3. RECETAS ───────────────────────────────────
    console.log(`\n📝 RECETAS`)
    const { count: totalRecetas } = await supabase.from('recetas').select('*', { count: 'exact', head: true })
    console.log(`  Total: ${totalRecetas}`)

    const { data: estados } = await supabase.from('recetas').select('estado')
    const estadoCount = {}
    for (const r of estados || []) { estadoCount[r.estado] = (estadoCount[r.estado] || 0) + 1 }
    for (const [estado, count] of Object.entries(estadoCount).sort()) {
        console.log(`    ${estado}: ${count}`)
    }

    // Macros de recetas
    const { data: recetasMacros } = await supabase
        .from('recetas')
        .select('id, nombre, kcal, proteinas, grasas, carbohidratos, estado')
        .in('estado', ['aprobada', 'en_revision'])

    const sinKcal = recetasMacros?.filter(r => !r.kcal || r.kcal === 0) || []
    const conKcal = recetasMacros?.filter(r => r.kcal && r.kcal > 0) || []
    console.log(`\n  📊 Macros:`)
    console.log(`    Con kcal: ${conKcal.length}`)
    console.log(`    Sin kcal (0/NULL): ${sinKcal.length}`)
    if (sinKcal.length > 0) {
        console.log(`\n  🚨 Recetas SIN kcal:`)
        sinKcal.slice(0, 10).forEach(r =>
            console.log(`    [${r.estado}] "${r.nombre}" kcal=${r.kcal} P=${r.proteinas} G=${r.grasas} C=${r.carbohidratos}`)
        )
    }

    // Recetas con ingredientes huerfanos
    const { data: recetasConHuerfanos } = await supabase
        .from('receta_ingredientes')
        .select('receta_id')
        .is('alimento_id', null)

    const recetasAfectadas = new Set(recetasConHuerfanos?.map(i => i.receta_id) || [])
    console.log(`\n  🔗 Recetas con ingredientes huérfanos:`)
    console.log(`    ${recetasAfectadas.size} recetas afectadas`)
    if (recetasAfectadas.size > 0) {
        const { data: nombresRecetas } = await supabase
            .from('recetas')
            .select('id, nombre')
            .in('id', [...recetasAfectadas])
        console.log('    Ejemplos:')
        for (const r of (nombresRecetas || []).slice(0, 10)) {
            const huerfanos = sinMatchList?.filter(i => i.receta_id === r.id).map(i => i.nombre_libre).join(', ') || ''
            console.log(`    - "${r.nombre}": ${huerfanos}`)
        }
    }

    // ── 4. PRECIOS ───────────────────────────────────
    console.log(`\n💰 PRECIOS`)
    try {
        const { count: totalPrecios } = await supabase.from('precios_alimento').select('*', { count: 'exact', head: true })
        console.log(`  Total registros: ${totalPrecios}`)
        if (totalPrecios && totalPrecios > 0) {
            const { data: preciosData } = await supabase.from('precios_alimento').select('alimento_id')
            const alimentosConPrecio = new Set(preciosData?.map(p => p.alimento_id) || [])
            console.log(`  Alimentos únicos con precio: ${alimentosConPrecio.size}`)
        }
    } catch (e) {
        console.log(`  ⚠️ Tabla 'precios_alimento' no existe: ${e.message}`)
    }

    // ── 5. RECETAS SIN INGREDIENTES ──────────────────
    console.log(`\n📋 VERIFICACIÓN DE INTEGRIDAD`)
    const { data: recetasWithCounts } = await supabase
        .from('recetas')
        .select('id, nombre')

    let sinIngredientes = 0
    for (const receta of recetasWithCounts || []) {
        const { count } = await supabase
            .from('receta_ingredientes')
            .select('*', { count: 'exact', head: true })
            .eq('receta_id', receta.id)
        if (count === 0) {
            sinIngredientes++
            if (sinIngredientes <= 5) console.log(`  ⚠️ "${receta.nombre}" no tiene ingredientes`)
        }
    }
    if (sinIngredientes > 0) console.log(`  Total recetas sin ingredientes: ${sinIngredientes}`)

    // ── 6. SUMMARY ──────────────────────────────────
    console.log(`\n══════════════════════════════════════════`)
    console.log('   RESUMEN')
    console.log('══════════════════════════════════════════')
    console.log(`  Alimentos totales:     ${totalAlimentos}`)
    console.log(`    Con macros:          ${conMacros} (100%)`)
    console.log(`    Basura a limpiar:    ${basura.length} (${((basura.length / totalAlimentos) * 100).toFixed(1)}%)`)
    console.log(`  Ingredientes total:    ${riTotal}`)
    console.log(`    Con match alimento:  ${conMatch} (${((conMatch / riTotal) * 100).toFixed(1)}%)`)
    console.log(`    Sin match:           ${sinMatch} (${((sinMatch / riTotal) * 100).toFixed(1)}%)`)
    console.log(`  Recetas:               ${totalRecetas}`)
    console.log(`    Sin kcal:            ${sinKcal.length}`)
    console.log(`    Con huérfanos:       ${recetasAfectadas.size}`)
    console.log('')
}

main().catch(err => { console.error(err); process.exit(1) })
