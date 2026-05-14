/**
 * bonpreu.ts — Scraper para Bonpreu/Esclat España
 *
 * Bonpreu y Esclat comparten la misma plataforma de compra online:
 * https://www.compraonline.bonpreuesclat.cat/
 *
 * Es una SPA construida con Next.js, con AWS WAF como protección.
 * No tiene API REST pública fácil de usar.
 * Estrategia: Playwright con navegador real, navegando por categorías
 * y extrayendo productos del DOM renderizado.
 *
 * Web: https://www.compraonline.bonpreuesclat.cat/
 */

import type { ScrapingConfig } from '../types'
import type { ProductoRaw } from '../types'
import { chromium } from 'playwright'

export const configBonpreu: ScrapingConfig = {
    supermercado: {
        id: '',
        nombre: 'Bonpreu',
        slug: 'bonpreu',
    },
    metodo: 'playwright',
    url_base: 'https://www.compraonline.bonpreuesclat.cat',
    rate_limit_ms: 1000,
    timeout_ms: 30000,
}

/* ─── Interfaces ─── */

interface BonpreuProductExtraido {
    nombre: string
    precio: number
    precioPorKg?: number
    url: string
    imagen: string
    marca?: string
    cantidad?: string
}

/* ─── Mapeo ─── */

function mapearProducto(p: BonpreuProductExtraido, categoria?: string): ProductoRaw {
    return {
        nombre: p.nombre,
        precio_actual: p.precio,
        precio_por_kg: p.precioPorKg,
        unidad: 'kg',
        url_producto: p.url,
        imagen_url: p.imagen || undefined,
        marca: p.marca || 'Bonpreu',
        cantidad: p.cantidad || undefined,
        disponible: true,
        categoria,
    }
}

/* ─── Lógica principal con Playwright ─── */

