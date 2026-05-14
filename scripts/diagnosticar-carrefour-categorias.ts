/**
 * Diagnóstico específico de categorías de Carrefour
 *
 * Uso: npx tsx scripts/diagnosticar-carrefour-categorias.ts
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

    const categorias = [
        { nombre: 'Frescos', url: 'https://www.carrefour.es/supermercado/frescos/cat20002/c' },
        { nombre: 'Despensa', url: 'https://www.carrefour.es/supermercado/la-despensa/cat20001/c' },
        { nombre: 'Bebidas', url: 'https://www.carrefour.es/supermercado/bebidas/cat20003/c' },
        { nombre: 'Congelados', url: 'https://www.carrefour.es/supermercado/congelados/cat21449123/c' },
    ]

    for (const cat of categorias) {
        console.log('\n' + '='.repeat(60))
        console.log('📍 ' + cat.nombre + ' — ' + cat.url)

        try {
            await page.goto(cat.url, { waitUntil: 'domcontentloaded', timeout: 20000 })
        } catch (e: any) {
            console.log('   ⚠️ goto timeout (continuing): ' + (e.message || ''))
        }
        await page.waitForTimeout(4000)

        console.log('   Title: ' + (await page.title().catch(() => '(error)')))
        console.log('   URL final: ' + page.url())

        // Scroll ligero
        await page.evaluate('window.scrollTo(0, document.body.scrollHeight * 0.3)')
        await page.waitForTimeout(1000)
        await page.evaluate('window.scrollTo(0, document.body.scrollHeight * 0.6)')
        await page.waitForTimeout(1000)
        await page.evaluate('window.scrollTo(0, document.body.scrollHeight)')
        await page.waitForTimeout(1500)

        // Diagnóstico ligero usando selectores específicos (sin querySelectorAll('*'))
        const info = await page.evaluate(`(() => {
            var r = {};

            // Selectores específicos
            var sels = ['.product-card__parent', '.product-card', '[class*="product-card"]', '[class*="product"]', 'article', '.grid-item'];
            r.selectores = {};
            for (var i = 0; i < sels.length; i++) {
                try { r.selectores[sels[i]] = document.querySelectorAll(sels[i]).length; } catch(e) {}
            }

            // Sample HTML del body
            r.bodyHTML = (document.body ? document.body.innerHTML.slice(0, 3000) : '') || '';

            // Botones "Ver más" o load more
            var verMas = document.querySelectorAll('button, a');
            r.botonesCargar = [];
            for (var i = 0; i < verMas.length; i++) {
                var t = (verMas[i].textContent || '').trim().toLowerCase();
                if (t.indexOf('ver más') !== -1 || t.indexOf('ver mas') !== -1 || t.indexOf('cargar') !== -1 || t.indexOf('mostrar') !== -1) {
                    r.botonesCargar.push(t.slice(0, 50));
                }
            }

            // H2 y H3 (títulos de producto)
            var headers = document.querySelectorAll('h2, h3');
            r.headers = [];
            for (var i = 0; i < Math.min(headers.length, 10); i++) {
                var h = headers[i];
                r.headers.push({ tag: h.tagName, text: (h.textContent || '').trim().slice(0, 80), cls: (h.className || '').slice(0, 60) });
            }

            // Links sospechosos de producto
            var links = document.querySelectorAll('a[href*="/product/"], a[href*="/p/"], a[data-product-id]');
            r.linksProducto = [];
            for (var i = 0; i < Math.min(links.length, 8); i++) {
                var a = links[i];
                r.linksProducto.push({ href: (a.getAttribute('href') || '').slice(0, 80), text: (a.textContent || '').trim().slice(0, 60) });
            }

            // Elementos con precio (limitado a primeros 5 que aparezcan)
            var todos = document.querySelectorAll('span, div, p, strong, ins');
            r.precios = [];
            for (var i = 0; i < todos.length && r.precios.length < 8; i++) {
                var el = todos[i];
                var txt = el.textContent || '';
                if (txt.indexOf('\u20AC') !== -1 && el.children.length === 0) {
                    var parent = el.parentElement;
                    r.precios.push({
                        texto: txt.trim().slice(0, 40),
                        parentClass: parent ? (parent.className || '').slice(0, 80) : '',
                        parentTag: parent ? parent.tagName : '',
                    });
                }
            }

            return r;
        })()`)

        console.log('   Selectores con elementos:')
        for (var sel in info.selectores) {
            if (info.selectores[sel] > 0) console.log('     ' + sel + ': ' + info.selectores[sel])
        }
        console.log('   Sample body HTML (primeros 200 chars):')
        var bh = info.bodyHTML as string
        console.log('     ' + bh.slice(0, 200).replace(/\n/g, ' '))
        console.log('   Botones "cargar más": ' + JSON.stringify(info.botonesCargar))
        console.log('   Headers (h2/h3):')
        for (var h of (info.headers as any[])) {
            console.log('     <' + h.tag + ' class="' + h.cls + '"> ' + h.text)
        }
        console.log('   Links a productos:')
        for (var l of (info.linksProducto as any[])) {
            console.log('     ' + l.href + ' — ' + l.text)
        }
        console.log('   Precios encontrados:')
        for (var p of (info.precios as any[])) {
            console.log('     ' + p.texto + ' | padre: <' + p.parentTag + ' class="' + p.parentClass + '">')
        }

        // También guardar el HTML completo para inspección offline
        var htmlContent = await page.content().catch(function () { return '' })
        console.log('   HTML total size: ' + htmlContent.length + ' bytes')
    }

    await browser.close()
}

main().catch(function (err) { console.error('FATAL:', err); process.exit(1) })
