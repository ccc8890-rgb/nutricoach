/**
 * carrefour.ts — Scraper para Carrefour España
 *
 * Carrefour usa Cloudflare que bloquea cualquier fetch HTTP directo.
 * Estrategia: Playwright con navegador real para evitar Cloudflare,
 * e interceptar las peticiones API que hace el SPA.
 *
 * APIs internas detectadas (via cloud-api):
 * - Categorías: cloud-api/v1/categories/taxonomy/cat000000
 * - Productos: cloud-api/v1/categories/{id}/products
 * - Búsqueda: cloud-api/v1/search
 *
 * Web: https://www.carrefour.es/supermercado/
 */

import type { ScrapingConfig } from '../types'
import type { ProductoRaw } from '../types'
import { chromium } from 'playwright'

export const configCarrefour: ScrapingConfig = {
    supermercado: {
        id: '',
        nombre: 'Carrefour',
        slug: 'carrefour',
    },
    metodo: 'playwright',
    url_base: 'https://www.carrefour.es',
    rate_limit_ms: 1500,   // Carrefour es muy restrictivo, delays largos
    timeout_ms: 45000,      // Cloudflare a veces tarda en resolver
}

/* ─── Interfaces de respuesta detectadas ─── */

interface CarrefourTaxonomyCategory {
    id: string
    name: string
    children?: CarrefourTaxonomyCategory[]
    productCount?: number
    url?: string
}

interface CarrefourProduct {
    id: string
    name: string
    displayName?: string
    price: number
    pricePerKg?: number
    referencePrice?: string
    url: string
    image: string
    brand?: string
    packaging?: string
    available: boolean
}

/* ─── Mapeo ─── */

function mapearProducto(p: CarrefourProduct, categoria?: string): ProductoRaw {
    let precioPorKg: number | undefined

    if (p.pricePerKg) {
        precioPorKg = p.pricePerKg
    } else if (p.referencePrice) {
        const match = String(p.referencePrice).match(/(\d+[.,]\d+)/)
        if (match) {
            const val = parseFloat(match[1].replace(',', '.'))
            if (!isNaN(val)) precioPorKg = val
        }
    }

    const url = p.url?.startsWith('http')
        ? p.url
        : `https://www.carrefour.es${p.url || ''}`

    const imagen = p.image?.startsWith('http') ? p.image : undefined

    return {
        nombre: p.displayName || p.name || '',
        precio_actual: p.price || 0,
        precio_por_kg: precioPorKg,
        unidad: 'kg',
        url_producto: url,
        imagen_url: imagen,
        marca: p.brand || 'Carrefour',
        cantidad: p.packaging || '',
        disponible: p.available !== false,
        categoria,
    }
}

/* ─── Lógica principal con Playwright ─── */

/**
 * Scraper de Carrefour usando Playwright.
 *
 * Estrategia:
 * 1. Lanzar navegador headless (necesario para pasar Cloudflare)
 * 2. Navegar a supermercado y extraer categorías del DOM
 * 3. Para cada categoría, navegar y extraer productos con selectores
 * 4. Fallback: interceptar llamadas a cloud-api si están disponibles
 *
 * NOTA: Usamos page.evaluate con strings en vez de arrow functions
 * para evitar el error "__name is not defined" que causa tsx al
 * serializar funciones compiladas al contexto del navegador.
 */
