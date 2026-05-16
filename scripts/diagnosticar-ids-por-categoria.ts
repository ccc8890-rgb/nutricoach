/**
 * Diagnóstico: Extraer IDs de productos por categoría de Bonpreu/Esclat
 *
 * Objetivo: Descubrir cómo obtener los UUIDs de TODOS los productos
 * de una categoría para luego hacer PUT v6/products por lotes.
 *
 * Uso: npx tsx scripts/diagnosticar-ids-por-categoria.ts
 */
import { chromium } from 'playwright'
import * as fs from 'fs'

const URL_BASE = 'https://www.compraonline.bonpreuesclat.cat'
const CAT_UUID = 'c95cfbf2-501d-433f-bae3-10fcef330b11'

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

    // Capturar ALL v6/products PUT requests (sus postData = los UUIDs)
    const allUuids = new Set<string>()
    const allProducts: any[] = []

    page.on('request', (req) => {
        const url = req.url()
        if (url.includes('/api/webproductpagews/v6/products') && req.method() === 'PUT') {
            try {
                const data = JSON.parse(req.postData() || '[]')
                for (const uuid of data) allUuids.add(uuid)
            } catch { }
        }
    })

    page.on('response', async (res) => {
        const url = res.url()
        if (url.includes('/api/webproductpagews/v6/products') && res.status() === 200) {
            try {
                const json = await res.json() as any
                if (json.products) {
                    for (const p of json.products) {
                        allProducts.push({
                            productId: p.productId,
                            name: p.name,
                            brand: p.brand,
                            price: p.price?.amount,
                            category: '', // lo asignamos después
                        })
                    }
                }
            } catch { }
        }
    })

    // 1. Homepage
    console.log('📍 Homepage...')
    await page.goto(URL_BASE, { waitUntil: 'networkidle', timeout: 30000 }).catch(() => { })
    await page.waitForTimeout(3000)
    console.log(`   UUIDs: ${allUuids.size}, Products: ${allProducts.length}`)

    // 2. Categoría frescos con scroll completo
    console.log('📍 Categoría: frescos (con scroll)...')
    await page.goto(`${URL_BASE}/categories/frescos/${CAT_UUID}`, {
        waitUntil: 'networkidle', timeout: 30000
    }).catch(() => { })
    await page.waitForTimeout(3000)

    // Scroll progresivo para trigger lazy loading
    const scrollSteps = [0.1, 0.25, 0.4, 0.55, 0.7, 0.85, 1.0]
    for (const frac of scrollSteps) {
        await page.evaluate((f) => window.scrollTo(0, document.body.scrollHeight * f), frac)
        await page.waitForTimeout(2000)
    }
    // Extra scroll extra
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight))
    await page.waitForTimeout(3000)

    console.log(`   UUIDs: ${allUuids.size}, Products: ${allProducts.length}`)

    // 3. Extraer window.__INITIAL_STATE__ si existe
    const initialState = await page.evaluate(() => {
        const w = window as any
        const data: Record<string, any> = {}
        if (w.__INITIAL_STATE__) {
            data['__INITIAL_STATE__'] = {
                keys: Object.keys(w.__INITIAL_STATE__),
                sampleCategory: w.__INITIAL_STATE__.categoryPage || null,
                sampleProducts: w.__INITIAL_STATE__.products || null,
            }
        }
        if (w.__NEXT_DATA__) {
            data['__NEXT_DATA__'] = 'present'
        }
        if (w.__NUXT__) {
            data['__NUXT__'] = 'present'
        }
        // Check for any data on window
        data['windowKeys'] = Object.keys(w).filter(k =>
            k.startsWith('__') || k.includes('data') || k.includes('state') || k.includes('config')
        ).slice(0, 30)
        return data
    })
    console.log('\n📦 Window state:', JSON.stringify(initialState, null, 2))

    // 4. Extraer script tags con state embebido
    const scriptsWithData = await page.evaluate(() => {
        const scripts = document.querySelectorAll('script')
        const results: Array<{ id: string; type: string; src: string; contentLength: number; preview: string }> = []
        for (const s of scripts) {
            const text = s.textContent || ''
            if (text.length > 100 && !s.src) {
                const preview = text.slice(0, 500).replace(/\s+/g, ' ').trim()
                results.push({
                    id: s.id || '(no id)',
                    type: s.type || 'text/javascript',
                    src: s.src || '(inline)',
                    contentLength: text.length,
                    preview: preview.slice(0, 300),
                })
            }
        }
        return results
    })
    console.log(`\n📜 Inline scripts with data: ${scriptsWithData.length}`)
    for (const s of scriptsWithData.slice(0, 10)) {
        console.log(`  [${s.id}] ${s.contentLength} bytes`)
        console.log(`    ${s.preview}`)
    }

    // Buscar script que contenga productIds
    const productIdScripts = scriptsWithData.filter(s =>
        s.preview.includes('productId') || s.preview.includes('productIds')
    )
    console.log(`\n🔍 Scripts con productId: ${productIdScripts.length}`)
    for (const s of productIdScripts) {
        console.log(`  [${s.id}] ${s.contentLength} bytes`)
    }

    await browser.close()

    // Resumen
    console.log(`\n══════════════════════════════════`)
    console.log(`Total UUIDs capturados: ${allUuids.size}`)
    console.log(`Total products: ${allProducts.length}`)
    console.log(`══════════════════════════════════`)

    // Guardar UUIDs para posible uso
    fs.writeFileSync('scripts/uuids-frescos.json', JSON.stringify([...allUuids], null, 2))
    fs.writeFileSync('scripts/products-frescos.json', JSON.stringify(allProducts, null, 2))
    console.log('\n✅ Datos guardados')
}

main().catch(err => { console.error('FATAL:', err); process.exit(1) })
