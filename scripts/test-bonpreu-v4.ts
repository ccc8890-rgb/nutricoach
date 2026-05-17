/**
 * Test rápido del scraper Bonpreu v4
 * Uso: npx tsx scripts/test-bonpreu-v4.ts
 */
import { scrapearBonpreu } from '../lib/scraping/supermercados/bonpreu'

async function main() {
    console.log('🧪 Test Bonpreu v4...')
    const resultado = await scrapearBonpreu()
    console.log(`\n📊 Resultado:`)
    console.log(`   Productos: ${resultado.productos.length}`)
    console.log(`   Errores: ${resultado.errores.length}`)
    console.log(`   Duración: ${(resultado.duracion_ms / 1000).toFixed(1)}s`)

    if (resultado.errores.length > 0) {
        console.log(`\n⚠️  Errores:`)
        for (const e of resultado.errores) console.log(`   ❌ ${e}`)
    }

    if (resultado.productos.length > 0) {
        console.log(`\n📋 Muestras:`)
        for (const p of resultado.productos.slice(0, 10)) {
            console.log(`   ${p.nombre} | ${p.precio_actual}€ | ${p.categoria}`)
        }

        // Stats por categoría
        const cats = new Map<string, number>()
        for (const p of resultado.productos) {
            const cat = p.categoria || 'sin-categoria'
            cats.set(cat, (cats.get(cat) || 0) + 1)
        }
        console.log(`\n📊 Por categoría:`)
        for (const [cat, count] of cats) {
            console.log(`   ${cat}: ${count}`)
        }
    }
}

main().catch(err => { console.error('FATAL:', err); process.exit(1) })