export async function scrapearCarrefour(): Promise<{
    productos: ProductoRaw[]
    errores: string[]
    duracion_ms: number
}> {
    const inicio = Date.now()
    const errores: string[] = []
    const productos: ProductoRaw[] = []
    let browser

    try {
        console.log('[Carrefour] Lanzando navegador Playwright...')
        browser = await chromium.launch({
            headless: true,
            args: ['--no-sandbox', '--disable-setuid-sandbox'],
        })

        const context = await browser.newContext({
            userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
            viewport: { width: 1920, height: 1080 },
            locale: 'es-ES',
            extraHTTPHeaders: {
                'Accept-Language': 'es-ES,es;q=0.9',
            },
        })

        const page = await context.newPage()

        // ── 1. Navegar a supermercado ──
        console.log('[Carrefour] Navegando a supermercado...')
        try {
            await page.goto('https://www.carrefour.es/supermercado', {
                waitUntil: 'domcontentloaded',
                timeout: 30000,
            })
            console.log('[Carrefour] Página cargada:', await page.title())
        } catch (err) {
            console.warn('[Carrefour] Timeout en carga inicial, continuando...')
        }

        // Cloudflare tarda en resolver, esperamos a que el DOM cargue
        await page.waitForTimeout(8000)

        // ── 2. Extraer categorías de alimentación del nav ──
        console.log('[Carrefour] Extrayendo categorías del nav...')
        let categorias: { url: string; name: string }[] = []

        try {
            categorias = await page.evaluate(`
                (() => {
                    const links = [];
                    const seen = new Set();
                    // Buscar enlaces de navegación de categorías principales de supermercado
                    const navLinks = document.querySelectorAll(
                        '.nav-first-level-categories__list-element a, ' +
                        'nav a[href*="/supermercado/"], ' +
                        'a[href*="/supermercado/"][href*="/cat"]'
                    );
                    navLinks.forEach(a => {
                        const href = a.href && a.href.trim();
                        const text = a.textContent && a.textContent.trim();
                        // Solo categorías de alimentación (excluir droguería, mascotas, parafarmacia, bebé)
                        if (href && text && !seen.has(href) && !href.includes('#') && text.length > 2) {
                            const lower = text.toLowerCase();
                            if (lower.includes('fresco') || lower.includes('despensa') ||
                                lower.includes('bebida') || lower.includes('congelado') ||
                                lower.includes('lácteo') || lower.includes('huevo') ||
                                lower.includes('pan') || lower.includes('aceite')) {
                                seen.add(href);
                                links.push({ url: href, name: text });
                            }
                        }
                    });
                    return links;
                })()
            `)
        } catch (err) {
            const msg = err instanceof Error ? err.message : String(err)
            console.warn('[Carrefour] Error extrayendo categorías:', msg)
        }

        console.log(`[Carrefour] ${categorias.length} categorías encontradas en nav`)

        // ── 3. Fallback: categorías predefinidas con nuevo formato ──
        if (categorias.length === 0) {
            console.log('[Carrefour] Usando categorías predefinidas (nuevo formato)...')
            const CATS_PREDEFINIDAS: { url: string; name: string }[] = [
                { url: 'https://www.carrefour.es/supermercado/frescos/cat20002/c', name: 'Frescos' },
                { url: 'https://www.carrefour.es/supermercado/la-despensa/cat20001/c', name: 'La Despensa' },
                { url: 'https://www.carrefour.es/supermercado/bebidas/cat20003/c', name: 'Bebidas' },
                { url: 'https://www.carrefour.es/supermercado/congelados/cat21449123/c', name: 'Congelados' },
            ]
            categorias = CATS_PREDEFINIDAS
        }

        // ── 4. Extraer productos directamente del homepage ──
        // Carrefour carga TODAS las categorías en el homepage, evitando
        // los bloqueos de Cloudflare al navegar a URLs de categoría individual.
        // El homepage tiene ~444 product-card__parent con catalog="food".
        console.log('[Carrefour] Extrayendo productos del homepage...')

        try {
            const prods = await extraerProductosHomepage(page)
            for (const p of prods) {
                productos.push(p)
            }
            console.log(`[Carrefour]   → ${prods.length} productos desde homepage`)
        } catch (err) {
            const msg = err instanceof Error ? err.message : String(err)
            errores.push(`Error extrayendo homepage: ${msg}`)
            console.warn(`[Carrefour]   ❌ ${msg}`)
        }

        // ── 5. Intentar también Frescos (única categoría que no bloquea Cloudflare) ──
        // La primera navegación a categoría suele pasar Cloudflare
        if (categorias.length > 0) {
            const frescos = categorias.find(c => c.url.includes('cat20002'))
            if (frescos) {
                console.log('[Carrefour] Intentando categoría Frescos (primera navegación)...')
                await new Promise(r => setTimeout(r, configCarrefour.rate_limit_ms))
                try {
                    const prods = await extraerProductosDOM(page, frescos.url, frescos.name)
                    for (const p of prods) {
                        // Evitar duplicados con los del homepage (por nombre)
                        const yaExiste = productos.some(e => e.nombre === p.nombre)
                        if (!yaExiste) productos.push(p)
                    }
                    console.log(`[Carrefour]   → ${prods.length} adicionales de Frescos`)
                } catch (err) {
                    console.warn('[Carrefour]   Frescos saltado (posible Cloudflare):', err instanceof Error ? err.message : String(err))
                }
            }
        }

        console.log(`[Carrefour] ${productos.length} productos totales`)
    } catch (err) {
        const msg = err instanceof Error ? err.message : String(err)
        errores.push(`Error general: ${msg}`)
        console.error('[Carrefour] Error:', msg)
    } finally {
        if (browser) await browser.close()
    }

    return { productos, errores, duracion_ms: Date.now() - inicio }
}

