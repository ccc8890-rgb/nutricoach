/**
 * Diagnóstico: Extraer UUIDs de todas las categorías desde la homepage
 *
 * La respuesta de v5/product-pages contiene ~218 UUIDs. Entre ellos están
 * los UUIDs de las categorías. Este script extrae los UUIDs de categoría
 * navegando a la homepage y obteniendo los links de navegación.
 *
 * Uso: npx tsx scripts/diagnosticar-categorias-uuids.ts
 */
import { chromium } from 'playwright'
import * as fs from 'fs'

const URL_BASE = 'https://www.compraonline.bonpreuesclat.cat'

async function main() {
    const browser = await chromium.launch({
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox'],
    })
    const context = await browser.newContext({
        userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        viewport: { width: 1920, height: 1080 },
        locale: 'ca-ES',
        extraHTTPHeaders: { 'Accept-Language': 'ca-ES,ca;q=0.9,es;q=0.8' },
    })
    const page = await context.newPage()

    let catApiResponse: any = null
    page.on('response', async (res) => {
        const url = res.url()
        if (url.includes('/api/webproductpagews/v5/product-pages') && !catApiResponse) {
            try {
                catApiResponse = { status: res.status(), url, body: await res.text() }
            } catch { }
        }
    })

    console.log('📍 Homepage...')
    await page.goto(URL_BASE + '/', { waitUntil: 'networkidle', timeout: 30000 }).catch(() => { })
    await page.waitForTimeout(5000)

    // ── 1. Extraer categorías del DOM ──
    const categoriasDelDom = await page.evaluate(() => {
        const links: Array<{ name: string; url: string; uuid: string }> = []
        // Buscar todos los enlaces que contengan /categories/
        document.querySelectorAll('a[href*="/categories/"]').forEach(a => {
            const href = a.getAttribute('href') || ''
            const match = href.match(/\/categories\/([^/]+)\/([0-9a-f-]{36})/)
            if (match) {
                links.push({
                    name: (a.textContent || '').trim(),
                    url: href,
                    uuid: match[2],
                })
            }
        })
        return links
    })

    // ── 2. Extraer del menú de navegación principal ──
    const menuCategorias = await page.evaluate(() => {
        const items: Array<{ name: string; url: string }> = []
        // Buscar menú de categorías (típicamente un nav o ul con las categorías principales)
        document.querySelectorAll('[class*="category"], [class*="Category"], nav a, [class*="menu"] a, li a').forEach(a => {
            const href = a.getAttribute('href') || ''
            if (href.includes('/categories/')) {
                const name = (a.textContent || '').trim()
                if (name && !items.some(i => i.name === name)) {
                    items.push({ name, url: href })
                }
            }
        })
        return items
    })

    console.log(`\n📂 Categorías encontradas en DOM: ${categoriasDelDom.length}`)
    for (const c of categoriasDelDom) {
        console.log(`   ${c.name.padEnd(25)} ${c.url}`)
    }

    console.log(`\n📂 Menú de navegación: ${menuCategorias.length}`)
    for (const c of menuCategorias) {
        console.log(`   ${c.name.padEnd(25)} ${c.url}`)
    }

    // ── 3. Si no hay suficientes, extraer slugs y construir URLs ──
    if (categoriasDelDom.length < 5) {
        console.log('\n🔍 No hay suficientes categorías en DOM. Probando extracción de __INITIAL_STATE__...')
        const state = await page.evaluate(() => {
            const w = window as any
            return w.__INITIAL_STATE__ || null
        })
        if (state) {
            fs.writeFileSync('scripts/initial-state-homepage.json', JSON.stringify(state, null, 2))
            console.log('   ✅ Guardado en scripts/initial-state-homepage.json')

            // Buscar categorías en el state
            const str = JSON.stringify(state)
            const catMatches = str.match(/categories\/([a-z-]+)\/([0-9a-f-]{36})/g)
            if (catMatches) {
                const unique = [...new Set(catMatches)]
                console.log(`\n📂 Categorías en INITIAL_STATE: ${unique.length}`)
                for (const c of unique.slice(0, 30)) {
                    console.log(`   ${c}`)
                }
            }
        } else {
            console.log('   ❌ No __INITIAL_STATE__')
        }
    }

    // ── 4. Extraer del HTML estático ──
    const html = await page.content()
    const catLinks = html.match(/\/categories\/([a-z-]+)\/([0-9a-f-]{36})/g)
    if (catLinks) {
        const unique = [...new Set(catLinks)]
        console.log(`\n📂 Categorías en HTML: ${unique.length}`)
        for (const c of unique) {
            const parts = c.split('/')
            console.log(`   ${parts[2].padEnd(25)} ${parts[3]}`)
        }
    }

    await browser.close()
}

main().catch(err => { console.error('FATAL:', err); process.exit(1) })
