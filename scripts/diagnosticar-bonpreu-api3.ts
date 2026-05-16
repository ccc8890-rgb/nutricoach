/**
 * Diagnóstico Bonpreu — Capturar request/response de la API de productos
 * 
 * En el primer diagnóstico se detectó:
 *   [PUT] /api/webproductpagews/v6/products → 200 con productos reales
 * 
 * Averiguar: qué body envía el PUT y qué headers necesita
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

    // Capturar TODAS las requests y responses de API
    const apiCalls: any[] = []
    page.on('request', (req) => {
        const url = req.url()
        if (url.includes('webproductpagews') || url.includes('productpage')) {
            apiCalls.push({
                type: 'REQUEST',
                method: req.method(),
                url: url.slice(0, 150),
                headers: req.headers(),
                postData: req.postData()?.slice(0, 5000),
                resourceType: req.resourceType(),
            })
        }
    })

    page.on('response', async (res) => {
        const url = res.url()
        if (url.includes('webproductpagews') || url.includes('productpage')) {
            let body = ''
            try {
                body = await res.text()
            } catch { body = '(no body)' }
            apiCalls.push({
                type: 'RESPONSE',
                method: res.request()?.method(),
                url: url.slice(0, 150),
                status: res.status(),
                headers: res.headers(),
                bodyLength: body.length,
                body: body.length > 100000 ? body.slice(0, 100000) + '...[TRUNCATED]' : body,
            })
        }
    })

    // Navegar al homepage primero (como hace el SPA)
    console.log('📍 Navegando a homepage...')
    await page.goto(URL_BASE, { waitUntil: 'domcontentloaded', timeout: 30000 }).catch(() => { })
    await page.waitForTimeout(5000)

    console.log('📍 Navegando a categoría frescos...')
    const uuid = 'c95cfbf2-501d-433f-bae3-10fcef330b11'
    await page.goto(`${URL_BASE}/categories/frescos/${uuid}`, { waitUntil: 'domcontentloaded', timeout: 30000 }).catch(() => { })

    // Esperar y scrollear para trigger lazy loading
    await page.waitForTimeout(5000)
    await page.evaluate(`window.scrollTo(0, document.body.scrollHeight * 0.3)`)
    await page.waitForTimeout(2000)
    await page.evaluate(`window.scrollTo(0, document.body.scrollHeight * 0.6)`)
    await page.waitForTimeout(2000)
    await page.evaluate(`window.scrollTo(0, document.body.scrollHeight)`)
    await page.waitForTimeout(3000)

    // Guardar resultados
    const outputPath = 'scripts/output-bonpreu-api3.json'
    fs.writeFileSync(outputPath, JSON.stringify(apiCalls, null, 2))

    console.log(`\n📦 ${apiCalls.length} llamadas API capturadas`)
    for (const call of apiCalls) {
        if (call.type === 'REQUEST') {
            console.log(`\n>> ${call.method} ${call.url}`)
            if (call.postData) {
                console.log(`   POST DATA: ${call.postData.slice(0, 500)}`)
            }
        } else {
            console.log(`<< ${call.status} ${call.url}`)
            console.log(`   Body: ${call.bodyLength} bytes`)
            if (call.bodyLength < 5000) {
                console.log(`   Body: ${call.body}`)
            } else {
                // Intentar parsear y mostrar resumen
                try {
                    const json = JSON.parse(call.body)
                    if (json.products) {
                        console.log(`   🏪 ${json.products.length} productos:`)
                        for (const p of json.products.slice(0, 5)) {
                            console.log(`   - ${p.name} | ${p.brand || ''} | ${p.packSizeDescription || ''} | price: ${JSON.stringify(p.price)}`)
                            // Mostrar todas las keys del producto
                            console.log(`     keys: ${Object.keys(p).join(', ')}`)
                        }
                    } else {
                        console.log(`   Keys: ${Object.keys(json).join(', ')}`)
                    }
                } catch (e) {
                    console.log(`   (no pude parsear JSON, preview: ${call.body.slice(0, 300)})`)
                }
            }
        }
    }

    await browser.close()
    console.log('\n✅ Diagnóstico guardado en:', outputPath)
}

main().catch(err => { console.error('FATAL:', err); process.exit(1) })