/**
 * Extrae productos del homepage de Carrefour (donde aparecen todas las categorías).
 * Evita navegar a URLs individuales que Cloudflare bloquea.
 */
async function extraerProductosHomepage(
    page: import('playwright').Page
): Promise<ProductoRaw[]> {
    // Scroll rápido para trigger lazy loading
    await page.evaluate('window.scrollTo(0, document.body.scrollHeight * 0.3)')
    await page.waitForTimeout(800)
    await page.evaluate('window.scrollTo(0, document.body.scrollHeight * 0.6)')
    await page.waitForTimeout(800)
    await page.evaluate('window.scrollTo(0, document.body.scrollHeight)')
    await page.waitForTimeout(1500)

    // Extraer productos del DOM del homepage
    const prods = await page.evaluate<ProductoRaw[]>(`
        (() => {
            const items = [];
            const parents = document.querySelectorAll('.product-card__parent');
            const seen = new Set();

            parents.forEach(function(parent) {
                const appPrice = parent.getAttribute('app_price') || '';
                const appPricePerUnit = parent.getAttribute('app_price_per_unit') || '';
                const catalog = parent.getAttribute('catalog') || '';

                // Solo productos de alimentación
                if (catalog && catalog !== 'food') return;

                // Precio desde atributo app_price
                var precio = 0;
                var pm = appPrice.match(/(\\d+[.,]\\d+)/);
                if (pm) {
                    precio = parseFloat(pm[1].replace(',', '.'));
                }
                if (!precio || isNaN(precio)) {
                    var priceEl = parent.querySelector('.product-card__prices');
                    if (priceEl && priceEl.textContent) {
                        var m = priceEl.textContent.replace(/[^\\d,]/g, '').replace(',', '.');
                        precio = parseFloat(m) || 0;
                    }
                }

                // Precio por kg
                var precioKg;
                var km = appPricePerUnit.match(/(\\d+[.,]\\d+)/);
                if (km) {
                    precioKg = parseFloat(km[1].replace(',', '.'));
                }
                if (!precioKg) {
                    var kgEl = parent.querySelector('[class*="price-per-unit"]');
                    if (kgEl && kgEl.textContent) {
                        var m = kgEl.textContent.replace(/[^\\d,]/g, '').replace(',', '.');
                        precioKg = parseFloat(m) || undefined;
                    }
                }

                // Nombre desde h2.product-card__title (diagnóstico confirmó esta estructura)
                var titleEl = parent.querySelector('.product-card__title');
                var nombre = (titleEl && titleEl.textContent && titleEl.textContent.trim()) || '';

                // URL - buscar cualquier enlace dentro del card
                var link = parent.querySelector('a[href*="/supermercado/"]');
                var href = (link && link.getAttribute('href')) || '';
                if (href && !href.startsWith('http')) {
                    href = 'https://www.carrefour.es' + href;
                }

                // Imagen
                var img = parent.querySelector('img');
                var imagen = '';
                if (img) {
                    imagen = img.getAttribute('data-src') || img.getAttribute('src') || '';
                }

                // Categoría - intentar inferir del enlace
                var categoria = 'Homepage';
                if (href.indexOf('cat20002') !== -1) categoria = 'Frescos';
                else if (href.indexOf('cat20001') !== -1) categoria = 'Despensa';
                else if (href.indexOf('cat20003') !== -1) categoria = 'Bebidas';
                else if (href.indexOf('cat21449123') !== -1) categoria = 'Congelados';

                if (nombre && precio > 0 && !seen.has(nombre)) {
                    seen.add(nombre);
                    items.push({
                        nombre: nombre,
                        precio_actual: precio,
                        precio_por_kg: precioKg,
                        unidad: 'kg',
                        url_producto: href || '',
                        imagen_url: imagen,
                        marca: 'Carrefour',
                        cantidad: '',
                        disponible: true,
                        categoria: categoria,
                    });
                }
            });

            return items;
        })()
    `)

    return prods
}

