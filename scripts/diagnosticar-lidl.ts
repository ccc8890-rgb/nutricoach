/**
 * Diagnóstico rápido de DOM de Lidl
 * Uso: npx tsx scripts/diagnosticar-lidl.ts
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

    const urls = [
        'https://www.lidl.es/',
        'https://www.lidl.es/c/alimentacion/s10068374',
    ]

    for (const url of urls) {
        console.log('\n' + '='.repeat(60))
        console.log('📍 ' + url)

        try {
            await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 20000 })
        } catch { }
        await page.waitForTimeout(4000)

        console.log('   Title: ' + (await page.title().catch(() => '?')))
        console.log('   URL: ' + page.url())

        // Scroll
        await page.evaluate('window.scrollTo(0, document.body.scrollHeight * 0.3)')
        await page.waitForTimeout(800)
        await page.evaluate('window.scrollTo(0, document.body.scrollHeight * 0.6)')
        await page.waitForTimeout(800)
        await page.evaluate('window.scrollTo(0, document.body.scrollHeight)')
        await page.waitForTimeout(1000)

        const info = await page.evaluate(`(() => {
            var r = {};

            // 1. Todos los selectores que puedan ser productos
            var sels = [
                '.product-card', '[class*="product-card"]', '[class*="product"]',
                'article', '.grid-item', '[class*="grid"]',
                '[class*="item"]', '[class*="tile"]', '[class*="plp"]',
                '[data-testid*="product"]', '[data-product]',
                'li[class*="product"]', '.card', '[class*="card"]',
            ];
            r.selectores = {};
            for (var i = 0; i < sels.length; i++) {
                try { r.selectores[sels[i]] = document.querySelectorAll(sels[i]).length; } catch(e) {}
            }

            // 2. Buscar elementos con € en el texto y con hijos
            var allEls = document.querySelectorAll('span, div, p, strong, ins, meta, a');
            r.precios = [];
            for (var i = 0; i < allEls.length && r.precios.length < 8; i++) {
                var el = allEls[i];
                var txt = el.textContent || '';
                if (txt.indexOf('\u20AC') !== -1 && el.children.length === 0) {
                    var parent = el.parentElement;
                    r.precios.push({
                        texto: txt.trim().slice(0, 40),
                        parentClass: parent ? (parent.className || '').slice(0, 100) : '',
                        parentTag: parent ? parent.tagName : '',
                    });
                }
            }

            // 3. H2 y H3 como posibles títulos de producto
            var hs = document.querySelectorAll('h2, h3, h4');
            r.headers = [];
            for (var i = 0; i < Math.min(hs.length, 15); i++) {
                var h = hs[i];
                r.headers.push({ tag: h.tagName, text: (h.textContent || '').trim().slice(0, 70), cls: (h.className || '').slice(0, 60) });
            }

            // 4. Links con /p/ o /product/ (posibles URLs de producto)
            var links = document.querySelectorAll('a[href*="/p/"], a[href*="/product/"], a[href*="/c/"]');
            r.linksCat = [];
            for (var i = 0; i < Math.min(links.length, 10); i++) {
                var a = links[i];
                r.linksCat.push({ href: (a.getAttribute('href') || '').slice(0, 100), text: (a.textContent || '').trim().slice(0, 60) });
            }

            return r;
        })()`)

        console.log('   Selectores con elementos:')
        for (var sel in info.selectores) {
            if (info.selectores[sel] > 0) console.log('     ' + sel + ': ' + info.selectores[sel])
        }
        console.log('   Precios:')
        for (var p of (info.precios as any[])) {
            console.log('     ' + p.texto + ' | <' + p.parentTag + ' class="' + p.parentClass + '">')
        }
        console.log('   Headers:')
        for (var h of (info.headers as any[])) {
            console.log('     <' + h.tag + ' class="' + h.cls + '"> ' + h.text)
        }
        console.log('   Links cat/producto:')
        for (var l of (info.linksCat as any[])) {
            console.log('     ' + l.href + ' — ' + l.text)
        }
    }

    await browser.close()
}

main().catch(function (e) { console.error(e); process.exit(1) })
