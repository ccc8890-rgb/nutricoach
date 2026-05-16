/**
 * Test rápido del scraper Esclat reescrito con interceptación API
 * 
 * Uso: npx tsx scripts/test-esclat-api.ts
 */
import { scrapearEsclat } from '../lib/scraping/supermercados/esclat'

async function main() {
    console.log('=== TEST ESCLAT SCRAPER (interceptación API) ===')
    const result = await scrapearEsclat()

    console.log(`\nDuración: ${result.duracion_ms}ms`)
    console.log(`Productos: ${result.productos.length}`)
    console.log(`Errores: ${result.errores.length}`)

    if (result.errores.length > 0) {
        console.log('\nErrores:')
        for (const e of result.errores) {
            console.log(`  ❌ ${e}`)
        }
    }

    if (result.productos.length > 0) {
        console.log('\nPrimeros 10 productos:')
        for (let i = 0; i < Math.min(result.productos.length, 10); i++) {
            const p = result.productos[i]
            console.log(`  ${i + 1}. ${p.nombre} — ${p.precio_actual}€${p.precio_por_kg ? ` (${p.precio_por_kg}€/kg)` : ''} [${p.marca}]`)
        }

        const categorias = new Map<string, number>()
        for (const p of result.productos) {
            const cat = p.categoria || 'sin categoria'
            categorias.set(cat, (categorias.get(cat) || 0) + 1)
        }
        console.log('\nProductos por categoría:')
        for (const [cat, count] of categorias) {
            console.log(`  ${cat}: ${count}`)
        }
    }

    console.log('\n=== FIN TEST ===')
}

main().catch(err => {
    console.error('FATAL:', err)
    process.exit(1)
})
