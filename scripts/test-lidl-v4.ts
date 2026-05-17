/**
 * test-lidl-v4.ts — Prueba del flujo v4 con 3 términos
 * Uso: env $(cat .env.local | grep -v '^#' | xargs) npx tsx scripts/test-lidl-v4.ts
 */
import { chromium } from 'playwright'

const URL_BASE = 'https://www.lidl.es'
const GRIDBOXES_API = `${URL_BASE}/p/api/gridboxes/ES/es`

function extraerErpNumber(url: string): string | null {
    const match = url.match(/\/p(\d{6,12})(?:[?#/]|$)/)
    return match ? match[1] : null
}

function esCategoriaAlimentacion(cat: string | undefined): boolean {
    if (!cat) return false
    const c = cat.toLowerCase().trim()
    if (c === 'food') return true
    return ['alimentaci', 'frutas', 'verduras', 'carnes', 'lacteos', 'bebidas', 'congelados'].some(k => c.includes(k))
}

async function main() {
    const terminos = ['leche', 'pollo', 'pan']
    const erpMap = new Map<string, { nombre: string; url: string }>()

    console.log('[Fase 1] Playwright — 3 términos de prueba...')
    const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] })
    const context = await browser.newContext({
        userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        locale: 'es-ES',
    })
    const page = await context.newPage()

    await page.goto(URL_BASE + '/', { waitUntil: 'domcontentloaded', timeout: 20000 }).catch(() => {})
    await page.waitForTimeout(2000)
    const cookies = await context.cookies()
    const cookieHeader = cookies.map(c => `${c.name}=${c.value}`).join('; ')

    for (const termino of terminos) {
        await page.goto(`${URL_BASE}/q/search?q=${encodeURIComponent(termino)}`, {
            waitUntil: 'domcontentloaded', timeout: 20000
        }).catch(() => {})
        await page.waitForTimeout(1500)
        await page.evaluate('window.scrollTo(0, document.body.scrollHeight)')
        await page.waitForTimeout(800)

        // String IIFE — evita bug __name
        const items = await page.evaluate<Array<{ nombre: string; url: string }>>(`
            (function() {
                var results = [];
                var selectors = ['.product-grid-box', '.odsc-tile', '.ods-tile', '[class*="product-grid"] > li', '[class*="product-grid"] > div'];
                var tiles = [];
                for (var s = 0; s < selectors.length; s++) {
                    var found = document.querySelectorAll(selectors[s]);
                    if (found.length > 0) { tiles = Array.prototype.slice.call(found); break; }
                }
                tiles.forEach(function(tile) {
                    var linkEl = tile.querySelector('a[href*="/p/"]');
                    if (!linkEl) return;
                    var href = linkEl.href || '';
                    var titleEl = tile.querySelector('.product-grid-box__title, [class*="product-title"], [class*="title"], h3, h2');
                    var nombre = titleEl ? titleEl.textContent.trim() : (linkEl.title || '');
                    if (!nombre || !href) return;
                    results.push({ nombre: nombre, url: href });
                });
                return results;
            })()
        `)

        let nuevos = 0
        for (const item of items) {
            const erp = extraerErpNumber(item.url)
            if (erp && !erpMap.has(erp)) { erpMap.set(erp, item); nuevos++ }
        }
        console.log(`  "${termino}": ${items.length} tiles, ${nuevos} nuevos erpNumbers`)
    }

    await browser.close()
    const allErps = Array.from(erpMap.keys())
    console.log(`\nFase 1 OK: ${allErps.length} erpNumbers únicos`)
    console.log('Ejemplos:', allErps.slice(0, 5).join(', '))

    // Fase 2: Gridboxes API
    console.log('\n[Fase 2] Gridboxes API...')
    const resp = await fetch(`${GRIDBOXES_API}?erpNumbers=${allErps.slice(0, 25).join(',')}`, {
        headers: {
            'Accept': 'application/json',
            'Accept-Encoding': 'gzip, deflate, br',
            'Cookie': cookieHeader,
            'Referer': URL_BASE + '/',
            'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
        },
    })
    console.log(`HTTP ${resp.status}`)
    const data = await resp.json() as Array<{ erpNumber?: string; fullTitle?: string; category?: string; price?: { price?: number; packaging?: { text?: string } }; brand?: { name?: string } }>
    console.log(`Gridboxes: ${data.length} productos`)

    let alim = 0, descartados = 0
    for (const gp of data) {
        if (esCategoriaAlimentacion(gp.category)) {
            alim++
            const precio = gp.price?.price ?? 0
            const cantidad = gp.price?.packaging?.text || ''
            const marca = gp.brand?.name || 'Lidl'
            if (alim <= 8) {
                console.log(`  ✅ [${gp.category}] ${gp.fullTitle} | ${precio}€ | ${cantidad} | ${marca}`)
            }
        } else {
            descartados++
            if (descartados <= 3) {
                console.log(`  ❌ [${gp.category}] ${gp.fullTitle}`)
            }
        }
    }
    console.log(`\n✅ Resultado: ${alim} alimentos, ${descartados} descartados`)
}

main().catch(console.error)
