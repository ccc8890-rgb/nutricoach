/**
 * scrapear-modular.mjs
 *
 * Ejecuta los scrapers modulares TypeScript (Playwright real desde npm)
 * y guarda los resultados en Supabase directamente.
 *
 * Los scrapers en lib/scraping/supermercados/ son más fiables
 * que los inline en ejecutar-scraping.mjs porque importan
 * Playwright correctamente desde node_modules.
 *
 * Uso:
 *   node scripts/scrapear-modular.mjs --carrefour          # Solo Carrefour
 *   node scripts/scrapear-modular.mjs --carrefour --dry-run # Solo prueba
 *   node scripts/scrapear-modular.mjs --all                 # Todos los disponibles
 */
import { createClient } from '@supabase/supabase-js'

// ── Config ──
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://hopeqzwzmlrpktoeygxz.supabase.co'
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!SUPABASE_SERVICE_KEY) {
    console.error('❌ SUPABASE_SERVICE_ROLE_KEY no encontrada en entorno')
    process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)

// ── IDs de supermercados (mapeo slug → id) ──
const SUPERMERCADOS = {
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

// ── Mapeo slug → función scraper ──
const SCRAPERS_MODULARES = {
    carrefour: () => import('../lib/scraping/supermercados/carrefour.mjs').then(m => m.scrapearCarrefour()),
    // carrefour requiere rewrite especial (es .ts, no .mjs)
}

// Como los scrapers modulares son .ts, usamos tsx inline
async function ejecutarScraperConTsx(slug) {
    const script = `
        import { scrapear${slug.charAt(0).toUpperCase() + slug.slice(1)} } from '../lib/scraping/supermercados/${slug}.ts'
        const r = await scrapear${slug.charAt(0).toUpperCase() + slug.slice(1)}()
        process.stdout.write(JSON.stringify(r))
    `
    // No podemos importar TS directamente desde .mjs
    // Usamos npx tsx para ejecutar un script inline
    const { execSync } = await import('child_process')
    const result = execSync(
        `npx tsx -e "${script.replace(/"/g, '\\"')}"`,
        { cwd: process.cwd(), timeout: 120000, maxBuffer: 10 * 1024 * 1024 }
    )
    return JSON.parse(result.toString())
}

// ── Alternativa: invocar npx tsx scripts/test-scraper-modular.ts con salida JSON ──
// Mejor: usar directamente el test script que ya creamos pero con salida JSON

async function ejecutarScraper(slug) {
    console.log(`\n═══════════════════════════════════════════`)
    console.log(`  🛒 Ejecutando scraper: ${slug.toUpperCase()}`)
    console.log(`═══════════════════════════════════════════`)

    const inicio = Date.now()

    // Ejecutamos el scraper TS via tsx con un wrapper que imprime JSON
    const { execSync } = await import('child_process')
    const tsScript = `
        import { scrapear${slug.charAt(0).toUpperCase() + slug.slice(1)} } from '../lib/scraping/supermercados/${slug}.ts'
        const r = await scrapear${slug.charAt(0).toUpperCase() + slug.slice(1)}()
        console.log(JSON.stringify({ productos: r.productos, errores: r.errores, duracion_ms: r.duracion_ms }))
    `

    // Guardar script temporal
    const { writeFileSync, unlinkSync } = await import('fs')
    const tmpFile = `/tmp/scrapear-${slug}-${Date.now()}.mjs`
    writeFileSync(tmpFile, tsScript, 'utf-8')

    try {
        const output = execSync(
            `npx tsx "${tmpFile}"`,
            {
                cwd: '/Users/carloscasanova/Desktop/Carlos/CLAUDE/NUTRICION/nutricoach-modulos',
                timeout: 180000,
                maxBuffer: 50 * 1024 * 1024,
                encoding: 'utf-8',
                env: { ...process.env, NODE_OPTIONS: '--experimental-vm-modules' },
            }
        )
        const lines = output.trim().split('\n')
        const jsonLine = lines.find(l => l.startsWith('{"productos"'))
        if (!jsonLine) {
            console.error(`❌ No se encontró JSON en salida:\n${output.substring(0, 500)}`)
            return null
        }
        return JSON.parse(jsonLine)
    } catch (err) {
        console.error(`❌ Error ejecutando ${slug}:`, err.stderr?.substring(0, 500) || err.message)
        return null
    } finally {
        try { unlinkSync(tmpFile) } catch { }
    }
}

// ── Guardar en BD ──
async function guardarEnBD(slug, resultado, dryRun) {
    const supermercadoId = SUPERMERCADOS[slug]
    if (!supermercadoId) {
        console.error(`❌ No hay ID para supermercado "${slug}"`)
        return
    }

    const { productos, errores, duracion_ms } = resultado
    const duracion = (duracion_ms / 1000).toFixed(1)

    console.log(`\n📊 Resultados ${slug}:`)
    console.log(`   Productos: ${productos.length}`)
    console.log(`   Errores:   ${errores.length}`)
    console.log(`   Duración:  ${duracion}s`)

    if (errores.length > 0) {
        console.log(`\n❌ Errores:`)
        errores.forEach(e => console.log(`   • ${e}`))
    }

    if (productos.length === 0) {
        console.log(`\n⚠️  0 productos — nada que guardar`)
        return
    }

    // Categorías
    const cats = new Map()
    productos.forEach(p => {
        const c = p.categoria || 'Sin categoría'
        cats.set(c, (cats.get(c) || 0) + 1)
    })
    console.log(`\n📁 Categorías:`)
    cats.forEach((count, cat) => console.log(`   • ${cat}: ${count} productos`))

    if (dryRun) {
        console.log(`\n🏁 Dry-run: no se guarda nada`)
        return
    }

    // Guardar usando scrapearSupermercado del index.ts
    // (tiene toda la lógica de matching y upsert)
    console.log(`\n💾 Guardando en BD via scrapearSupermercado...`)

    // Usamos el orquestador batch que ya tiene todo el matching
    const { scrapearSupermercado } = await import('../lib/scraping/index.ts')
    const result = await scrapearSupermercado(supermercadoId, slug, supabase)

    console.log(`\n✅ Resultado final:`)
    console.log(`   Nuevos productos: ${result.nuevos_productos}`)
    console.log(`   Actualizados:     ${result.actualizados}`)
    console.log(`   No encontrados:   ${result.no_encontrados}`)
    console.log(`   Filtrados:        ${result.filtrados || 0}`)
    console.log(`   Errores:          ${result.errores?.length || 0}`)
}

// ── Main ──
async function main() {
    const args = process.argv.slice(2)
    const dryRun = args.includes('--dry-run')
    const slugs = args.filter(a => !a.startsWith('--'))

    if (slugs.length === 0) {
        console.log('Uso: node scripts/scrapear-modular.mjs [--dry-run] <slug1> <slug2> ...')
        console.log('Slugs disponibles: carrefour, dia, alcampo, consum, eroski, lidl, mercadona, bonpreu, esclat, el-corte-ingles, hipercor')
        console.log('\nEjemplo: node scripts/scrapear-modular.mjs --dry-run carrefour')
        console.log('         node scripts/scrapear-modular.mjs carrefour')
        return
    }

    for (const slug of slugs) {
        const resultado = await ejecutarScraper(slug)
        if (resultado) {
            await guardarEnBD(slug, resultado, dryRun)
        }
    }

    console.log('\n✅ Proceso completado')
}

main().catch(err => {
    console.error('Error general:', err)
    process.exit(1)
})
