/**
 * Prueba del scraper de Eroski con selectores reales
 *
 * Uso: npx tsx scripts/probar-eroski.ts
 */
import { scrapearEroski } from '../lib/scraping/supermercados/eroski'

async function main() {
    console.log('🚀 Probando scraper Eroski...\n')

    const resultado = await scrapearEroski()

    console.log('\n' + '='.repeat(50))
    console.log('📊 RESULTADOS:')
    console.log('   Productos:', resultado.productos.length)
    console.log('   Errores:', resultado.errores.length)
    console.log('   Duración:', (resultado.duracion_ms / 1000).toFixed(1) + 's')

    if (resultado.errores.length > 0) {
        console.log('\n❌ Errores:')
        for (const err of resultado.errores) {
            console.log('   - ' + err)
        }
    }

    if (resultado.productos.length > 0) {
        console.log('\n📦 Primeros 10 productos:')
        for (const p of resultado.productos.slice(0, 10)) {
            console.log(`   ${p.precio_actual.toFixed(2)}€  ${p.precio_por_kg ? p.precio_por_kg.toFixed(2) + '€/kg' : '      '}  ${p.nombre.slice(0, 60)}`)
        }

        // Categorías detectadas
        const cats = new Set(resultado.productos.map(p => p.categoria || 'sin categoría'))
        console.log('\n🏷️ Categorías:', Array.from(cats).join(', '))

        // Stats de precios
        const conPrecioKg = resultado.productos.filter(p => p.precio_por_kg && p.precio_por_kg > 0)
        console.log(`📈 Productos con precio/kg: ${conPrecioKg.length}/${resultado.productos.length}`)
    }
}

main().catch((err) => { console.error('FATAL:', err); process.exit(1) })
