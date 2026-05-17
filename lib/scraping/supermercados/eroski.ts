/**
 * eroski.ts — Scraper para Eroski España
 *
 * Eroski usa Apache Tapestry (framework Java). Las URLs de categoría
 * redirigen a 404, así que solo podemos extraer productos del homepage.
 * El homepage muestra productos en carruseles (slick-slider) con estructura:
 *
 * div.product-container.product-item
 *   div.product-image → a → img
 *   div.product-info.product-description
 *     div.product-name-div → a → p.product-name
 *     div.product-price.offer-description → p.product-price-value → span.product-price-currency
 *     p.product-price-per-uom (precio por kg/litro)
 *
 * Web: https://supermercado.eroski.es/es/
 *
 * NOTA: page.evaluate usa string IIFE en vez de arrow functions
 * para evitar el error "__name is not defined" que causa tsx al
 * serializar funciones compiladas al contexto del navegador.
 */
import type { ScrapingConfig } from '../types'
import type { ProductoRaw } from '../types'
import { chromium } from 'playwright'

export const configEroski: ScrapingConfig = {
    supermercado: {
        id: '',
        nombre: 'Eroski',
        slug: 'eroski',
    },
    metodo: 'playwright',
    url_base: 'https://supermercado.eroski.es',
    rate_limit_ms: 800,
    timeout_ms: 30000,
}

/* ─── Lógica principal con Playwright ─── */

