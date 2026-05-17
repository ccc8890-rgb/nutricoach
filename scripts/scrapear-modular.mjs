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
