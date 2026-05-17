/**
 * diagnostic-dia.ts
 *
 * Abre Día con Playwright, guarda el HTML de la homepage y busca
 * categorías disponibles. Usado para diagnosticar por qué el scraper
 * no encuentra categorías.
 *
 * Uso: npx tsx scripts/diagnostic-dia.ts
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

    // 1. Homepage
    console.log('=== 1. Abriendo homepage Día ===')
    await page.goto('https://www.dia.es/compra-online/', {
        waitUntil: 'networkidle',
        timeout: 30000,
    }).catch(() => console.log('Timeout en homepage, continuando...'))
    await page.waitForTimeout(5000)

    // Guardar HTML
    const html = await page.content()
    console.log(`HTML length: ${html.length} bytes`)
    console.log(`Title: ${await page.title()}`)

    // Buscar enlaces a categorías
    const links = await page.evaluate(() => {
        const results: { href: string; text: string; tag: string; selector: string }[] = []
        // Buscar todos los enlaces que contengan "compra-online"
        document.querySelectorAll('a').forEach(a => {
            const href = a.getAttribute('href') || ''
            const text = a.textContent?.trim() || ''
            if (href.includes('compra-online') && text.length > 1) {
                // Buscar selector único
                let selector = a.tagName.toLowerCase()
                if (a.id) selector += `#${a.id}`
                if (a.className) selector += `.${a.className.split(' ').join('.')}`
                results.push({ href, text: text.substring(0, 80), tag: a.tagName, selector })
            }
        })
        return results
    })
    console.log(`\n=== 2. Enlaces a /compra-online/ (${links.length}) ===`)
    links.slice(0, 30).forEach((l, i) => {
        console.log(`  ${i + 1}. [${l.selector}] "${l.text}" → ${l.href}`)
    })

    // Buscar específicamente /c/ (categorías)
    const catLinks = links.filter(l => l.href.includes('/c/'))
    console.log(`\n=== 3. Enlaces con /c/ (categorías): ${catLinks.length} ===`)
    catLinks.forEach((l, i) => {
        console.log(`  ${i + 1}. "${l.text}" → ${l.href}`)
    })

    // 4. Probar API de Día
    console.log(`\n=== 4. Probando API directa de Día ===`)
    try {
        const apiUrl = 'https://www.dia.es/api/commerce/v0/categories/AL00'
        console.log(`Fetching: ${apiUrl}`)
        const response = await page.evaluate(async (url) => {
            try {
                const r = await fetch(url, {
                    headers: { 'Accept': 'application/json' }
                })
                if (r.ok) {
                    const data = await r.json()
                    return { ok: true, status: r.status, data: JSON.stringify(data).substring(0, 500) }
                }
                return { ok: false, status: r.status, data: await r.text().then(t => t.substring(0, 200)) }
            } catch (e) {
                return { ok: false, status: 0, data: String(e) }
            }
        }, apiUrl)
        console.log(`  Status: ${response.status}, OK: ${response.ok}`)
        console.log(`  Data: ${response.data}`)
    } catch (err) {
        console.log(`  Error: ${err}`)
    }

    // 5. Guardar HTML de la página
    const path = '/tmp/dia-homepage.html'
    const fs = await import('fs')
    fs.writeFileSync(path, html)
    console.log(`\n=== 5. HTML guardado en ${path} ===`)

    await browser.close()
    console.log('\n=== Diagnóstico completado ===')
}

main().catch(err => {
    console.error('Error:', err)
    process.exit(1)
})
