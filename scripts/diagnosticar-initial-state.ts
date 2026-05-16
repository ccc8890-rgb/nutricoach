/**
 * Diagnóstico: Extraer __INITIAL_STATE__ y entender lazy loading
 *
 * Uso: npx tsx scripts/diagnosticar-initial-state.ts
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

    // Capturar todas las respuestas
    const apiResponses: Array<{ url: string; method: string; status: number; body: string }> = []
    page.on('response', async (res) => {
        const url = res.url()
        if (url.includes('/api/') && url.includes('bonpreuesclat')) {
            try {
                const text = await res.text()
                apiResponses.push({
                    url: url.replace(URL_BASE, ''),
                    method: res.request()?.method() || 'GET',
                    status: res.status(),
                    body: text.length > 50000 ? text.slice(0, 50000) : text,
                })
            } catch { }
        }
    })

    console.log('📍 Navegando a categoría frescos...')
    await page.goto(`${URL_BASE}/categories/frescos/${CAT_UUID}`, {
        waitUntil: 'networkidle', timeout: 30000
    }).catch(() => { })
    await page.waitForTimeout(3000)

    // Extraer __INITIAL_STATE__
    const initialState = await page.evaluate(() => {
        const w = window as any
        return w.__INITIAL_STATE__ || null
    })

    if (initialState) {
        console.log('\n📦 __INITIAL_STATE__ encontrado!')
        const keys = Object.keys(initialState)
        console.log(`   Keys principales: ${keys.join(', ')}`)

        // Explorar categoría
        if (initialState.categoryPage) {
            console.log(`\n📂 categoryPage:`)
            const catKeys = Object.keys(initialState.categoryPage)
            console.log(`   Keys: ${catKeys.join(', ')}`)
            const cat = initialState.categoryPage
            if (cat.category) console.log(`   category.name: ${cat.category.name}`)
            if (cat.category) console.log(`   category.uuid: ${cat.category.uuid}`)
            if (cat.products) console.log(`   products count: ${cat.products.length}`)
        }

        // Buscar la data de productos
        if (initialState.products) {
            console.log(`\n🛒 products:`)
            const prodKeys = Object.keys(initialState.products)
            console.log(`   Keys: ${prodKeys.join(', ')}`)
            // Check if it has productIds
            if (initialState.products.productIds) {
                console.log(`   productIds: ${initialState.products.productIds.length}`)
            }
            if (initialState.products.byId) {
                console.log(`   byId keys: ${Object.keys(initialState.products.byId).length}`)
                const sampleId = Object.keys(initialState.products.byId)[0]
                if (sampleId) {
                    const sample = initialState.products.byId[sampleId]
                    console.log(`   Sample product: ${JSON.stringify(sample).slice(0, 300)}`)
                }
            }
        }

        // Search for productIds in any key
        for (const key of keys) {
            const val = initialState[key]
            if (val && typeof val === 'object') {
                const str = JSON.stringify(val)
                const productIdCount = (str.match(/"productId"/g) || []).length
                if (productIdCount > 0) {
                    console.log(`\n🔑 "${key}" contiene ${productIdCount} productId`)
                }
                if (key !== 'categoryPage' && key !== 'products') {
                    const subKeys = Object.keys(val).slice(0, 10)
                    console.log(`   Subkeys: ${subKeys.join(', ')}`)
                }
            }
        }

        // Guardar INITIAL_STATE completo
        fs.writeFileSync('scripts/initial-state.json', JSON.stringify(initialState, null, 2))
        console.log(`\n✅ initial-state.json guardado (${JSON.stringify(initialState).length} bytes)`)
    } else {
        console.log('❌ No se encontró __INITIAL_STATE__')
        // What's on window?
        const windowKeys = await page.evaluate(() => {
            return Object.keys(window).filter(k => k.startsWith('__') || k.includes('data') || k.includes('state')).slice(0, 20)
        })
        console.log('Window keys:', windowKeys)
    }

    // También guardar las APIs capturadas
    console.log(`\n📡 ${apiResponses.length} API responses capturadas:`)
    const uniqueApis = new Map<string, number>()
    for (const r of apiResponses) {
        const key = `${r.method} ${r.url.split('?')[0]}`
        uniqueApis.set(key, (uniqueApis.get(key) || 0) + 1)
    }
    for (const [key, count] of uniqueApis) {
        console.log(`   ${key} (${count}x)`)
    }

    // En particular, ver qué contiene la respuesta de v6/products
    const v6Response = apiResponses.find(r => r.url.includes('/v6/products') && r.method === 'PUT')
    if (v6Response) {
        try {
            const json = JSON.parse(v6Response.body)
            console.log(`\n📊 PUT v6/products: ${json.products?.length || 0} productos`)
        } catch { }
    }

    await browser.close()
}

main().catch(err => { console.error('FATAL:', err); process.exit(1) })
