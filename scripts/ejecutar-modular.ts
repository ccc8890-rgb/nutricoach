/**
 * ejecutar-modular.ts
 *
 * Ejecuta scrapers modulares (Playwright desde node_modules) y guarda
 * directamente en Supabase usando el orquestador batch scrapearSupermercado.
 *
 * Los scrapers modulares en lib/scraping/supermercados/ son más fiables
 * que los inline en ejecutar-scraping.mjs.
 *
 * Modo --scrape solo: extrae productos, NO guarda en BD (como dry-run).
 * Modo normal: extrae + guarda en BD.
 *
 * Uso:
 *   npx tsx scripts/ejecutar-modular.ts carrefour
 *   npx tsx scripts/ejecutar-modular.ts --scrape carrefour
 *   npx tsx scripts/ejecutar-modular.ts carrefour dia alcampo
 */
import { createClient } from '@supabase/supabase-js'
import { scrapearSupermercado } from '../lib/scraping/index'

// ── IDs de supermercados (extraídos de la BD) ──
const SUPERMERCADOS: Record<string, string> = {
    mercadona: 'b4a94174-0e96-4a68-882d-91f40bea27cc',
    carrefour: 'a3963fee-ed67-40da-a850-b68bc13a6ef8',
    dia: '8a5c5b38-3bb5-4081-9497-432c00346452',
    alcampo: 'f40021e3-93fb-4a98-b75a-6e6838badee2',
    consum: 'c1fabfab-69f1-4bbf-9324-b6d3cdff2427',
    eroski: 'f156cba6-b234-43e5-b8ee-3215a28cc9eb',
    lidl: '3c7add77-080f-4eae-b831-a5b79c4b26db',
    bonpreu: '9f0cd41e-22fb-4cc9-ade9-54aa24f9a1c5',
    esclat: '0d1b23a1-2a98-4d1d-a54e-15ee43e92b99',
    'el-corte-ingles': '7eaa25df-8836-4e4f-931a-eb93e21e7270',
    hipercor: 'e6ed9db9-e9be-47ba-9c3d-06f38946503a',
}

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://hopeqzwzmlrpktoeygxz.supabase.co'
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!SUPABASE_SERVICE_KEY) {
    console.error('❌ SUPABASE_SERVICE_ROLE_KEY no encontrada en entorno')
    process.exit(1)
}

async function main() {
    const args = process.argv.slice(2)
    const soloScrape = args.includes('--scrape')
    const slugs = args.filter(a => !a.startsWith('--'))

    if (slugs.length === 0) {
        console.log('Uso: npx tsx scripts/ejecutar-modular.ts [--scrape] <slug1> [slug2] ...')
        console.log('')
        console.log('Slugs: carrefour, dia, alcampo, consum, eroski, lidl, mercadona')
        console.log('       bonpreu, esclat, el-corte-ingles, hipercor')
        console.log('')
        console.log('--scrape: solo extrae productos sin guardar en BD')
        console.log('')
        console.log('Ejemplos:')
        console.log('  npx tsx scripts/ejecutar-modular.ts --scrape carrefour')
        console.log('  npx tsx scripts/ejecutar-modular.ts carrefour')
        return
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)

    for (const slug of slugs) {
        const supermercadoId = SUPERMERCADOS[slug]
        if (!supermercadoId) {
            console.error(`❌ Slug "${slug}" no reconocido`)
            continue
        }

        console.log('')
        console.log('═══════════════════════════════════════════')
        console.log(`  🛒 ${slug.toUpperCase()}`)
        console.log('═══════════════════════════════════════════')

        if (soloScrape) {
            // Solo scrape (no guarda en BD)
            // Importar scraper directamente
            let scraperFn: () => Promise<{ productos: any[]; errores: string[]; duracion_ms: number }>

            switch (slug) {
                case 'carrefour':
                    const { scrapearCarrefour } = await import('../lib/scraping/supermercados/carrefour')
                    scraperFn = scrapearCarrefour
                    break
                case 'dia':
                    const { scrapearDia } = await import('../lib/scraping/supermercados/dia')
                    scraperFn = scrapearDia
                    break
                case 'alcampo':
                    const { scrapearAlcampo } = await import('../lib/scraping/supermercados/alcampo')
                    scraperFn = scrapearAlcampo
                    break
                case 'consum':
                    const { scrapearConsum } = await import('../lib/scraping/supermercados/consum')
                    scraperFn = scrapearConsum
                    break
                case 'eroski':
                    const { scrapearEroski } = await import('../lib/scraping/supermercados/eroski')
                    scraperFn = scrapearEroski
                    break
                case 'lidl':
                    const { scrapearLidl } = await import('../lib/scraping/supermercados/lidl')
                    scraperFn = scrapearLidl
                    break
                default:
                    console.error(`❌ Scraper para "${slug}" no disponible en modo solo-scrape`)
                    continue
            }

            const inicio = Date.now()
            const resultado = await scraperFn()
            const duracion = ((Date.now() - inicio) / 1000).toFixed(1)

            console.log(`\n📊 Resultados:`)
            console.log(`   Productos: ${resultado.productos.length}`)
            console.log(`   Errores:   ${resultado.errores.length}`)
            console.log(`   Duración:  ${duracion}s`)

            if (resultado.productos.length > 0) {
                console.log(`\n📦 Muestra (5):`)
                resultado.productos.slice(0, 5).forEach((p, i) => {
                    console.log(`   ${i + 1}. ${p.nombre}`)
                    console.log(`      Precio: ${p.precio_actual}€ | kg: ${p.precio_por_kg ?? 'N/A'}€/kg`)
                })

                const cats = new Map<string, number>()
                resultado.productos.forEach((p: any) => {
                    const c = p.categoria || 'Sin categoría'
                    cats.set(c, (cats.get(c) || 0) + 1)
                })
                console.log(`\n📁 Categorías:`)
                cats.forEach((count, cat) => console.log(`   • ${cat}: ${count}`))
            }
        } else {
            // Scrape + guardar en BD
            console.log(`   Guardando en BD via scrapearSupermercado...`)
            const resultado = await scrapearSupermercado(supermercadoId, slug, supabase)
            console.log(`\n📊 Resultado:`)
            console.log(`   Nuevos:     ${resultado.nuevos_productos}`)
            console.log(`   Actualizados: ${resultado.actualizados}`)
            console.log(`   No encontrados: ${resultado.no_encontrados}`)
            console.log(`   Filtrados:  ${(resultado as any).filtrados || 0}`)
            console.log(`   Errores:    ${resultado.errores?.length || 0}`)
            console.log(`   Total:      ${resultado.total_procesados}`)
            console.log(`   Duración:   ${(resultado.duracion_ms / 1000).toFixed(1)}s`)
        }
    }

    console.log('\n✅ Completado')
}

main().catch(err => {
    console.error('Error general:', err)
    process.exit(1)
})
