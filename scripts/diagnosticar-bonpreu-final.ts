/**
 * Diagnóstico FINAL de Bonpreu/Esclat — estructura de product-card-container
 *
 * Uso: npx tsx scripts/diagnosticar-bonpreu-final.ts
 */
import { chromium } from 'playwright'

const URL_BASE = 'https://www.compraonline.bonpreuesclat.cat'

async function main() {
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

    const url = URL_BASE + '/categories/lactic-i-ous'
    try {
        await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 })
    } catch (e: any) { console.log('timeout') }
    await page.waitForTimeout(6000)

    // Scroll
    await page.evaluate(`window.scrollTo(0, document.body.scrollHeight * 0.3)`)
    await page.waitForTimeout(1000)
    await page.evaluate(`window.scrollTo(0, document.body.scrollHeight * 0.6)`)
    await page.waitForTimeout(1000)
    await page.evaluate(`window.scrollTo(0, document.body.scrollHeight)`)
    await page.waitForTimeout(2000)

    // Ver HTML COMPLETO de los primeros 3 product-card-container
    const html = await page.evaluate(`(() => {
        var containers = document.querySelectorAll('.product-card-container');
        var result = [];
        for (var i = 0; i < Math.min(containers.length, 3); i++) {
            result.push(containers[i].outerHTML);
        }
        // También buscar contenedor padre
        var parent = containers.length > 0 ? containers[0].parentElement : null;
        var parentInfo = parent ? {
            tag: parent.tagName,
            cls: (parent.className || '').slice(0, 100),
            children: parent.children.length,
            outerHTML: parent.outerHTML.slice(0, 2000),
        } : null;

        return {
            total: containers.length,
            samples: result,
            parent: parentInfo,
            // Buscar botón "load more" o paginación
            loadMore: (function() {
                var btns = document.querySelectorAll('button, a');
                for (var i = 0; i < btns.length; i++) {
                    var t = (btns[i].textContent || '').toLowerCase();
                    if (t.indexOf('carregar') !== -1 || t.indexOf('més') !== -1 || t.indexOf('mostrar') !== -1 || t.indexOf('load') !== -1) {
                        return { text: (btns[i].textContent || '').trim().slice(0, 60), tag: btns[i].tagName, cls: (btns[i].className || '').slice(0, 60) };
                    }
                }
                return null;
            })(),
        };
    })()`)

    console.log('Total product-card-container: ' + html.total)
    console.log('Load more: ' + JSON.stringify(html.loadMore))
    console.log('\nPadre:')
    if (html.parent) {
        console.log('  <' + html.parent.tag + ' class="' + html.parent.cls + '"> (' + html.parent.children + ' hijos)')
    }

    console.log('\nMuestras HTML (primeros 3):')
    for (var i = 0; i < html.samples.length; i++) {
        console.log('\n--- PRODUCTO ' + (i + 1) + ' ---')
        console.log(html.samples[i])
    }

    await browser.close()
}

main().catch(function (err) { console.error('FATAL:', err); process.exit(1) })
