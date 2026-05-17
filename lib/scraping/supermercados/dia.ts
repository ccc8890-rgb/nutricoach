/**
 * dia.ts — Scraper para Día España
 *
 * Día bloquea accesos directos con fetch (Access Denied).
 * Estrategia: Playwright con navegador real para evitar bloqueos,
 * navegando por categorías de alimentación y extrayendo productos del DOM.
 *
 * Web: https://www.dia.es/compra-online/
 */

import type { ScrapingConfig } from '../types'
import type { ProductoRaw } from '../types'
import { chromium } from 'playwright'

export const configDia: ScrapingConfig = {
    supermercado: {
        id: '',
        nombre: 'Día',
        slug: 'dia',
    },
    metodo: 'playwright',
    url_base: 'https://www.dia.es',
    rate_limit_ms: 1000,
    timeout_ms: 30000,
}

/* ─── Interfaces ─── */

interface DiaProductExtraido {
    nombre: string
    precio: number
    precioPorKg?: number
    url: string
    imagen: string
    marca?: string
    cantidad?: string
}

/* ─── Mapeo ─── */

function mapearProducto(p: DiaProductExtraido, categoria?: string): ProductoRaw {
    return {
        nombre: p.nombre,
        precio_actual: p.precio,
        precio_por_kg: p.precioPorKg,
        unidad: 'kg',
        url_producto: p.url,
        imagen_url: p.imagen || undefined,
        marca: p.marca || 'Día',
        cantidad: p.cantidad || undefined,
        disponible: true,
        categoria,
    }
}

/* ─── Lógica principal con Playwright ─── */

export async function scrapearDia(): Promise<{
    productos: ProductoRaw[]
    errores: string[]
    duracion_ms: number
}> {
    const inicio = Date.now()
    const errores: string[] = []
    const productos: ProductoRaw[] = []
    let browser

    try {
        console.log('[Día] Lanzando navegador Playwright...')
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

        // ── 1. Obtener categorías de alimentación ──
        console.log('[Día] Obteniendo categorías de alimentación...')
        const categorias = await obtenerCategoriasAlimentacion(page)
        console.log(`[Día] ${categorias.length} categorías de alimentación`)

        if (categorias.length === 0) {
            // Fallback: usar categorías predefinidas
            console.log('[Día] Usando categorías predefinidas...')
            const CATS_PREDEFINIDAS = [
                'https://www.dia.es/compra-online/alimentacion/c/AL00',
                'https://www.dia.es/compra-online/leches-y-postres/c/AL01',
                'https://www.dia.es/compra-online/huevos/c/AL02',
                'https://www.dia.es/compra-online/aceite/c/AL03',
                'https://www.dia.es/compra-online/arroz-pasta-legumbres/c/AL04',
                'https://www.dia.es/compra-online/pan-panaderia/c/AL05',
                'https://www.dia.es/compra-online/cereales-y-galletas/c/AL06',
                'https://www.dia.es/compra-online/chocolates-y-dulces/c/AL07',
                'https://www.dia.es/compra-online/conservas/c/AL08',
                'https://www.dia.es/compra-online/congelados/c/AL09',
                'https://www.dia.es/compra-online/bebidas/c/AL10',
                'https://www.dia.es/compra-online/salsas-especias/c/AL11',
                'https://www.dia.es/compra-online/frutos-secos/c/AL12',
            ]
            for (const url of CATS_PREDEFINIDAS) {
                const name = url.split('/c/').pop()?.replace(/-/g, ' ') || url
                categorias.push({ url, name })
            }
        }

        // ── 2. Scrapear cada categoría ──
        const maxCats = Math.min(categorias.length, 15)

        for (let i = 0; i < maxCats; i++) {
            const cat = categorias[i]
            console.log(`[Día] Categoría ${i + 1}/${maxCats}: ${cat.name}`)

            await new Promise(r => setTimeout(r, configDia.rate_limit_ms))

            try {
                const prods = await scrapearCategoria(page, cat.url, cat.name)
                for (const p of prods) {
                    productos.push(mapearProducto(p, cat.name))
                }
                console.log(`[Día]   → ${prods.length} productos`)
            } catch (err) {
                const msg = err instanceof Error ? err.message : String(err)
                errores.push(`Error en categoría ${cat.name}: ${msg}`)
                console.warn(`[Día]   ❌ ${msg}`)
            }
        }

        console.log(`[Día] ${productos.length} productos totales`)
    } catch (err) {
        const msg = err instanceof Error ? err.message : String(err)
        errores.push(`Error general: ${msg}`)
        console.error('[Día] Error:', msg)
    } finally {
        if (browser) await browser.close()
    }

    return { productos, errores, duracion_ms: Date.now() - inicio }
}

