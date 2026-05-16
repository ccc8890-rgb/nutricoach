/**
 * Diagnóstico rápido: Explorar APIs de Bonpreu/Esclat
 * Captura todas las requests/responses de una categoría con scroll
 * y guarda los resultados para analizar.
 *
 * Uso: npx tsx scripts/diagnosticar-api-explorer.ts
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

    // Guardar en archivo incremental
    const results: any[] = []

    page.on('response', async (res) => {
        const url = res.url()
        if (!url.includes('compraonline.bonpreuesclat')) return

        try {
            const text = await res.text()
            const path = url.replace(URL_BASE, '')
            const isApi = path.includes('/api/')
            const bodyLen = text.length

            // Solo guardar APIs relevantes
            if (isApi || path.includes('/categories/')) {
                const entry: any = {
                    url: path.split('?')[0],
                    query: url.includes('?') ? url.split('?')[1] : '',
                    method: res.request()?.method() || 'GET',
                    status: res.status(),
                    bodyLen,
                }

                // Guardar body completo solo si es pequeño
                if (bodyLen < 200000) {
                    entry.body = text.slice(0, 200000)
                } else {
                    entry.body = `[${bodyLen} bytes - too large]`
                }

                results.push(entry)
            }
        } catch { }
    })

    // Homepage first
    console.log('📍 Homepage...')
    await page.goto(URL_BASE + '/', { waitUntil: 'domcontentloaded', timeout: 30000 }).catch(() => { })
    await page.waitForTimeout(5000)

    // Category page
    console.log('📍 Categoría frescos...')
    await page.goto(`${URL_BASE}/categories/frescos/${CAT_UUID}`, {
        waitUntil: 'domcontentloaded', timeout: 30000
    }).catch(() => { })
    await page.waitForTimeout(3000)

    // Scroll
    console.log('📍 Scroll...')
    for (let i = 0; i < 10; i++) {
        await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight))
        await page.waitForTimeout(1500)
    }

    // Guardar
    const outputPath = 'scripts/api-explorer-results.json'
    fs.writeFileSync(outputPath, JSON.stringify(results, null, 2))
    console.log(`\n✅ ${results.length} entradas guardadas en ${outputPath}`)

    // Resumen
    const uniqueApis = new Map<string, { method: string; count: number; sizes: number[] }>()
    for (const r of results) {
        const key = `${r.method} ${r.url}`
        if (!uniqueApis.has(key)) {
            uniqueApis.set(key, { method: r.method, count: 0, sizes: [] })
        }
        const entry = uniqueApis.get(key)!
        entry.count++
        entry.sizes.push(r.bodyLen)
    }

    console.log('\n📊 ENDPOINTS:')
    for (const [key, info] of uniqueApis) {
        const avgSize = Math.round(info.sizes.reduce((a, b) => a + b, 0) / info.sizes.length / 1024)
        const firstBody = results.find(r => `${r.method} ${r.url}` === key)?.body
        const preview = firstBody && typeof firstBody === 'string' && firstBody.length < 500
            ? firstBody.slice(0, 300)
            : firstBody && typeof firstBody === 'string' && firstBody.startsWith('[')
                ? `[${firstBody.length} bytes]`
                : ''

        console.log(`  ${info.method} ${key}`)
        console.log(`    ${info.count}x | avg ${avgSize}KB`)
        if (preview) console.log(`    Preview: ${preview}`)
    }

    await browser.close()
}

main().catch(err => { console.error('FATAL:', err); process.exit(1) })
