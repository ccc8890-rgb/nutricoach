/**
 * Script diagnóstico para scrapers bloqueados (Día, Lidl, ECI, Hipercor)
 * Estrategia: interceptar APIs internas via page.on('response')
 * para ver si exponen JSON subyacente (como Bonpreu/Consum)
 */
import { chromium } from 'playwright'

interface ApiEndpoint {
    url: string
    metodo: string
    contentType: string
    bodyPreview: string
    supermercado: string
}

async function diagnosticarSupermercado(
    nombre: string,
    urlInicial: string,
    timeout: number = 30000
): Promise<ApiEndpoint[]> {
    console.log(`\n========== ${nombre} ==========`)

    const endpoints: ApiEndpoint[] = []
    let browser

    try {
        browser = await chromium.launch({
            headless: true,
            args: ['--no-sandbox', '--disable-setuid-sandbox'],
        })

        const context = await browser.newContext({
            userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
            viewport: { width: 1920, height: 1080 },
            locale: 'es-ES',
        })

        const page = await context.newPage()

        // Interceptar TODAS las respuestas
        page.on('response', async (res) => {
            const url = res.url()
            const ct = res.headers()['content-type'] || ''
            const status = res.status()

            // Solo JSON o URLs con patrones de API
            const esApi = ct.includes('json') ||
                url.includes('/api/') ||
                url.includes('/graphql') ||
                url.includes('/search/') ||
                url.includes('/product') ||
                url.includes('/category') ||
                url.includes('/rest/') ||
                url.includes('/v1/') ||
                url.includes('/v2/') ||
                url.includes('/v3/')

            if (esApi && status === 200) {
                try {
                    const body = await res.text()
                    const preview = body.length > 200
                        ? body.substring(0, 200) + '...'
                        : body
                    endpoints.push({
                        url,
                        metodo: res.request().method(),
                        contentType: ct,
                        bodyPreview: preview,
                        supermercado: nombre,
                    })
                } catch {
                    // ignore
                }
            }
        })

        console.log(`Navegando a ${urlInicial}...`)
        await page.goto(urlInicial, {
            waitUntil: 'networkidle',
            timeout,
        }).catch(e => console.log(`  Timeout/navigation error: ${e.message?.substring(0, 100)}`))

        await page.waitForTimeout(5000)

        // Intentar navegar a categorías
        if (nombre === 'Día') {
            const cats = [
                'https://www.dia.es/compra-online/alimentacion/c/AL00',
                'https://www.dia.es/compra-online/leches-y-postres/c/AL01',
            ]
            for (const catUrl of cats) {
                await page.goto(catUrl, { waitUntil: 'networkidle', timeout }).catch(() => { })
                await page.waitForTimeout(3000)
            }
        } else if (nombre === 'Lidl') {
            const cats = [
                'https://www.lidl.es/c/alimentacion',
                'https://www.lidl.es/c/frutas-y-verduras',
            ]
            for (const catUrl of cats) {
                await page.goto(catUrl, { waitUntil: 'networkidle', timeout }).catch(() => { })
                await page.waitForTimeout(3000)
            }
        } else if (nombre === 'El Corte Inglés') {
            const cats = [
                'https://www.elcorteingles.es/supermercado/',
                'https://www.elcorteingles.es/supermercado/carniceria/',
            ]
            for (const catUrl of cats) {
                await page.goto(catUrl, { waitUntil: 'networkidle', timeout }).catch(() => { })
                await page.waitForTimeout(3000)
            }
        } else if (nombre === 'Hipercor') {
            const cats = [
                'https://www.hipercor.es/supermercado/',
                'https://www.hipercor.es/supermercado/carniceria/',
            ]
            for (const catUrl of cats) {
                await page.goto(catUrl, { waitUntil: 'networkidle', timeout }).catch(() => { })
                await page.waitForTimeout(3000)
            }
        }

        await page.waitForTimeout(2000)

        // También ver si la página cargó correctamente
        const title = await page.title().catch(() => 'N/A')
        const bodyText = await page.evaluate(() => document.body?.innerText?.substring(0, 500) || 'N/A').catch(() => 'N/A')
        console.log(`  Title: ${title}`)
        console.log(`  Body preview: ${bodyText.substring(0, 300)}`)

    } catch (err) {
        console.error(`Error: ${err}`)
    } finally {
        if (browser) await browser.close()
    }

    console.log(`\nEndpoints API encontrados: ${endpoints.length}`)
    for (const ep of endpoints) {
        console.log(`  [${ep.metodo}] ${ep.url}`)
        console.log(`    Content-Type: ${ep.contentType}`)
        console.log(`    Preview: ${ep.bodyPreview.substring(0, 150)}`)
    }

    return endpoints
}

async function main() {
    const resultados: Record<string, ApiEndpoint[]> = {}

    resultados['Día'] = await diagnosticarSupermercado(
        'Día',
        'https://www.dia.es/compra-online/',
        25000
    )

    resultados['Lidl'] = await diagnosticarSupermercado(
        'Lidl',
        'https://www.lidl.es/',
        25000
    )

    resultados['El Corte Inglés'] = await diagnosticarSupermercado(
        'El Corte Inglés',
        'https://www.elcorteingles.es/supermercado/',
        25000
    )

    resultados['Hipercor'] = await diagnosticarSupermercado(
        'Hipercor',
        'https://www.hipercor.es/supermercado/',
        25000
    )

    console.log('\n\n========== RESUMEN FINAL ==========')
    for (const [nombre, eps] of Object.entries(resultados)) {
        console.log(`\n${nombre}: ${eps.length} endpoints API encontrados`)
    }
}
main().catch(console.error)
