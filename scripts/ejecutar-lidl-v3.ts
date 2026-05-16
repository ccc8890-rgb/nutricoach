/**
 * ejecutar-lidl-v3.ts — Ejecuta el scraper Lidl v3 completo y persiste en BD
 *
 * 1. Scrapea 60 términos en 4 lotes (cada lote con browser nuevo)
 * 2. Persiste productos en productos_supermercado + precios_historico
 * 3. Muestra estadísticas finales
 *
 * Uso: npx tsx --env-file=.env.local scripts/ejecutar-lidl-v3.ts
 */

import { createClient } from '@supabase/supabase-js'
import { scrapearSupermercado } from '../lib/scraping/index'

const LIDL_UUID = '29d40fe3-c49d-40c9-b61b-5072f704ec35'

async function main() {
    const supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!,
        { auth: { persistSession: false } }
    )

    console.log('\n╔════════════════════════════════════════════════╗')
    console.log('║  LIDL v3 — Pipeline completo                   ║')
    console.log('╚════════════════════════════════════════════════╝')
    console.log(`Inicio: ${new Date().toLocaleString('es-ES')}`)
    console.log('')

    // 1. Contar antes
    const { count: antes } = await supabase
        .from('productos_supermercado')
        .select('*', { count: 'exact', head: true })
        .eq('supermercado_id', LIDL_UUID)

    console.log(`Productos Lidl antes: ${antes ?? '?'}\n`)

    // 2. Ejecutar scraper + pipeline
    const resultado = await scrapearSupermercado(LIDL_UUID, 'lidl', supabase)

    // 3. Contar después
    const { count: despues } = await supabase
        .from('productos_supermercado')
        .select('*', { count: 'exact', head: true })
        .eq('supermercado_id', LIDL_UUID)

    console.log('\n╔════════════════════════════════════════════════╗')
    console.log('║  RESULTADOS FINALES                            ║')
    console.log('╚════════════════════════════════════════════════╝')
    console.log('')
    console.log(`  Duración:      ${(resultado.duracion_ms / 1000).toFixed(1)}s (${(resultado.duracion_ms / 60000).toFixed(1)} min)`)
    console.log(`  Productos raw:  ${resultado.total_procesados}`)
    console.log(`  Nuevos:         ${resultado.nuevos_productos}`)
    console.log(`  Actualizados:   ${resultado.actualizados}`)
    console.log(`  No encontrados: ${resultado.no_encontrados}`)
    console.log(`  Errores:        ${resultado.errores.length}`)
    console.log(`  Productos BD:   ${antes ?? '?'} → ${despues ?? '?'}`)
    console.log('')

    if (resultado.errores.length > 0) {
        console.log('  Errores:')
        resultado.errores.forEach(e => console.log(`    ❌ ${e}`))
    }

    // 4. Resumen
    if (resultado.nuevos_productos > 0 || resultado.actualizados > 0) {
        console.log('  ✅ Pipeline completado con éxito')
    } else {
        console.log('  ⚠️  No se insertaron/actualizaron productos')
    }

    console.log(`\nFin: ${new Date().toLocaleString('es-ES')}`)
}

main().catch(err => {
    console.error('Error fatal:', err)
    process.exit(1)
})