/**
 * Extrae productos de una URL de categoría de Carrefour navegando a ella.
 * La primera navegación suele pasar Cloudflare; las siguientes no.
 */
async function extraerProductosDOM(
    page: import('playwright').Page,
    url: string,
    categoria: string
): Promise<ProductoRaw[]> {
    await page.goto(url, {
        waitUntil: 'domcontentloaded',
        timeout: configCarrefour.timeout_ms,
    }).catch(() => { })

    await page.waitForTimeout(3000)

    // Scroll
    await page.evaluate('window.scrollTo(0, document.body.scrollHeight * 0.3)')
    await page.waitForTimeout(800)
    await page.evaluate('window.scrollTo(0, document.body.scrollHeight * 0.6)')
    await page.waitForTimeout(800)
    await page.evaluate('window.scrollTo(0, document.body.scrollHeight)')
    await page.waitForTimeout(1000)

    const prods = await page.evaluate<ProductoRaw[]>(`
        (() => {
            var items = [];
            var seen = new Set();
            var parents = document.querySelectorAll('.product-card__parent');

            parents.forEach(function(parent) {
                var appPrice = parent.getAttribute('app_price') || '';
                var appPricePerUnit = parent.getAttribute('app_price_per_unit') || '';
                var catalog = parent.getAttribute('catalog') || '';

                if (catalog && catalog !== 'food') return;

                var precio = 0;
                var pm = appPrice.match(/(\\d+[.,]\\d+)/);
                if (pm) {
                    precio = parseFloat(pm[1].replace(',', '.'));
                }
                if (!precio || isNaN(precio)) {
                    var priceEl = parent.querySelector('.product-card__prices');
                    if (priceEl && priceEl.textContent) {
                        var m = priceEl.textContent.replace(/[^\\d,]/g, '').replace(',', '.');
                        precio = parseFloat(m) || 0;
                    }
                }

                var precioKg;
                var km = appPricePerUnit.match(/(\\d+[.,]\\d+)/);
                if (km) {
                    precioKg = parseFloat(km[1].replace(',', '.'));
                }
                if (!precioKg) {
                    var kgEl = parent.querySelector('[class*="price-per-unit"]');
                    if (kgEl && kgEl.textContent) {
                        var m = kgEl.textContent.replace(/[^\\d,]/g, '').replace(',', '.');
                        precioKg = parseFloat(m) || undefined;
                    }
                }

                var titleEl = parent.querySelector('.product-card__title');
                var nombre = (titleEl && titleEl.textContent && titleEl.textContent.trim()) || '';

                var link = parent.querySelector('a[href*="/supermercado/"]');
                var href = (link && link.getAttribute('href')) || '';
                if (href && !href.startsWith('http')) {
                    href = 'https://www.carrefour.es' + href;
                }

                var img = parent.querySelector('img');
                var imagen = '';
                if (img) {
                    imagen = img.getAttribute('data-src') || img.getAttribute('src') || '';
                }

                if (nombre && precio > 0 && !seen.has(nombre)) {
                    seen.add(nombre);
                    items.push({
                        nombre: nombre,
                        precio_actual: precio,
                        precio_por_kg: precioKg,
                        unidad: 'kg',
                        url_producto: href || '',
                        imagen_url: imagen,
                        marca: 'Carrefour',
                        cantidad: '',
                        disponible: true,
                        categoria: '${categoria.replace(/'/g, "\\'")}',
                    });
                }
            });

            return items;
        })()
    `)

    return prods
}
