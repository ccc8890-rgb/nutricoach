/**
 * Diagnóstico para Hipercor / El Corte Inglés — descubrir selectores del DOM
 *
 * Uso: npx tsx scripts/diagnosticar-hipercor-eci.ts
 *
 * Ambos pertenecen al grupo El Corte Inglés y usan Akamai como protección.
 * Web: https://www.hipercor.es/supermercado/
 * Web: https://www.elcorteingles.es/supermercado/
 */
import { chromium } from 'playwright'

const SUPERMERCADOS = [
    { nombre: 'Hipercor', url: 'https://www.hipercor.es/supermercado/', catUrl: 'https://www.hipercor.es/supermercado/carniceria/' },
    { nombre: 'El Corte Inglés', url: 'https://www.elcorteingles.es/supermercado/', catUrl: 'https://www.elcorteingles.es/supermercado/carniceria/' },
]

async function diagnosticar(nombre: string, baseUrl: string, catUrl: string, page: any) {
    console.log('\n' + '='.repeat(60))
    console.log('📍 ' + nombre)

    // ── Homepage ──
    console.log('   --- HOMEPAGE ---')
    try {
        await page.goto(baseUrl, { waitUntil: 'domcontentloaded', timeout: 45000 })
    } catch (e: any) {
        console.log('   ⚠️ goto timeout: ' + (e.message || ''))
    }
    await page.waitForTimeout(5000)

    const urlActual = page.url()
    console.log('   URL final: ' + urlActual)
    console.log('   Title: ' + (await page.title().catch(() => '(error)')))

    // Si detecta bloqueo Akamai / challenge
    const bodyText = await page.evaluate(`(document.body ? document.body.innerText.slice(0, 500) : '') || ''`)
    if (bodyText.indexOf('captcha') !== -1 || bodyText.indexOf('Challenge') !== -1 || bodyText.indexOf('Verifying') !== -1) {
        console.log('   ⚠️ POSIBLE BLOQUEO AKAMAI detectado en homepage')
        console.log('   Body: ' + bodyText.slice(0, 200))
    }

    const infoHome = await page.evaluate(`(() => {
        var r = {};

        var sels = [
            '.product-card', '[class*="product-card"]', '[class*="ProductCard"]',
            '[class*="product-item"]', '[class*="product"]', '[class*="Product"]',
            'article', '.grid-item', '[data-testid*="product"]',
            '[class*="productContainer"]', '[class*="product_container"]',
            'li[class*="product"]', '.item', '[class*="item-product"]',
            '.producto', '[class*="producto"]', '[class*="card"]',
            '[class*="tile"]', '[class*="ProductTile"]',
            'article[data-product]',
        ];
        r.selectores = {};
        for (var i = 0; i < sels.length; i++) {
            try { r.selectores[sels[i]] = document.querySelectorAll(sels[i]).length; } catch(e) {}
        }

        // Enlaces a categorías
        var catLinks = document.querySelectorAll('a[href*="/supermercado/"]');
        r.categorias = [];
        for (var i = 0; i < catLinks.length; i++) {
            var a = catLinks[i];
            var href = a.getAttribute('href') || '';
            var text = (a.textContent || '').trim();
            if (text && text.length > 2 && href.indexOf('login') === -1 && href.indexOf('carrito') === -1) {
                r.categorias.push({ href: href.slice(0, 120), text: text.slice(0, 60) });
            }
        }
        r.categorias = r.categorias.slice(0, 20);

        r.bodyHTML = (document.body ? document.body.innerHTML.slice(0, 2000) : '') || '';

        return r;
    })()`) as any

    console.log('   Selectores con elementos:')
    for (var sel in infoHome.selectores) {
        if (infoHome.selectores[sel] > 0) console.log('     ' + sel + ': ' + infoHome.selectores[sel])
    }
    console.log('   Categorías:')
    for (var c of (infoHome.categorias as any[])) {
        console.log('     ' + c.href + ' — ' + c.text)
    }

    // ── Categoría de prueba ──
    console.log('\n   --- CATEGORÍA ---')
    console.log('   URL: ' + catUrl)
    try {
        await page.goto(catUrl, { waitUntil: 'domcontentloaded', timeout: 45000 })
    } catch (e: any) {
        console.log('   ⚠️ goto timeout: ' + (e.message || ''))
    }
    await page.waitForTimeout(6000)

    console.log('   URL final: ' + page.url())
    console.log('   Title: ' + (await page.title().catch(() => '(error)')))

    // Scroll
    await page.evaluate(`window.scrollTo(0, document.body.scrollHeight * 0.3)`)
    await page.waitForTimeout(1500)
    await page.evaluate(`window.scrollTo(0, document.body.scrollHeight * 0.6)`)
    await page.waitForTimeout(1500)
    await page.evaluate(`window.scrollTo(0, document.body.scrollHeight)`)
    await page.waitForTimeout(2000)

    const infoCat = await page.evaluate(`(() => {
        var r = {};

        var sels = [
            '.product-card', '[class*="product-card"]', '[class*="ProductCard"]',
            '[class*="product-item"]', '[class*="product"]', '[class*="Product"]',
            'article', '.grid-item', '[data-testid*="product"]',
            '[class*="productContainer"]', '[class*="product_container"]',
            'li[class*="product"]', '.item', '[class*="item-product"]',
            '.producto', '[class*="producto"]', '[class*="card"]',
            '[class*="tile"]', '[class*="ProductTile"]',
            'article[data-product]',
            '[class*="listing"]', '[class*="list"]', '.category-item',
            '[class*="grid"]', '[class*="Grid"]',
        ];
        r.selectores = {};
        for (var i = 0; i < sels.length; i++) {
            try { r.selectores[sels[i]] = document.querySelectorAll(sels[i]).length; } catch(e) {}
        }

        // Posibles contenedores de grid
        var grids = document.querySelectorAll('[class*="grid"]:not([class*="icon"]):not([class*="svg"]), [class*="Grid"], [class*="container"]:not([class*="icon"]), [class*="Container"], [class*="wrapper"], [class*="Wrapper"], [class*="list-view"], [class*="ListView"]');
        r.grids = [];
        for (var i = 0; i < grids.length && r.grids.length < 15; i++) {
            var g = grids[i];
            if (g.children && g.children.length > 2) {
                r.grids.push({
                    cls: (g.className || '').slice(0, 100),
                    tag: g.tagName,
                    children: g.children.length,
                });
            }
        }

        // Headers
        var headers = document.querySelectorAll('h2, h3');
        r.headers = [];
        for (var i = 0; i < Math.min(headers.length, 10); i++) {
            var h = headers[i];
            r.headers.push({ tag: h.tagName, text: (h.textContent || '').trim().slice(0, 80), cls: (h.className || '').slice(0, 60) });
        }

        // Links a productos
        var links = document.querySelectorAll('a[href*="/product/"], a[href*="/p/"], a[data-product-id], a[data-product]');
        r.linksProducto = [];
        for (var i = 0; i < Math.min(links.length, 8); i++) {
            var a = links[i];
            r.linksProducto.push({ href: (a.getAttribute('href') || '').slice(0, 100), text: (a.textContent || '').trim().slice(0, 60) });
        }

        // Precios
        var todos = document.querySelectorAll('span, div, p, strong, ins');
        r.precios = [];
        for (var i = 0; i < todos.length && r.precios.length < 10; i++) {
            var el = todos[i];
            var txt = el.textContent || '';
            if (txt.indexOf('\\u20AC') !== -1 && el.children.length === 0) {
                r.precios.push({
                    texto: txt.trim().slice(0, 40),
                    parentClass: (el.parentElement && el.parentElement.className || '').slice(0, 100),
                    parentTag: el.parentElement ? el.parentElement.tagName : '',
                });
            }
        }

        r.bodyHTML = (document.body ? document.body.innerHTML.slice(0, 2000) : '') || '';

        return r;
    })()`) as any

    console.log('   Selectores con elementos:')
    for (var sel in infoCat.selectores) {
        if (infoCat.selectores[sel] > 0) console.log('     ' + sel + ': ' + infoCat.selectores[sel])
    }
    console.log('   Posibles contenedores grid (>2 children):')
    for (var g of (infoCat.grids as any[])) {
        console.log('     <' + g.tag + ' class="' + g.cls + '"> (' + g.children + ' hijos)')
    }
    console.log('   Headers (h2/h3):')
    for (var h of (infoCat.headers as any[])) {
        console.log('     <' + h.tag + ' class="' + h.cls + '"> ' + h.text)
    }
    console.log('   Links a productos:')
    for (var l of (infoCat.linksProducto as any[])) {
        console.log('     ' + l.href + ' — ' + l.text)
    }
    console.log('   Precios:')
    for (var p of (infoCat.precios as any[])) {
        console.log('     ' + p.texto + ' | <' + p.parentTag + ' class="' + p.parentClass + '">')
    }
}

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

    for (const s of SUPERMERCADOS) {
        const page = await context.newPage()
        await diagnosticar(s.nombre, s.url, s.catUrl, page)
        await page.close()
    }

    await browser.close()
}

main().catch(function (err) { console.error('FATAL:', err); process.exit(1) })
