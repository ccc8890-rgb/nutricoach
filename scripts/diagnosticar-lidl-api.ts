/**
 * Diagnóstico profundo Lidl — probar APIs internas directamente vía HTTP
 * Se descubrieron:
 *  - /p/api/gridboxes/ES/es?erpNumbers=... → info de productos individuales
 *  - recommendations.lidl-shop.com → recomendaciones con itemIds
 * 
 * Objetivo: encontrar una API que devuelva productos por categoría/búsqueda
 */
import { chromium } from 'playwright'

async function main() {
    const browser = await chromium.launch({
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox'],
    })

    const context = await browser.newContext({
        userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        viewport: { width: 1920, height: 1080 },
        locale: 'es-ES',
    })

    const page = await context.newPage()

    // Interceptar todas las llamadas a p/api o recommendations
    const apiCalls: any[] = []

    page.on('response', async (res) => {
        const url = res.url()
        const ct = res.headers()['content-type'] || ''
        const status = res.status()

        if (ct.includes('json') && status === 200) {
            try {
                const body = await res.text()
                let parsed: any
                try { parsed = JSON.parse(body) } catch { return }

                // Guardar endpoints interesantes
                if (
                    url.includes('p/api/') ||
                    url.includes('recommendations.lidl') ||
                    url.includes('search') ||
                    (url.includes('.json') && typeof parsed === 'object' && !url.includes('cookielaw') && !url.includes('onetrust') && !url.includes('storesearch'))
                ) {
                    apiCalls.push({
                        url,
                        status,
                        contentType: ct,
                        bodyKeys: typeof parsed === 'object' ? Object.keys(parsed) : 'N/A',
                        bodyPreview: JSON.stringify(parsed).substring(0, 500)
                    })
                }
            } catch { }
        }
    })

    // Probar URLs que podrían funcionar
    const urlsToTest = [
        'https://www.lidl.es/',
        'https://www.lidl.es/p/api/gridboxes/ES/es?erpNumbers=100398189,100399000',
        'https://www.lidl.es/p/api/categories',
        'https://www.lidl.es/p/api/categories/ES/es',
        'https://www.lidl.es/q/search?q=leche',
        'https://www.lidl.es/q/search?q=arroz',
    ]

    for (const url of urlsToTest) {
        console.log(`\n📌 ${url}`)
        try {
            const resp = await page.goto(url, {
                waitUntil: 'networkidle',
                timeout: 15000,
            }).catch(() => null)
            await page.waitForTimeout(2000)
            console.log(`   Status: ${resp?.status()}`)
        } catch (e: any) {
            console.log(`   Error: ${e.message?.substring(0, 80)}`)
        }
    }

    // También probar la API de recomendaciones directamente
    const recUrls = [
        'https://recommendations.lidl-shop.com/r/api/recommendations/ES/es/web/bestsellers/allproducts?limit=50',
        'https://recommendations.lidl-shop.com/r/api/recommendations/ES/es/web/shopthelook?limit=50&pageType=START_PAGE&pageId=home',
    ]

    for (const url of recUrls) {
        console.log(`\n📌 ${url}`)
        try {
            const resp = await page.goto(url, {
                waitUntil: 'networkidle',
                timeout: 15000,
            }).catch(() => null)
            await page.waitForTimeout(2000)
            console.log(`   Status: ${resp?.status()}`)
        } catch (e: any) {
            console.log(`   Error: ${e.message?.substring(0, 80)}`)
        }
    }

    console.log(`\n\n═══════ ENDPOINTS ENCONTRADOS ═══════`)
    const seen = new Set<string>()
    for (const call of apiCalls) {
        if (!seen.has(call.url)) {
            seen.add(call.url)
            console.log(`\n[${call.status}] ${call.url}`)
            console.log(`  Type: ${call.contentType}`)
            console.log(`  Keys: ${call.bodyKeys}`)
            console.log(`  Preview: ${call.bodyPreview.substring(0, 400)}`)
        }
    }

    await browser.close()
}
main().catch(console.error)
