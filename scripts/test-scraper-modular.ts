/**
 * test-scraper-modular.ts
 *
 * Prueba los scrapers modulares de Carrefour y Día (los que importan
 * Playwright correctamente desde npm), extrayendo productos y mostrando
 * estadísticas. NO escribe en BD.
 *
 * Uso:
 *   npx tsx scripts/test-scraper-modular.ts [--carrefour] [--dia]
 *
 * Por defecto ejecuta ambos si no se especifica flag.
 */
import { scrapearCarrefour } from '../lib/scraping/supermercados/carrefour'
import { scrapearDia } from '../lib/scraping/supermercados/dia'
import type { ProductoRaw } from '../lib/scraping/types'

function mostrarResultado(nombre: string, resultado: { productos: ProductoRaw[]; errores: string[]; duracion_ms: number }) {
    const duracion = (resultado.duracion_ms / 1000).toFixed(1)
    console.log(`\n📊 Resultados ${nombre}:`)
    console.log(`   Productos: ${resultado.productos.length}`)
    console.log(`   Errores:   ${resultado.errores.length}`)
    console.log(`   Duración:  ${duracion}s`)

    if (resultado.errores.length > 0) {
        console.log(`\n❌ Errores:`)
        resultado.errores.forEach((e: string) => console.log(`   • ${e}`))
    }

    if (resultado.productos.length > 0) {
        console.log(`\n📦 Primeros 5 productos:`)
        resultado.productos.slice(0, 5).forEach((p: ProductoRaw, i: number) => {
            const precioKg = p.precio_por_kg ? `${p.precio_por_kg.toFixed(2)}€/kg` : 'N/A'
            console.log(`   ${i + 1}. ${p.nombre}`)
            console.log(`      Precio: ${p.precio_actual.toFixed(2)}€ | kg: ${precioKg}`)
            console.log(`      Cat: ${p.categoria || 'N/A'}`)
        })

        // Categorías detectadas
        const cats = new Map<string, number>()
        resultado.productos.forEach((p: ProductoRaw) => {
            const c = p.categoria || 'Sin categoría'
            cats.set(c, (cats.get(c) || 0) + 1)
        })
        console.log(`\n📁 Categorías (${cats.size}):`)
        cats.forEach((count, cat) => console.log(`   • ${cat}: ${count} productos`))
    } else {
        console.log(`\n⚠️  0 productos extraídos`)
    }
}

async function main() {
    const args = process.argv.slice(2)
    const soloCarrefour = args.includes('--carrefour')
    const soloDia = args.includes('--dia')
    const ambos = !soloCarrefour && !soloDia

    if (ambos || soloCarrefour) {
        console.log('═══════════════════════════════════════════')
        console.log('  🛒 Probando scraper modular: CARREFOUR')
        console.log('═══════════════════════════════════════════')
        try {
            const inicio = Date.now()
            const resultado = await scrapearCarrefour()
            mostrarResultado('Carrefour', resultado)
        } catch (err) {
            console.error(`\n💥 Error ejecutando Carrefour:`, err instanceof Error ? err.message : String(err))
        }
    }

    if (ambos || soloDia) {
        console.log('\n')
        console.log('═══════════════════════════════════════════')
        console.log('  🛒 Probando scraper modular: DÍA')
        console.log('═══════════════════════════════════════════')
        try {
            const inicio = Date.now()
            const resultado = await scrapearDia()
            mostrarResultado('Día', resultado)
        } catch (err) {
            console.error(`\n💥 Error ejecutando Día:`, err instanceof Error ? err.message : String(err))
        }
    }
}

main().catch((err: unknown) => {
    console.error('Error general:', err)
    process.exit(1)
})