export async function scrapearEroski(): Promise<{
    productos: ProductoRaw[]
    errores: string[]
    duracion_ms: number
}> {
    const inicio = Date.now()
    const errores: string[] = []
    const productos: ProductoRaw[] = []
    let browser

    try {
        console.log('[Eroski] Lanzando navegador Playwright...')
        browser = await chromium.launch({
            headless: true,
            args: ['--no-sandbox', '--disable-setuid-sandbox'],
        })

        const context = await browser.newContext({
            userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
            viewport: { width: 1920, height: 1080 },
            locale: 'es-ES',
        })

        const page = await context.newPage()

        // ── 1. Navegar al homepage ──
        // NOTA: Las URLs de categoría (/es/c/...) redirigen a 404.
        // Solo el homepage tiene productos visibles.
        console.log('[Eroski] Navegando al homepage...')
        try {
            await page.goto('https://supermercado.eroski.es/es/', {
                waitUntil: 'domcontentloaded',
                timeout: configEroski.timeout_ms,
            })
        } catch (err) {
            console.warn('[Eroski] Timeout en carga inicial, continuando...')
        }

        await page.waitForTimeout(5000)

        // Scroll progresivo para activar lazy loading de imágenes
        console.log('[Eroski] Scroll progresivo...')
        await page.evaluate(`window.scrollTo(0, document.body.scrollHeight * 0.2)`)
        await page.waitForTimeout(800)
        await page.evaluate(`window.scrollTo(0, document.body.scrollHeight * 0.4)`)
        await page.waitForTimeout(800)
        await page.evaluate(`window.scrollTo(0, document.body.scrollHeight * 0.6)`)
        await page.waitForTimeout(800)
        await page.evaluate(`window.scrollTo(0, document.body.scrollHeight * 0.8)`)
        await page.waitForTimeout(800)
        await page.evaluate(`window.scrollTo(0, document.body.scrollHeight)`)
        await page.waitForTimeout(2000)

        // ── 2. Extraer productos del DOM ──
        console.log('[Eroski] Extrayendo productos del homepage...')

        const prods = await page.evaluate<ProductoRaw[]>(`
            (() => {
                var items = [];
                var seen = new Set();

                // Selector de contenedor de producto (diagnóstico confirmado)
                var containers = document.querySelectorAll('.product-container.product-item');

                containers.forEach(function(container) {
                    // Nombre
                    var nameEl = container.querySelector('.product-name');
                    var nombre = (nameEl && nameEl.textContent && nameEl.textContent.trim()) || '';
                    if (!nombre) return;

                    // Evitar duplicados (slick-slider duplica items)
                    if (seen.has(nombre)) return;
                    seen.add(nombre);

                    // Precio - extraer del .product-price-value
                    var priceEl = container.querySelector('.product-price-value');
                    var precio = 0;
                    if (priceEl && priceEl.textContent) {
                        // Formato español: "33.00" o "1,50"
                        var text = priceEl.textContent.trim();
                        // Si tiene punto como separador de miles, quitarlo
                        // Si tiene coma, reemplazar por punto
                        if (text.indexOf('.') !== -1 && text.indexOf(',') !== -1) {
                            // Tiene ambos: "1.234,56" → quitar puntos, reemplazar coma
                            text = text.replace(/\./g, '').replace(',', '.');
                        } else if (text.indexOf(',') !== -1) {
                            text = text.replace(',', '.');
                        }
                        var parsed = parseFloat(text);
                        if (!isNaN(parsed)) precio = parsed;
                    }

                    // Precio por kg/unidad - extraer del .product-price-per-uom
                    var perKgEl = container.querySelector('.product-price-per-uom');
                    var precioKg;
                    if (perKgEl && perKgEl.textContent) {
                        // Formato: "1 KILO A 8,571 €" o "1 LITRO A 0,593 €"
                        var match = perKgEl.textContent.match(/(\\d+[.,]\\d+)/);
                        if (match) {
                            var text = match[1].replace(',', '.');
                            var parsed = parseFloat(text);
                            if (!isNaN(parsed)) precioKg = parsed;
                        }
                    }

                    // URL - buscar el enlace dentro del contenedor
                    // Los enlaces pasan por Criteo tracking, extraer dest= real
                    var link = container.querySelector('a[href*="productDetail"]') ||
                               container.querySelector('a[href*="criteo"]');
                    var href = '';
                    if (link) {
                        var rawHref = link.getAttribute('href') || '';
                        // Extraer URL real del parámetro dest= (Criteo redirect)
                        var destMatch = rawHref.match(/dest=([^&]+)/);
                        if (destMatch) {
                            href = decodeURIComponent(destMatch[1]);
                        } else if (rawHref.startsWith('http')) {
                            href = rawHref;
                        } else if (rawHref.startsWith('//')) {
                            href = 'https:' + rawHref;
                        } else if (rawHref.startsWith('/')) {
                            href = 'https://supermercado.eroski.es' + rawHref;
                        }
                    }

                    // Imagen
                    var img = container.querySelector('img');
                    var imagen = '';
                    if (img) {
                        var src = img.getAttribute('src') || img.getAttribute('data-src') || '';
                        if (src && !src.startsWith('data:')) {
                            if (src.startsWith('//')) imagen = 'https:' + src;
                            else if (src.startsWith('/')) imagen = 'https://supermercado.eroski.es' + src;
                            else imagen = src;
                        }
                    }

                    if (nombre && precio > 0) {
                        items.push({
                            nombre: nombre,
                            precio_actual: precio,
                            precio_por_kg: precioKg,
                            unidad: 'kg',
                            url_producto: href || '',
                            imagen_url: imagen || undefined,
                            marca: 'Eroski',
                            cantidad: '',
                            disponible: true,
                            categoria: 'Homepage',
                        });
                    }
                });

                return items;
            })()
        `)

        for (const p of prods) {
            productos.push(p)
        }
        console.log(`[Eroski] ${prods.length} productos únicos extraídos`)

        console.log(`[Eroski] ${productos.length} productos totales`)
    } catch (err) {
        const msg = err instanceof Error ? err.message : String(err)
        errores.push(`Error general: ${msg}`)
        console.error('[Eroski] Error:', msg)
    } finally {
        if (browser) await browser.close()
    }

    return { productos, errores, duracion_ms: Date.now() - inicio }
}
