/**
 * Diagnóstico: Extraer UUIDs de productos desde HTML SPA de categoría
 *
 * La página HTML de categoría (~1MB) contiene los UUIDs de productos.
 * Podemos extraerlos con regex y luego hacer PUT v6/products en batch.
 *
 * Uso: npx tsx scripts/diagnosticar-uuids-desde-sesion.ts
 */
import { chromium } from 'playwright'
import * as fs from 'fs'

const URL_BASE = 'https://www.compraonline.bonpreuesclat.cat'
const CAT_UUID = 'c95cfbf2-501d-433f-bae3-10fcef330b11'
const CAT_SLUG = 'frescos'

async function main() {
    // ── 1. Establecer sesión con Playwright ──
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

    let csrfToken = ''
    page.on('request', (req) => {
        const headers = req.headers()
        if (headers['x-csrf-token'] && !csrfToken) {
            csrfToken = headers['x-csrf-token']
        }
    })

    console.log('📍 Estableciendo sesión via homepage...')
    await page.goto(URL_BASE + '/', { waitUntil: 'networkidle', timeout: 30000 }).catch(() => { })
    await page.waitForTimeout(3000)

    if (!csrfToken) {
        await page.goto(`${URL_BASE}/categories/frescos/${CAT_UUID}`, { waitUntil: 'networkidle', timeout: 30000 }).catch(() => { })
        await page.waitForTimeout(5000)
    }

    const cookies = await context.cookies()
    const cookieStr = cookies.map(c => `${c.name}=${c.value}`).join('; ')
    const userAgent = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36'

    console.log(`   🍪 Cookies: ${cookies.length} cookies, ${cookieStr.length} chars`)
    console.log(`   🛡️  CSRF: ${csrfToken ? '✅ ' + csrfToken.slice(0, 20) + '...' : '❌ no token'}`)

    await browser.close()

    // ── 2. Fetch HTML de categoría via HTTP ──
    console.log(`\n📍 Fetching category page HTML via HTTP...`)
    const catUrl = (useUuid: boolean) => useUuid
        ? `${URL_BASE}/categories/${CAT_SLUG}/${CAT_UUID}`
        : `${URL_BASE}/categories/${CAT_SLUG}`

    const headers = {
        'User-Agent': userAgent,
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'ca-ES,ca;q=0.9,es;q=0.8',
        'Cookie': cookieStr,
        ...(csrfToken ? { 'x-csrf-token': csrfToken } : {}),
    }

    const res = await fetch(catUrl(true), { headers, signal: AbortSignal.timeout(30000) })
    const html = await res.text()
    console.log(`   Status: ${res.status}`)
    console.log(`   HTML size: ${(html.length / 1024).toFixed(1)} KB`)

    // ── 3. Buscar UUIDs en el HTML ──
    // UUID pattern: xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
    const uuidPattern = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi
    const allUuids = html.match(uuidPattern) || []
    console.log(`\n📦 UUIDs encontrados en HTML: ${allUuids.length}`)

    // Deduplicar y contar frecuencia
    const uuidCount = new Map<string, number>()
    for (const u of allUuids) {
        uuidCount.set(u, (uuidCount.get(u) || 0) + 1)
    }

    // Mostrar los más comunes (los UUIDs de producto deberían aparecer en contexto de productId)
    const sortedByCount = [...uuidCount.entries()].sort((a, b) => b[1] - a[1])
    console.log(`\nUUIDs únicos: ${uuidCount.size}`)
    console.log(`\nTop 10 UUIDs más frecuentes:`)
    for (const [uuid, count] of sortedByCount.slice(0, 10)) {
        console.log(`   ${uuid} (${count}x)`)
    }

    // ── 4. Buscar contexto específico de productId ──
    // Buscar "productId":"..." en el HTML
    const productIdPattern = /"productId"\s*:\s*"([0-9a-f-]{36})"/gi
    const productIds = [...html.matchAll(productIdPattern)].map(m => m[1])
    console.log(`\n🔑 productId encontrados: ${productIds.length}`)

    // Buscar patterns de scripts con state
    const scriptsWithProductIds = html.match(/<script[^>]*>[\s\S]*?productId[\s\S]*?<\/script>/gi) || []
    console.log(`\n📜 Scripts con productId: ${scriptsWithProductIds.length}`)

    // Buscar window.__INITIAL_STATE__ o similar
    const statePatterns = [
        /window\.__INITIAL_STATE__\s*=\s*([^;]+);/,
        /window\.__NUXT__\s*=\s*([^;]+);/,
        /window\.__NEXT_DATA__\s*=\s*([^;]+);/,
        /self\.__NEXT_DATA__\s*=\s*([^;]+);/,
    ]
    for (const pattern of statePatterns) {
        const match = html.match(pattern)
        if (match) {
            console.log(`\n📦 State encontrado: ${pattern.toString().slice(0, 50)}...`)
            const data = match[1]
            console.log(`   Size: ${(data.length / 1024).toFixed(1)} KB`)
            // Buscar product count en el state
            const prodCount = (data.match(/"productId"/g) || []).length
            console.log(`   Product IDs in state: ${prodCount}`)
            break
        }
    }

    // ── 5. Intentar PUT v6/products con UUIDs extraídos ──
    const uniqueProductIds = [...new Set(productIds)]
    console.log(`\n🔄 Probando PUT v6/products con ${uniqueProductIds.length} UUIDs...`)

    if (uniqueProductIds.length > 0 && csrfToken) {
        const batchSize = 24
        const allProducts: any[] = []

        for (let i = 0; i < Math.min(uniqueProductIds.length, 96); i += batchSize) {
            const batch = uniqueProductIds.slice(i, i + batchSize)
            const putRes = await fetch(`${URL_BASE}/api/webproductpagews/v6/products`, {
                method: 'PUT',
                headers: {
                    ...headers,
                    'Content-Type': 'application/json; charset=utf-8',
                    'Accept': 'application/json; charset=utf-8',
                    'x-csrf-token': csrfToken,
                    'ecom-request-source': 'web',
                    'ecom-request-source-version': '2.0.0-2026-05-14-11h49m36s-7d389e59',
                    'Referer': catUrl(true),
                    'client-route-id': crypto.randomUUID(),
                    'page-view-id': crypto.randomUUID(),
                },
                body: JSON.stringify(batch),
                signal: AbortSignal.timeout(15000),
            })

            if (putRes.ok) {
                const json = await putRes.json() as any
                if (json.products) {
                    allProducts.push(...json.products)
                    console.log(`   Batch ${i / batchSize + 1}: ✅ ${json.products.length} products`)
                }
            } else {
                console.log(`   Batch ${i / batchSize + 1}: ❌ ${putRes.status}`)
            }
        }

        console.log(`\n📊 Total products fetched via PUT: ${allProducts.length}`)
        fs.writeFileSync('scripts/products-via-put.json', JSON.stringify(allProducts.slice(0, 50), null, 2))
    }

    console.log('\n✅ Diagnóstico completado')
}

main().catch(err => { console.error('FATAL:', err); process.exit(1) })
