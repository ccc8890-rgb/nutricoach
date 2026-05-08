import { chromium } from 'playwright'

async function testInstagram() {
    const url = 'https://www.instagram.com/p/DTA0oZnD7dE/'
    console.log(`🚀 Probando Playwright con: ${url}`)

    const browser = await chromium.launch({ headless: true })
    const context = await browser.newContext({
        userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15',
        viewport: { width: 390, height: 844 },
        locale: 'es-ES',
    })
    const page = await context.newPage()

    try {
        console.log('⏳ Navegando...')
        await page.goto(url, { waitUntil: 'networkidle', timeout: 30000 })
        console.log('✅ Página cargada')

        const html = await page.content()
        console.log(`📄 HTML length: ${html.length} chars`)
        console.log(`📄 HTML primeros 500: ${html.slice(0, 500)}`)

        // Intentar extraer texto visible
        const bodyText = await page.evaluate(() => document.body.innerText)
        console.log(`\n📝 Visible text (primeros 1000):`)
        console.log(bodyText.slice(0, 1000))

        // Buscar meta tags
        const metaDesc = await page.evaluate(() => {
            const meta = document.querySelector('meta[name="description"]')
            return meta ? meta.getAttribute('content') : null
        })
        console.log(`\n📋 Meta description: ${metaDesc}`)

        // Buscar JSON-LD
        const jsonLd = await page.evaluate(() => {
            const scripts = document.querySelectorAll('script[type="application/ld+json"]')
            return Array.from(scripts).map(s => s.textContent).join('\n')
        })
        console.log(`\n🔍 JSON-LD: ${jsonLd.slice(0, 500) || 'Ninguno'}`)

    } catch (err) {
        console.error('❌ Error:', err)
    } finally {
        await browser.close()
        console.log('🔒 Navegador cerrado')
    }
}

testInstagram()