/**
 * Obtiene las URLs de categorías de alimentación desde la página principal.
 */
async function obtenerCategoriasAlimentacion(
    page: import('playwright').Page
): Promise<{ url: string; name: string }[]> {
    try {
        await page.goto('https://www.dia.es/compra-online/', {
            waitUntil: 'networkidle',
            timeout: configDia.timeout_ms,
        }).catch(() => { })

        await page.waitForTimeout(3000)

        const cats = await page.evaluate<{ url: string; name: string }[]>(`
            (() => {
                const links = [];
                const seen = new Set();

                const anchors = document.querySelectorAll(
                    'a[href*="/compra-online/"]:not([href*="login"]):not([href*="carrito"])'
                );

                anchors.forEach(a => {
                    const href = a.href?.trim();
                    const text = a.textContent?.trim();
                    if (href && text && !seen.has(href) && text.length > 3 && href.includes('/c/')) {
                        seen.add(href);
                        links.push({ url: href, name: text });
                    }
                });

                return links;
            })()
        `)

        return cats
    } catch (err) {
        return []
    }
}

/**
 * Scrapea productos de una categoría de Día.
 */
async function scrapearCategoria(
    page: import('playwright').Page,
    url: string,
    categoria: string
): Promise<DiaProductExtraido[]> {
    await page.goto(url, {
        waitUntil: 'networkidle',
        timeout: configDia.timeout_ms,
    }).catch(() => { })

    await page.waitForTimeout(3000)

    // Scroll para lazy loading
    await page.evaluate(`
        (async () => {
            const delay = (ms) => new Promise(r => setTimeout(r, ms));
            for (let i = 0; i < document.body.scrollHeight; i += 500) {
                window.scrollTo(0, i);
                await delay(400);
            }
        })()
    `)

    await page.waitForTimeout(1000)

    // Extraer productos del DOM
    const prods = await page.evaluate<{
        nombre: string; precio: number; precioPorKg?: number;
        url: string; imagen: string; marca?: string; cantidad?: string
    }[]>(`
        (() => {
            const items = [];

            const cards = document.querySelectorAll(
                'article[data-product], ' +
                '[class*="product-card"], ' +
                '[class*="product-item"], ' +
                'li[class*="product"], ' +
                '[data-testid*="product"], ' +
                '.product-grid [class*="item"]'
            );

            cards.forEach(card => {
                const nombreEl = card.querySelector(
                    '[class*="product-name"], ' +
                    '[class*="product-title"], ' +
                    '[class*="name"], ' +
                    'h3, h2, [class*="brand"] + [class*="name"]'
                );
                const precioEl = card.querySelector(
                    '[class*="price"], ' +
                    '.current-price, .offer-price, ' +
                    '[data-price], [class*="precio"]'
                );
                const precioKgEl = card.querySelector(
                    '[class*="unit-price"], ' +
                    '[class*="price-per-kg"], ' +
                    '[class*="base-price"], ' +
                    '[class*="reference"]'
                );
                const urlEl = card.querySelector('a[href]');
                const imgEl = card.querySelector('img');
                const marcaEl = card.querySelector(
                    '[class*="brand"], [data-brand], [class*="marca"]'
                );
                const cantidadEl = card.querySelector(
                    '[class*="quantity"], [class*="weight"], [class*="amount"], ' +
                    '[data-quantity], [class*="packaging"]'
                );

                const nombre = nombreEl?.textContent?.trim() || '';
                const precioTexto = precioEl?.textContent?.replace(/[^\d,]/g, '').replace(',', '.') || '0';
                const precio = parseFloat(precioTexto) || 0;
                const precioKgTexto = precioKgEl?.textContent?.replace(/[^\d,]/g, '').replace(',', '.') || '';
                const precioKg = precioKgTexto ? parseFloat(precioKgTexto) : undefined;

                let href = urlEl?.href || '';
                if (href && !href.startsWith('http')) {
                    href = 'https://www.dia.es' + href;
                }

                if (nombre && precio > 0) {
                    items.push({
                        nombre,
                        precio,
                        precioPorKg: precioKg,
                        url: href,
                        imagen: imgEl?.src || '',
                        marca: marcaEl?.textContent?.trim() || undefined,
                        cantidad: cantidadEl?.textContent?.trim() || undefined,
                    });
                }
            });

            return items;
        })()
    `)

    return prods
}
