/**
 * diagnosticar-hipercor-api.ts
 *
 * Diagnóstico para Hipercor (y El Corte Inglés).
 * Objetivo: descubrir si el frontend SPA hace llamadas API REST internas
 * que podamos usar directamente con fetch().
 *
 * Estrategia:
 * 1. Navegar con Playwright a la homepage de Hipercor
 * 2. Navegar a una categoría de supermercado
 * 3. Interceptar TODAS las respuestas network (incluyendo XHR/fetch)
 * 4. Buscar patrones API (/api/, /rest/, JSON responses, etc.)
 * 5. Probar si alguna llamada funciona con HTTP fetch directo
 *
 * Uso: Navegador headless: npx tsx scripts/diagnosticar-hipercor-api.ts
 *      Con navegador visible: npx tsx scripts/diagnosticar-hipercor-api.ts --headed
 */

import { chromium } from 'playwright'

const HIPERCOR_HOMEPAGE = 'https://www.hipercor.es/supermercado/'
const CATEGORIA_URL = 'https://www.hipercor.es/supermercado/carniceria/'

async function main() {
    const headed = process.argv.includes('--headed')
    console.log(`[Diagnóstico Hipercor] Iniciando (headed: ${headed})...`)
    console.log(`URL: ${HIPERCOR_HOMEPAGE}\n`)

    const browser = await chromium.launch({
        headless: !headed,
        args: ['--no-sandbox', '--disable-setuid-sandbox'],
    })

    const context = await browser.newContext({
        userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        viewport: { width: 1920, height: 1080 },
        locale: 'es-ES',
    })

    const page = await context.newPage()

    // ── Interceptar TODAS las respuestas ──
    const respuestas: Array<{ url: string; status: number; contentType: string; size: number }> = []

    page.on('response', async (res) => {
        const url = res.url()
        const status = res.status()
        const contentType = res.headers()['content-type'] || ''
        const size = parseInt(res.headers()['content-length'] || '0')

        // Filtrar solo respuestas que parezcan API (no assets estáticos)
        const esApi =
            url.includes('/api/') ||
            url.includes('/rest/') ||
            url.includes('/graphql') ||
            url.includes('/v1/') ||
            url.includes('/v2/') ||
            url.includes('/v3/') ||
            url.includes('/v4/') ||
            url.includes('/v5/') ||
            url.includes('/v6/') ||
            contentType.includes('json')

        if (esApi || status === 403 || status === 429) {
            respuestas.push({
                url,
                status,
                contentType: contentType.slice(0, 60),
                size
            })
        }

        // También capturar cualquier JSON aunque no tenga API en URL
        if (contentType.includes('json') && status === 200) {
            respuestas.push({
                url,
                status,
                contentType: contentType.slice(0, 60),
                size
            })
        }
    })

    // ── 1. Navegar a homepage ──
    console.log('Paso 1: Navegando a homepage...')
    try {
        await page.goto(HIPERCOR_HOMEPAGE, {
            waitUntil: 'networkidle',
            timeout: 30000,
        })
        console.log(`  Status: ${await page.evaluate(() => document.title)}`)
        console.log(`  URL final: ${page.url()}`)
        const bodyText = await page.evaluate(() => document.body?.innerText?.slice(0, 200) || 'NO BODY')
        console.log(`  Body preview: ${bodyText.slice(0, 100)}`)
    } catch (err) {
        console.log(`  ❌ Error homepage: ${err instanceof Error ? err.message : String(err)}`)
    }

    await page.waitForTimeout(2000)

    // ── 2. Navegar a categoría ──
    console.log('\nPaso 2: Navegando a categoría carnicería...')
    try {
        await page.goto(CATEGORIA_URL, {
            waitUntil: 'networkidle',
            timeout: 30000,
        })
        console.log(`  URL final: ${page.url()}`)
        const bodyText = await page.evaluate(() => document.body?.innerText?.slice(0, 500) || 'NO BODY')
        console.log(`  Body preview: ${bodyText.slice(0, 200)}`)
    } catch (err) {
        console.log(`  ❌ Error categoría: ${err instanceof Error ? err.message : String(err)}`)
    }

    await page.waitForTimeout(3000)

    // ── 3. Mostrar respuestas API encontradas ──
    console.log(`\nPaso 3: Respuestas API encontradas: ${respuestas.length}`)

    // Ordenar por URL
    const unicos = new Map<string, typeof respuestas[0]>()
    for (const r of respuestas) {
        const key = r.url.split('?')[0] // quitar query params
        if (!unicos.has(key)) {
            unicos.set(key, r)
        }
    }

    console.log(`\nEndpoints únicos descubiertos (${unicos.size}):`)
    let i = 1
    for (const [url, info] of unicos) {
        console.log(`  ${i}. [${info.status}] ${info.contentType}`)
        console.log(`     ${url.slice(0, 150)}`)
        i++
    }

    // ── 4. Buscar patrones en el HTML (__NEXT_DATA__, __INITIAL_STATE__, etc.) ──
    console.log('\nPaso 4: Buscando datos embebidos en HTML...')
    const patrones = ['__NEXT_DATA__', '__INITIAL_STATE__', '__NUXT__', 'window.__', 'data: {']
    for (const patron of patrones) {
        const encontrado = await page.evaluate((p) => {
            const html = document.documentElement?.innerHTML || ''
            return html.includes(p)
        }, patron)
        console.log(`  ${patron}: ${encontrado ? '✅ ENCONTRADO' : '❌ no encontrado'}`)
    }

    // ── 5. Buscar JSON-LD ──
    const jsonld = await page.evaluate(() => {
        const scripts = document.querySelectorAll('script[type="application/ld+json"]')
        return Array.from(scripts).map(s => s.textContent?.slice(0, 200))
    })
    console.log(`\n  JSON-LD encontrados: ${jsonld.length}`)
    jsonld.forEach((j, i) => console.log(`    [${i}] ${j?.slice(0, 150)}`))

    // ── 6. Probar fetch directo a un endpoint sospechoso ──
    console.log('\nPaso 5: Probando fetch directo a posibles APIs...')
    const cookies = await context.cookies()
    const cookieStr = cookies.map(c => `${c.name}=${c.value}`).join('; ')

    const endpointsAProbar = [
        'https://www.hipercor.es/api/supermercado/v1/productos?categoria=carniceria',
        'https://www.hipercor.es/supermercado/api/productos',
        'https://www.hipercor.es/api/supermercado/productos',
        'https://www7.hipercor.es/api/', // posible subdominio API
    ]

    for (const endpoint of endpointsAProbar) {
        try {
            const res = await fetch(endpoint, {
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
                    'Accept': 'application/json',
                    'Cookie': cookieStr,
                    'Referer': HIPERCOR_HOMEPAGE,
                },
                signal: AbortSignal.timeout(10000),
            })
            const text = await res.text()
            console.log(`  [${res.status}] ${endpoint}`)
            console.log(`     ${text.slice(0, 200)}`)
        } catch (err) {
            console.log(`  [ERR] ${endpoint}: ${err instanceof Error ? err.message : String(err)}`)
        }
    }

    // ── 7. Intentar mismo para El Corte Inglés ──
    console.log('\nPaso 6: Probando El Corte Inglés...')
    const endpointsECI = [
        'https://www.elcorteingles.es/api/supermercado/v1/productos',
        'https://www.elcorteingles.es/supermercado/api/productos',
        'https://api.elcorteingles.es/supermercado/productos',
    ]
    for (const endpoint of endpointsECI) {
        try {
            const res = await fetch(endpoint, {
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
                    'Accept': 'application/json',
                },
                signal: AbortSignal.timeout(10000),
            })
            const text = await res.text()
            console.log(`  [${res.status}] ${endpoint}`)
            console.log(`     ${text.slice(0, 200)}`)
        } catch (err) {
            console.log(`  [ERR] ${endpoint}: ${err instanceof Error ? err.message : String(err)}`)
        }
    }

    // ── Cerrar ──
    console.log('\n✅ Diagnóstico completado')
    await browser.close()
}

main().catch(err => {
    console.error('Error fatal:', err)
    process.exit(1)
})
