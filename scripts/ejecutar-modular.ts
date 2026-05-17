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
    mercadona: '7a742169-14dd-4a61-b4d0-b7af7f20a182',
    carrefour: '04773652-b024-4636-91c4-2870c9d3bd57',
    dia: '814453a3-f6e5-444b-ad3a-7294718b40d2',
    alcampo: '5359e3ea-c32a-4902-8b6a-e4af1532759f',
    consum: '965e60c1-8030-4fbe-a44a-0214bce61781',
    eroski: '2238c2ee-bae4-4fd0-add8-74eb4a0a59af',
    lidl: '29d40fe3-c49d-40c9-b61b-5072f704ec35',
    bonpreu: 'c720e5db-e8d7-481c-95fe-36cc53c085be',
    esclat: 'c307b882-9c55-406b-af2e-6e6b6004e496',
    'el-corte-ingles': '478d817f-f370-45d0-ba08-f92ec71913b1',
    hipercor: '77ddb2d6-23cb-4e28-9e49-0991cbde0010',
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
        console.log('Slugs: carrefour, dia, alcampo, consum, eroski, lidl, mercadona, bonpreu, esclat')
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
                case 'bonpreu':
                    const { scrapearBonpreu } = await import('../lib/scraping/supermercados/bonpreu')
                    scraperFn = scrapearBonpreu
                    break
                case 'esclat':
                    const { scrapearEsclat } = await import('../lib/scraping/supermercados/esclat')
                    scraperFn = scrapearEsclat
                    break
                case 'el-corte-ingles':
                    const { scrapearElCorteIngles } = await import('../lib/scraping/supermercados/el-corte-ingles')
                    scraperFn = scrapearElCorteIngles
                    break
                case 'hipercor':
                    const { scrapearHipercor } = await import('../lib/scraping/supermercados/hipercor')
                    scraperFn = scrapearHipercor
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
