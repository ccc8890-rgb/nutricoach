/**
 * find-scraper-apis.ts — Usa Playwright para interceptar llamadas API
 * en los supermercados y descubrir endpoints funcionales.
 *
 * Uso: npx tsx scripts/find-scraper-apis.ts
 */
import { chromium } from 'playwright'

interface ProbeTarget {
    name: string
    url: string
    /** Patrón de URL para identificar calls API relevantes */
    apiPattern?: string
}

const TARGETS: ProbeTarget[] = [
    // Consum - Drupal, buscar API JSON
    { name: 'Consum', url: 'https://www.consum.es/', apiPattern: 'api|json|graphql|rest' },
    // Día - SPA React
    { name: 'Día', url: 'https://www.dia.es/compra-online/', apiPattern: 'api|rest|graphql|gateway' },
    // Carrefour - bloqueado por Cloudflare
    { name: 'Carrefour', url: 'https://www.carrefour.es/supermercado/c/alimentacion', apiPattern: 'api|search|category|product' },
    // Eroski - Apache Tapestry
    { name: 'Eroski', url: 'https://supermercado.eroski.es/', apiPattern: 'api|rest|json|search' },
    // Lidl
    { name: 'Lidl', url: 'https://www.lidl.es/', apiPattern: 'api|rest|gateway|search' },
    // Alcampo (DNS issues)
    { name: 'Alcampo', url: 'https://www.alcampo.es/', apiPattern: 'api|rest|product|category' },
]

async function main() {
    const browser = await chromium.launch({
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox'],
    })

    for (const target of TARGETS) {
        console.log(`\n${'='.repeat(60)}`)
        console.log(`🔍 ${target.name} — ${target.url}`)
        console.log(`${'='.repeat(60)}`)

        const context = await browser.newContext({
            userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
            viewport: { width: 1920, height: 1080 },
            locale: 'es-ES',
        })

        const page = await context.newPage()

        // Interceptar todas las peticiones de red
        const apiCalls: { url: string; method: string; status: number; type: string }[] = []
        page.on('response', async (response) => {
            const req = response.request()
            const url = req.url()
            const method = req.method()
            const status = response.status()
            const type = req.resourceType()

            // Solo nos interesan calls con patterns de API
            if (target.apiPattern && new RegExp(target.apiPattern, 'i').test(url)) {
                apiCalls.push({ url: url.substring(0, 200), method, status, type })
            }

            // Capturar también si es una respuesta JSON exitosa
            const ct = response.headers()['content-type'] || ''
            if (ct.includes('json') && status < 400) {
                // No duplicar si ya lo capturamos arriba
                if (!target.apiPattern || !new RegExp(target.apiPattern, 'i').test(url)) {
                    apiCalls.push({ url: url.substring(0, 200), method, status, type: 'json(' + type + ')' })
                }
            }
        })

        // También interceptar requests para ver endpoints ANTES de que fallen
        page.on('request', (request) => {
            const url = request.url()
            // Capturar cualquier call que parezca API
            if (/api|rest|graphql|search|category|product|gateway|v1|v2|v3/i.test(url)) {
                // Lo capturamos en response, pero si falla la response lo perdemos
                // Así que lo guardamos aquí también
            }
        })

        try {
            await page.goto(target.url, {
                waitUntil: 'networkidle',
                timeout: 30000,
            })

            // Esperar un poco más para JS dinámico
            await page.waitForTimeout(3000)

            // Scroll down para trigger lazy loading
            await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight))
            await page.waitForTimeout(2000)

            const title = await page.title().catch(() => '(sin título)')
            console.log(`  📄 Título: ${title}`)
            console.log(`  📡 API calls detectadas: ${apiCalls.length}`)

            // Mostrar calls relevantes (ordenadas por tipo)
            const jsonCalls = apiCalls.filter(c => c.type.includes('json') || c.status < 400)
            const xhrCalls = apiCalls.filter(c => c.type === 'xhr')

            const relevant = [...jsonCalls, ...xhrCalls]
            if (relevant.length === 0) {
                console.log(`  ⚠️  No se detectaron calls API. Mostrando todas:`)
                for (const c of apiCalls.slice(0, 10)) {
                    console.log(`     [${c.status}] ${c.method} ${c.type} ${c.url}`)
                }
            } else {
                for (const c of relevant.slice(0, 15)) {
                    console.log(`     [${c.status}] ${c.method} ${c.type} ${c.url}`)
                }
            }
            if (relevant.length > 15) {
                console.log(`     ... y ${relevant.length - 15} más`)
            }

        } catch (err) {
            console.log(`  ❌ Error: ${err instanceof Error ? err.message : String(err)}`)
        }

        await context.close()
    }

    await browser.close()
    console.log(`\n✅ Inspección completada`)
}

main().catch(console.error)