export async function scrapearBonpreu(): Promise<{
    productos: ProductoRaw[]
    errores: string[]
    duracion_ms: number
}> {
    const inicio = Date.now()
    const errores: string[] = []
    const productos: ProductoRaw[] = []
    let browser

    try {
        console.log('[Bonpreu] Lanzando navegador Playwright...')
        browser = await chromium.launch({
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

        // ── 1. Obtener categorías de alimentación ──
        console.log('[Bonpreu] Obteniendo categorías...')
        const categorias = await obtenerCategoriasAlimentacion(page)
        console.log(`[Bonpreu] ${categorias.length} categorías encontradas`)

        // Fallback: categorías predefinidas
        if (categorias.length === 0) {
            console.log('[Bonpreu] Usando categorías predefinidas...')
            const CATS_PREDEFINIDAS = [
                '/categories/carn-i-au',
                '/categories/peix-i-marisc',
                '/categories/fruita-i-verdura',
                '/categories/lactic-i-ous',
                '/categories/pa-i-pastisseria',
                '/categories/congelats',
                '/categories/despensa',
                '/categories/begudes',
                '/categories/oli-vinagre-i-salses',
                '/categories/conserves',
                '/categories/arros-pasta-i-llegums',
                '/categories/dolc-i-xocolata',
                '/categories/esmorzar-i-marmelada',
                '/categories/snacks-i-fruits-secs',
                '/categories/plats-preparats',
            ]
            for (const path of CATS_PREDEFINIDAS) {
                const name = path.split('/categories/').pop()?.replace(/-/g, ' ') || path
                categorias.push({ url: `https://www.compraonline.bonpreuesclat.cat${path}`, name })
            }
        }

        // ── 2. Scrapear cada categoría ──
        const maxCats = Math.min(categorias.length, 15)

        for (let i = 0; i < maxCats; i++) {
            const cat = categorias[i]
            console.log(`[Bonpreu] Categoría ${i + 1}/${maxCats}: ${cat.name}`)

            await new Promise(r => setTimeout(r, configBonpreu.rate_limit_ms))

            try {
                const prods = await scrapearCategoria(page, cat.url, cat.name)
                for (const p of prods) {
                    productos.push(mapearProducto(p, cat.name))
                }
                console.log(`[Bonpreu]   → ${prods.length} productos`)
            } catch (err) {
                const msg = err instanceof Error ? err.message : String(err)
                errores.push(`Error en categoría ${cat.name}: ${msg}`)
                console.warn(`[Bonpreu]   ❌ ${msg}`)
            }
        }

        console.log(`[Bonpreu] ${productos.length} productos totales`)
    } catch (err) {
        const msg = err instanceof Error ? err.message : String(err)
        errores.push(`Error general: ${msg}`)
        console.error('[Bonpreu] Error:', msg)
    } finally {
        if (browser) await browser.close()
    }

    return { productos, errores, duracion_ms: Date.now() - inicio }
}

/**
 * Obtiene categorías desde la página principal de Bonpreu/Esclat.
 */
async function obtenerCategoriasAlimentacion(
    page: import('playwright').Page
): Promise<{ url: string; name: string }[]> {
    try {
        await page.goto('https://www.compraonline.bonpreuesclat.cat/', {
            waitUntil: 'networkidle',
            timeout: configBonpreu.timeout_ms,
        }).catch(() => { })

        await page.waitForTimeout(5000)

        const cats = await page.evaluate(() => {
            const links: { url: string; name: string }[] = []
            const seen = new Set<string>()

            const anchors = document.querySelectorAll<HTMLAnchorElement>(
                'a[href*="/categories/"], ' +
                'nav a[href], ' +
                '[class*="category"] a[href], ' +
                '[class*="Category"] a[href], ' +
                '.menu-item a[href]'
            )

            anchors.forEach(a => {
                const href = a.href?.trim()
                const text = a.textContent?.trim()
                if (href && text && !seen.has(href) && text.length > 2 && !href.includes('#') && !href.includes('login')) {
                    seen.add(href)
                    links.push({ url: href, name: text })
                }
            })

            return links
        })

        return cats.filter(c => c.url.includes('/categories/'))
    } catch (err) {
        return []
    }
}

/**
 * Scrapea productos de una categoría de Bonpreu/Esclat.
 * La web es una SPA Next.js, los productos se renderizan con JavaScript.
 * Necesitamos esperar a que el contenido cargue completamente.
 */
async function scrapearCategoria(
    page: import('playwright').Page,
    url: string,
    categoria: string
): Promise<BonpreuProductExtraido[]> {
    await page.goto(url, {
        waitUntil: 'networkidle',
        timeout: configBonpreu.timeout_ms,
    }).catch(() => { })

    // Esperar a que la SPA renderice los productos
    await page.waitForTimeout(5000)

    // Esperar a que aparezcan las tarjetas de producto
    try {
        await page.waitForSelector('[class*="product-card"], [class*="ProductCard"], [class*="product"]', {
            timeout: 10000,
        }).catch(() => { })
    } catch {
        // Si no aparece, continuamos igual
    }

    // Scroll para trigger lazy loading
    await page.evaluate(async () => {
        const delay = (ms: number) => new Promise(r => setTimeout(r, ms))
        for (let i = 0; i < document.body.scrollHeight; i += 500) {
            window.scrollTo(0, i)
            await delay(500)
        }
    })

    await page.waitForTimeout(2000)

    // Extraer productos del DOM
    const prods = await page.evaluate(() => {
        const items: BonpreuProductExtraido[] = []

        const cards = document.querySelectorAll<HTMLElement>(
            '[class*="product-card"], ' +
            '[class*="ProductCard"], ' +
            '[class*="product-item"], ' +
            '[class*="product"], ' +
            'li[class*="product"], ' +
            'article, ' +
            '.grid-item, ' +
            '[data-testid*="product"]'
        )

        cards.forEach(card => {
            const nombreEl = card.querySelector<HTMLElement>(
                '[class*="product-name"], ' +
                '[class*="product-title"], ' +
                '[class*="name"], ' +
                'h3, h2, [class*="title"], ' +
                '[data-product-name]'
            )
            const precioEl = card.querySelector<HTMLElement>(
                '[class*="price"], ' +
                '.current-price, [class*="precio"], ' +
                '[data-price], [class*="offer-price"], ' +
                '[class*="Price"]'
            )
            const precioKgEl = card.querySelector<HTMLElement>(
                '[class*="unit-price"], ' +
                '[class*="price-per-kg"], ' +
                '[class*="base-price"], ' +
                '[class*="reference-price"], ' +
                '[class*="/kg"], [class*="per kg"]'
            )
            const urlEl = card.querySelector<HTMLAnchorElement>('a[href]')
            const imgEl = card.querySelector<HTMLImageElement>('img')
            const marcaEl = card.querySelector<HTMLElement>(
                '[class*="brand"], [data-brand], [class*="marca"], [class*="Brand"]'
            )
            const cantidadEl = card.querySelector<HTMLElement>(
                '[class*="quantity"], [class*="weight"], [class*="packaging"], ' +
                '[data-quantity], [class*="amount"], [class*="Size"], ' +
                '[class*="format"]'
            )

            const nombre = nombreEl?.textContent?.trim() || ''
            const precioTexto = precioEl?.textContent?.replace(/[^\d,]/g, '').replace(',', '.') || '0'
            const precio = parseFloat(precioTexto) || 0
            const precioKgTexto = precioKgEl?.textContent?.replace(/[^\d,]/g, '').replace(',', '.') || ''
            const precioKg = precioKgTexto ? parseFloat(precioKgTexto) : undefined

            let href = urlEl?.href || ''
            if (href && !href.startsWith('http')) {
                href = `https://www.compraonline.bonpreuesclat.cat${href}`
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
                })
            }
        })

        return items
    })

    return prods
}
