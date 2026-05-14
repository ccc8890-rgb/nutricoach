/**
 * Diagnóstico Lidl 2: buscar productos y API
 * Uso: npx tsx scripts/diagnosticar-lidl2.ts
 */
import { chromium } from 'playwright'

async function main() {
    const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] })
    const context = await browser.newContext({
        userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        viewport: { width: 1920, height: 1080 },
        locale: 'es-ES',
    })
    const page = await context.newPage()

    // Lista de URLs a probar
    const urls = [
        'https://www.lidl.es/c/alimentacion/s10068374',
        'https://www.lidl.es/c/alimentacion',
        'https://www.lidl.es/c/frutas-y-verduras/s10068375',
        'https://www.lidl.es/c/frutas-y-verduras',
        'https://www.lidl.es/c/carnes-y-aves/s10068376',
        'https://www.lidl.es/c/lacteos-y-huevos/s10068378',
    ]

    for (const url of urls) {
        console.log('\n--- ' + url)
        try {
            await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 15000 })
        } catch { }
        await page.waitForTimeout(3000)

        console.log('   Title: ' + await page.title().catch(() => '?'))
        console.log('   URL final: ' + page.url())

        // Buscar cualquier elemento con precio
        const hayPrecios = await page.evaluate(`(function() {
            var all = document.querySelectorAll('span, div, p, strong');
            var found = [];
            for (var i = 0; i < all.length && found.length < 5; i++) {
                var t = all[i].textContent || '';
                if (t.indexOf('\u20AC') !== -1 && all[i].children.length === 0) {
                    var p = all[i].parentElement;
                    found.push({ text: t.trim().slice(0, 50), parentCls: p ? (p.className || '').slice(0, 80) : '' });
                }
            }
            return found;
        })()`)
        console.log('   Precios: ' + JSON.stringify(hayPrecios))

        // Buscar contenedores de producto
        const conts = await page.evaluate(`(function() {
            var sels = ['.ods-product', '[class*="ods-product"]', '.product',
                        '[class*="product-card"]', '[class*="plp"]', '[class*="listing"]',
                        '[class*="category-grid"]', '[class*="product-grid"]', '.grid'];
            var r = {};
            for (var i = 0; i < sels.length; i++) {
                try { r[sels[i]] = document.querySelectorAll(sels[i]).length; } catch(e) {}
            }
            return r;
        })()`)
        var found = false
        for (var s in conts) {
            if (conts[s] > 0) { console.log('   ' + s + ': ' + conts[s]); found = true; }
        }
        if (!found) console.log('   (no containers found)')
    }

    await browser.close()
}

main().catch(console.error)
