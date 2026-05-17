/**
 * Fix: Corregir precios de Consum que están 100× menores
 * El scraper dividía centAmount/centUnitAmount entre 100
 * cuando los valores YA venían en euros.
 * 
 * Uso: node --env-file=.env.local scripts/fix-consum-precios.mjs
 *
 * NOTA: Requiere SUPABASE_SERVICE_ROLE_KEY en .env.local
 */

import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY)
const CONSUM_ID = '965e60c1-8030-4fbe-a44a-0214bce61781'
const BATCH_SIZE = 100
const PAGE_SIZE = 1000

async function main() {
    console.log('🔧 Fix precios Consum ×100')
    console.log('='.repeat(50))

    let corregidos = 0
    let errores = 0
    let desde = 0
    let total = 0

    // Paginar para obtener TODOS los productos (Supabase limita a 1000)
    while (true) {
        const { data: productos, error, count } = await supabase
            .from('productos_supermercado')
            .select('id, precio_por_kg, precio_unidad, nombre_original', { count: 'exact' })
            .eq('supermercado_id', CONSUM_ID)
            .lt('precio_por_kg', 0.3)
            .not('nombre_original', 'ilike', 'Seed:%')
            .range(desde, desde + PAGE_SIZE - 1)
            .order('id')

        if (error) {
            console.error('❌ Error consultando productos:', error.message)
            process.exit(1)
        }

        if (!productos || productos.length === 0) break

        if (total === 0) {
            total = count || productos.length
            console.log(`📦 ${total} productos a corregir`)
        }

        // Procesar en sublotes
        for (let i = 0; i < productos.length; i += BATCH_SIZE) {
            const lote = productos.slice(i, i + BATCH_SIZE)
            const updates = lote.map(p => {
                const nuevoPrecioKg = Math.round(p.precio_por_kg * 100 * 100) / 100
                const nuevoPrecioUnidad = p.precio_unidad !== null ? Math.round(p.precio_unidad * 100 * 100) / 100 : null

                return supabase
                    .from('productos_supermercado')
                    .update({
                        precio_por_kg: nuevoPrecioKg,
                        precio_unidad: nuevoPrecioUnidad,
                        updated_at: new Date().toISOString(),
                    })
                    .eq('id', p.id)
            })

            const results = await Promise.allSettled(updates)
            for (const r of results) {
                if (r.status === 'fulfilled' && !r.value.error) {
                    corregidos++
                } else {
                    errores++
                }
            }
        }

        desde += PAGE_SIZE
        const pct = Math.round(Math.min(desde, total) / total * 100)
        console.log(`  Progreso: ${Math.min(desde, total)}/${total} (${pct}%) · ✅ ${corregidos} · ❌ ${errores}`)

        if (productos.length < PAGE_SIZE) break
    }

    console.log('\n\n📊 Verificación...')

    const { count: restantes } = await supabase
        .from('productos_supermercado')
        .select('*', { count: 'exact', head: true })
        .eq('supermercado_id', CONSUM_ID)
        .lt('precio_por_kg', 0.3)
        .not('nombre_original', 'ilike', 'Seed:%')

    const { count: totalConsum } = await supabase
        .from('productos_supermercado')
        .select('*', { count: 'exact', head: true })
        .eq('supermercado_id', CONSUM_ID)

    console.log(`  Total Consum: ${totalConsum}`)
    console.log(`  Corregidos: ${corregidos}`)
    console.log(`  Restantes < 0.3: ${restantes}`)
    console.log(`  Errores: ${errores}`)

    // Mostrar ejemplos
    const { data: ejemplos } = await supabase
        .from('productos_supermercado')
        .select('nombre_original, precio_por_kg, precio_unidad')
        .eq('supermercado_id', CONSUM_ID)
        .ilike('nombre_original', '%arroz%')
        .gte('precio_por_kg', 0.5)
        .limit(5)

    if (ejemplos?.length) {
        console.log('\n✅ Ejemplos corregidos:')
        ejemplos.forEach(p => console.log(`  ${p.nombre_original}: ${p.precio_por_kg?.toFixed(2)} €/kg`))
    }

    if (restantes && restantes > 0) {
        console.log(`\n⚠️  Quedan ${restantes} productos con precio < 0.3 €/kg (pueden ser edulcorantes, especias, etc.)`)
    }

    console.log('\n✅ Fix completado')
}

main().catch(console.error)
