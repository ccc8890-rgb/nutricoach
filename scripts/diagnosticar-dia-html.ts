/**
 * diagnosticar-dia-html.ts — Inspecciona el HTML real que devuelve Día
 *
 * Algunos endpoints HTTP devuelven 200 con 210KB de HTML.
 * Veamos si es contenido real (productos) o una página de bloqueo camuflada.
 */
import { chromium } from 'playwright'

const URLS = [
    'https://www.dia.es/compra-online/api/products?category=AL00',
    'https://www.dia.es/compra-online/alimentacion/c/AL00',
    'https://www.dia.es/compra-online/search?q=leche',
]

async function diagnosticar() {
    console.log('=== INSPECCIÓN HTML DE DÍA (200 OK) ===\n')

    for (const url of URLS) {
        console.log(`\n── ${url} ──`)

        const resp = await fetch(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
                'Accept-Language': 'es-ES,es;q=0.9',
            },
        })

        const html = await resp.text()
        console.log(`  Status: ${resp.status}`)
        console.log(`  Content-Type: ${resp.headers.get('content-type')}`)
        console.log(`  Size: ${html.length} bytes`)

        // Buscar keywords en el HTML
        const keywords = [
            'Access Denied', 'cloudflare', 'blocked', 'denied', 'challenge',
            'product-card', 'product-name', 'producto', 'precio', 'price',
            'leche', 'product', 'article', 'item', 'data-product',
            'csrf', 'token', 'recaptcha', 'captcha',
        ]

        for (const kw of keywords) {
            const regex = new RegExp(kw, 'gi')
            const matches = html.match(regex)
            if (matches) {
                console.log(`  "${kw}": ${matches.length} ocurrencias`)
            }
        }

        // Mostrar el título si existe
        const titleMatch = html.match(/<title>(.*?)<\/title>/i)
        if (titleMatch) {
            console.log(`  <title>: ${titleMatch[1]}`)
        }

        // Buscar contenedores de producto
        const posiblesContenedores = [
            'product-card', 'product-item', 'producto', 'item-product',
            'grid-item', 'product-list', 'search-result',
        ]
        for (const cls of posiblesContenedores) {
            const regex = new RegExp(`class=["'][^"']*${cls}[^"']*["']`, 'gi')
            const matches = html.match(regex)
            if (matches) {
                console.log(`  class*="${cls}": ${matches.length} elementos`)
                if (matches.length > 0 && matches.length < 5) {
                    matches.forEach(m => console.log(`    → ${m.slice(0, 120)}`))
                }
            }
        }

        // Buscar precios (€)
        const precioMatches = html.match(/\d+[,.]\d{2}\s*[€€]/g)
        if (precioMatches) {
            console.log(`  Precios (€): ${precioMatches.length} encontrados`)
            // Mostrar contexto alrededor de algunos
            const samples = precioMatches.slice(0, 5)
            for (const p of samples) {
                const idx = html.indexOf(p)
                const context = html.slice(Math.max(0, idx - 50), idx + 50)
                console.log(`    → ...${context.trim()}...`)
            }
        }

        // Buscar productos en JSON-LD
        const jsonldMatches = html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/gi)
        if (jsonldMatches) {
            console.log(`  JSON-LD: ${jsonldMatches.length} bloques`)
            jsonldMatches.slice(0, 2).forEach(j => {
                const clean = j.replace(/<[^>]+>/g, '').slice(0, 300)
                console.log(`    → ${clean}`)
            })
        }

        // Buscar scripts con data (estado inicial, SSR props, etc.)
        const dataMatches = html.match(/<script[^>]*>window\.__[^<]+<\/script>/gi)
        if (dataMatches) {
            console.log(`  Window.__ data: ${dataMatches.length} scripts`)
            dataMatches.slice(0, 3).forEach(s => console.log(`    → ${s.slice(0, 200)}`))
        }

        // Buscar data-attributes de producto
        const dataProd = html.match(/data-[a-z-]+="[^"]*"/gi)
        if (dataProd) {
            const dataProdFiltrados = dataProd.filter(d =>
                d.includes('product') || d.includes('price') || d.includes('id')
            )
            if (dataProdFiltrados.length > 0) {
                console.log(`  Data attributes relevantes: ${dataProdFiltrados.length}`)
                dataProdFiltrados.slice(0, 10).forEach(d => console.log(`    → ${d}`))
            }
        }

        // Primeros 500 chars
        console.log(`\n  PRIMEROS 500 chars:`)
        console.log(`  ${html.slice(0, 500)}`)

        console.log(`\n  ÚLTIMOS 500 chars:`)
        console.log(`  ${html.slice(-500)}`)
    }

    /* ─── Ahora probamos también con fetch limpio (sin headers extra) ─── */
    console.log('\n\n=== FETCH LIMPIO (sin headers especiales) ===\n')
    const cleanResp = await fetch('https://www.dia.es/compra-online/alimentacion/c/AL00')
    const cleanHtml = await cleanResp.text()
    console.log(`Status: ${cleanResp.status}, Size: ${cleanHtml.length} bytes`)
    const cleanTitle = cleanHtml.match(/<title>(.*?)<\/title>/i)
    if (cleanTitle) console.log(`Title: ${cleanTitle[1]}`)

    /* ─── Ahora probamos desde Playwright pero interceptando requests ─── */
    console.log('\n\n=== PLAYWRIGHT — INTERCEPTANDO XHR ===\n')
    let browser
    try {
        browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] })
        const context = await browser.newContext({
            userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
        })
        const page = await context.newPage()

        // Escuchar todas las requests XHR/fetch
        const requestsXHR: { url: string; tipo: string }[] = []
        page.on('request', req => {
            const tipo = req.resourceType()
            if (tipo === 'xhr' || tipo === 'fetch' || tipo === 'websocket') {
                requestsXHR.push({ url: req.url(), tipo })
            }
        })

        // Intentar navegar
        try {
            await page.goto('https://www.dia.es/compra-online/alimentacion/c/AL00', {
                waitUntil: 'domcontentloaded',
                timeout: 15000,
            })
            await page.waitForTimeout(5000)
        } catch {
            console.log('  Navegación falló (esperado con WAF)')
        }

        console.log(`  URL final: ${page.url()}`)
        const title2 = await page.title().catch(() => '')
        console.log(`  Title: ${title2}`)

        console.log(`\n  Requests XHR/Fetch capturados:`)
        for (const r of requestsXHR.slice(0, 20)) {
            console.log(`  [${r.tipo}] ${r.url.slice(0, 150)}`)
        }
        if (requestsXHR.length === 0) {
            console.log('  (ninguno — WAF bloqueó antes de que la página cargara)')
        }

    } catch (err) {
        console.log(`  Error: ${err}`)
    } finally {
        if (browser) await browser.close().catch(() => { })
    }
}

diagnosticar().catch(console.error)
