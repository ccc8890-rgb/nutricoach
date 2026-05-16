/**
 * Diagnóstico de paginación Bonpreu/Esclat
 * 
 * Objetivo: descubrir cómo obtener TODOS los productos de una categoría,
 * no solo los 27 destacados.
 * 
 * Uso: npx tsx scripts/diagnosticar-paginacion-bonpreu.ts
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

    // Capturar TODAS las requests API con detalles
    const apiCalls: any[] = []
    page.on('request', (req) => {
        const url = req.url()
        if (url.includes('compraonline.bonpreuesclat') && 
            (url.includes('/api/') || url.includes('/categories/'))) {
            apiCalls.push({
                type: 'REQUEST',
                method: req.method(),
                url: url.replace(URL_BASE, '').split('?')[0],
                queryString: url.includes('?') ? url.split('?')[1] : '',
                postData: req.postData()?.slice(0, 300),
                resourceType: req.resourceType(),
                timestamp: Date.now(),
            })
        }
    })

    page.on('response', async (res) => {
        const url = res.url()
        if (url.includes('compraonline.bonpreuesclat') && 
            (url.includes('/api/') || url.includes('/categories/'))) {
            let body = ''
            try {
                body = await res.text()
            } catch { body = '(no body)' }
            
            // Buscar info de paginación en el body
            let paginationInfo = ''
            try {
                const json = JSON.parse(body)
                // Check for total count / pagination fields
                const keys = Object.keys(json)
                const paginationKeys = keys.filter(k => 
                    k.includes('total') || k.includes('page') || k.includes('offset') || 
                    k.includes('pagination') || k.includes('count') || k.includes('limit') ||
                    k.includes('next') || k.includes('hasMore') || k.includes('cursor')
                )
                if (paginationKeys.length > 0) {
                    paginationInfo = paginationKeys.map(k => `${k}: ${JSON.stringify(json[k]).slice(0, 200)}`).join(', ')
                }
                // Check product count
                if (json.productGroups) {
                    let totalProducts = 0
                    for (const g of json.productGroups) {
                        totalProducts += g.products?.length || 0
                    }
                    paginationInfo += ` | productGroups: ${json.productGroups.length} groups, ${totalProducts} total products`
                }
                if (json.products) {
                    paginationInfo += ` | products: ${json.products.length}`
                }
            } catch {}
            
            apiCalls.push({
                type: 'RESPONSE',
                method: res.request()?.method(),
                url: url.replace(URL_BASE, '').split('?')[0],
                queryString: url.includes('?') ? url.split('?')[1] : '',
                status: res.status(),
                bodyLength: body.length,
                paginationInfo: paginationInfo.slice(0, 500),
                timestamp: Date.now(),
            })
        }
    })

    // 1. Navegar a homepage
    console.log('📍 Navegando a homepage...')
    await page.goto(URL_BASE, { waitUntil: 'networkidle', timeout: 30000 }).catch(() => {})
    await page.waitForTimeout(3000)
    console.log(`   API calls so far: ${apiCalls.length}`)

    // 2. Navegar a categoría frescos
    console.log('📍 Navegando a categoría frescos...')
    await page.goto(`${URL_BASE}/categories/frescos/${CAT_UUID}`, { 
        waitUntil: 'networkidle', 
        timeout: 30000 
    }).catch(() => {})
    await page.waitForTimeout(5000)
    console.log(`   API calls so far: ${apiCalls.length}`)

    // 3. Scroll lento y profundo para cargar más productos
    console.log('📍 Haciendo scroll profundo...')
    const scrolls = [0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1.0]
    for (const frac of scrolls) {
        await page.evaluate((f) => {
            window.scrollTo(0, document.body.scrollHeight * f)
        }, frac)
        await page.waitForTimeout(2000)
    }
    // Scroll extra al final
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight))
    await page.waitForTimeout(3000)
    console.log(`   API calls so far: ${apiCalls.length}`)

    // 4. Imprimir resumen de llamadas API únicas
    const uniqueEndpoints = new Map<string, number>()
    for (const call of apiCalls) {
        const key = `${call.method} ${call.url}`
        uniqueEndpoints.set(key, (uniqueEndpoints.get(key) || 0) + 1)
    }

    console.log('\n=== ENDPOINTS ÚNICOS DETECTADOS ===')
    for (const [endpoint, count] of uniqueEndpoints) {
        const sample = apiCalls.find(c => `${c.method} ${c.url}` === endpoint)
        console.log(`  ${endpoint} (${count} calls)`)
        if (sample.queryString) {
            console.log(`    Query: ${sample.queryString}`)
        }
        if (sample.paginationInfo && sample.type === 'RESPONSE') {
            console.log(`    Info: ${sample.paginationInfo}`)
        }
    }

    // 5. Guardar diagnóstico completo
    const outputPath = 'scripts/output-paginacion-bonpreu.json'
    fs.writeFileSync(outputPath, JSON.stringify(apiCalls, null, 2))
    console.log(`\n✅ Diagnóstico guardado en: ${outputPath}`)
    console.log(`   Total API calls: ${apiCalls.length}`)

    await browser.close()
}

main().catch(err => { console.error('FATAL:', err); process.exit(1) })
