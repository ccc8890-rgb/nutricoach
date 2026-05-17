/**
 * Diagnóstico de alimentos duplicados creados por fix-matches-ingredientes.mjs
 * 
 * Uso: node --env-file=.env.local scripts/diagnostic-duplicados.mjs
 */
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseKey) {
    console.error('❌ Faltan env vars')
    process.exit(1)
}

const sup = createClient(supabaseUrl, supabaseKey)

async function main() {
    // ─── 1. HARINA DE ALMENDRA (23ec40c0) ──────────────────────────
    console.log('=== 1. HARINA DE ALMENDRA (23ec40c0) ===')
    const { data: ri } = await sup
        .from('receta_ingredientes')
        .select('receta_id, cantidad, unidad')
        .eq('alimento_id', '23ec40c0')

    console.log(`Recetas usando este alimento: ${ri?.length || 0}`)
    for (const r of ri || []) {
        const { data: receta } = await sup
            .from('recetas')
            .select('id, titulo')
            .eq('id', r.receta_id)
            .single()
        console.log(`  [${r.receta_id.slice(0, 8)}] "${receta?.titulo}" - ${r.cantidad} ${r.unidad}`)
    }

    // Check what other "harina de almendra" exist and what recetas they use
    console.log('\n  -- Alimentos similares con recetas vinculadas:')
    const { data: similaresHA } = await sup
        .from('alimentos')
        .select('id, nombre, categoria')
        .or('nombre.ilike.%harina%almendr%,nombre.ilike.%almendra%molida%,nombre.ilike.%almendras%molidas%')

    for (const a of similaresHA || []) {
        const { data: riA } = await sup.from('receta_ingredientes').select('receta_id').eq('alimento_id', a.id)
        const { data: psA } = await sup.from('productos_supermercado').select('id', { count: 'exact' }).eq('alimento_id', a.id)
        if ((riA?.length || 0) > 0 || (psA?.count || 0) > 0) {
            console.log(`  [${a.id.slice(0, 8)}] "${a.nombre}" [${a.categoria}] -> ${riA?.length || 0} recetas, ${psA?.count || 0} productos`)
        } else if (a.nombre === 'Harina de almendra') {
            console.log(`  [${a.id.slice(0, 8)}] "${a.nombre}" [${a.categoria}] -> 0 recetas, 0 prods (huérfano)`)
        }
    }

    // ─── 2. MANTEQUILLA DE CACAHUETE (385eb0e5) ────────────────────
    console.log('\n=== 2. MANTEQUILLA DE CACAHUETE (385eb0e5) ===')
    const { data: ri2 } = await sup
        .from('receta_ingredientes')
        .select('receta_id, cantidad, unidad')
        .eq('alimento_id', '385eb0e5')

    console.log(`Recetas usando este alimento: ${ri2?.length || 0}`)
    for (const r of ri2 || []) {
        const { data: receta } = await sup
            .from('recetas')
            .select('id, titulo')
            .eq('id', r.receta_id)
            .single()
        console.log(`  [${r.receta_id.slice(0, 8)}] "${receta?.titulo}" - ${r.cantidad} ${r.unidad}`)
    }

    console.log('\n  -- Alimentos similares:')
    const { data: similaresMC } = await sup
        .from('alimentos')
        .select('id, nombre, categoria')
        .or('nombre.ilike.%mantequilla%cacahuete%,nombre.ilike.%crema%cacahuete%,nombre.ilike.%peanut butter%')

    for (const a of similaresMC || []) {
        const { data: riA } = await sup.from('receta_ingredientes').select('receta_id').eq('alimento_id', a.id)
        const { data: psA } = await sup.from('productos_supermercado').select('id', { count: 'exact' }).eq('alimento_id', a.id)
        if ((riA?.length || 0) > 0 || (psA?.count || 0) > 0 || a.nombre === 'Mantequilla de cacahuete') {
            console.log(`  [${a.id.slice(0, 8)}] "${a.nombre}" [${a.categoria}] -> ${riA?.length || 0} recetas, ${psA?.count || 0} productos`)
        }
    }

    // ─── 3. SALSA BARBACOA (2628d64e) ──────────────────────────────
    console.log('\n=== 3. SALSA BARBACOA (2628d64e) ===')
    const { data: ri3 } = await sup
        .from('receta_ingredientes')
        .select('receta_id, cantidad, unidad')
        .eq('alimento_id', '2628d64e')

    console.log(`Recetas usando este alimento: ${ri3?.length || 0}`)
    for (const r of ri3 || []) {
        const { data: receta } = await sup
            .from('recetas')
            .select('id, titulo')
            .eq('id', r.receta_id)
            .single()
        console.log(`  [${r.receta_id.slice(0, 8)}] "${receta?.titulo}" - ${r.cantidad} ${r.unidad}`)
    }

    console.log('\n  -- Todos alimentos Salsa Barbacoa (reales, sin platos preparados):')
    const { data: salsas } = await sup
        .from('alimentos')
        .select('id, nombre, categoria')
        .ilike('nombre', '%barbacoa%')

    for (const a of salsas || []) {
        // Skip composite dishes
        if (['ff38ab06', 'f5cfe860', '16d019ac', '645c190a'].includes(a.id)) {
            const { data: riA } = await sup.from('receta_ingredientes').select('receta_id').eq('alimento_id', a.id)
            console.log(`  [${a.id.slice(0, 8)}] "${a.nombre}" [${a.categoria}] -> ${riA?.length || 0} recetas (plato preparado, skip)`)
            continue
        }
        const { data: riA } = await sup.from('receta_ingredientes').select('receta_id').eq('alimento_id', a.id)
        const { data: psA } = await sup.from('productos_supermercado').select('id', { count: 'exact' }).eq('alimento_id', a.id)
        console.log(`  [${a.id.slice(0, 8)}] "${a.nombre}" [${a.categoria}] -> ${riA?.length || 0} recetas, ${psA?.count || 0} productos`)
    }

    // ─── 4. YOGUR DE PROTEÍNA ─────────────────────────────────────
    console.log('\n=== 4. ALIMENTOS YOGUR PROTEÍNA ===')
    // Check if 'Yogur de proteína' exists
    const { data: yp } = await sup
        .from('alimentos')
        .select('id, nombre, categoria')
        .or('nombre.ilike.%yogur%prote%%,nombre.ilike.%yogur%0%%prote%%')

    for (const a of yp || []) {
        const { data: riA } = await sup.from('receta_ingredientes').select('receta_id').eq('alimento_id', a.id)
        const { data: psA } = await sup.from('productos_supermercado').select('id', { count: 'exact' }).eq('alimento_id', a.id)
        console.log(`  [${a.id.slice(0, 8)}] "${a.nombre}" [${a.categoria}] -> ${riA?.length || 0} recetas, ${psA?.count || 0} productos`)
    }

    // ─── 5. CREMA DE AVELLANAS ────────────────────────────────────
    console.log('\n=== 5. ALIMENTOS CREMA DE AVELLANAS ===')
    const { data: av } = await sup
        .from('alimentos')
        .select('id, nombre, categoria')
        .ilike('nombre', '%avellana%')

    for (const a of av || []) {
        const { data: riA } = await sup.from('receta_ingredientes').select('receta_id').eq('alimento_id', a.id)
        const { data: psA } = await sup.from('productos_supermercado').select('id', { count: 'exact' }).eq('alimento_id', a.id)
        console.log(`  [${a.id.slice(0, 8)}] "${a.nombre}" [${a.categoria}] -> ${riA?.length || 0} recetas, ${psA?.count || 0} productos`)
    }

    // ─── RESUMEN ──────────────────────────────────────────────────
    console.log('\n═══════════════════════════════════════════')
    console.log('  RESUMEN')
    console.log('═══════════════════════════════════════════')

    console.log('\n📌 Harina de almendra:')
    const { data: haAll } = await sup.from('alimentos').select('id, nombre').or('nombre.ilike.%harina%almendr%,nombre.ilike.%almendra%molida%')
    for (const a of haAll || []) {
        const { data: riA } = await sup.from('receta_ingredientes').select('receta_id').eq('alimento_id', a.id)
        const { data: psA } = await sup.from('productos_supermercado').select('id', { count: 'exact' }).eq('alimento_id', a.id)
        const isOrphan = (a.id === '23ec40c0' || a.id === 'bbf7aac0' || a.id === '392b1b9a' || a.id === '4c99a423') &&
            !riA?.length && !psA?.count
        console.log(`  ${isOrphan ? '🗑️' : '✅'} [${a.id.slice(0, 8)}] "${a.nombre}" -> ${riA?.length || 0} recetas, ${psA?.count || 0} prods${isOrphan ? ' ORFANO' : ''}${riA?.length > 0 || psA?.count > 0 ? ' (EN USO)' : ''}`)
    }

    console.log('\n📌 Mantequilla/Crema de cacahuete:')
    const { data: mcAll } = await sup.from('alimentos').select('id, nombre').or('nombre.ilike.%mantequilla%cacahuete%,nombre.ilike.%crema%cacahuete%')
    for (const a of mcAll || []) {
        const { data: riA } = await sup.from('receta_ingredientes').select('receta_id').eq('alimento_id', a.id)
        const { data: psA } = await sup.from('productos_supermercado').select('id', { count: 'exact' }).eq('alimento_id', a.id)
        console.log(`  [${a.id.slice(0, 8)}] "${a.nombre}" -> ${riA?.length || 0} recetas, ${psA?.count || 0} prods${riA?.length > 0 || psA?.count > 0 ? ' (EN USO)' : ''}`)
    }

    console.log('\n📌 Salsa barbacoa:')
    const { data: sbAll } = await sup.from('alimentos').select('id, nombre').ilike('nombre', '%barbacoa%')
    for (const a of sbAll || []) {
        const { data: riA } = await sup.from('receta_ingredientes').select('receta_id').eq('alimento_id', a.id)
        const { data: psA } = await sup.from('productos_supermercado').select('id', { count: 'exact' }).eq('alimento_id', a.id)
        console.log(`  [${a.id.slice(0, 8)}] "${a.nombre}" -> ${riA?.length || 0} recetas, ${psA?.count || 0} prods${riA?.length > 0 || psA?.count > 0 ? ' (EN USO)' : ''}`)
    }
}

main().catch(err => {
    console.error('Error:', err)
    process.exit(1)
})
