/**
 * Diagnóstico para Bonpreu/Esclat — descubrir selectores reales del DOM
 *
 * Uso: npx tsx scripts/diagnosticar-bonpreu-esclat.ts
 *
 * Bonpreu y Esclat comparten plataforma: https://www.compraonline.bonpreuesclat.cat/
 * Es una SPA Next.js con AWS WAF.
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
        extraHTTPHeaders: {
            'Accept-Language': 'ca-ES,ca;q=0.9,es;q=0.8',
        },
    })
    const page = await context.newPage()

    // ── 1. Homepage ──
    console.log('\n' + '='.repeat(60))
    console.log('📍 HOMEPAGE: ' + URL_BASE)
    try {
        await page.goto(URL_BASE, { waitUntil: 'domcontentloaded', timeout: 30000 })
    } catch (e: any) {
        console.log('   ⚠️ goto timeout: ' + (e.message || ''))
    }
    await page.waitForTimeout(5000)

    console.log('   Title: ' + (await page.title().catch(() => '(error)')))
    console.log('   URL final: ' + page.url())

    const infoHome = await page.evaluate(`(() => {
        var r = {};

        // Selectores genéricos
        var sels = [
            '.product-card', '[class*="product-card"]', '[class*="ProductCard"]',
            '[class*="product-item"]', '[class*="product"]', '[class*="Product"]',
            'article', '.grid-item', '[data-testid*="product"]',
            '.item', '[class*="item-product"]', '[class*="ItemProduct"]',
            '.producto', '[class*="producto"]', 'li[class*="product"]',
            '[class*="card"]', '[class*="tile"]', '.product-tile',
        ];
        r.selectores = {};
        for (var i = 0; i < sels.length; i++) {
            try { r.selectores[sels[i]] = document.querySelectorAll(sels[i]).length; } catch(e) {}
        }

        // Enlaces a categorías
        var catLinks = document.querySelectorAll('a[href*="/categories/"], a[href*="/categoria"], nav a');
        r.categorias = [];
        for (var i = 0; i < catLinks.length; i++) {
            var a = catLinks[i];
            var href = a.getAttribute('href') || '';
            var text = (a.textContent || '').trim();
            if (text && text.length > 2) {
                r.categorias.push({ href: href.slice(0, 120), text: text.slice(0, 60) });
            }
        }
        // Limitar
        r.categorias = r.categorias.slice(0, 20);

        // Sample del body
        r.bodyHTML = (document.body ? document.body.innerHTML.slice(0, 2000) : '') || '';

        // Precios (€)
        var todos = document.querySelectorAll('span, div, p, strong, ins');
        r.precios = [];
        for (var i = 0; i < todos.length && r.precios.length < 8; i++) {
            var el = todos[i];
            var txt = el.textContent || '';
            if (txt.indexOf('\\u20AC') !== -1 && el.children.length === 0) {
                r.precios.push({
                    texto: txt.trim().slice(0, 40),
                    parentClass: (el.parentElement && el.parentElement.className || '').slice(0, 80),
                    parentTag: el.parentElement ? el.parentElement.tagName : '',
                });
            }
        }

        return r;
    })()`) as any

    console.log('   Selectores con elementos:')
    for (var sel in infoHome.selectores) {
        if (infoHome.selectores[sel] > 0) console.log('     ' + sel + ': ' + infoHome.selectores[sel])
    }
    console.log('   Categorías encontradas:')
    for (var c of (infoHome.categorias as any[])) {
        console.log('     ' + c.href + ' — ' + c.text)
    }
    console.log('   Precios:')
    for (var p of (infoHome.precios as any[])) {
        console.log('     ' + p.texto + ' | <' + p.parentTag + ' class="' + p.parentClass + '">')
    }

    // ── 2. Categoría de prueba ──
    console.log('\n' + '='.repeat(60))
    const CAT_PRUEBA = URL_BASE + '/categories/lactic-i-ous'
    console.log('📍 CATEGORÍA: ' + CAT_PRUEBA)
    try {
        await page.goto(CAT_PRUEBA, { waitUntil: 'domcontentloaded', timeout: 30000 })
    } catch (e: any) {
        console.log('   ⚠️ goto timeout: ' + (e.message || ''))
    }
    await page.waitForTimeout(6000)

    console.log('   Title: ' + (await page.title().catch(() => '(error)')))
    console.log('   URL final: ' + page.url())

    // Scroll
    await page.evaluate(`window.scrollTo(0, document.body.scrollHeight * 0.3)`)
    await page.waitForTimeout(1000)
    await page.evaluate(`window.scrollTo(0, document.body.scrollHeight * 0.6)`)
    await page.waitForTimeout(1000)
    await page.evaluate(`window.scrollTo(0, document.body.scrollHeight)`)
    await page.waitForTimeout(2000)

    const infoCat = await page.evaluate(`(() => {
        var r = {};

        // Selectores
        var sels = [
            '.product-card', '[class*="product-card"]', '[class*="ProductCard"]',
            '[class*="product-item"]', '[class*="product"]', '[class*="Product"]',
            'article', '.grid-item', '[data-testid*="product"]',
            '.item', '[class*="item-product"]', '[class*="ItemProduct"]',
            '.producto', '[class*="producto"]', 'li[class*="product"]',
            '[class*="card"]', '[class*="tile"]', '.product-tile',
            '[class*="listing"]', '[class*="list"]', '.category-item',
        ];
        r.selectores = {};
        for (var i = 0; i < sels.length; i++) {
            try { r.selectores[sels[i]] = document.querySelectorAll(sels[i]).length; } catch(e) {}
        }

        // Grid/container de productos
        var grids = document.querySelectorAll('[class*="grid"], [class*="Grid"], [class*="container"], [class*="Container"], [class*="wrapper"], [class*="Wrapper"], [class*="list"], [class*="List"]');
        r.grids = [];
        for (var i = 0; i < grids.length && r.grids.length < 15; i++) {
            var g = grids[i];
            if (g.children && g.children.length > 2) {
                r.grids.push({
                    cls: (g.className || '').slice(0, 80),
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

        // Sample body
        r.bodyHTML = (document.body ? document.body.innerHTML.slice(0, 2000) : '') || '';

        return r;
    })()`) as any

    console.log('   Selectores con elementos:')
    for (var sel in infoCat.selectores) {
        if (infoCat.selectores[sel] > 0) console.log('     ' + sel + ': ' + infoCat.selectores[sel])
    }
    console.log('   Posibles contenedores de grid (>2 children):')
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

    await browser.close()
}

main().catch(function (err) { console.error('FATAL:', err); process.exit(1) })
