/**
 * Diagnóstico: Investigar API de suggestions/primary como posible
 * endpoint para obtener TODOS los productos de golpe.
 *
 * La respuesta de suggestions/primary con searchTerm="" y limit=20000
 * devolvió 80KB en el diagnóstico anterior.
 *
 * Uso: npx tsx scripts/diagnosticar-suggestions-api.ts
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

    // Capturar SOLO suggestions/primary
    let suggestionsResponse: any = null
    page.on('response', async (res) => {
        const url = res.url()
        if (url.includes('/api/search/v1/suggestions/primary')) {
            try {
                const body = await res.text()
                suggestionsResponse = {
                    status: res.status(),
                    url: url,
                    bodyLength: body.length,
                    body: body,
                }
            } catch { }
        }
    })

    console.log('📍 Navegando a homepage...')
    await page.goto(URL_BASE + '/', {
        waitUntil: 'networkidle',
        timeout: 30000,
    }).catch(() => { })
    await page.waitForTimeout(5000)

    if (suggestionsResponse) {
        const json = JSON.parse(suggestionsResponse.body)

        console.log(`\n📦 Suggestions API Response:`)
        console.log(`   Status: ${suggestionsResponse.status}`)
        console.log(`   Body Length: ${suggestionsResponse.bodyLength} bytes`)
        console.log(`   Top-level keys: ${Object.keys(json).join(', ')}`)

        // Explorar estructura
        for (const key of Object.keys(json)) {
            const val = json[key]
            if (Array.isArray(val)) {
                console.log(`   ${key}: Array[${val.length}]`)
                if (val.length > 0 && typeof val[0] === 'object') {
                    console.log(`     First item keys: ${Object.keys(val[0]).join(', ')}`)
                    console.log(`     First item: ${JSON.stringify(val[0]).slice(0, 300)}`)
                }
            } else if (typeof val === 'object' && val !== null) {
                console.log(`   ${key}: Object {${Object.keys(val).join(', ')}}`)
            } else {
                console.log(`   ${key}: ${String(val).slice(0, 100)}`)
            }
        }

        // Guardar JSON completo
        fs.writeFileSync('scripts/suggestions-response.json', JSON.stringify(json, null, 2))
        console.log(`\n✅ Guardado en scripts/suggestions-response.json`)
    } else {
        console.log('❌ No se capturó respuesta de suggestions/primary')
    }

    // También probar con otro query parameter
    console.log('\n📍 Probando v5/product-pages sin decoratedOnly...')
    // Navegar a una categoría y ver qué otra API se llama

    await browser.close()
}

main().catch(err => { console.error('FATAL:', err); process.exit(1) })
