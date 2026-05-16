/**
 * Diagnóstico profundo de Eroski — estructura de productos en homepage
 *
 * Uso: npx tsx scripts/diagnosticar-eroski.ts
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

    await page.goto('https://supermercado.eroski.es/es/', { waitUntil: 'domcontentloaded', timeout: 30000 })
    await page.waitForTimeout(5000)

    // Scroll progresivo para activar lazy loading
    for (let i = 0; i < 5; i++) {
        await page.evaluate(`window.scrollTo(0, document.body.scrollHeight * ${(i + 1) * 0.2})`)
        await page.waitForTimeout(1500)
    }

    console.log('=== Título:', await page.title())
    console.log('=== URL:', page.url())

    // Análisis detallado de productos en homepage
    const info: any = await page.evaluate(`(() => {
        var r = {};

        // 1. Productos: estructura detallada
        var padres = document.querySelectorAll('[class*="product-item"], [class*="product-title"], [class*="product-price"]');
        r.totalProductRelated = padres.length;

        // 2. Cada producto-name con su contexto
        var names = document.querySelectorAll('.product-name');
        r.productNames = [];
        names.forEach(function(n, i) {
            if (i >= 30) return;
            // Buscar ascendentes con clase
            var climb = [];
            var el = n.parentElement;
            for (var j = 0; j < 5 && el; j++) {
                climb.push(el.tagName + '.' + (el.className || '').slice(0, 80));
                el = el.parentElement;
            }
            r.productNames.push({
                text: (n.textContent || '').trim().slice(0, 80),
                parentClimb: climb.join(' > ')
            });
        });

        // 3. Cada product-price-value con su contexto
        var prices = document.querySelectorAll('.product-price-value');
        r.productPrices = [];
        prices.forEach(function(p, i) {
            if (i >= 30) return;
            var climb = [];
            var el = p.parentElement;
            for (var j = 0; j < 5 && el; j++) {
                climb.push(el.tagName + '.' + (el.className || '').slice(0, 80));
                el = el.parentElement;
            }
            r.productPrices.push({
                text: (p.textContent || '').trim().slice(0, 30),
                climb: climb.join(' > ')
            });
        });

        // 4. Precio por unidad (per-uom)
        var perUom = document.querySelectorAll('.product-price-per-uom');
        r.preciosPorKg = [];
        perUom.forEach(function(p, i) {
            if (i >= 30) return;
            r.preciosPorKg.push({
                text: (p.textContent || '').trim().slice(0, 30),
                parentCls: p.parentElement ? (p.parentElement.className || '').slice(0, 80) : ''
            });
        });

        // 5. Enlaces a producto (.product-title-link)
        var links = document.querySelectorAll('.product-title-link');
        r.productLinks = [];
        links.forEach(function(l, i) {
            if (i >= 20) return;
            r.productLinks.push({
                href: (l.getAttribute('href') || '').slice(0, 120),
                text: (l.textContent || '').trim().slice(0, 60)
            });
        });

        // 6. Buscar contenedores de productos (el padre común de name + price)
        var todosProductos = document.querySelectorAll('.product-name-div');
        r.productCards = [];
        todosProductos.forEach(function(card, i) {
            if (i >= 20) return;
            var name = card.querySelector('.product-name');
            var price = card.querySelector('.product-price-value');
            var perKg = card.querySelector('.product-price-per-uom');
            var link = card.querySelector('a');
            var img = card.querySelector('img');
            r.productCards.push({
                nombre: name ? (name.textContent || '').trim().slice(0, 60) : null,
                precio: price ? (price.textContent || '').trim() : null,
                precioKg: perKg ? (perKg.textContent || '').trim() : null,
                href: link ? (link.getAttribute('href') || '').slice(0, 100) : null,
                imgSrc: img ? (img.getAttribute('src') || '').slice(0, 100) : null,
                parentCls: (card.parentElement ? card.parentElement.className : '').slice(0, 80)
            });
        });

        // 7. HTML de un producto de ejemplo (primer product-item)
        var sample = document.querySelector('[class*="product-item"]');
        r.sampleHTML = sample ? sample.outerHTML.slice(0, 3000) : '(no sample)';

        // 8. Todos los enlaces de navegación principales
        var navLinks = document.querySelectorAll('nav a, header a, .menu a, [class*="nav"] a');
        r.navLinks = [];
        navLinks.forEach(function(a, i) {
            if (i >= 30) return;
            var href = (a.getAttribute('href') || '').slice(0, 100);
            var text = (a.textContent || '').trim().slice(0, 60);
            if (href && text && href !== '#') {
                r.navLinks.push({ href: href, text: text });
            }
        });

        // 9. Buscar cualquier elemento con data-category o data-section
        var dataCats = document.querySelectorAll('[data-category], [data-section], [data-department]');
        r.dataCategories = [];
        dataCats.forEach(function(el, i) {
            if (i >= 10) return;
            r.dataCategories.push({
                tag: el.tagName,
                cls: (el.className || '').slice(0, 60),
                dataCat: el.getAttribute('data-category') || el.getAttribute('data-section') || el.getAttribute('data-department') || ''
            });
        });

        return r;
    })()`)

    console.log('\n=== Total elementos relacionados con producto:', info.totalProductRelated)

    console.log('\n=== ProductNames (primeros 20):')
    for (var n of info.productNames) {
        console.log('  ' + n.text)
        console.log('    ' + n.parentClimb)
    }

    console.log('\n=== Precios:')
    for (var p of info.productPrices) {
        console.log('  ' + p.text + ' | ' + p.climb)
    }

    console.log('\n=== Precios por kg:')
    for (var p of info.preciosPorKg) {
        console.log('  ' + p.text + ' | padre: ' + p.parentCls)
    }

    console.log('\n=== Links a producto:')
    for (var l of info.productLinks) {
        console.log('  ' + l.href + ' — ' + l.text)
    }

    console.log('\n=== ProductCards (estructura completa):')
    for (var c of info.productCards) {
        console.log('  ' + c.nombre + ' | ' + c.precio + ' | ' + c.precioKg + ' | href: ' + c.href)
        console.log('    padre: ' + c.parentCls)
    }

    console.log('\n=== NavLinks:')
    for (var l of info.navLinks) {
        console.log('  ' + l.href + ' — ' + l.text)
    }

    console.log('\n=== Data categories:')
    for (var d of info.dataCategories) {
        console.log('  <' + d.tag + ' class="' + d.cls + '"> data: ' + d.dataCat)
    }

    console.log('\n=== Sample HTML de un product-item:')
    console.log(info.sampleHTML)

    await browser.close()
}

main().catch((err) => { console.error('FATAL:', err); process.exit(1) })
