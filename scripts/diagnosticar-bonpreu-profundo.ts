/**
 * Diagnóstico PROFUNDO de Bonpreu/Esclat — estructura DOM real de productos
 *
 * Uso: npx tsx scripts/diagnosticar-bonpreu-profundo.ts
 *
 * La web usa CSS Modules (Next.js) con clases dinámicas.
 * Necesitamos encontrar los selectores reales dentro de la SPA.
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

    // ── Ir a categoría con productos ──
    const CATS = [
        '/categories/lactic-i-ous',
        '/categories/frescos/c95cfbf2-501d-433f-bae3-10fcef330b11',
        '/categories/alimentaci%C3%B3/c49d1ef2-bf51-44a7-b631-4a35474a21ac',
    ]

    for (const catPath of CATS) {
        const url = URL_BASE + catPath
        console.log('\n' + '='.repeat(60))
        console.log('📍 CAT: ' + url)

        try {
            await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 })
        } catch (e: any) {
            console.log('   ⚠️ timeout')
        }
        await page.waitForTimeout(6000)

        console.log('   Title: ' + (await page.title().catch(() => '(error)')))
        console.log('   URL: ' + page.url())

        // Scroll suave
        await page.evaluate(`window.scrollTo(0, document.body.scrollHeight * 0.3)`)
        await page.waitForTimeout(1000)
        await page.evaluate(`window.scrollTo(0, document.body.scrollHeight * 0.6)`)
        await page.waitForTimeout(1000)
        await page.evaluate(`window.scrollTo(0, document.body.scrollHeight)`)
        await page.waitForTimeout(2000)

        // ── Diagnóstico profundo: estructura de listas ──
        const info = await page.evaluate(`(() => {
            var r = {};

            // 1. Todas las listas (<ul>) con hijos para ver su estructura
            var lists = document.querySelectorAll('ul');
            r.listas = [];
            for (var i = 0; i < lists.length; i++) {
                var ul = lists[i];
                if (ul.children && ul.children.length >= 3) {
                    var firstChild = ul.children[0];
                    var firstChildHTML = firstChild ? firstChild.outerHTML.slice(0, 300) : '';
                    r.listas.push({
                        cls: (ul.className || '').slice(0, 80),
                        hijos: ul.children.length,
                        tag_primer_hijo: firstChild ? firstChild.tagName : '',
                        clases_primer_hijo: firstChild ? (firstChild.className || '').slice(0, 100) : '',
                        html_primer_hijo: firstChildHTML,
                    });
                }
            }

            // 2. Buscar elementos con data-testid o data-* attributes de producto
            var dataEls = document.querySelectorAll('[data-testid], [data-product], [data-product-id], [data-sku]');
            r.dataElements = [];
            for (var i = 0; i < Math.min(dataEls.length, 10); i++) {
                var el = dataEls[i];
                var attrs = {};
                for (var j = 0; j < el.attributes.length; j++) {
                    var attr = el.attributes[j];
                    if (attr.name.indexOf('data-') === 0) {
                        attrs[attr.name] = attr.value.slice(0, 60);
                    }
                }
                r.dataElements.push({
                    tag: el.tagName,
                    cls: (el.className || '').slice(0, 80),
                    data: attrs,
                    html: el.outerHTML.slice(0, 200),
                });
            }

            // 3. Buscar elementos que contengan "€" cerca de otros elementos de producto
            var priceContainers = document.querySelectorAll('div, span, p');
            r.productCandidates = [];
            for (var i = 0; i < priceContainers.length && r.productCandidates.length < 5; i++) {
                var el = priceContainers[i];
                var txt = el.textContent || '';
                // Si tiene € y tiene hijos con imágenes
                if (txt.indexOf('\\u20AC') !== -1 && el.querySelector('img')) {
                    r.productCandidates.push({
                        tag: el.tagName,
                        cls: (el.className || '').slice(0, 100),
                        outerHTML: el.outerHTML.slice(0, 400),
                    });
                }
            }

            // 4. Sample de body para ver estructura general
            r.bodySample = (document.body ? document.body.innerHTML.slice(0, 4000) : '') || '';

            // 5. Buscar contenedores con className que contenga "product" o "item"
            var all = document.querySelectorAll('*');
            r.classesConProducto = {};
            for (var i = 0; i < all.length; i++) {
                var cls = all[i].className || '';
                if (typeof cls === 'string' && (cls.indexOf('product') !== -1 || cls.indexOf('Product') !== -1 || cls.indexOf('item') !== -1 || cls.indexOf('Item') !== -1 || cls.indexOf('card') !== -1 || cls.indexOf('Card') !== -1)) {
                    var key = cls.slice(0, 80);
                    if (!r.classesConProducto[key]) {
                        r.classesConProducto[key] = { tag: all[i].tagName, count: 0 };
                    }
                    r.classesConProducto[key].count++;
                }
            }

            return r;
        })()`) as any

        console.log('   Listas (>2 hijos):')
        for (var l of (info.listas as any[])) {
            console.log('     <UL class="' + l.cls + '"> (' + l.hijos + ' hijos)')
            console.log('       1er hijo: <' + l.tag_primer_hijo + ' class="' + l.clases_primer_hijo + '">')
            console.log('       HTML: ' + l.html_primer_hijo.replace(/\\n/g, ' ').slice(0, 250))
        }

        console.log('   Elementos con data-* attributes:')
        for (var d of (info.dataElements as any[])) {
            console.log('     <' + d.tag + ' class="' + d.cls + '"> data=' + JSON.stringify(d.data))
            console.log('       HTML: ' + d.html.replace(/\\n/g, ' ').slice(0, 200))
        }

        console.log('   Candidatos a producto (€ + img):')
        for (var c of (info.productCandidates as any[])) {
            console.log('     <' + c.tag + ' class="' + c.cls + '">')
            console.log('       HTML: ' + c.outerHTML.replace(/\\n/g, ' ').slice(0, 500))
        }

        console.log('   Clases con "product"/"item"/"card":')
        for (var key in info.classesConProducto) {
            var v = info.classesConProducto[key];
            console.log('     <' + v.tag + '> "' + key + '" x' + v.count);
        }
    }

    await browser.close()
}

main().catch(function (err) { console.error('FATAL:', err); process.exit(1) })
